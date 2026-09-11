import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// The notification catalogue: one builder per event in
// ASSIGNMENT-SLA-NOTIFICATIONS.md "Notification types". Builders are pure —
// they decide title, body, priority, deep link, dedupe key and whether email is
// warranted. They never decide WHO is notified from anything a client sent:
// every recipient passed in here was read from the record by the producer
// (lead.ownerId, onboarding.reviewerId, task.assigneeId, a mention in a note).
//
// The central service (services/notification-service.ts) is the only writer.

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
  // SLA clock states before a breach (Day 4B). In-app only.
  'SLA_DUE_SOON',
  'SLA_DUE',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const isNotificationType = (value: string): value is NotificationType =>
  (NOTIFICATION_TYPES as readonly string[]).includes(value);

// Object the deep link opens. Restricted to objects the recipient can be shown
// under CM-004 — see the recipient comments in each builder.
export type NotificationTargetObject =
  | 'lvLead'
  | 'lvOnboarding'
  | 'lvOnboardingDocument'
  | 'task'
  | 'note';

export type NotificationTarget = {
  object: NotificationTargetObject;
  recordId: string;
};

// Where the record page for a target lives in Twenty. Kept in one place so a
// route change is one edit, and so the tests can assert the exact path the
// centre navigates to.
export const deepLinkFor = (target: NotificationTarget): string =>
  `/object/${target.object}/${target.recordId}`;

export type NotificationIntent = {
  type: NotificationType;
  recipientWorkspaceMemberId: string;
  title: string;
  body: string;
  priority: LeadPriority;
  target: NotificationTarget;
  // The lead this concerns, when there is one — populates the real relation.
  leadId: string | null;
  // Deterministic. Same event + same recipient = same key, so a replay is a
  // no-op. Distinct events on the same record (two reassignments) get
  // distinct keys through the event-specific component.
  dedupeKey: string;
  // Whether this notification also goes out by email. Decided by type and
  // priority here; delivery and its outcome are the email pipeline's concern.
  email: boolean;
  metadata: Record<string, unknown>;
};

// Types where an email is worth the interruption. Everything else is in-app
// only — "Do not send email for every in-app event."
const EMAIL_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'SLA_BREACH',
  'ESCALATION',
  'APPROVAL_REQUIRED',
  'DOCUMENT_REJECTED',
]);

// Assignment and reassignment email only when the lead itself is urgent.
const EMAIL_WORTHY_ASSIGNMENT_PRIORITIES: ReadonlySet<LeadPriority> =
  new Set<LeadPriority>(['CRITICAL', 'HIGH']);

export const shouldEmail = (type: NotificationType, priority: LeadPriority): boolean => {
  if (EMAIL_TYPES.has(type)) {
    return true;
  }

  if (type === 'LEAD_ASSIGNED' || type === 'LEAD_REASSIGNED') {
    return EMAIL_WORTHY_ASSIGNMENT_PRIORITIES.has(priority);
  }

  return false;
};

const lead = (leadId: string): NotificationTarget => ({ object: 'lvLead', recordId: leadId });

// A time component that is stable for one event and different for the next.
// Producers pass the record's own updatedAt from the event payload, so a
// replayed event reproduces the key exactly.
const eventStamp = (isoTimestamp: string): string => isoTimestamp.replace(/[^0-9]/g, '');

const shortUtc = (isoTimestamp: string): string =>
  `${isoTimestamp.slice(0, 16).replace('T', ' ')} UTC`;

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

export const buildLeadAssignedNotification = ({
  leadId,
  leadName,
  recipientWorkspaceMemberId,
  previousOwnerWorkspaceMemberId,
  assignedByName,
  priority,
  changedAt,
}: {
  leadId: string;
  leadName: string;
  recipientWorkspaceMemberId: string;
  previousOwnerWorkspaceMemberId: string | null;
  assignedByName: string | null;
  priority: LeadPriority;
  // updatedAt of the lead row after the change — from the event, not "now".
  changedAt: string;
}): NotificationIntent => {
  const isReassignment = previousOwnerWorkspaceMemberId !== null;
  const type: NotificationType = isReassignment ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED';
  const attribution =
    assignedByName === null ? 'Assigned automatically' : `Assigned by ${assignedByName}`;

  return {
    type,
    recipientWorkspaceMemberId,
    title: isReassignment ? `Lead reassigned to you: ${leadName}` : `New lead: ${leadName}`,
    body: `${attribution}. Priority ${priority.toLowerCase()}.`,
    priority,
    target: lead(leadId),
    leadId,
    dedupeKey: `${type}:${leadId}:${recipientWorkspaceMemberId}:${eventStamp(changedAt)}`,
    email: shouldEmail(type, priority),
    metadata: { previousOwnerWorkspaceMemberId, assignedByName },
  };
};

// Only the new owner is told. The previous owner loses access to the lead the
// moment ownership moves (CM-004 scopes leads by owner), so a notification to
// them would deep-link to a record they can no longer open — exactly what
// "never receive a notification that reveals a record they cannot access"
// forbids.
export const notificationsForOwnerChange = ({
  leadId,
  leadName,
  previousOwnerWorkspaceMemberId,
  newOwnerWorkspaceMemberId,
  assignedByName,
  priority,
  changedAt,
}: {
  leadId: string;
  leadName: string;
  previousOwnerWorkspaceMemberId: string | null;
  newOwnerWorkspaceMemberId: string | null;
  assignedByName: string | null;
  priority: LeadPriority;
  changedAt: string;
}): readonly NotificationIntent[] => {
  if (
    newOwnerWorkspaceMemberId === null ||
    newOwnerWorkspaceMemberId === previousOwnerWorkspaceMemberId
  ) {
    return [];
  }

  return [
    buildLeadAssignedNotification({
      leadId,
      leadName,
      recipientWorkspaceMemberId: newOwnerWorkspaceMemberId,
      previousOwnerWorkspaceMemberId,
      assignedByName,
      priority,
      changedAt,
    }),
  ];
};

// ---------------------------------------------------------------------------
// Follow-ups (Twenty tasks)
// ---------------------------------------------------------------------------

export const buildFollowUpNotification = ({
  taskId,
  taskTitle,
  leadId,
  leadName,
  assigneeWorkspaceMemberId,
  dueAt,
  priority,
  isOverdue,
}: {
  taskId: string;
  taskTitle: string;
  leadId: string | null;
  leadName: string | null;
  assigneeWorkspaceMemberId: string;
  dueAt: string;
  priority: LeadPriority;
  isOverdue: boolean;
}): NotificationIntent => {
  const type: NotificationType = isOverdue ? 'FOLLOW_UP_OVERDUE' : 'FOLLOW_UP_DUE';
  const about = leadName ? ` for ${leadName}` : '';

  return {
    type,
    recipientWorkspaceMemberId: assigneeWorkspaceMemberId,
    title: isOverdue ? `Overdue: ${taskTitle}` : `Due soon: ${taskTitle}`,
    body: isOverdue
      ? `This follow-up${about} was due ${shortUtc(dueAt)} and is still open.`
      : `This follow-up${about} is due ${shortUtc(dueAt)}.`,
    // An overdue follow-up is at least HIGH regardless of the task's own level.
    priority: isOverdue && (priority === 'LOW' || priority === 'MEDIUM') ? 'HIGH' : priority,
    target: { object: 'task', recordId: taskId },
    leadId,
    // Rescheduling a task changes dueAt, which produces a fresh reminder; a
    // re-run of the sweep on the same due time does not.
    dedupeKey: `${type}:${taskId}:${eventStamp(dueAt)}`,
    email: false,
    metadata: { dueAt, taskTitle },
  };
};

// ---------------------------------------------------------------------------
// Lead reply
// ---------------------------------------------------------------------------

export const buildLeadRepliedNotification = ({
  leadId,
  leadName,
  interactionId,
  channelLabel,
  ownerWorkspaceMemberId,
  priority,
}: {
  leadId: string;
  leadName: string;
  interactionId: string;
  channelLabel: string;
  ownerWorkspaceMemberId: string;
  priority: LeadPriority;
}): NotificationIntent => ({
  type: 'LEAD_REPLIED',
  recipientWorkspaceMemberId: ownerWorkspaceMemberId,
  title: `${leadName} replied`,
  body: `An inbound ${channelLabel.toLowerCase()} interaction was logged on this lead.`,
  // A reply is a live conversation — never lower than HIGH.
  priority: priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
  target: lead(leadId),
  leadId,
  dedupeKey: `LEAD_REPLIED:${interactionId}:${ownerWorkspaceMemberId}`,
  email: false,
  metadata: { interactionId, channel: channelLabel },
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export type OnboardingEventKind =
  | 'ONBOARDING_STARTED'
  | 'ONBOARDING_COMPLETED'
  | 'APPROVAL_REQUIRED';

// Which status change means what. INITIATED is the partner beginning the
// journey; INTERNAL_REVIEW is the reviewer's cue that a human decision is now
// required; ACTIVATED is the partner live. Other transitions are visible on
// the record and in the timeline but do not interrupt anyone.
export const onboardingEventForStatus = (status: string): OnboardingEventKind | null => {
  switch (status) {
    case 'INITIATED':
      return 'ONBOARDING_STARTED';
    case 'INTERNAL_REVIEW':
      return 'APPROVAL_REQUIRED';
    case 'ACTIVATED':
      return 'ONBOARDING_COMPLETED';
    default:
      return null;
  }
};

const ONBOARDING_TITLES: Record<OnboardingEventKind, (name: string) => string> = {
  ONBOARDING_STARTED: (name) => `Onboarding started: ${name}`,
  APPROVAL_REQUIRED: (name) => `Approval required: ${name}`,
  ONBOARDING_COMPLETED: (name) => `Onboarding completed: ${name}`,
};

const ONBOARDING_BODIES: Record<OnboardingEventKind, string> = {
  ONBOARDING_STARTED: 'The partner has begun their onboarding.',
  APPROVAL_REQUIRED: 'All documents are checked. This onboarding is waiting for your decision.',
  ONBOARDING_COMPLETED: 'The partner is activated and live.',
};

const ONBOARDING_PRIORITY: Record<OnboardingEventKind, LeadPriority> = {
  ONBOARDING_STARTED: 'MEDIUM',
  APPROVAL_REQUIRED: 'HIGH',
  ONBOARDING_COMPLETED: 'MEDIUM',
};

// Recipients for an onboarding event, each with a target THEY can open:
//   - the reviewer is scoped to the onboarding itself (CM-004: reviewerId)
//   - the lead owner is scoped to the lead (CM-004: ownerId) — they are not
//     the reviewer, so the onboarding record would be hidden from them.
// Approval is the reviewer's decision alone, so only the reviewer is told.
export const notificationsForOnboardingStatus = ({
  onboardingId,
  onboardingName,
  status,
  changedAt,
  reviewerWorkspaceMemberId,
  leadId,
  leadOwnerWorkspaceMemberId,
}: {
  onboardingId: string;
  onboardingName: string;
  status: string;
  changedAt: string;
  reviewerWorkspaceMemberId: string | null;
  leadId: string | null;
  leadOwnerWorkspaceMemberId: string | null;
}): readonly NotificationIntent[] => {
  const kind = onboardingEventForStatus(status);

  if (kind === null) {
    return [];
  }

  const build = (recipient: string, target: NotificationTarget): NotificationIntent => ({
    type: kind,
    recipientWorkspaceMemberId: recipient,
    title: ONBOARDING_TITLES[kind](onboardingName),
    body: ONBOARDING_BODIES[kind],
    priority: ONBOARDING_PRIORITY[kind],
    target,
    leadId,
    dedupeKey: `${kind}:${onboardingId}:${recipient}:${eventStamp(changedAt)}`,
    email: shouldEmail(kind, ONBOARDING_PRIORITY[kind]),
    metadata: { onboardingId, status },
  });

  const intents: NotificationIntent[] = [];

  if (reviewerWorkspaceMemberId !== null) {
    intents.push(
      build(reviewerWorkspaceMemberId, { object: 'lvOnboarding', recordId: onboardingId }),
    );
  }

  if (
    kind !== 'APPROVAL_REQUIRED' &&
    leadId !== null &&
    leadOwnerWorkspaceMemberId !== null &&
    leadOwnerWorkspaceMemberId !== reviewerWorkspaceMemberId
  ) {
    intents.push(build(leadOwnerWorkspaceMemberId, lead(leadId)));
  }

  return intents;
};

// ---------------------------------------------------------------------------
// Document rejected
// ---------------------------------------------------------------------------

// The reviewer normally IS the person rejecting, in which case the service
// drops them as the actor. The lead owner is the one who has to go back to the
// partner for a replacement, so they are the substantive recipient — linked to
// the lead, which is the record they can open.
export const notificationsForDocumentRejected = ({
  documentId,
  documentLabel,
  onboardingId,
  reason,
  changedAt,
  reviewerWorkspaceMemberId,
  leadId,
  leadName,
  leadOwnerWorkspaceMemberId,
}: {
  documentId: string;
  documentLabel: string;
  onboardingId: string | null;
  reason: string | null;
  changedAt: string;
  reviewerWorkspaceMemberId: string | null;
  leadId: string | null;
  leadName: string | null;
  leadOwnerWorkspaceMemberId: string | null;
}): readonly NotificationIntent[] => {
  const about = leadName ? ` (${leadName})` : '';
  const body = reason
    ? `Rejected: ${reason}. A replacement is needed before onboarding can continue.`
    : 'A replacement is needed before onboarding can continue.';

  const build = (recipient: string, target: NotificationTarget): NotificationIntent => ({
    type: 'DOCUMENT_REJECTED',
    recipientWorkspaceMemberId: recipient,
    title: `Document rejected: ${documentLabel}${about}`,
    body,
    priority: 'HIGH',
    target,
    leadId,
    dedupeKey: `DOCUMENT_REJECTED:${documentId}:${recipient}:${eventStamp(changedAt)}`,
    email: shouldEmail('DOCUMENT_REJECTED', 'HIGH'),
    metadata: { documentId, onboardingId, reason },
  });

  const intents: NotificationIntent[] = [];

  if (reviewerWorkspaceMemberId !== null) {
    intents.push(
      build(reviewerWorkspaceMemberId, {
        object: 'lvOnboardingDocument',
        recordId: documentId,
      }),
    );
  }

  if (
    leadId !== null &&
    leadOwnerWorkspaceMemberId !== null &&
    leadOwnerWorkspaceMemberId !== reviewerWorkspaceMemberId
  ) {
    intents.push(build(leadOwnerWorkspaceMemberId, lead(leadId)));
  }

  return intents;
};

// ---------------------------------------------------------------------------
// Mention (Twenty note body)
// ---------------------------------------------------------------------------

export const buildMentionNotification = ({
  noteId,
  noteTitle,
  mentionedWorkspaceMemberId,
  authorName,
  leadId,
}: {
  noteId: string;
  noteTitle: string;
  mentionedWorkspaceMemberId: string;
  authorName: string | null;
  leadId: string | null;
}): NotificationIntent => ({
  type: 'MENTION',
  recipientWorkspaceMemberId: mentionedWorkspaceMemberId,
  title: authorName ? `${authorName} mentioned you` : 'You were mentioned',
  body: noteTitle ? `In the note "${noteTitle}".` : 'In a note.',
  priority: 'MEDIUM',
  // Notes are readable by every LV role and are not row-scoped, so the note
  // itself is always a target the recipient can open.
  target: { object: 'note', recordId: noteId },
  leadId,
  // Once per note per person. Editing the note does not re-notify.
  dedupeKey: `MENTION:${noteId}:${mentionedWorkspaceMemberId}`,
  email: false,
  metadata: { noteId },
});

// ---------------------------------------------------------------------------
// SLA — produced by the SLA engine (Phase 4B). The builders live here so the
// engine uses this service rather than a second one.
// ---------------------------------------------------------------------------

export const buildSlaDueNotification = ({
  slaRecordId,
  ruleLabel,
  expectation,
  ownerWorkspaceMemberId,
  target,
  leadId,
  subjectName,
  dueAt,
  priority,
  kind,
}: {
  slaRecordId: string;
  ruleLabel: string;
  expectation: string;
  ownerWorkspaceMemberId: string;
  target: NotificationTarget;
  leadId: string | null;
  subjectName: string;
  dueAt: string;
  priority: LeadPriority;
  kind: 'DUE_SOON' | 'DUE';
}): NotificationIntent => {
  const type: NotificationType = kind === 'DUE' ? 'SLA_DUE' : 'SLA_DUE_SOON';

  return {
    type,
    recipientWorkspaceMemberId: ownerWorkspaceMemberId,
    title:
      kind === 'DUE'
        ? `SLA due now: ${ruleLabel} — ${subjectName}`
        : `SLA due soon: ${ruleLabel} — ${subjectName}`,
    body: `${expectation} Due ${shortUtc(dueAt)}.`,
    // Due soon is a nudge; due is at least HIGH.
    priority: kind === 'DUE' && (priority === 'LOW' || priority === 'MEDIUM') ? 'HIGH' : priority,
    target,
    leadId,
    // One per SLA per state per owner: a re-run never repeats it, a
    // reassignment tells the new owner.
    dedupeKey: `${type}:${slaRecordId}:${ownerWorkspaceMemberId}`,
    email: false,
    metadata: { slaRecordId, ruleLabel, dueAt },
  };
};

export const buildSlaBreachNotification = ({
  slaRecordId,
  ruleLabel,
  ownerWorkspaceMemberId,
  target,
  leadId,
  subjectName,
  dueAt,
  priority,
}: {
  slaRecordId: string;
  ruleLabel: string;
  ownerWorkspaceMemberId: string;
  target: NotificationTarget;
  leadId: string | null;
  subjectName: string;
  dueAt: string;
  priority: LeadPriority;
}): NotificationIntent => ({
  type: 'SLA_BREACH',
  recipientWorkspaceMemberId: ownerWorkspaceMemberId,
  title: `SLA breached: ${ruleLabel} — ${subjectName}`,
  body: `Was due ${shortUtc(dueAt)} and has not been actioned.`,
  priority,
  target,
  leadId,
  dedupeKey: `SLA_BREACH:${slaRecordId}:${ownerWorkspaceMemberId}`,
  email: shouldEmail('SLA_BREACH', priority),
  metadata: { slaRecordId, ruleLabel, dueAt },
});

export const buildEscalationNotification = ({
  slaRecordId,
  ruleLabel,
  managerWorkspaceMemberId,
  ownerName,
  target,
  leadId,
  subjectName,
  dueAt,
}: {
  slaRecordId: string;
  ruleLabel: string;
  managerWorkspaceMemberId: string;
  ownerName: string | null;
  target: NotificationTarget;
  leadId: string | null;
  subjectName: string;
  dueAt: string;
}): NotificationIntent => ({
  type: 'ESCALATION',
  recipientWorkspaceMemberId: managerWorkspaceMemberId,
  title: `Escalation: ${ruleLabel} — ${subjectName}`,
  body: `${ownerName ?? 'The owner'} has not actioned this since it was due ${shortUtc(dueAt)}.`,
  priority: 'CRITICAL',
  target,
  leadId,
  dedupeKey: `ESCALATION:${slaRecordId}:${managerWorkspaceMemberId}`,
  email: shouldEmail('ESCALATION', 'CRITICAL'),
  metadata: { slaRecordId, ruleLabel, dueAt, ownerName },
});
