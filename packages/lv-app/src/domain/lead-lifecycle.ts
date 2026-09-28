// Lifecycle vocabulary. Mirrors PRODUCT-REQUIREMENTS.md "Lifecycle" exactly —
// the main flow in order, then the terminal/holding states. Order matters: it
// drives funnel ordering and the SELECT option positions on the Lead object.

export const LEAD_MAIN_FLOW_STATUSES = [
  'DISCOVERED',
  'NEW',
  'QUALIFYING',
  'ASSIGNED',
  'CONTACTED',
  'ENGAGED',
  'INTERESTED',
  'NEGOTIATION',
  'ONBOARDING_INITIATED',
  'ONBOARDING_IN_PROGRESS',
  'VERIFICATION',
  'APPROVED',
  'LIVE_ACTIVE',
  'GROWTH',
] as const;

export const LEAD_ADDITIONAL_STATUSES = [
  'NOT_INTERESTED',
  'FOLLOW_UP_LATER',
  'NO_RESPONSE',
  'WRONG_CONTACT',
  'DUPLICATE',
  'NOT_ELIGIBLE',
  'TEMPORARILY_CLOSED',
  'LOST',
  'REJECTED',
  'DORMANT',
] as const;

export const LEAD_STATUSES = [
  ...LEAD_MAIN_FLOW_STATUSES,
  ...LEAD_ADDITIONAL_STATUSES,
] as const;

export type LeadMainFlowStatus = (typeof LEAD_MAIN_FLOW_STATUSES)[number];
export type LeadAdditionalStatus = (typeof LEAD_ADDITIONAL_STATUSES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  DISCOVERED: 'Discovered',
  NEW: 'New',
  QUALIFYING: 'Qualifying',
  ASSIGNED: 'Assigned',
  CONTACTED: 'Contacted',
  ENGAGED: 'Engaged',
  INTERESTED: 'Interested',
  NEGOTIATION: 'Negotiation / Discussion',
  ONBOARDING_INITIATED: 'Onboarding initiated',
  ONBOARDING_IN_PROGRESS: 'Onboarding in progress',
  VERIFICATION: 'Verification',
  APPROVED: 'Approved',
  LIVE_ACTIVE: 'Live / Active',
  GROWTH: 'Growth',
  NOT_INTERESTED: 'Not interested',
  FOLLOW_UP_LATER: 'Follow up later',
  NO_RESPONSE: 'No response',
  WRONG_CONTACT: 'Wrong contact',
  DUPLICATE: 'Duplicate',
  NOT_ELIGIBLE: 'Not eligible',
  TEMPORARILY_CLOSED: 'Temporarily closed',
  LOST: 'Lost',
  REJECTED: 'Rejected',
  DORMANT: 'Dormant',
};

// A lead counts against an owner's workload only while it is live work. Closed,
// dormant and rejected leads must not make a coordinator look busy — otherwise
// workload-based assignment starves whoever has the longest history.
const NON_WORKLOAD_STATUSES = new Set<LeadStatus>([
  'NOT_INTERESTED',
  'WRONG_CONTACT',
  'DUPLICATE',
  'NOT_ELIGIBLE',
  'TEMPORARILY_CLOSED',
  'LOST',
  'REJECTED',
  'DORMANT',
  'LIVE_ACTIVE',
  'GROWTH',
]);

export const isOpenWorkloadStatus = (status: LeadStatus): boolean =>
  !NON_WORKLOAD_STATUSES.has(status);

export const isLeadStatus = (value: string): value is LeadStatus =>
  (LEAD_STATUSES as readonly string[]).includes(value);

// The status a lead lands on the moment assignment succeeds. Kept as a named
// constant because both the assignment logic function and its tests depend on
// it, and PRODUCT-REQUIREMENTS.md places ASSIGNED before CONTACTED.
export const STATUS_AFTER_ASSIGNMENT: LeadStatus = 'ASSIGNED';

// Where a lead created by automated capture starts, before a human confirms it.
export const STATUS_ON_PRELIMINARY_CAPTURE: LeadStatus = 'DISCOVERED';

// Where a lead created by a human with confirmed fields starts.
export const STATUS_ON_CONFIRMED_CAPTURE: LeadStatus = 'NEW';

export const LEAD_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const isLeadPriority = (value: unknown): value is LeadPriority =>
  typeof value === 'string' && (LEAD_PRIORITIES as readonly string[]).includes(value);

// What to assume when a record carries no priority — the middle of the scale,
// never the top, so an unset field cannot page anyone.
export const priorityOrDefault = (value: unknown): LeadPriority =>
  isLeadPriority(value) ? value : 'MEDIUM';

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};
