import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  isNotificationType,
  type NotificationType,
} from 'src/modules/lv-notifications/utils/build-notification';

// Presentation rules for the notification centre, kept out of the component so
// they are unit-testable: how a row is labelled, sorted, filtered and timed.

export type NotificationRow = {
  id: string;
  name: string | null;
  body: string | null;
  notificationType: string | null;
  priority: string | null;
  isRead: boolean | null;
  readAt: string | null;
  createdAt: string;
  deepLink: string | null;
  targetObject: string | null;
  targetRecordId: string | null;
  lead?: { id: string; name: string | null; lvLeadId: string | null } | null;
  emailStatus: string | null;
};

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const TYPE_LABEL: Record<NotificationType, string> = {
  LEAD_ASSIGNED: 'Assigned',
  LEAD_REASSIGNED: 'Reassigned',
  FOLLOW_UP_DUE: 'Follow-up due',
  FOLLOW_UP_OVERDUE: 'Overdue',
  SLA_BREACH: 'SLA breach',
  LEAD_REPLIED: 'Reply',
  ONBOARDING_STARTED: 'Onboarding',
  ONBOARDING_COMPLETED: 'Activated',
  DOCUMENT_REJECTED: 'Document',
  APPROVAL_REQUIRED: 'Approval',
  MENTION: 'Mention',
  ESCALATION: 'Escalation',
  SLA_DUE_SOON: 'SLA due soon',
  SLA_DUE: 'SLA due',
};

export const typeLabel = (type: string | null): string =>
  type && isNotificationType(type) ? TYPE_LABEL[type] : 'Notification';

export const PRIORITY_TONE: Record<LeadPriority, Tone> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
};

export const priorityTone = (priority: string | null): Tone =>
  priority && priority in PRIORITY_TONE ? PRIORITY_TONE[priority as LeadPriority] : 'neutral';

const PRIORITY_RANK: Record<LeadPriority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const rankOf = (priority: string | null): number =>
  priority && priority in PRIORITY_RANK ? PRIORITY_RANK[priority as LeadPriority] : 4;

export type Filter = 'ALL' | 'UNREAD';

// Unread first, then urgency, then newest. A read CRITICAL never outranks an
// unread LOW: the centre is an inbox, not a severity report.
export const sortNotifications = (rows: readonly NotificationRow[]): NotificationRow[] =>
  [...rows].sort((a, b) => {
    const unread = Number(Boolean(a.isRead)) - Number(Boolean(b.isRead));

    if (unread !== 0) {
      return unread;
    }

    const rank = rankOf(a.priority) - rankOf(b.priority);

    if (rank !== 0) {
      return rank;
    }

    return b.createdAt.localeCompare(a.createdAt);
  });

export const applyFilter = (rows: readonly NotificationRow[], filter: Filter): NotificationRow[] =>
  filter === 'UNREAD' ? rows.filter((row) => !row.isRead) : [...rows];

export const unreadCount = (rows: readonly NotificationRow[]): number =>
  rows.filter((row) => !row.isRead).length;

// "just now", "5 min ago", "3 h ago", "2 d ago", else the date.
export const relativeTime = (isoTimestamp: string, now: string): string => {
  const then = Date.parse(isoTimestamp);
  const at = Date.parse(now);

  if (Number.isNaN(then) || Number.isNaN(at)) {
    return '';
  }

  const seconds = Math.max(0, Math.round((at - then) / 1000));

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} h ago`;
  }

  const days = Math.round(hours / 24);

  if (days < 7) {
    return `${days} d ago`;
  }

  return isoTimestamp.slice(0, 10);
};

// Where a click goes. The deep link stored on the row is authoritative; the
// target fields are the fallback for rows written before deepLink existed.
export const navigationTargetFor = (
  row: NotificationRow,
): { objectNameSingular: string; objectRecordId: string } | null => {
  if (row.targetObject && row.targetRecordId) {
    return { objectNameSingular: row.targetObject, objectRecordId: row.targetRecordId };
  }

  const match = row.deepLink?.match(/^\/object\/([^/]+)\/([^/?#]+)/);

  return match ? { objectNameSingular: match[1], objectRecordId: match[2] } : null;
};
