// The eleven partner onboarding statuses and the transitions allowed between
// them. ONBOARDING.md requires an auditable trail, so the machine is explicit:
// anything not listed here is refused rather than silently permitted.

export const ONBOARDING_STATUSES = [
  'NOT_STARTED',
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
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  NOT_STARTED: 'Not started',
  INVITED: 'Invited',
  INITIATED: 'Initiated',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_PARTNER: 'Waiting for partner',
  VERIFICATION: 'Verification',
  INTERNAL_REVIEW: 'Internal review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVATED: 'Activated',
};

// Allowed transitions. Read as: from -> the set it may move to.
//
// Shape of the journey:
//   NOT_STARTED -> INVITED -> INITIATED -> IN_PROGRESS
//   IN_PROGRESS <-> WAITING_FOR_PARTNER      (chasing missing information)
//   IN_PROGRESS -> VERIFICATION              (partner submitted)
//   VERIFICATION -> INTERNAL_REVIEW          (documents checked)
//   INTERNAL_REVIEW -> APPROVED | REJECTED | CHANGES_REQUESTED
//   CHANGES_REQUESTED -> IN_PROGRESS         (back to the partner)
//   APPROVED -> ACTIVATED                    (goes live)
//
// REJECTED is deliberately NOT terminal: ONBOARDING.md expects a rejected
// partner to be able to reapply, and forcing a new record would lose the
// history of why they were rejected the first time.
export const ONBOARDING_TRANSITIONS: Record<
  OnboardingStatus,
  readonly OnboardingStatus[]
> = {
  NOT_STARTED: ['INVITED'],
  INVITED: ['INITIATED', 'REJECTED'],
  INITIATED: ['IN_PROGRESS', 'WAITING_FOR_PARTNER', 'REJECTED'],
  IN_PROGRESS: ['WAITING_FOR_PARTNER', 'VERIFICATION', 'REJECTED'],
  WAITING_FOR_PARTNER: ['IN_PROGRESS', 'VERIFICATION', 'REJECTED'],
  VERIFICATION: ['INTERNAL_REVIEW', 'CHANGES_REQUESTED', 'REJECTED'],
  INTERNAL_REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'],
  CHANGES_REQUESTED: ['IN_PROGRESS', 'WAITING_FOR_PARTNER', 'REJECTED'],
  APPROVED: ['ACTIVATED', 'REJECTED'],
  REJECTED: ['IN_PROGRESS'],
  ACTIVATED: [],
};

// Decisions a human must own. AI-INTELLIGENCE.md and the brief are both
// explicit that approval stays with a person, so these transitions REQUIRE an
// actor and are refused without one — an automated caller cannot perform them.
export const HUMAN_ONLY_TRANSITIONS: readonly OnboardingStatus[] = [
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'ACTIVATED',
];

// Transitions that must carry a written reason.
export const REASON_REQUIRED_TRANSITIONS: readonly OnboardingStatus[] = [
  'REJECTED',
  'CHANGES_REQUESTED',
];

// The partner can still edit their submission in these states.
export const PARTNER_EDITABLE_STATUSES: readonly OnboardingStatus[] = [
  'INITIATED',
  'IN_PROGRESS',
  'WAITING_FOR_PARTNER',
  'CHANGES_REQUESTED',
];

// Under review by La Vivenzia — the partner sees a read-only summary.
export const UNDER_REVIEW_STATUSES: readonly OnboardingStatus[] = [
  'VERIFICATION',
  'INTERNAL_REVIEW',
];

export const isOnboardingStatus = (value: string): value is OnboardingStatus =>
  (ONBOARDING_STATUSES as readonly string[]).includes(value);

export const isPartnerEditable = (status: OnboardingStatus): boolean =>
  PARTNER_EDITABLE_STATUSES.includes(status);

export const isUnderReview = (status: OnboardingStatus): boolean =>
  UNDER_REVIEW_STATUSES.includes(status);

export const requiresHumanActor = (target: OnboardingStatus): boolean =>
  HUMAN_ONLY_TRANSITIONS.includes(target);

export const requiresReason = (target: OnboardingStatus): boolean =>
  REASON_REQUIRED_TRANSITIONS.includes(target);

export const canTransition = (
  from: OnboardingStatus,
  to: OnboardingStatus,
): boolean => ONBOARDING_TRANSITIONS[from].includes(to);
