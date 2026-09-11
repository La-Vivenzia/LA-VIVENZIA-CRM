import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';

import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { findMember } from 'src/modules/lv-notifications/services/member-lookup';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';
import { buildMentionNotification } from 'src/modules/lv-notifications/utils/build-notification';
import {
  extractMentionedWorkspaceMemberIds,
  newlyMentioned,
} from 'src/modules/lv-notifications/utils/mentions';

// Shared handler for note.created and note.updated (one trigger per logic
// function, so two thin functions call this). A mention is Twenty's own
// @-mention of a workspace member in the note body; LV adds no syntax.

type NoteRow = {
  id: string;
  title?: string | null;
  bodyV2?: { blocknote?: string | null; markdown?: string | null } | null;
  createdBy?: { workspaceMemberId?: string | null; name?: string | null } | null;
};

export type NoteEvent =
  | DatabaseEventPayload<ObjectRecordCreateEvent<NoteRow>>
  | DatabaseEventPayload<ObjectRecordUpdateEvent<NoteRow>>;

export const mentionsFromNoteEvent = (payload: NoteEvent): {
  noteId: string;
  noteTitle: string;
  mentioned: string[];
  actorWorkspaceMemberId: string | null;
} | null => {
  const after = payload.properties.after;

  if (!after?.id) {
    return null;
  }

  const before = 'before' in payload.properties ? payload.properties.before : undefined;

  const mentionedBefore = extractMentionedWorkspaceMemberIds({
    blocknote: before?.bodyV2?.blocknote ?? null,
  });
  const mentionedAfter = extractMentionedWorkspaceMemberIds({
    blocknote: after.bodyV2?.blocknote ?? null,
  });

  return {
    noteId: after.id,
    noteTitle: after.title ?? '',
    mentioned: newlyMentioned(mentionedBefore, mentionedAfter),
    // The person saving the note, from the event context; the note's own
    // createdBy is the fallback for a create with no session (import, API).
    actorWorkspaceMemberId:
      payload.workspaceMemberId ?? after.createdBy?.workspaceMemberId ?? null,
  };
};

export const handleNoteMentions = async (payload: NoteEvent): Promise<Record<string, unknown>> => {
  const parsed = mentionsFromNoteEvent(payload);

  if (parsed === null) {
    return { notified: 0, reason: 'No record.' };
  }

  if (parsed.mentioned.length === 0) {
    return { notified: 0, reason: 'No new workspace-member mentions.' };
  }

  const client = new CoreApiClient({ runAs: 'application' });
  const author = await findMember(client, parsed.actorWorkspaceMemberId);

  // The lead the note is attached to, if any — populates the relation so the
  // centre can say which partner the conversation is about.
  const targets = await client.query({
    noteTargets: {
      __args: { filter: { noteId: { eq: parsed.noteId } }, first: 10 },
      edges: { node: { targetLvLeadId: true } },
    },
  });
  const leadId =
    (targets as { noteTargets?: { edges?: { node?: { targetLvLeadId?: string | null } }[] } })
      .noteTargets?.edges?.map((edge) => edge.node?.targetLvLeadId)
      .find((id): id is string => typeof id === 'string') ?? null;

  const intents = parsed.mentioned.map((memberId) =>
    buildMentionNotification({
      noteId: parsed.noteId,
      noteTitle: parsed.noteTitle,
      mentionedWorkspaceMemberId: memberId,
      authorName: author?.displayName ?? null,
      leadId,
    }),
  );

  const outcome = await dispatchNotifications({
    port: createCoreApiNotificationPort(client),
    intents,
    sourceEvent: payload.name,
    actorWorkspaceMemberId: parsed.actorWorkspaceMemberId,
  });

  return {
    notified: outcome.created.length,
    duplicates: outcome.duplicates.length,
    suppressed: outcome.suppressed,
  };
};
