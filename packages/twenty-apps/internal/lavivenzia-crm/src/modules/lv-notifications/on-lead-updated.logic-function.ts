import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';

import { FN_ON_LEAD_UPDATED_ID } from 'src/constants/universal-identifiers';
import { priorityOrDefault } from 'src/modules/lv-core/constants/lead-lifecycle';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { findMember } from 'src/modules/lv-notifications/services/member-lookup';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';
import { notificationsForOwnerChange } from 'src/modules/lv-notifications/utils/build-notification';
import { createCoreApiSlaPort } from 'src/modules/lv-sla/services/core-api-sla-port';
import { evaluateTarget, startSla } from 'src/modules/lv-sla/services/sla-lifecycle';
import { entersInterested, entersNewLeadContact } from 'src/modules/lv-sla/utils/sla-triggers';

// Fires on lvLead.updated. The ONE producer of LEAD_ASSIGNED / LEAD_REASSIGNED,
// and the lead-side SLA hook: starts the contact / follow-up clocks when the
// status enters NEW / INTERESTED, and re-evaluates open SLAs on every change
// so reassignment and resolution land immediately.
//
// Ownership changes through the assignment engine, a manual edit on the record
// page, or an API call. All three land here as the same database event, so the
// new owner is told exactly once whichever path was taken — and the actor
// (from the event, never the body) is credited or, if they assigned the lead to
// themselves, not notified at all.

type LeadRow = {
  id: string;
  name?: string | null;
  ownerId?: string | null;
  status?: string | null;
  priority?: string | null;
  updatedAt?: string | null;
};

export type OwnerChangeEvent = DatabaseEventPayload<ObjectRecordUpdateEvent<LeadRow>>;

export const ownerChangeFromEvent = (
  payload: OwnerChangeEvent,
): {
  leadId: string;
  leadName: string;
  previousOwnerWorkspaceMemberId: string | null;
  newOwnerWorkspaceMemberId: string | null;
  priority: ReturnType<typeof priorityOrDefault>;
  changedAt: string;
  actorWorkspaceMemberId: string | null;
} | null => {
  const after = payload.properties.after;
  const before = payload.properties.before;

  if (!after?.id) {
    return null;
  }

  const previous = before?.ownerId ?? null;
  const next = after.ownerId ?? null;

  if (previous === next) {
    return null;
  }

  return {
    leadId: after.id,
    leadName: after.name ?? 'this lead',
    previousOwnerWorkspaceMemberId: previous,
    newOwnerWorkspaceMemberId: next,
    priority: priorityOrDefault(after.priority),
    // The row's own timestamp: identical on a replay, different on the next
    // change — which is exactly what the dedupe key needs.
    changedAt: after.updatedAt ?? new Date(0).toISOString(),
    actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
  };
};

// The lead-side SLA work for one update: start clocks the status change
// warrants, then re-evaluate every open SLA on the lead (owner change ->
// reassignment, status change / closure -> resolution).
export const applyLeadSlaHooks = async ({
  client,
  payload,
  now,
}: {
  client: CoreApiClient;
  payload: OwnerChangeEvent;
  now: string;
}): Promise<{ started: string[]; evaluated: number }> => {
  const after = payload.properties.after;
  const before = payload.properties.before;

  if (!after?.id) {
    return { started: [], evaluated: 0 };
  }

  const port = createCoreApiSlaPort(client);
  const started: string[] = [];
  const common = {
    port,
    subjectName: after.name ?? 'this lead',
    priority: priorityOrDefault(after.priority),
    ownerWorkspaceMemberId: after.ownerId ?? null,
    target: { object: 'lvLead' as const, recordId: after.id },
    leadId: after.id,
    onboardingId: null,
    documentId: null,
    startedAt: after.updatedAt ?? now,
    sourceEvent: payload.name,
    actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
  };

  if (entersNewLeadContact(before?.status, after.status)) {
    const outcome = await startSla({ ...common, rule: 'NEW_LEAD_CONTACT' });

    started.push(`NEW_LEAD_CONTACT:${outcome.outcome}`);
  }

  if (entersInterested(before?.status, after.status)) {
    const outcome = await startSla({ ...common, rule: 'INTERESTED_FOLLOW_UP' });

    started.push(`INTERESTED_FOLLOW_UP:${outcome.outcome}`);
  }

  const results = await evaluateTarget({ port, leadId: after.id, now });

  return { started, evaluated: results.length };
};

export const handler = async (payload: OwnerChangeEvent): Promise<Record<string, unknown>> => {
  // Writes a notification for someone other than the actor, so it needs the
  // application role — the delegated token would carry the actor's own
  // permissions, which do not include other people's notifications.
  const client = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const slaHooks = await applyLeadSlaHooks({ client, payload, now });
  const change = ownerChangeFromEvent(payload);

  if (change === null) {
    return { notified: 0, reason: 'Owner unchanged.', sla: slaHooks };
  }

  const actor = await findMember(client, change.actorWorkspaceMemberId);

  const intents = notificationsForOwnerChange({
    leadId: change.leadId,
    leadName: change.leadName,
    previousOwnerWorkspaceMemberId: change.previousOwnerWorkspaceMemberId,
    newOwnerWorkspaceMemberId: change.newOwnerWorkspaceMemberId,
    // A member with no name on their profile is still a person, not the
    // engine — "automatically" would misattribute a human decision.
    assignedByName: actor === null ? null : (actor.displayName ?? 'a team member'),
    priority: change.priority,
    changedAt: change.changedAt,
  });

  const outcome = await dispatchNotifications({
    port: createCoreApiNotificationPort(client),
    intents,
    sourceEvent: payload.name,
    actorWorkspaceMemberId: change.actorWorkspaceMemberId,
  });

  return {
    notified: outcome.created.length,
    duplicates: outcome.duplicates.length,
    suppressed: outcome.suppressed,
    newOwnerWorkspaceMemberId: change.newOwnerWorkspaceMemberId,
    sla: slaHooks,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_LEAD_UPDATED_ID,
  name: 'lv-on-lead-updated',
  description:
    'Notifies the new owner when a lead is assigned or reassigned, whichever path changed the owner',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvLead.updated' },
});
