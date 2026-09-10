import {
  canTransition,
  ONBOARDING_STATUS_LABELS,
  requiresHumanActor,
  requiresReason,
  type OnboardingStatus,
} from 'src/modules/lv-onboarding/constants/onboarding-status';
import {
  canSubmitForReview,
  type OnboardingData,
} from 'src/modules/lv-onboarding/utils/validate-onboarding';
import {
  isDocumentAcceptable,
  type DocumentVerificationState,
} from 'src/modules/lv-onboarding/constants/document-verification';

// The onboarding state machine, with guards.
//
// Every refusal is a typed reason rather than a thrown error, so the caller can
// show the partner or the reviewer exactly why something is not possible.
//
// Two rules matter more than the rest and are enforced here, not by convention:
//   1. APPROVED / REJECTED / CHANGES_REQUESTED / ACTIVATED require a human
//      actor. An automated caller cannot perform them, whatever it passes.
//   2. A submission cannot reach VERIFICATION with required information
//      missing, and cannot be APPROVED with an unverified or rejected document.

export type TransitionRefusal =
  | 'NOT_ALLOWED'
  | 'ACTOR_REQUIRED'
  | 'REASON_REQUIRED'
  | 'INCOMPLETE_SUBMISSION'
  | 'DOCUMENTS_NOT_VERIFIED'
  | 'REVIEWER_REQUIRED';

export type AuditEntry = {
  from: OnboardingStatus;
  to: OnboardingStatus;
  at: string;
  actorWorkspaceMemberId: string | null;
  reason: string | null;
  note: string | null;
};

export type TransitionRequest = {
  from: OnboardingStatus;
  to: OnboardingStatus;
  at: string;
  // Null means "an automated process is asking".
  actorWorkspaceMemberId?: string | null;
  reason?: string | null;
  note?: string | null;
  data?: OnboardingData;
  documents?: Readonly<Record<string, DocumentVerificationState>>;
  // The team member accountable for the review decision.
  reviewerWorkspaceMemberId?: string | null;
};

export type TransitionResult =
  | { ok: true; status: OnboardingStatus; audit: AuditEntry }
  | { ok: false; refusal: TransitionRefusal; message: string };

const refuse = (
  refusal: TransitionRefusal,
  message: string,
): TransitionResult => ({ ok: false, refusal, message });

export const transitionOnboarding = (
  request: TransitionRequest,
): TransitionResult => {
  const {
    from,
    to,
    at,
    actorWorkspaceMemberId = null,
    reason = null,
    note = null,
    data,
    documents,
    reviewerWorkspaceMemberId = null,
  } = request;

  if (!canTransition(from, to)) {
    return refuse(
      'NOT_ALLOWED',
      `Cannot move from ${ONBOARDING_STATUS_LABELS[from]} to ${ONBOARDING_STATUS_LABELS[to]}.`,
    );
  }

  // --- human approval is mandatory -----------------------------------------
  if (requiresHumanActor(to) && actorWorkspaceMemberId === null) {
    return refuse(
      'ACTOR_REQUIRED',
      `${ONBOARDING_STATUS_LABELS[to]} is a human decision and cannot be applied automatically.`,
    );
  }

  if (requiresReason(to) && (reason === null || reason.trim().length === 0)) {
    return refuse(
      'REASON_REQUIRED',
      `${ONBOARDING_STATUS_LABELS[to]} requires a written reason.`,
    );
  }

  // --- submission completeness ---------------------------------------------
  if (to === 'VERIFICATION') {
    if (data === undefined) {
      return refuse(
        'INCOMPLETE_SUBMISSION',
        'Cannot submit for verification without the submitted answers.',
      );
    }

    const submission = canSubmitForReview(data);

    if (!submission.ok) {
      const first = submission.missing[0];

      return refuse(
        'INCOMPLETE_SUBMISSION',
        `${submission.missing.length} item(s) still missing, starting with "${first?.label}".`,
      );
    }
  }

  // --- approval requires verified documents and a named reviewer -----------
  if (to === 'APPROVED') {
    if (reviewerWorkspaceMemberId === null) {
      return refuse(
        'REVIEWER_REQUIRED',
        'Approval requires a named reviewer to be accountable for the decision.',
      );
    }

    const states = Object.values(documents ?? {});

    if (states.length === 0) {
      return refuse(
        'DOCUMENTS_NOT_VERIFIED',
        'Approval requires at least one verified document.',
      );
    }

    if (!states.every(isDocumentAcceptable)) {
      return refuse(
        'DOCUMENTS_NOT_VERIFIED',
        'Every uploaded document must be verified before approval. Expired, rejected and replacement-pending documents all block it.',
      );
    }
  }

  return {
    ok: true,
    status: to,
    audit: {
      from,
      to,
      at,
      actorWorkspaceMemberId,
      reason: reason === null ? null : reason.trim(),
      note,
    },
  };
};

// Everything reachable from here right now, given the current record. Drives
// which buttons the reviewer UI offers, so the UI can never present an action
// the machine would refuse.
export const availableTransitions = ({
  from,
  data,
  documents,
  reviewerWorkspaceMemberId,
}: {
  from: OnboardingStatus;
  data?: OnboardingData;
  documents?: Readonly<Record<string, DocumentVerificationState>>;
  reviewerWorkspaceMemberId?: string | null;
}): readonly OnboardingStatus[] => {
  const candidates = (
    [
      'INVITED',
      'INITIATED',
      'IN_PROGRESS',
      'WAITING_FOR_PARTNER',
      'VERIFICATION',
      'INTERNAL_REVIEW',
      'CHANGES_REQUESTED',
      'APPROVED',
      'REJECTED',
      'ACTIVATED',
    ] as const
  ).filter((to) => canTransition(from, to));

  return candidates.filter((to) => {
    const probe = transitionOnboarding({
      from,
      to,
      at: '1970-01-01T00:00:00.000Z',
      // Probe as a human with a reason so the result reflects genuine blockers
      // (incomplete data, unverified documents) rather than missing paperwork
      // the UI will collect at the point of clicking.
      actorWorkspaceMemberId: 'probe',
      reason: 'probe',
      data,
      documents,
      reviewerWorkspaceMemberId: reviewerWorkspaceMemberId ?? 'probe',
    });

    return probe.ok;
  });
};
