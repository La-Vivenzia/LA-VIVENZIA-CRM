import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_ON_ONBOARDING_STATUS_ID } from 'src/constants/universal-identifiers';
import { isOnboardingStatus } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { applyOnboardingTransition } from 'src/modules/lv-onboarding/services/onboarding-orchestrator';
import { createCoreApiOnboardingPort } from 'src/modules/lv-onboarding/services/core-api-onboarding-port';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';

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
  event: unknown,
): Promise<Record<string, unknown>> => {
  // This route read its arguments off the event envelope rather than the body,
  // so every field was undefined. It was never called before now, which is why
  // nothing surfaced it.
  // isAuthRequired rejects anonymous callers before this runs. A null
  // userWorkspaceId therefore means an authenticated non-human caller (an API
  // key or integration), which is recorded rather than refused — the human-only
  // rule is enforced by the state machine’s actor requirement, not here.
  // The actor is the workspace member the platform authenticated — never a
  // value from the body. A body may still carry actorWorkspaceMemberId or
  // reviewerWorkspaceMemberId from older clients; both are ignored for
  // identity. The client requests an action; the server decides who did it.
  const { input, userWorkspaceId, actorWorkspaceMemberId } =
    readRouteInput<TransitionInput>(event);

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
    actorWorkspaceMemberId,
    reason: input.reason ?? null,
    note: input.note ?? null,
    // Only honoured when the record has no reviewer yet (see orchestrator);
    // it can propose the authenticated actor, never a third party.
    reviewerWorkspaceMemberId: actorWorkspaceMemberId,
  });

  if (!result.ok) {
    return { ok: false, refusal: result.refusal, error: result.message };
  }

  return {
    ok: true,
    status: result.status,
    // The session the platform authenticated, recorded beside the claimed
    // actor so an approval can be traced to a real sign-in.
    audit: { ...result.audit, authenticatedUserWorkspaceId: userWorkspaceId },
  };
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
