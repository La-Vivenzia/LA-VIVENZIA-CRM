// Lifecycles of the ecosystem entities — partner, experience, property.
//
// A partner record exists from onboarding approval onwards, so the states
// before that (prospect, verification, pending approval, rejected) live on the
// lead and its onboarding, where they have been since Day 3. The partner's
// own machine starts at APPROVED; PROSPECTIVE and ONBOARDING remain for a
// partner an administrator creates by hand ahead of an onboarding.
//
// Experiences and properties share one machine. The Day 1 values are kept
// (renaming would orphan rows and views): IN_REVIEW is "submitted /
// verification", READY is "approved", LIVE is "active", RETIRED is
// "archived"; CHANGES_REQUIRED and SUSPENDED are added.
//
// Everything not listed as a transition is refused. Human-only transitions
// require a session actor. Activation additionally requires the deterministic
// readiness check (activation-readiness.ts) to pass — the route fails closed.

export const PARTNER_STATUSES = ['PROSPECTIVE', 'ONBOARDING', 'APPROVED', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'INACTIVE', 'OFFBOARDED'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  PROSPECTIVE: 'Prospective',
  ONBOARDING: 'Onboarding',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
  OFFBOARDED: 'Offboarded',
};

export const PARTNER_TRANSITIONS: Record<PartnerStatus, readonly PartnerStatus[]> = {
  PROSPECTIVE: ['ONBOARDING', 'OFFBOARDED'],
  ONBOARDING: ['APPROVED', 'OFFBOARDED'],
  APPROVED: ['ACTIVE', 'SUSPENDED', 'OFFBOARDED'],
  ACTIVE: ['PAUSED', 'SUSPENDED', 'INACTIVE', 'OFFBOARDED'],
  PAUSED: ['ACTIVE', 'INACTIVE', 'OFFBOARDED'],
  SUSPENDED: ['ACTIVE', 'OFFBOARDED'],
  INACTIVE: ['ACTIVE', 'OFFBOARDED'],
  OFFBOARDED: [],
};

// Decisions a person must own (an event handler may never make them).
export const PARTNER_HUMAN_ONLY: readonly PartnerStatus[] = ['ACTIVE', 'SUSPENDED', 'OFFBOARDED'];
// Transitions that must carry a written reason.
export const PARTNER_REASON_REQUIRED: readonly PartnerStatus[] = ['SUSPENDED', 'OFFBOARDED', 'PAUSED'];
// Transitions gated by the readiness check.
export const PARTNER_READINESS_GATED: readonly PartnerStatus[] = ['ACTIVE'];

export const isPartnerStatus = (value: string | null | undefined): value is PartnerStatus => (PARTNER_STATUSES as readonly string[]).includes(value ?? '');

// ---------------------------------------------------------------------------

export const LISTING_STATUSES = ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUIRED', 'READY', 'LIVE', 'PAUSED', 'SUSPENDED', 'RETIRED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  CHANGES_REQUIRED: 'Changes required',
  READY: 'Approved',
  LIVE: 'Active',
  PAUSED: 'Paused',
  SUSPENDED: 'Suspended',
  RETIRED: 'Archived',
};

export const LISTING_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  DRAFT: ['IN_REVIEW', 'RETIRED'],
  IN_REVIEW: ['READY', 'CHANGES_REQUIRED', 'RETIRED'],
  CHANGES_REQUIRED: ['IN_REVIEW', 'RETIRED'],
  READY: ['LIVE', 'CHANGES_REQUIRED', 'RETIRED'],
  LIVE: ['PAUSED', 'SUSPENDED', 'RETIRED'],
  PAUSED: ['LIVE', 'RETIRED'],
  SUSPENDED: ['LIVE', 'RETIRED'],
  RETIRED: [],
};

// Approval (READY), changes required, activation (LIVE), suspension and
// archiving are human decisions.
export const LISTING_HUMAN_ONLY: readonly ListingStatus[] = ['READY', 'CHANGES_REQUIRED', 'LIVE', 'SUSPENDED', 'RETIRED'];
export const LISTING_REASON_REQUIRED: readonly ListingStatus[] = ['CHANGES_REQUIRED', 'SUSPENDED', 'RETIRED', 'PAUSED'];
// Approving or activating is a governance decision: the record's own owner
// may not approve their own work; approvers need the object's write
// permission (Experience Team / Operations) or administration.
export const LISTING_GOVERNED: readonly ListingStatus[] = ['READY', 'LIVE', 'SUSPENDED', 'RETIRED'];
export const LISTING_READINESS_GATED: readonly ListingStatus[] = ['LIVE'];

export const isListingStatus = (value: string | null | undefined): value is ListingStatus => (LISTING_STATUSES as readonly string[]).includes(value ?? '');

// States that count as "needs attention" on views and dashboards.
export const LISTING_ATTENTION_STATUSES: readonly ListingStatus[] = ['IN_REVIEW', 'CHANGES_REQUIRED', 'SUSPENDED'];
export const PARTNER_ATTENTION_STATUSES: readonly PartnerStatus[] = ['ONBOARDING', 'APPROVED', 'SUSPENDED'];

export type TransitionRefusal = 'UNKNOWN_STATUS' | 'NOT_ALLOWED' | 'HUMAN_REQUIRED' | 'REASON_REQUIRED' | 'SAME_STATUS';

export const checkTransition = <S extends string>(table: Record<S, readonly S[]>, humanOnly: readonly S[], reasonRequired: readonly S[], input: { from: S; to: S; hasActor: boolean; reason: string | null }): { ok: true } | { ok: false; refusal: TransitionRefusal; message: string } => {
  if (input.from === input.to) {
    return { ok: false, refusal: 'SAME_STATUS', message: `Already ${input.to.toLowerCase().replace(/_/g, ' ')}.` };
  }

  if (!table[input.from]?.includes(input.to)) {
    return { ok: false, refusal: 'NOT_ALLOWED', message: `Cannot move from ${input.from} to ${input.to}.` };
  }

  if (humanOnly.includes(input.to) && !input.hasActor) {
    return { ok: false, refusal: 'HUMAN_REQUIRED', message: `${input.to} is a decision a team member must make.` };
  }

  if (reasonRequired.includes(input.to) && (input.reason ?? '').trim().length < 3) {
    return { ok: false, refusal: 'REASON_REQUIRED', message: `A reason is required to move to ${input.to}.` };
  }

  return { ok: true };
};
