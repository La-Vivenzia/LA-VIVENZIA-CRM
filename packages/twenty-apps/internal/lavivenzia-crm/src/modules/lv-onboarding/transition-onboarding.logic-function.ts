import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_ON_ONBOARDING_STATUS_ID } from 'src/constants/universal-identifiers';
import { isOnboardingStatus } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { applyOnboardingTransition } from 'src/modules/lv-onboarding/services/onboarding-orchestrator';
import { createCoreApiOnboardingPort } from 'src/modules/lv-onboarding/services/core-api-onboarding-port';

// The reviewer's approve / reject / request-changes endpoint.
//
// Deliberately server-side. The reviewer UI already hides actions the machine
// would refuse, but SECURITY-RBAC.md is explicit that UI filtering is never the
// protection — a direct API call meets exactly the same guards, including
// "approval requires a human actor" and "every document must be verified".

type TransitionInput = {
  onboardingId?: string;
  to?: string;
  reason?: string | null;
  note?: string | null;
  // The team member performing the action. Required for approve / reject /
  // request-changes / activate; the orchestrator refuses without it.
  actorWorkspaceMemberId?: string | null;
  reviewerWorkspaceMemberId?: string | null;
};

export const handler = async (
  input: TransitionInput,
): Promise<Record<string, unknown>> => {
  const { onboardingId, to } = input;

  if (!onboardingId) {
    return { ok: false, error: 'onboardingId is required.' };
  }

  if (!to || !isOnboardingStatus(to)) {
    return { ok: false, error: `"${to}" is not a known onboarding status.` };
  }

  const port = createCoreApiOnboardingPort(new CoreApiClient());

  const result = await applyOnboardingTransition({
    onboardingId,
    to,
    at: new Date().toISOString(),
    port,
    actorWorkspaceMemberId: input.actorWorkspaceMemberId ?? null,
    reason: input.reason ?? null,
    note: input.note ?? null,
    reviewerWorkspaceMemberId: input.reviewerWorkspaceMemberId ?? null,
  });

  if (!result.ok) {
    return { ok: false, refusal: result.refusal, error: result.message };
  }

  return { ok: true, status: result.status, audit: result.audit };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_ONBOARDING_STATUS_ID,
  name: 'lv-transition-onboarding',
  description:
    'Applies a partner onboarding status change with server-side approval guards and an append-only audit entry',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/onboarding/transition',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
