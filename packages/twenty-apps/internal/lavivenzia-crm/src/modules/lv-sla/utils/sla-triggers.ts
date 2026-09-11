// When each SLA clock starts. Pure predicates over before/after values, so the
// event hooks stay thin and the trigger rules are testable in isolation.

// Rule 1 — a lead is actionable once a human has confirmed it: NEW, or the
// states the assignment engine moves it to immediately. DISCOVERED is a
// preliminary capture and does not start the clock.
const ACTIONABLE_NEW_LEAD_STATUSES = new Set(['NEW', 'QUALIFYING', 'ASSIGNED']);

export const isActionableNewLeadStatus = (status: string | null | undefined): boolean =>
  typeof status === 'string' && ACTIONABLE_NEW_LEAD_STATUSES.has(status);

// Rule 1 on update — the lead ENTERS the actionable set from DISCOVERED (or
// from no status at all).
export const entersNewLeadContact = (
  before: string | null | undefined,
  after: string | null | undefined,
): boolean =>
  isActionableNewLeadStatus(after) && !isActionableNewLeadStatus(before) && (before ?? 'DISCOVERED') === 'DISCOVERED';

// Rule 2 — the lead enters INTERESTED.
export const entersInterested = (
  before: string | null | undefined,
  after: string | null | undefined,
): boolean => after === 'INTERESTED' && before !== 'INTERESTED';

// Rule 3 — the partner begins onboarding.
export const entersOnboardingInitiated = (
  before: string | null | undefined,
  after: string | null | undefined,
): boolean => after === 'INITIATED' && before !== 'INITIATED';

// Rule 4 — a document needs to be obtained again. NEEDS_REPLACEMENT and
// EXPIRED are "requires resubmission" in the document state machine.
const MISSING_DOCUMENT_STATES = new Set(['REJECTED', 'NEEDS_REPLACEMENT', 'EXPIRED']);

export const entersMissingDocument = (
  before: string | null | undefined,
  after: string | null | undefined,
): boolean =>
  typeof after === 'string' &&
  MISSING_DOCUMENT_STATES.has(after) &&
  !(typeof before === 'string' && MISSING_DOCUMENT_STATES.has(before));
