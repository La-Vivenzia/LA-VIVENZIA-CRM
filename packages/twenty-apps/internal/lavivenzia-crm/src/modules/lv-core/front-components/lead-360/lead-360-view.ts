import { LEAD_PRIORITY_LABELS, LEAD_STATUS_LABELS, type LeadPriority, type LeadStatus, isLeadPriority, isLeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';
import { type Lead360Model, type TimelineEntry } from 'src/modules/lv-core/services/lead-360';
import { type DashboardLens } from 'src/modules/lv-dashboard/services/caller-context';
import { type DataQualityResult } from 'src/modules/lv-intelligence/engines/data-quality';
import { ONBOARDING_STATUS_LABELS, type OnboardingStatus, isOnboardingStatus } from 'src/modules/lv-onboarding/constants/onboarding-status';

// Pure view helpers for Lead 360: what the header shows, in which order the
// sections appear for each role, how a timeline is grouped by day. No data
// access and no permission logic — capabilities come from the server model.

export type Lead360Section =
  | 'NEXT_ACTION'
  | 'OVERVIEW'
  | 'INTELLIGENCE'
  | 'TIMELINE'
  | 'TASKS'
  | 'SLA'
  | 'ONBOARDING'
  | 'DOCUMENTS'
  | 'NOTES'
  | 'ASSIGNMENT'
  | 'LIFECYCLE';

export const SECTION_TITLES: Record<Lead360Section, string> = {
  NEXT_ACTION: 'Next action',
  OVERVIEW: 'Overview',
  INTELLIGENCE: 'Intelligence',
  TIMELINE: 'Relationship timeline',
  TASKS: 'Open tasks & follow-ups',
  SLA: 'Service levels',
  ONBOARDING: 'Onboarding',
  DOCUMENTS: 'Documents',
  NOTES: 'Internal notes',
  ASSIGNMENT: 'Ownership',
  LIFECYCLE: 'Lifecycle',
};

// One page, role-aware ordering. The same sections exist for everyone the
// server lets see them; what changes is what comes first, so a hunter lands
// on contact and next action, a coordinator on follow-ups and SLAs, an
// onboarding expert on onboarding and documents.
export const sectionOrderFor = (lens: DashboardLens): Lead360Section[] => {
  switch (lens) {
    case 'COORDINATOR':
      return ['NEXT_ACTION', 'TASKS', 'SLA', 'TIMELINE', 'OVERVIEW', 'INTELLIGENCE', 'ONBOARDING', 'DOCUMENTS', 'NOTES', 'ASSIGNMENT', 'LIFECYCLE'];
    case 'ONBOARDING':
      return ['ONBOARDING', 'DOCUMENTS', 'NEXT_ACTION', 'OVERVIEW', 'TIMELINE', 'TASKS', 'NOTES', 'INTELLIGENCE', 'SLA', 'ASSIGNMENT', 'LIFECYCLE'];
    case 'ADMIN':
      return ['NEXT_ACTION', 'OVERVIEW', 'INTELLIGENCE', 'TASKS', 'SLA', 'TIMELINE', 'ONBOARDING', 'DOCUMENTS', 'NOTES', 'ASSIGNMENT', 'LIFECYCLE'];
    case 'OVERSIGHT':
      return ['OVERVIEW', 'INTELLIGENCE', 'TIMELINE', 'NEXT_ACTION', 'TASKS', 'SLA', 'ONBOARDING', 'DOCUMENTS', 'NOTES', 'ASSIGNMENT', 'LIFECYCLE'];
    case 'HUNTER':
    default:
      return ['NEXT_ACTION', 'OVERVIEW', 'INTELLIGENCE', 'TIMELINE', 'TASKS', 'NOTES', 'ONBOARDING', 'DOCUMENTS', 'SLA', 'ASSIGNMENT', 'LIFECYCLE'];
  }
};

export const statusLabel = (status: string | null | undefined): string =>
  status && isLeadStatus(status) ? LEAD_STATUS_LABELS[status as LeadStatus] : (status ?? '—');

export const priorityLabel = (priority: string | null | undefined): string =>
  isLeadPriority(priority) ? LEAD_PRIORITY_LABELS[priority as LeadPriority] : (priority ?? '—');

// An empty string is what a SELECT field holds before anyone chose a value;
// it means "not started" just as null does.
export const onboardingStatusLabel = (status: string | null | undefined): string =>
  status && isOnboardingStatus(status) ? ONBOARDING_STATUS_LABELS[status as OnboardingStatus] : status ? status : 'Not started';

export const humanize = (value: string | null | undefined): string =>
  (value ?? '—').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (character) => character.toUpperCase());

export type HeaderField = { key: string; label: string; value: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; emphasis?: boolean };

// The header strip. Exactly the fields the brief names, in the order it
// names them, with an honest "—" for anything not recorded.
export const headerFields = (model: Lead360Model): HeaderField[] => {
  const { lead, intelligence, nextAction } = model;
  const health = intelligence.health.state;
  const healthTone = health === 'HEALTHY' ? 'success' : health === 'ATTENTION' ? 'warning' : health === 'AT_RISK' ? 'danger' : 'neutral';

  return [
    { key: 'lvLeadId', label: 'LV Lead ID', value: lead.lvLeadId ?? 'pending', emphasis: true },
    { key: 'organisation', label: 'Organisation', value: lead.organisationName ?? '—' },
    { key: 'category', label: 'Category', value: humanize(lead.category) },
    { key: 'subcategory', label: 'Subcategory', value: humanize(lead.subcategory) },
    { key: 'location', label: 'Location', value: lead.location ?? '—' },
    { key: 'source', label: 'Source', value: humanize(lead.source) },
    { key: 'owner', label: 'Owner', value: lead.owner?.displayName ?? (lead.ownerId ? 'Team member' : 'Unassigned'), tone: lead.ownerId ? undefined : 'warning' },
    { key: 'status', label: 'Status', value: statusLabel(lead.status), tone: 'info' },
    { key: 'priority', label: 'Priority', value: priorityLabel(lead.priority), tone: lead.priority === 'CRITICAL' || lead.priority === 'HIGH' ? 'danger' : undefined },
    { key: 'opportunity', label: 'Opportunity score', value: intelligence.opportunity.available ? `${intelligence.opportunity.score} / 100` : 'n/a' },
    { key: 'health', label: 'Relationship health', value: humanize(health), tone: healthTone },
    { key: 'lastInteraction', label: 'Last interaction', value: lead.lastInteractionAt ? lead.lastInteractionAt.slice(0, 10) : 'None yet' },
    { key: 'nextAction', label: 'Next action', value: nextAction.task?.title ?? lead.nextAction ?? 'None scheduled', tone: nextAction.task || lead.nextAction ? undefined : 'warning' },
    { key: 'nextFollowUp', label: 'Next follow-up', value: nextAction.task?.dueAt ? nextAction.task.dueAt.slice(0, 16).replace('T', ' ') : lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 16).replace('T', ' ') : '—' },
    { key: 'onboarding', label: 'Onboarding', value: onboardingStatusLabel(model.onboarding?.status ?? lead.onboardingStatus) },
  ];
};

export type OverviewWarning = { code: string; text: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' };

// Data-quality warnings shown inside the overview. They ARE the Day 6 data
// quality engine's issues, just phrased for the field they sit beside; the
// "no interaction" and "no next follow-up" cases come from the same result.
export const overviewWarnings = (dataQuality: DataQualityResult, attention: Lead360Model['attention']): OverviewWarning[] => {
  const warnings: OverviewWarning[] = dataQuality.issues.map((issue) => ({ code: issue.code, text: issue.issue, severity: issue.severity }));

  if (attention.noInteraction && !warnings.some((warning) => warning.code === 'STALE_LEAD')) {
    warnings.push({ code: 'NO_INTERACTION', text: 'No interaction recorded yet', severity: 'MEDIUM' });
  }

  if (attention.noNextAction && !warnings.some((warning) => warning.code === 'MISSING_NEXT_ACTION' || warning.code === 'MISSING_NEXT_FOLLOW_UP')) {
    warnings.push({ code: 'NO_NEXT_FOLLOW_UP', text: 'No next follow-up scheduled', severity: 'MEDIUM' });
  }

  return warnings;
};

export type TimelineDay = { day: string; label: string; entries: TimelineEntry[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dayLabel = (iso: string, now: string): string => {
  const date = new Date(iso);
  const today = now.slice(0, 10);
  const day = iso.slice(0, 10);

  if (day === today) {
    return 'Today';
  }

  const yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);

  if (day === yesterday) {
    return 'Yesterday';
  }

  const sameYear = day.slice(0, 4) === today.slice(0, 4);

  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}${sameYear ? '' : ` ${date.getUTCFullYear()}`}`;
};

export const groupTimelineByDay = (entries: TimelineEntry[], now: string): TimelineDay[] => {
  const days: TimelineDay[] = [];

  for (const entry of entries) {
    const day = entry.at.slice(0, 10);
    const current = days[days.length - 1];

    if (current && current.day === day) {
      current.entries.push(entry);
    } else {
      days.push({ day, label: dayLabel(entry.at, now), entries: [entry] });
    }
  }

  return days;
};

export const formatDateTimeLocal = (iso: string | null | undefined): string => {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// A datetime-local value is wall-clock time in the browser's zone; the API
// wants an instant.
export const localInputToIso = (value: string): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const dueLabel = (iso: string | null, now: string): { text: string; tone: 'neutral' | 'warning' | 'danger' | 'success' } => {
  if (!iso) {
    return { text: 'No due date', tone: 'neutral' };
  }

  const diff = Date.parse(iso) - Date.parse(now);
  const day = iso.slice(0, 10);
  const today = now.slice(0, 10);

  if (diff < 0) {
    const days = Math.max(1, Math.round(-diff / 86_400_000));

    return { text: `Overdue by ${days} day${days === 1 ? '' : 's'}`, tone: 'danger' };
  }

  if (day === today) {
    return { text: `Today, ${timeOfDay(iso)}`, tone: 'warning' };
  }

  const tomorrow = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);

  if (day === tomorrow) {
    return { text: `Tomorrow, ${timeOfDay(iso)}`, tone: 'success' };
  }

  return { text: `${dayLabel(iso, now)}, ${timeOfDay(iso)}`, tone: 'neutral' };
};

// Wall-clock time in the viewer's zone, "11:00".
export const timeOfDay = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
