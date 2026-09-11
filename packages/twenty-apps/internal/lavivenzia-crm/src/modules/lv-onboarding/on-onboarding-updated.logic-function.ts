import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';

import { FN_ON_ONBOARDING_UPDATED_ID } from 'src/constants/universal-identifiers';
import { priorityOrDefault } from 'src/modules/lv-core/constants/lead-lifecycle';
import { isOnboardingStatus } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { findLead } from 'src/modules/lv-notifications/services/member-lookup';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';
import { notificationsForOnboardingStatus } from 'src/modules/lv-notifications/utils/build-notification';
import { createCoreApiSlaPort } from 'src/modules/lv-sla/services/core-api-sla-port';
import { evaluateTarget, startSla } from 'src/modules/lv-sla/services/sla-lifecycle';
import { entersOnboardingInitiated } from 'src/modules/lv-sla/utils/sla-triggers';

// Reacts to an onboarding status change: mirrors the status onto the lead and
// notifies the people the change concerns.
//
// Why a database event rather than the transition route doing it: routes run
// with the caller's own permissions, and a reviewer — correctly — cannot write
// leads or other people's notifications. This function runs as the
// application role, triggered by the update the route already made. Both
// writes are idempotent: the lead sync is same-in-same-out, and the
// notifications are keyed on the record's updatedAt.

type OnboardingRow = {
  id: string;
  name?: string | null;
  leadId?: string | null;
  status?: string | null;
  reviewerId?: string | null;
  updatedAt?: string | null;
};

export const handler = async (
  payload: DatabaseEventPayload<ObjectRecordUpdateEvent<OnboardingRow>>,
): Promise<Record<string, unknown>> => {
  const after = payload.properties.after;
  const before = payload.properties.before;

  if (!after?.id) {
    return { synced: false, notified: 0, reason: 'No record.' };
  }

  if (!after.status || !isOnboardingStatus(after.status)) {
    return { synced: false, notified: 0, reason: 'No recognisable status on the record.' };
  }

  const client = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const slaPort = createCoreApiSlaPort(client);

  // Every update re-evaluates the onboarding's open SLAs (a reviewer change is
  // a reassignment; a status change may resolve the first-action clock or
  // close the missing-document clocks). Only a status change goes further.
  const slaEvaluated = (await evaluateTarget({ port: slaPort, onboardingId: after.id, now })).length;

  // Only act on a status change. Every other update to an onboarding (answers,
  // progress, reviewer) would otherwise re-write the lead for nothing.
  if (before?.status === after.status) {
    return { synced: false, notified: 0, reason: 'Status unchanged.', slaEvaluated };
  }

  const lead = await findLead(client, after.leadId);

  // SLA rule 3 — onboarding first action, owned by the reviewer.
  let slaStarted: string | null = null;

  if (entersOnboardingInitiated(before?.status, after.status)) {
    const outcome = await startSla({
      port: slaPort,
      rule: 'ONBOARDING_FIRST_ACTION',
      subjectName: after.name ?? lead?.name ?? 'Partner onboarding',
      priority: priorityOrDefault(lead?.priority),
      ownerWorkspaceMemberId: after.reviewerId ?? null,
      target: { object: 'lvOnboarding', recordId: after.id },
      leadId: lead?.id ?? null,
      onboardingId: after.id,
      documentId: null,
      startedAt: after.updatedAt ?? now,
      sourceEvent: payload.name,
      actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
    });

    slaStarted = outcome.outcome;
  }

  let synced = false;

  if (lead !== null) {
    await client.mutation({
      updateLvLead: {
        __args: { id: lead.id, data: { onboardingStatus: after.status } },
        id: true,
      },
    });
    synced = true;
  }

  const intents = notificationsForOnboardingStatus({
    onboardingId: after.id,
    onboardingName: after.name ?? lead?.name ?? 'Partner onboarding',
    status: after.status,
    changedAt: after.updatedAt ?? new Date(0).toISOString(),
    reviewerWorkspaceMemberId: after.reviewerId ?? null,
    leadId: lead?.id ?? null,
    leadOwnerWorkspaceMemberId: lead?.ownerWorkspaceMemberId ?? null,
  });

  const outcome = await dispatchNotifications({
    port: createCoreApiNotificationPort(client),
    intents,
    sourceEvent: payload.name,
    // The person who made the transition, from the event — never the body.
    actorWorkspaceMemberId: payload.workspaceMemberId ?? null,
  });

  return {
    synced,
    leadId: lead?.id ?? null,
    status: after.status,
    notified: outcome.created.length,
    duplicates: outcome.duplicates.length,
    suppressed: outcome.suppressed,
    slaEvaluated,
    slaStarted,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_ONBOARDING_UPDATED_ID,
  name: 'lv-on-onboarding-updated',
  description:
    'Mirrors an onboarding status change onto its lead and notifies the reviewer and lead owner, running as the application role',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvOnboarding.updated' },
});
