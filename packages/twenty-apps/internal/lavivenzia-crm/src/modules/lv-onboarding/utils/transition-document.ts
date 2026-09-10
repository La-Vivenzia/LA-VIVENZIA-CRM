import {
  canTransitionDocument,
  DOCUMENT_REASON_REQUIRED_STATES,
  DOCUMENT_VERIFICATION_STATE_LABELS,
  flagRequiresReplacement,
  HUMAN_ONLY_DOCUMENT_STATES,
  type DocumentVerificationFlag,
  type DocumentVerificationState,
} from 'src/modules/lv-onboarding/constants/document-verification';

// Document verification state machine, with the same discipline as the
// onboarding machine: typed refusals, human-only outcomes enforced here rather
// than by convention, and an append-only audit entry on every change.

export type DocumentRefusal =
  | 'NOT_ALLOWED'
  | 'ACTOR_REQUIRED'
  | 'REASON_REQUIRED'
  | 'FLAGS_REQUIRED';

export type DocumentAuditEntry = {
  from: DocumentVerificationState;
  to: DocumentVerificationState;
  at: string;
  actorWorkspaceMemberId: string | null;
  reason: string | null;
  flags: readonly DocumentVerificationFlag[];
};

export type DocumentTransitionRequest = {
  from: DocumentVerificationState;
  to: DocumentVerificationState;
  at: string;
  actorWorkspaceMemberId?: string | null;
  reason?: string | null;
  flags?: readonly DocumentVerificationFlag[];
};

export type DocumentTransitionResult =
  | {
      ok: true;
      state: DocumentVerificationState;
      audit: DocumentAuditEntry;
    }
  | { ok: false; refusal: DocumentRefusal; message: string };

const refuse = (
  refusal: DocumentRefusal,
  message: string,
): DocumentTransitionResult => ({ ok: false, refusal, message });

export const transitionDocument = (
  request: DocumentTransitionRequest,
): DocumentTransitionResult => {
  const {
    from,
    to,
    at,
    actorWorkspaceMemberId = null,
    reason = null,
    flags = [],
  } = request;

  if (!canTransitionDocument(from, to)) {
    return refuse(
      'NOT_ALLOWED',
      `A document cannot move from ${DOCUMENT_VERIFICATION_STATE_LABELS[from]} to ${DOCUMENT_VERIFICATION_STATE_LABELS[to]}.`,
    );
  }

  if (
    HUMAN_ONLY_DOCUMENT_STATES.includes(to) &&
    actorWorkspaceMemberId === null
  ) {
    return refuse(
      'ACTOR_REQUIRED',
      `${DOCUMENT_VERIFICATION_STATE_LABELS[to]} is a reviewer decision and cannot be applied automatically.`,
    );
  }

  if (
    DOCUMENT_REASON_REQUIRED_STATES.includes(to) &&
    (reason === null || reason.trim().length === 0)
  ) {
    return refuse(
      'REASON_REQUIRED',
      `${DOCUMENT_VERIFICATION_STATE_LABELS[to]} requires a written reason the partner can act on.`,
    );
  }

  // Asking for a replacement without saying what is wrong gives the partner
  // nothing to fix, so at least one flag is required.
  if (to === 'NEEDS_REPLACEMENT' && flags.length === 0) {
    return refuse(
      'FLAGS_REQUIRED',
      'Requesting a replacement requires at least one problem flag.',
    );
  }

  return {
    ok: true,
    state: to,
    audit: {
      from,
      to,
      at,
      actorWorkspaceMemberId,
      reason: reason === null ? null : reason.trim(),
      flags,
    },
  };
};

// What a reviewer's recorded problems imply. A flag the partner must fix by
// sending another file means replacement; anything else is a plain rejection.
export const outcomeForFlags = (
  flags: readonly DocumentVerificationFlag[],
): DocumentVerificationState | null => {
  if (flags.length === 0) {
    return null;
  }

  return flags.some(flagRequiresReplacement) ? 'NEEDS_REPLACEMENT' : 'REJECTED';
};

// A verified document whose expiry has passed is no longer acceptable. This is
// the one transition the system may apply without a human, because a date
// passing is a fact rather than a judgement.
export const expireIfDue = ({
  state,
  expiresAt,
  now,
}: {
  state: DocumentVerificationState;
  expiresAt: string | null;
  now: string;
}): DocumentTransitionResult | null => {
  if (state !== 'VERIFIED' || expiresAt === null) {
    return null;
  }

  const expiry = Date.parse(expiresAt);
  const current = Date.parse(now);

  if (Number.isNaN(expiry) || Number.isNaN(current) || expiry > current) {
    return null;
  }

  return transitionDocument({
    from: state,
    to: 'EXPIRED',
    at: now,
    actorWorkspaceMemberId: null,
    reason: `Document expired on ${expiresAt.slice(0, 10)}.`,
  });
};

// Replacing a document: the old one is superseded and the new upload starts
// fresh. The old record is never deleted — it is the evidence of what was
// checked and when.
export type ReplacementPlan = {
  supersededDocumentId: string;
  supersededState: DocumentVerificationState;
  newDocumentState: DocumentVerificationState;
  audit: DocumentAuditEntry;
};

export const planReplacement = ({
  documentId,
  currentState,
  at,
  actorWorkspaceMemberId,
  reason,
  flags = [],
}: {
  documentId: string;
  currentState: DocumentVerificationState;
  at: string;
  actorWorkspaceMemberId: string | null;
  reason: string | null;
  flags?: readonly DocumentVerificationFlag[];
}): DocumentTransitionResult | ReplacementPlan => {
  const transition = transitionDocument({
    from: currentState,
    to: 'NEEDS_REPLACEMENT',
    at,
    actorWorkspaceMemberId,
    reason,
    flags,
  });

  if (!transition.ok) {
    return transition;
  }

  return {
    supersededDocumentId: documentId,
    supersededState: 'NEEDS_REPLACEMENT',
    newDocumentState: 'PENDING',
    audit: transition.audit,
  };
};
