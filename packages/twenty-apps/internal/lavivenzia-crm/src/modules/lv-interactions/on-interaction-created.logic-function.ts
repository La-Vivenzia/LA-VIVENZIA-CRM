import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/define';

import { FN_ON_INTERACTION_CREATED_ID } from 'src/constants/universal-identifiers';
import {
  INTERACTION_CHANNEL_LABELS,
  isInteractionChannel,
  isInteractionOutcome,
} from 'src/modules/lv-interactions/constants/interaction-vocabulary';
import { applyInteraction } from 'src/modules/lv-interactions/services/interaction-orchestrator';
import { createCoreApiInteractionPort } from 'src/modules/lv-interactions/services/core-api-interaction-port';
import {
  priorityOrDefault,
  type LeadPriority,
} from 'src/modules/lv-core/constants/lead-lifecycle';
import { isInboundInteraction } from 'src/modules/lv-interactions/constants/interaction-direction';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';
import { buildLeadRepliedNotification } from 'src/modules/lv-notifications/utils/build-notification';
import { createCoreApiSlaPort } from 'src/modules/lv-sla/services/core-api-sla-port';
import { evaluateTarget } from 'src/modules/lv-sla/services/sla-lifecycle';

// Fires on lvInteraction.created. Refreshes the lead's relationship summary,
// creates the follow-up task, and — for an INBOUND interaction — tells the
// lead's owner that the lead replied.
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
  direction?: string | null;
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

  // System side-effect: runs as the application, not as whoever triggered the
  // event. The default (delegated) token acts as the triggering person, whose
  // role usually cannot write history, notifications or other people's leads —
  // exactly the writes this function exists to make. The human-facing routes
  // stay delegated, so authorization still binds where a person is acting.
  const client = new CoreApiClient({ runAs: 'application' });
  const port = createCoreApiInteractionPort(client);

  // A back-dated entry keeps its stated time; a live one falls back to when the
  // row was written rather than to "now", so a retry cannot drift the timeline.
  const occurredAt =
    record.occurredAt ?? record.createdAt ?? new Date().toISOString();

  const leadResult = await client.query({
    lvLead: {
      __args: { filter: { id: { eq: record.leadId } } },
      name: true,
      ownerId: true,
      priority: true,
    },
  });

  const leadRow = (
    leadResult as {
      lvLead?: { name?: string; ownerId?: string | null; priority?: string | null };
    }
  ).lvLead;
  const leadName = leadRow?.name ?? 'this lead';

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

  // Lead reply: the owner is read from the lead, the actor from the event.
  // Someone logging an inbound message on their own lead is not told about
  // it — the service drops the actor as recipient.
  let replyNotified = 0;

  if (isInboundInteraction(record.direction) && leadRow?.ownerId) {
    const outcome = await dispatchNotifications({
      port: createCoreApiNotificationPort(client),
      intents: [
        buildLeadRepliedNotification({
          leadId: record.leadId,
          leadName,
          interactionId: record.id,
          channelLabel: INTERACTION_CHANNEL_LABELS[channel],
          ownerWorkspaceMemberId: leadRow.ownerId,
          priority: priorityOrDefault(leadRow.priority),
        }),
      ],
      sourceEvent: payload.name,
      actorWorkspaceMemberId: payload.workspaceMemberId ?? record.actorId ?? null,
    });

    replyNotified = outcome.created.length;
  }

  // A logged contact is what resolves the "first contact" and "follow-up"
  // SLAs. Re-evaluate now rather than waiting for the sweep; the engine reads
  // the interaction back from the workspace, so nothing here is trusted.
  const slaEvaluations = await evaluateTarget({
    port: createCoreApiSlaPort(client),
    leadId: record.leadId,
    now: new Date().toISOString(),
  });

  return {
    applied: outcomeResult.skippedReason === null,
    skippedReason: outcomeResult.skippedReason,
    replyNotified,
    slaResolved: slaEvaluations.filter((result) => result.after === 'RESOLVED' && result.transitionClaimed).length,
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
