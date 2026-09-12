import {
  LEAD_ADDITIONAL_STATUSES,
  LEAD_MAIN_FLOW_STATUSES,
  LEAD_STATUSES,
  isOpenWorkloadStatus,
  type LeadStatus,
} from 'src/modules/lv-core/constants/lead-lifecycle';

// Every dashboard number is defined here, as a filter over a real object, so
// the definition is readable, unit-testable and identical for every role.
// The route only decides WHICH definitions to run; CM-004 decides which rows
// each one may count for the caller.
//
// Thresholds are the few places a business rule had to be chosen. Each is a
// named constant, stated in DAY_5_DASHBOARDS.md, and easy to change.

export const THRESHOLDS = {
  // A lead in an actionable state with no contact for this long is "stuck".
  STUCK_LEAD_DAYS: 14,
  // A high-priority lead untouched for this long needs attention.
  NO_RECENT_INTERACTION_DAYS: 7,
  // "Due soon" for follow-up tasks.
  DUE_SOON_DAYS: 3,
  // An onboarding not updated for this long is "stuck".
  STALE_ONBOARDING_DAYS: 7,
  // A verified document expiring within this window is "nearing expiry".
  EXPIRY_WARNING_DAYS: 30,
  // Communication activity window.
  COMMUNICATION_WINDOW_DAYS: 30,
  // "Waiting for response" looks back this far for an AWAITING_RESPONSE outcome.
  AWAITING_RESPONSE_DAYS: 14,
  // Recent-activity lists.
  RECENT_DAYS: 14,
} as const;

export type Filter = Record<string, unknown>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const daysAgo = (now: string, days: number): string =>
  new Date(Date.parse(now) - days * DAY_MS).toISOString();

export const daysAhead = (now: string, days: number): string =>
  new Date(Date.parse(now) + days * DAY_MS).toISOString();

// "Today" in the viewer's calendar. The offset is a display convenience the
// client sends (minutes east of UTC, as the browser reports it negated); it
// is clamped and never affects authorization.
export const clampTimeZoneOffset = (value: unknown): number => {
  const minutes = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;

  return Math.max(-14 * 60, Math.min(14 * 60, minutes));
};

export const dayBounds = (now: string, timeZoneOffsetMinutes: number): { start: string; end: string } => {
  const local = new Date(Date.parse(now) + timeZoneOffsetMinutes * 60 * 1000);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start = startLocal - timeZoneOffsetMinutes * 60 * 1000;

  return { start: new Date(start).toISOString(), end: new Date(start + DAY_MS).toISOString() };
};

export const OPEN_WORKLOAD_STATUSES: readonly LeadStatus[] = LEAD_STATUSES.filter(isOpenWorkloadStatus);
export const PIPELINE_STATUSES = LEAD_MAIN_FLOW_STATUSES;
export const INACTIVE_STATUSES = LEAD_ADDITIONAL_STATUSES;
export const CONVERSION_STATUSES: readonly LeadStatus[] = [
  'INTERESTED',
  'NEGOTIATION',
  'ONBOARDING_INITIATED',
  'ONBOARDING_IN_PROGRESS',
  'VERIFICATION',
  'APPROVED',
  'LIVE_ACTIVE',
];
// Definition of "likely to convert" without an opportunity score: already
// interested or negotiating AND flagged high/critical by a human.
export const LIKELY_TO_CONVERT_STATUSES: readonly LeadStatus[] = ['INTERESTED', 'NEGOTIATION'];
export const HIGH_PRIORITIES = ['CRITICAL', 'HIGH'] as const;

const and = (...parts: (Filter | null | undefined)[]): Filter => {
  const clauses = parts.filter((part): part is Filter => Boolean(part && Object.keys(part).length > 0));

  return clauses.length === 1 ? clauses[0] : { and: clauses };
};

// Twenty accepts exactly one operator per field object, so a range is two
// clauses ANDed together.
export const between = (field: string, from: string | null, to: string | null): Filter =>
  and(from ? { [field]: { gte: from } } : null, to ? { [field]: { lt: to } } : null);

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export const leadFilters = {
  all: (): Filter => ({}),
  open: (): Filter => ({ status: { in: [...OPEN_WORKLOAD_STATUSES] } }),
  mine: (memberId: string): Filter => ({ ownerId: { eq: memberId } }),
  unowned: (): Filter => ({ ownerId: { is: 'NULL' } }),
  createdBetween: (start: string, end: string): Filter => between('createdAt', start, end),
  status: (statuses: readonly string[]): Filter => ({ status: { in: [...statuses] } }),
  highPriority: (): Filter => and(leadFilters.open(), { priority: { in: [...HIGH_PRIORITIES] } }),
  likelyToConvert: (): Filter => ({
    status: { in: [...LIKELY_TO_CONVERT_STATUSES] },
    priority: { in: [...HIGH_PRIORITIES] },
  }),
  noNextAction: (): Filter => and(leadFilters.open(), { nextAction: { is: 'NULL' } }),
  noNextFollowUp: (): Filter => and(leadFilters.open(), { nextFollowUpAt: { is: 'NULL' } }),
  // High priority and no interaction in the last N days (or ever).
  highPriorityNoRecentInteraction: (now: string): Filter =>
    and(leadFilters.highPriority(), {
      or: [
        { lastInteractionAt: { is: 'NULL' } },
        { lastInteractionAt: { lt: daysAgo(now, THRESHOLDS.NO_RECENT_INTERACTION_DAYS) } },
      ],
    }),
  // Actionable, older than the threshold, and no contact within it.
  stuck: (now: string): Filter =>
    and(leadFilters.open(), {
      createdAt: { lt: daysAgo(now, THRESHOLDS.STUCK_LEAD_DAYS) },
      or: [
        { lastInteractionAt: { is: 'NULL' } },
        { lastInteractionAt: { lt: daysAgo(now, THRESHOLDS.STUCK_LEAD_DAYS) } },
      ],
    }),
  // "Hot without follow-up": high/critical, open, and nothing scheduled.
  hotWithoutFollowUp: (): Filter => and(leadFilters.highPriority(), { nextFollowUpAt: { is: 'NULL' } }),
  // Contact data. Twenty treats an empty composite value as NULL for `is`.
  noEmail: (): Filter => ({ emails: { primaryEmail: { is: 'NULL' } } }),
  noPhone: (): Filter => ({ phones: { primaryPhoneNumber: { is: 'NULL' } } }),
  noContactChannel: (): Filter =>
    and(leadFilters.open(), leadFilters.noEmail(), leadFilters.noPhone()),
  noOrganisation: (): Filter => and(leadFilters.open(), { organisationName: { is: 'NULL' } }),
  noLocation: (): Filter => and(leadFilters.open(), { location: { is: 'NULL' } }),
  // Duplicate work that actually exists: leads a human marked DUPLICATE, and
  // leads the capture step flagged with duplicate keys.
  markedDuplicate: (): Filter => ({ status: { eq: 'DUPLICATE' } }),
  flaggedDuplicateKeys: (): Filter => ({ duplicateKeys: { is: 'NOT_NULL' } }),
  scored: (): Filter => ({ opportunityScore: { is: 'NOT_NULL' } }),
  noResponse: (): Filter => ({ status: { eq: 'NO_RESPONSE' } }),
  recentlyUpdated: (now: string): Filter => ({ updatedAt: { gte: daysAgo(now, THRESHOLDS.RECENT_DAYS) } }),
};

// ---------------------------------------------------------------------------
// Follow-ups (Twenty tasks)
// ---------------------------------------------------------------------------

export const taskFilters = {
  open: (): Filter => ({ status: { neq: 'DONE' } }),
  mine: (memberId: string): Filter => ({ assigneeId: { eq: memberId } }),
  overdue: (now: string): Filter => and(taskFilters.open(), { dueAt: { lt: now } }),
  dueBetween: (start: string, end: string): Filter => and(taskFilters.open(), between('dueAt', start, end)),
  dueSoon: (now: string, dayEnd: string): Filter =>
    and(taskFilters.open(), between('dueAt', dayEnd, daysAhead(now, THRESHOLDS.DUE_SOON_DAYS))),
  recent: (now: string): Filter => ({ updatedAt: { gte: daysAgo(now, THRESHOLDS.RECENT_DAYS) } }),
};

// ---------------------------------------------------------------------------
// SLAs
// ---------------------------------------------------------------------------

export const slaFilters = {
  open: (): Filter => ({ status: { in: ['ON_TRACK', 'DUE_SOON', 'DUE', 'BREACHED', 'ESCALATED'] } }),
  due: (): Filter => ({ status: { in: ['DUE_SOON', 'DUE'] } }),
  breached: (): Filter => ({ status: { in: ['BREACHED', 'ESCALATED'] } }),
  unresolvedBreach: (): Filter => ({ status: { in: ['BREACHED', 'ESCALATED'] } }),
  escalated: (): Filter => ({ status: { eq: 'ESCALATED' } }),
  rule: (rule: string): Filter => ({ rule: { eq: rule } }),
  mine: (memberId: string): Filter => ({ ownerId: { eq: memberId } }),
  blocked: (): Filter => ({ escalationBlockedReason: { is: 'NOT_NULL' }, status: { eq: 'BREACHED' } }),
  recent: (now: string): Filter => ({ updatedAt: { gte: daysAgo(now, THRESHOLDS.RECENT_DAYS) } }),
};

// ---------------------------------------------------------------------------
// Onboarding & documents
// ---------------------------------------------------------------------------

export const OPEN_ONBOARDING_STATUSES = [
  'NOT_STARTED',
  'INVITED',
  'INITIATED',
  'IN_PROGRESS',
  'WAITING_FOR_PARTNER',
  'VERIFICATION',
  'INTERNAL_REVIEW',
  'CHANGES_REQUESTED',
] as const;

export const onboardingFilters = {
  open: (): Filter => ({ status: { in: [...OPEN_ONBOARDING_STATUSES] } }),
  mine: (memberId: string): Filter => ({ reviewerId: { eq: memberId } }),
  status: (statuses: readonly string[]): Filter => ({ status: { in: [...statuses] } }),
  awaitingApproval: (): Filter => ({ status: { eq: 'INTERNAL_REVIEW' } }),
  waitingForDocuments: (): Filter => ({ status: { in: ['WAITING_FOR_PARTNER', 'CHANGES_REQUESTED'] } }),
  stale: (now: string): Filter =>
    and(onboardingFilters.open(), { updatedAt: { lt: daysAgo(now, THRESHOLDS.STALE_ONBOARDING_DAYS) } }),
  recent: (now: string): Filter => ({ updatedAt: { gte: daysAgo(now, THRESHOLDS.RECENT_DAYS) } }),
};

export const documentFilters = {
  state: (states: readonly string[]): Filter => ({ verificationState: { in: [...states] } }),
  pending: (): Filter => ({ verificationState: { in: ['PENDING', 'UNDER_REVIEW'] } }),
  rejected: (): Filter => ({ verificationState: { eq: 'REJECTED' } }),
  needsReplacement: (): Filter => ({ verificationState: { eq: 'NEEDS_REPLACEMENT' } }),
  expired: (): Filter => ({ verificationState: { eq: 'EXPIRED' } }),
  backlog: (): Filter => ({
    verificationState: { in: ['PENDING', 'UNDER_REVIEW', 'REJECTED', 'NEEDS_REPLACEMENT', 'EXPIRED'] },
  }),
  nearingExpiry: (now: string): Filter =>
    and({ verificationState: { eq: 'VERIFIED' } }, between('expiresAt', now, daysAhead(now, THRESHOLDS.EXPIRY_WARNING_DAYS))),
  recent: (now: string): Filter => ({ updatedAt: { gte: daysAgo(now, THRESHOLDS.RECENT_DAYS) } }),
};

// ---------------------------------------------------------------------------
// Interactions & notifications
// ---------------------------------------------------------------------------

export const interactionFilters = {
  inWindow: (now: string): Filter => ({
    occurredAt: { gte: daysAgo(now, THRESHOLDS.COMMUNICATION_WINDOW_DAYS) },
  }),
  awaitingResponse: (now: string): Filter => ({
    outcome: { eq: 'AWAITING_RESPONSE' },
    occurredAt: { gte: daysAgo(now, THRESHOLDS.AWAITING_RESPONSE_DAYS) },
  }),
  recent: (now: string): Filter => ({ occurredAt: { gte: daysAgo(now, THRESHOLDS.RECENT_DAYS) } }),
};

export const notificationFilters = {
  unreadUrgent: (): Filter => ({ isRead: { eq: false }, priority: { in: [...HIGH_PRIORITIES] } }),
  slaRecent: (now: string): Filter => ({
    notificationType: { in: ['SLA_DUE_SOON', 'SLA_DUE', 'SLA_BREACH'] },
    createdAt: { gte: daysAgo(now, 7) },
  }),
  escalationsRecent: (now: string): Filter => ({
    notificationType: { eq: 'ESCALATION' },
    createdAt: { gte: daysAgo(now, 7) },
  }),
  emailFailed: (): Filter => ({ emailStatus: { eq: 'FAILED' } }),
  emailSkipped: (): Filter => ({ emailStatus: { eq: 'SKIPPED_NO_PROVIDER' } }),
};

// Task-channel grouping for the coordinator's "today". A follow-up task
// inherits its channel from the interaction that produced it; a task with no
// source interaction is "other".
export const CHANNEL_BUCKETS = {
  calls: ['PHONE'],
  emails: ['EMAIL'],
  whatsapp: ['WHATSAPP'],
  meetings: ['MEETING', 'VIDEO_CALL', 'EVENT'],
} as const;

export type ChannelBucket = keyof typeof CHANNEL_BUCKETS | 'other';

export const bucketForChannel = (channel: string | null | undefined): ChannelBucket => {
  for (const [bucket, channels] of Object.entries(CHANNEL_BUCKETS) as [keyof typeof CHANNEL_BUCKETS, readonly string[]][]) {
    if (channel && channels.includes(channel)) {
      return bucket;
    }
  }

  return 'other';
};

// Onboarding health, derived only from facts the record actually carries.
export type OnboardingHealth = 'HEALTHY' | 'NEEDS_ATTENTION' | 'BLOCKED';

export const onboardingHealthFor = ({
  hasBlockingDocument,
  hasBreachedSla,
  hasDueSla,
  updatedAt,
  now,
}: {
  hasBlockingDocument: boolean;
  hasBreachedSla: boolean;
  hasDueSla: boolean;
  updatedAt: string;
  now: string;
}): OnboardingHealth => {
  if (hasBlockingDocument || hasBreachedSla) {
    return 'BLOCKED';
  }

  if (hasDueSla || Date.parse(updatedAt) < Date.parse(daysAgo(now, THRESHOLDS.STALE_ONBOARDING_DAYS))) {
    return 'NEEDS_ATTENTION';
  }

  return 'HEALTHY';
};
