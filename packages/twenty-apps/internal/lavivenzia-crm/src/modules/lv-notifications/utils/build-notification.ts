import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// Minimal notification foundation. Twenty ships no notification system at all
// (only ephemeral toasts and transactional email templates), so this is the
// seed of the lv-notifications module rather than a wrapper over something.
//
// Phase 1 delivers IN_APP records only. ASSIGNMENT-SLA-NOTIFICATIONS.md asks for
// "in-app first, email second, optional WhatsApp/push" — the extra channels are
// listed in the type so the data model does not have to change when they land.

export const NOTIFICATION_TYPES = [
  'LEAD_ASSIGNED',
  'LEAD_REASSIGNED',
  'FOLLOW_UP_DUE',
  'FOLLOW_UP_OVERDUE',
  'SLA_BREACH',
  'LEAD_REPLIED',
  'ONBOARDING_STARTED',
  'ONBOARDING_COMPLETED',
  'DOCUMENT_REJECTED',
  'APPROVAL_REQUIRED',
  'MENTION',
  'ESCALATION',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL', 'WHATSAPP', 'PUSH'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationDraft = {
  recipientWorkspaceMemberId: string;
  type: NotificationType;
  title: string;
  body: string;
  // Relative link the in-app centre routes to.
  deepLink: string;
  priority: LeadPriority;
  channels: readonly NotificationChannel[];
  // Stable key. "Notifications must be idempotent" — a retried logic function
  // or a replayed database event must not notify twice, so the writer upserts
  // on this rather than inserting blindly.
  dedupeKey: string;
  createdAt: string;
  isRead: false;
};

export const buildLeadAssignedNotification = ({
  leadId,
  leadName,
  recipientWorkspaceMemberId,
  assignedByName,
  isReassignment,
  priority,
  now,
}: {
  leadId: string;
  leadName: string;
  recipientWorkspaceMemberId: string;
  assignedByName: string | null;
  isReassignment: boolean;
  priority: LeadPriority;
  now: string;
}): NotificationDraft => {
  const type: NotificationType = isReassignment
    ? 'LEAD_REASSIGNED'
    : 'LEAD_ASSIGNED';

  const attribution =
    assignedByName === null
      ? 'Assigned automatically'
      : `Assigned by ${assignedByName}`;

  return {
    recipientWorkspaceMemberId,
    type,
    title: isReassignment ? `Lead reassigned to you: ${leadName}` : `New lead: ${leadName}`,
    body: `${attribution}. Priority ${priority.toLowerCase()}.`,
    deepLink: `/object/lvLead/${leadId}`,
    priority,
    // Critical work is the one case worth interrupting someone outside the app.
    channels: priority === 'CRITICAL' ? ['IN_APP', 'EMAIL'] : ['IN_APP'],
    dedupeKey: `${type}:${leadId}:${recipientWorkspaceMemberId}`,
    createdAt: now,
    isRead: false,
  };
};

// Assignment notifications go to the new owner only. The previous owner is not
// notified of losing a lead in Phase 1 — ASSIGNMENT-SLA-NOTIFICATIONS.md lists
// "reassignment" as a type, but who receives it is a policy decision the
// founder has not made, and guessing would create noise.
export const notificationsForAssignment = ({
  leadId,
  leadName,
  previousOwnerId,
  newOwnerId,
  assignedByName,
  priority,
  now,
}: {
  leadId: string;
  leadName: string;
  previousOwnerId: string | null;
  newOwnerId: string | null;
  assignedByName: string | null;
  priority: LeadPriority;
  now: string;
}): readonly NotificationDraft[] => {
  if (newOwnerId === null || newOwnerId === previousOwnerId) {
    return [];
  }

  return [
    buildLeadAssignedNotification({
      leadId,
      leadName,
      recipientWorkspaceMemberId: newOwnerId,
      assignedByName,
      isReassignment: previousOwnerId !== null,
      priority,
      now,
    }),
  ];
};
