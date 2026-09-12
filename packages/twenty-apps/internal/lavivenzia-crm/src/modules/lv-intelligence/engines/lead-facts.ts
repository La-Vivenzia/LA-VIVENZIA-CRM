import { type LeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { INACTIVE_STATUSES, OPEN_WORKLOAD_STATUSES } from 'src/modules/lv-dashboard/metrics/definitions';

// The deterministic engines never read raw records; they read LeadFacts — a
// small, fully derived view of the context. Every fact is something the CRM
// actually recorded. Keeping the derivation in one place makes the scoring,
// health and next-best-action rules easy to audit against the data model.

export type LeadFacts = {
  leadId: string;
  label: string;
  status: string;
  priority: string;
  source: string | null;
  isOpen: boolean;
  isInactive: boolean;
  ageDays: number;
  dataCompleteness: number | null;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  hasInstagram: boolean;
  hasOrganisation: boolean;
  hasLocation: boolean;
  hasCategory: boolean;
  interactionCount: number;
  inboundCount: number;
  outboundCount: number;
  daysSinceLastInteraction: number | null;
  daysSinceLastInbound: number | null;
  lastInteraction: { id: string; channel: string | null; direction: string | null; outcome: string | null; sentiment: string | null; occurredAt: string | null } | null;
  awaitingResponseSince: string | null;
  awaitingResponseDays: number | null;
  recentSentiments: string[];
  hasNextAction: boolean;
  nextFollowUpAt: string | null;
  nextFollowUpOverdue: boolean;
  openTasks: { id: string; title: string | null; dueAt: string | null; overdueDays: number | null; priority: string | null }[];
  overdueTasks: { id: string; title: string | null; dueAt: string | null; overdueDays: number }[];
  openSlas: { id: string; rule: string | null; status: string | null; dueAt: string | null }[];
  breachedSlas: { id: string; rule: string | null; status: string | null }[];
  onboarding: { id: string; status: string | null; progress: number | null; daysSinceUpdate: number; rejectedDocs: number; pendingDocs: number; expiredDocs: number; missingRequired: string[] } | null;
  openProblems: { id: string; severity: string | null; problemType: string | null }[];
  now: string;
};

const DAY = 86_400_000;

export const daysBetween = (from: string | null | undefined, to: string): number | null => {
  if (!from) {
    return null;
  }

  const start = Date.parse(from);

  return Number.isFinite(start) ? Math.floor((Date.parse(to) - start) / DAY) : null;
};

const present = (value: string | null | undefined): boolean => typeof value === 'string' && value.trim().length > 0;

export const deriveLeadFacts = (context: LeadContext, now = new Date().toISOString()): LeadFacts => {
  const { lead } = context;
  const status = lead.status ?? 'NEW';
  const interactions = [...context.interactions].sort((a, b) => Date.parse(b.occurredAt ?? '0') - Date.parse(a.occurredAt ?? '0'));
  const last = interactions[0] ?? null;
  const lastInbound = interactions.find((row) => row.direction === 'INBOUND') ?? null;
  const awaiting = interactions.find((row) => row.outcome === 'AWAITING_RESPONSE') ?? null;
  const awaitingIsCurrent = awaiting !== null && (lastInbound === null || Date.parse(awaiting.occurredAt ?? '0') >= Date.parse(lastInbound.occurredAt ?? '0'));
  const openTasks = context.tasks
    .filter((task) => task.status !== 'DONE')
    .map((task) => {
      const overdue = task.dueAt && Date.parse(task.dueAt) < Date.parse(now) ? daysBetween(task.dueAt, now) : null;

      return { id: task.id, title: task.title, dueAt: task.dueAt, overdueDays: overdue, priority: task.lvPriority };
    });
  const openSlaStatuses = new Set(['ON_TRACK', 'DUE_SOON', 'DUE', 'BREACHED', 'ESCALATED']);
  const openSlas = context.slas.filter((sla) => sla.status && openSlaStatuses.has(sla.status));
  const onboarding = context.onboarding;
  const docs = onboarding?.documents ?? [];

  return {
    leadId: lead.id,
    label: [lead.lvLeadId, lead.name].filter(Boolean).join(' '),
    status,
    priority: lead.priority ?? 'MEDIUM',
    source: lead.source,
    isOpen: (OPEN_WORKLOAD_STATUSES as readonly string[]).includes(status),
    isInactive: (INACTIVE_STATUSES as readonly string[]).includes(status),
    ageDays: daysBetween(lead.createdAt, now) ?? 0,
    dataCompleteness: lead.dataCompleteness,
    hasEmail: present(lead.emails?.primaryEmail),
    hasPhone: present(lead.phones?.primaryPhoneNumber),
    hasWebsite: present(lead.website?.primaryLinkUrl),
    hasInstagram: present(lead.instagram?.primaryLinkUrl),
    hasOrganisation: present(lead.organisationName),
    hasLocation: present(lead.location),
    hasCategory: present(lead.category),
    interactionCount: interactions.length,
    inboundCount: interactions.filter((row) => row.direction === 'INBOUND').length,
    outboundCount: interactions.filter((row) => row.direction === 'OUTBOUND').length,
    daysSinceLastInteraction: daysBetween(last?.occurredAt ?? lead.lastInteractionAt, now),
    daysSinceLastInbound: daysBetween(lastInbound?.occurredAt, now),
    lastInteraction: last ? { id: last.id, channel: last.channel, direction: last.direction, outcome: last.outcome, sentiment: last.sentiment, occurredAt: last.occurredAt } : null,
    awaitingResponseSince: awaitingIsCurrent ? awaiting?.occurredAt ?? null : null,
    awaitingResponseDays: awaitingIsCurrent ? daysBetween(awaiting?.occurredAt, now) : null,
    recentSentiments: interactions.slice(0, 3).map((row) => row.sentiment ?? 'UNKNOWN'),
    hasNextAction: present(lead.nextAction),
    nextFollowUpAt: lead.nextFollowUpAt,
    nextFollowUpOverdue: Boolean(lead.nextFollowUpAt && Date.parse(lead.nextFollowUpAt) < Date.parse(now)),
    openTasks,
    overdueTasks: openTasks.filter((task): task is typeof task & { overdueDays: number } => task.overdueDays !== null && task.overdueDays >= 0).map((task) => ({ id: task.id, title: task.title, dueAt: task.dueAt, overdueDays: task.overdueDays })),
    openSlas: openSlas.map((sla) => ({ id: sla.id, rule: sla.rule, status: sla.status, dueAt: sla.dueAt })),
    breachedSlas: openSlas.filter((sla) => sla.status === 'BREACHED' || sla.status === 'ESCALATED').map((sla) => ({ id: sla.id, rule: sla.rule, status: sla.status })),
    onboarding: onboarding
      ? {
          id: onboarding.id,
          status: onboarding.status,
          progress: onboarding.progressPercentage,
          daysSinceUpdate: daysBetween(onboarding.updatedAt, now) ?? 0,
          rejectedDocs: docs.filter((doc) => doc.verificationState === 'REJECTED' || doc.verificationState === 'NEEDS_REPLACEMENT').length,
          pendingDocs: docs.filter((doc) => doc.verificationState === 'PENDING' || doc.verificationState === 'UNDER_REVIEW').length,
          expiredDocs: docs.filter((doc) => doc.verificationState === 'EXPIRED').length,
          missingRequired: docs.some((doc) => doc.documentType === 'IDENTITY') ? [] : ['IDENTITY'],
        }
      : null,
    openProblems: context.problems.filter((problem) => problem.status === 'OPEN' || problem.status === 'IN_PROGRESS').map((problem) => ({ id: problem.id, severity: problem.severity, problemType: problem.problemType })),
    now,
  };
};
