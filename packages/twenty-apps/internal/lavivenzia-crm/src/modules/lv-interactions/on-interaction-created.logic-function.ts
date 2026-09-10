import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/define';

import { FN_ON_INTERACTION_CREATED_ID } from 'src/constants/universal-identifiers';
import {
  isInteractionChannel,
  isInteractionOutcome,
} from 'src/modules/lv-interactions/constants/interaction-vocabulary';
import { applyInteraction } from 'src/modules/lv-interactions/services/interaction-orchestrator';
import { createCoreApiInteractionPort } from 'src/modules/lv-interactions/services/core-api-interaction-port';
import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// Fires on lvInteraction.created. Refreshes the lead's relationship summary and
// creates the follow-up task.
//
// The timeline entry is NOT written here — the lvInteractionLogged timeline
// activity type emits it declaratively through the lead relation, so Twenty
// owns the history exactly as it does for its own objects.

type InteractionRow = {
  id: string;
  leadId?: string | null;
  channel?: string | null;
  occurredAt?: string | null;
  outcome?: string | null;
  nextAction?: string | null;
  nextFollowUpAt?: string | null;
  actorId?: string | null;
  createdAt?: string | null;
};

export const handler = async (
  payload: DatabaseEventPayload<ObjectRecordCreateEvent<InteractionRow>>,
): Promise<Record<string, unknown>> => {
  const record = payload.properties.after;

  if (!record?.id || !record.leadId) {
    return { applied: false, reason: 'Interaction is not attached to a lead.' };
  }

  const channel =
    record.channel && isInteractionChannel(record.channel) ? record.channel : 'PHONE';

  const outcome =
    record.outcome && isInteractionOutcome(record.outcome) ? record.outcome : null;

  const client = new CoreApiClient();
  const port = createCoreApiInteractionPort(client);

  // A back-dated entry keeps its stated time; a live one falls back to when the
  // row was written rather than to "now", so a retry cannot drift the timeline.
  const occurredAt =
    record.occurredAt ?? record.createdAt ?? new Date().toISOString();

  const leadNameResult = await client.query({
    lvLead: {
      __args: { filter: { id: { eq: record.leadId } } },
      name: true,
    },
  });

  const leadName =
    (leadNameResult as { lvLead?: { name?: string } }).lvLead?.name ?? 'this lead';

  const outcomeResult = await applyInteraction({
    interaction: {
      id: record.id,
      leadId: record.leadId,
      leadName,
      channel,
      occurredAt,
      outcome,
      nextAction: record.nextAction ?? null,
      nextFollowUpAt: record.nextFollowUpAt ?? null,
      priority: null as LeadPriority | null,
      actorWorkspaceMemberId: record.actorId ?? null,
    },
    port,
  });

  return {
    applied: outcomeResult.skippedReason === null,
    skippedReason: outcomeResult.skippedReason,
    followUpTaskId: outcomeResult.followUpTaskId,
    followUpDueAt: outcomeResult.followUp?.dueAt ?? null,
    followUpPriority: outcomeResult.followUp?.priority ?? null,
    leadPatch: outcomeResult.leadPatch,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_INTERACTION_CREATED_ID,
  name: 'lv-on-interaction-created',
  description:
    'Refreshes the lead relationship summary and creates the follow-up task for a logged interaction',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvInteraction.created' },
});
