import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordUpdateEvent,
} from 'twenty-sdk/define';

import { FN_ON_ONBOARDING_UPDATED_ID } from 'src/constants/universal-identifiers';
import { isOnboardingStatus } from 'src/modules/lv-onboarding/constants/onboarding-status';

// Mirrors an onboarding's status onto its lead.
//
// Why a database event rather than the transition route doing it: routes run
// with the caller's own permissions, and a reviewer — correctly — cannot write
// leads. Trying to sync from inside the route therefore failed for exactly the
// people who approve onboardings. This function runs as the application role,
// which can write the lead, and is triggered by the update the route already
// made. The write is idempotent (same status in, same status out), so the
// route's own best-effort sync and this one never conflict.

type OnboardingRow = {
  id: string;
  leadId?: string | null;
  status?: string | null;
};

export const handler = async (
  payload: DatabaseEventPayload<ObjectRecordUpdateEvent<OnboardingRow>>,
): Promise<Record<string, unknown>> => {
  const after = payload.properties.after;
  const before = payload.properties.before;

  if (!after?.id || !after.leadId) {
    return { synced: false, reason: 'Onboarding is not attached to a lead.' };
  }

  if (!after.status || !isOnboardingStatus(after.status)) {
    return { synced: false, reason: 'No recognisable status on the record.' };
  }

  // Only act on a status change. Every other update to an onboarding (answers,
  // progress, reviewer) would otherwise re-write the lead for nothing.
  if (before?.status === after.status) {
    return { synced: false, reason: 'Status unchanged.' };
  }

  // System side-effect: runs as the application, not as whoever triggered the
  // event. The default (delegated) token acts as the triggering person, whose
  // role usually cannot write history, notifications or other people's leads —
  // exactly the writes this function exists to make. The human-facing routes
  // stay delegated, so authorization still binds where a person is acting.
  const client = new CoreApiClient({ runAs: 'application' });

  await client.mutation({
    updateLvLead: {
      __args: { id: after.leadId, data: { onboardingStatus: after.status } },
      id: true,
    },
  });

  return { synced: true, leadId: after.leadId, status: after.status };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_ONBOARDING_UPDATED_ID,
  name: 'lv-on-onboarding-updated',
  description:
    'Mirrors an onboarding status change onto its lead, running as the application role so it works regardless of who made the change',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvOnboarding.updated' },
});
