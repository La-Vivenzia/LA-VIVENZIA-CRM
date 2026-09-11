import { type SelectOption } from 'src/modules/lv-core/constants/select-options.generated';

// The four initial SLAs from ASSIGNMENT-SLA-NOTIFICATIONS.md "Initial SLAs",
// and nothing else. Hours are the business commitment; everything derived
// from them (due-soon threshold, breach grace) is documented below and in
// ASSIGNMENT-SLA-NOTIFICATIONS.md so a founder can change one number.

export const SLA_RULES = [
  'NEW_LEAD_CONTACT',
  'INTERESTED_FOLLOW_UP',
  'ONBOARDING_FIRST_ACTION',
  'MISSING_DOCUMENT',
] as const;

export type SlaRule = (typeof SLA_RULES)[number];

export const isSlaRule = (value: unknown): value is SlaRule =>
  typeof value === 'string' && (SLA_RULES as readonly string[]).includes(value);

export const SLA_RULE_HOURS: Record<SlaRule, number> = {
  NEW_LEAD_CONTACT: 24,
  INTERESTED_FOLLOW_UP: 48,
  ONBOARDING_FIRST_ACTION: 24,
  MISSING_DOCUMENT: 48,
};

export const SLA_RULE_LABELS: Record<SlaRule, string> = {
  NEW_LEAD_CONTACT: 'New lead contact',
  INTERESTED_FOLLOW_UP: 'Interested follow-up',
  ONBOARDING_FIRST_ACTION: 'Onboarding first action',
  MISSING_DOCUMENT: 'Missing document',
};

// What the owner is expected to do — shown on notifications and the
// escalation task so nobody has to look the rule up.
export const SLA_RULE_EXPECTATIONS: Record<SlaRule, string> = {
  NEW_LEAD_CONTACT: 'Make first contact with the lead (log a call, message or meeting).',
  INTERESTED_FOLLOW_UP: 'Complete the next follow-up with the interested lead.',
  ONBOARDING_FIRST_ACTION: 'Take the first onboarding action (review a document or move the onboarding on).',
  MISSING_DOCUMENT: 'Obtain the missing or replacement document from the partner.',
};

// DUE_SOON opens for the last 25% of the SLA window (24h → last 6h, 48h → last
// 12h). Chosen per the Day 4 brief; the follow-up reminder's fixed 4h window is
// a different concept (a task's own due time) and was deliberately not reused.
export const DUE_SOON_FRACTION = 0.25;

// DUE is the deadline itself. BREACHED is the deadline plus this grace: it
// gives the evaluator (every 15 minutes) time to raise DUE before BREACHED,
// and the owner one last hour before their manager is involved. This is an
// implementation decision, not a stated business rule — flagged in the docs.
export const BREACH_GRACE_HOURS = 1;

export const SLA_STATUSES = [
  'ON_TRACK',
  'DUE_SOON',
  'DUE',
  'BREACHED',
  'ESCALATED',
  'RESOLVED',
] as const;

export type SlaStatus = (typeof SLA_STATUSES)[number];

export const isSlaStatus = (value: unknown): value is SlaStatus =>
  typeof value === 'string' && (SLA_STATUSES as readonly string[]).includes(value);

// States the evaluator still has work to do on.
export const ACTIONABLE_SLA_STATUSES: readonly SlaStatus[] = [
  'ON_TRACK',
  'DUE_SOON',
  'DUE',
  'BREACHED',
];

// States that can still be resolved by the required action happening.
export const RESOLVABLE_SLA_STATUSES: readonly SlaStatus[] = [
  'ON_TRACK',
  'DUE_SOON',
  'DUE',
  'BREACHED',
  'ESCALATED',
];

const RANK: Record<SlaStatus, number> = {
  ON_TRACK: 0,
  DUE_SOON: 1,
  DUE: 2,
  BREACHED: 3,
  ESCALATED: 4,
  RESOLVED: 5,
};

// Forward-only. A missed evaluation may jump several steps at once (worker
// down for a day), but the clock never moves a record backwards, and nothing
// moves out of RESOLVED.
export const canAdvanceSla = (from: SlaStatus, to: SlaStatus): boolean =>
  from !== 'RESOLVED' && RANK[to] > RANK[from];

export const SLA_RULE_OPTIONS: SelectOption[] = [
  { id: '2f7c4e1a-8b3d-4c5e-9f6a-1b2c3d4e5f60', value: 'NEW_LEAD_CONTACT', label: 'New lead contact', position: 0, color: 'green' },
  { id: '3a8d5f2b-9c4e-4d6f-8a7b-2c3d4e5f6a71', value: 'INTERESTED_FOLLOW_UP', label: 'Interested follow-up', position: 1, color: 'blue' },
  { id: '4b9e6a3c-ad5f-4e7a-9b8c-3d4e5f6a7b82', value: 'ONBOARDING_FIRST_ACTION', label: 'Onboarding first action', position: 2, color: 'purple' },
  { id: '5caf7b4d-be6a-4f8b-8c9d-4e5f6a7b8c93', value: 'MISSING_DOCUMENT', label: 'Missing document', position: 3, color: 'orange' },
];

export const SLA_STATUS_OPTIONS: SelectOption[] = [
  { id: '6db08c5e-cf7b-4a9c-9dae-5f6a7b8c9da4', value: 'ON_TRACK', label: 'On track', position: 0, color: 'green' },
  { id: '7ec19d6f-d08c-4bad-8ebf-6a7b8c9dae05', value: 'DUE_SOON', label: 'Due soon', position: 1, color: 'yellow' },
  { id: '8fd2ae70-e19d-4cbe-9fc0-7b8c9daebf16', value: 'DUE', label: 'Due', position: 2, color: 'orange' },
  { id: '90e3bf81-f2ae-4dcf-8ad1-8c9daebfc027', value: 'BREACHED', label: 'Breached', position: 3, color: 'red' },
  { id: 'a1f4c092-03bf-4ed0-9be2-9daebfc0d138', value: 'ESCALATED', label: 'Escalated', position: 4, color: 'red' },
  { id: 'b205d1a3-14c0-4fe1-8cf3-aebfc0d1e249', value: 'RESOLVED', label: 'Resolved', position: 5, color: 'gray' },
];
