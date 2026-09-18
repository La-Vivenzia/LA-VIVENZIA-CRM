import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_REVIEW_DOCUMENT_ID } from 'src/constants/universal-identifiers';
import {
  DOCUMENT_VERIFICATION_FLAGS,
  isDocumentVerificationState,
  type DocumentVerificationFlag,
  type DocumentVerificationState,
} from 'src/modules/lv-onboarding/constants/document-verification';
import { createCoreApiDocumentPort } from 'src/modules/lv-onboarding/services/core-api-document-port';
import { transitionDocument } from 'src/modules/lv-onboarding/utils/transition-document';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';

// The reviewer's document endpoint: mark under review, verify, reject, or ask
// for a replacement.
//
// Until now transitionDocument was reachable only from its own unit test. This
// is the execution path that makes it real. The guards are not re-implemented
// here — the state machine owns them, so a direct API call meets exactly the
// same rules the UI does, including "a verification decision requires a named
// human" and "a rejection requires a written reason".

type ReviewInput = {
  documentId?: string;
  to?: string;
  reason?: string | null;
  flags?: string[];
  // The reviewer accountable for this decision. The state machine refuses the
  // human-only outcomes without it, whatever the caller claims.
  actorWorkspaceMemberId?: string | null;
};

const asFlags = (input: string[] | undefined): DocumentVerificationFlag[] =>
  (input ?? []).filter((flag): flag is DocumentVerificationFlag =>
    (DOCUMENT_VERIFICATION_FLAGS as readonly string[]).includes(flag),
  );

export const handler = async (
  event: unknown,
): Promise<Record<string, unknown>> => {
  // isAuthRequired rejects anonymous callers before this runs. A null
  // userWorkspaceId therefore means an authenticated non-human caller (an API
  // key or integration), which is recorded rather than refused — the human-only
  // rule is enforced by the state machine’s actor requirement, not here.
  // The actor is the platform-authenticated member, never a body field.
  const { input, userWorkspaceId, actorWorkspaceMemberId } =
    readRouteInput<ReviewInput>(event);

  const { documentId, to } = input;

  if (!documentId) {
    return { ok: false, error: 'documentId is required.' };
  }

  if (!to || !isDocumentVerificationState(to)) {
    return { ok: false, error: `"${to}" is not a known verification state.` };
  }

  const client = new CoreApiClient();
  const port = createCoreApiDocumentPort(client);

  const document = await port.getDocument(documentId);

  if (!document) {
    return { ok: false, error: 'That document does not exist.' };
  }

  // Reviewer entitlement: only the reviewer assigned to this document's
  // onboarding may decide on it. Record scoping (CM-004) already hides other
  // reviewers' documents from scoped roles; this makes the rule explicit and
  // covers unscoped roles that can read the row but must not judge it.
  if (document.onboardingId !== null) {
    const parent = await client.query({
      lvOnboarding: {
        __args: { filter: { id: { eq: document.onboardingId } } },
        reviewerId: true,
      },
    });
    const assignedReviewer =
      (parent as { lvOnboarding?: { reviewerId?: string | null } }).lvOnboarding
        ?.reviewerId ?? null;

    if (assignedReviewer !== null && assignedReviewer !== actorWorkspaceMemberId) {
      return {
        ok: false,
        refusal: 'NOT_THE_REVIEWER',
        error: 'Only the assigned reviewer can decide on this document.',
      };
    }
  }

  const at = new Date().toISOString();
  const flags = asFlags(input.flags);

  const result = transitionDocument({
    from: document.verificationState,
    to: to as DocumentVerificationState,
    at,
    actorWorkspaceMemberId,
    reason: input.reason ?? null,
    flags,
  });

  if (!result.ok) {
    return { ok: false, refusal: result.refusal, error: result.message };
  }

  await port.applyDocumentState({
    documentId,
    state: result.state,
    reviewerWorkspaceMemberId: actorWorkspaceMemberId,
    rejectionReason:
      result.state === 'REJECTED' || result.state === 'NEEDS_REPLACEMENT'
        ? (input.reason ?? null)
        : null,
    verificationFlags: flags,
    // Only a verification stamps a verifiedAt. Moving away from VERIFIED
    // clears it, so the timestamp always describes the current state.
    verifiedAt: result.state === 'VERIFIED' ? at : null,
    existingAudit: document.auditTrail,
    audit: { ...result.audit, authenticatedUserWorkspaceId: userWorkspaceId },
  });

  return {
    ok: true,
    documentId,
    from: document.verificationState,
    state: result.state,
    reviewerWorkspaceMemberId: actorWorkspaceMemberId,
    at,
    flags,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_REVIEW_DOCUMENT_ID,
  name: 'lv-review-document',
  description:
    'Applies a reviewer decision to an onboarding document through the verification state machine, with an append-only audit entry',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/onboarding/documents/review',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
