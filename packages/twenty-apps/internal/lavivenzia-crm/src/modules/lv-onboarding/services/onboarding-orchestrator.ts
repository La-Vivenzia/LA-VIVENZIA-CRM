import {
  type OnboardingStatus,
} from 'src/modules/lv-onboarding/constants/onboarding-status';
import {
  onboardingHealth,
  progressPercentage,
  type DocumentVerificationState,
} from 'src/modules/lv-onboarding/utils/onboarding-progress';
import {
  transitionOnboarding,
  type AuditEntry,
  type TransitionRefusal,
} from 'src/modules/lv-onboarding/utils/transition-onboarding';
import {
  resumeStep,
  type OnboardingData,
} from 'src/modules/lv-onboarding/utils/validate-onboarding';
import { type OnboardingStep } from 'src/modules/lv-onboarding/constants/onboarding-steps';

// Applies a status change server-side.
//
// The guards run HERE as well as in the reviewer UI. That is the point: the UI
// hides buttons it should not offer, but SECURITY-RBAC.md is explicit that UI
// filtering is never the protection. A caller hitting the API directly meets
// the same refusals.

export type OnboardingRecord = {
  id: string;
  leadId: string | null;
  status: OnboardingStatus;
  answers: OnboardingData;
  auditTrail: readonly AuditEntry[];
  reviewerWorkspaceMemberId: string | null;
};

export type OnboardingPatch = {
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  progressPercentage: number;
  healthScore: number;
  auditTrail: readonly AuditEntry[];
  decisionReason?: string | null;
  reviewerId?: string | null;
  submittedAt?: string;
  decidedAt?: string;
  activatedAt?: string;
};

export type OnboardingPort = {
  getOnboarding(id: string): Promise<OnboardingRecord | null>;
  getDocumentStates(
    onboardingId: string,
  ): Promise<Readonly<Record<string, DocumentVerificationState>>>;
  applyPatch(input: { id: string; patch: OnboardingPatch }): Promise<void>;
  // Mirrors the headline status onto the lead so a coordinator sees it without
  // opening the onboarding record.
  syncLeadOnboardingStatus(input: {
    leadId: string;
    status: OnboardingStatus;
  }): Promise<void>;
};

export type ApplyTransitionResult =
  | { ok: true; status: OnboardingStatus; audit: AuditEntry }
  | { ok: false; refusal: TransitionRefusal | 'NOT_FOUND'; message: string };

// Timestamps that a given target status stamps onto the record.
const timestampFor = (
  to: OnboardingStatus,
  at: string,
): Partial<OnboardingPatch> => {
  if (to === 'VERIFICATION') {
    return { submittedAt: at };
  }

  if (to === 'APPROVED' || to === 'REJECTED') {
    return { decidedAt: at };
  }

  if (to === 'ACTIVATED') {
    return { activatedAt: at };
  }

  return {};
};

export const applyOnboardingTransition = async ({
  onboardingId,
  to,
  at,
  port,
  actorWorkspaceMemberId = null,
  reason = null,
  note = null,
  reviewerWorkspaceMemberId,
}: {
  onboardingId: string;
  to: OnboardingStatus;
  at: string;
  port: OnboardingPort;
  actorWorkspaceMemberId?: string | null;
  reason?: string | null;
  note?: string | null;
  reviewerWorkspaceMemberId?: string | null;
}): Promise<ApplyTransitionResult> => {
  const record = await port.getOnboarding(onboardingId);

  if (record === null) {
    return {
      ok: false,
      refusal: 'NOT_FOUND',
      message: `Onboarding ${onboardingId} does not exist.`,
    };
  }

  const documents = await port.getDocumentStates(onboardingId);

  // The reviewer is whoever is named on the request, falling back to whoever is
  // already recorded on the onboarding.
  const reviewer =
    reviewerWorkspaceMemberId ?? record.reviewerWorkspaceMemberId ?? null;

  const decision = transitionOnboarding({
    from: record.status,
    to,
    at,
    actorWorkspaceMemberId,
    reason,
    note,
    data: record.answers,
    documents,
    reviewerWorkspaceMemberId: reviewer,
  });

  if (!decision.ok) {
    return decision;
  }

  const patch: OnboardingPatch = {
    status: decision.status,
    currentStep: resumeStep(record.answers),
    progressPercentage: progressPercentage(record.answers),
    healthScore: onboardingHealth({ data: record.answers, documents }).score,
    // Append-only: the trail is evidence, so nothing already written is edited.
    auditTrail: [...record.auditTrail, decision.audit],
    ...timestampFor(to, at),
  };

  if (reason !== null && reason.trim().length > 0) {
    patch.decisionReason = reason.trim();
  }

  if (reviewer !== null) {
    patch.reviewerId = reviewer;
  }

  await port.applyPatch({ id: onboardingId, patch });

  if (record.leadId !== null) {
    await port.syncLeadOnboardingStatus({
      leadId: record.leadId,
      status: decision.status,
    });
  }

  return { ok: true, status: decision.status, audit: decision.audit };
};
