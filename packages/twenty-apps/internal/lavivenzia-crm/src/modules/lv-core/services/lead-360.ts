import { type CallerContext, type DashboardLens } from 'src/modules/lv-dashboard/services/caller-context';
import { type LeadStatus, isLeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';
import { LEAD_CAPTURE_MODE_LABELS, type LeadCaptureMode, SOCIAL_PLATFORM_LABELS, type SocialPlatform } from 'src/modules/lv-core/constants/lead-taxonomy';
import { isClosedOrArchived, SETTABLE_STATUSES } from 'src/modules/lv-governance/services/governance';
import { type DataQualityResult } from 'src/modules/lv-intelligence/engines/data-quality';
import { type NextBestActionResult } from 'src/modules/lv-intelligence/engines/next-best-action';
import { type OpportunityScoreResult } from 'src/modules/lv-intelligence/engines/opportunity-score';
import { type RelationshipHealthResult } from 'src/modules/lv-intelligence/engines/relationship-health';
import { type LeadContext, type TaskRecord } from 'src/modules/lv-intelligence/services/lead-context';
import { ONBOARDING_STEP_LABELS, type OnboardingStep } from 'src/modules/lv-onboarding/constants/onboarding-steps';
import { type StepProgress } from 'src/modules/lv-onboarding/utils/onboarding-progress';

// The Lead 360 view model: everything an employee needs to work one
// relationship, composed ONCE on the server from records the caller can see.
//
// Pure. The route loads the records (delegated, so CM-004 and object
// permissions already applied) and this file turns them into sections,
// capabilities and a merged timeline. Keeping it pure means the composition
// is unit-tested without a server, and the front component never derives
// permissions on its own — it renders what `capabilities` says.

export type MemberSummary = { id: string; displayName: string | null; email: string | null };

export type Lead360Capabilities = {
  canEdit: boolean;
  canLogInteraction: boolean;
  canCreateTask: boolean;
  canAddNote: boolean;
  canChangeStatus: boolean;
  canChangeOwner: boolean;
  canClaim: boolean;
  canGovern: boolean;
  canViewOnboarding: boolean;
  canWorkOnboarding: boolean;
  canReviewDocuments: boolean;
  canViewIntelligence: boolean;
  // Day 8: may open Capture Lead (create permission on lvLead; the capture
  // routes re-check on every write).
  canCapture: boolean;
};

export type TaskSummary = {
  id: string;
  title: string | null;
  status: string | null;
  dueAt: string | null;
  priority: string | null;
  assignee: MemberSummary | null;
  isOverdue: boolean;
  sourceInteractionId: string | null;
};

export type InteractionSummary = {
  id: string;
  name: string | null;
  channel: string | null;
  direction: string | null;
  occurredAt: string | null;
  actor: MemberSummary | null;
  purpose: string | null;
  summary: string | null;
  sentiment: string | null;
  outcome: string | null;
  objections: string | null;
  commitments: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  durationMinutes: number | null;
};

export type TimelineKind =
  | 'LEAD_CREATED'
  | 'ASSIGNMENT'
  | 'INTERACTION'
  | 'TASK'
  | 'NOTE'
  | 'STATUS'
  | 'ONBOARDING'
  | 'DOCUMENT'
  | 'SLA'
  | 'AI_DECISION'
  | 'GOVERNANCE';

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  detail: string | null;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  target: { object: string; recordId: string } | null;
};

export type AssignmentHistoryRow = {
  id: string;
  assignedAt: string | null;
  fromOwnerId: string | null;
  toOwnerId: string | null;
  strategy: string | null;
  reason: string | null;
};

export type AuditRow = {
  id: string;
  action: string | null;
  outcome: string | null;
  at: string | null;
  actorId: string | null;
  reason: string | null;
  targetObject: string | null;
  targetRecordId: string | null;
  metadata: Record<string, unknown> | null;
};

export type InsightDecisionRow = {
  id: string;
  insightType: string | null;
  status: string | null;
  humanDecision: string | null;
  decidedAt: string | null;
  decidedById: string | null;
};

export type DocumentSummary = {
  id: string;
  name: string | null;
  documentType: string | null;
  verificationState: string | null;
  uploadedAt: string | null;
  expiresAt: string | null;
  reviewer: MemberSummary | null;
  rejectionReason: string | null;
};

export type OnboardingSummary = {
  id: string;
  status: string | null;
  currentStep: string | null;
  progressPercentage: number | null;
  completedSteps: number;
  totalSteps: number;
  steps: { step: OnboardingStep; label: string; isComplete: boolean; missingCount: number }[];
  reviewer: MemberSummary | null;
  submittedAt: string | null;
  documents: DocumentSummary[];
  pendingDocuments: number;
  rejectedDocuments: number;
  expiredDocuments: number;
};

export type Lead360Attention = {
  overdueFollowUp: boolean;
  noNextAction: boolean;
  slaBreach: boolean;
  missingDocuments: boolean;
  noInteraction: boolean;
};

export type Lead360Model = {
  ok: true;
  now: string;
  lead: LeadContext['lead'] & { owner: MemberSummary | null };
  caller: { workspaceMemberId: string; lens: DashboardLens; isAdmin: boolean; isOwner: boolean };
  capabilities: Lead360Capabilities;
  settableStatuses: LeadStatus[];
  nextAction: { task: TaskSummary | null; suggestion: NextBestActionResult['primary'] };
  openTasks: TaskSummary[];
  interactions: InteractionSummary[];
  notes: { id: string; title: string | null; body: string | null; updatedAt: string }[];
  timeline: TimelineEntry[];
  onboarding: OnboardingSummary | null;
  slas: { id: string; name: string | null; rule: string | null; status: string | null; dueAt: string | null; breachedAt: string | null }[];
  intelligence: {
    opportunity: OpportunityScoreResult;
    health: RelationshipHealthResult;
    nextBestAction: NextBestActionResult;
    dataQuality: DataQualityResult;
  };
  assignment: { history: (AssignmentHistoryRow & { from: MemberSummary | null; to: MemberSummary | null })[] };
  members: MemberSummary[];
  attention: Lead360Attention;
  // Day 8: how the lead entered the CRM. Null for leads created before
  // capture provenance existed (or through the API / native importer).
  capture: CaptureSummary | null;
};

export type CaptureSummary = {
  method: string;
  methodLabel: string;
  platform: string | null;
  platformLabel: string | null;
  originalUrl: string | null;
  originalHandle: string | null;
  capturedAt: string | null;
  capturedBy: MemberSummary | null;
  extraction: { status: string; kind: string | null; fieldCount: number } | null;
  classification: { status: string } | null;
  duplicateDecision: { decision: string; candidateLeadIds: string[] } | null;
  files: { fileId: string; label: string | null }[];
};

const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

export const summariseCapture = (lead: Pick<LeadContext['lead'], 'captureProvenance' | 'captureFiles' | 'captureMode'>, member: (id: string | null | undefined) => MemberSummary | null): CaptureSummary | null => {
  const raw = lead.captureProvenance;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const method = str(raw.method) ?? lead.captureMode ?? 'MANUAL';
  const platform = str(raw.platform);
  const extraction = raw.extraction && typeof raw.extraction === 'object' ? (raw.extraction as Record<string, unknown>) : null;
  const classification = raw.classification && typeof raw.classification === 'object' ? (raw.classification as Record<string, unknown>) : null;
  const duplicate = raw.duplicateDecision && typeof raw.duplicateDecision === 'object' ? (raw.duplicateDecision as Record<string, unknown>) : null;

  return {
    method,
    methodLabel: LEAD_CAPTURE_MODE_LABELS[method as LeadCaptureMode] ?? titleCase(method),
    platform,
    platformLabel: platform ? (SOCIAL_PLATFORM_LABELS[platform as SocialPlatform] ?? titleCase(platform)) : null,
    originalUrl: str(raw.originalUrl),
    originalHandle: str(raw.originalHandle),
    capturedAt: str(raw.capturedAt),
    capturedBy: member(str(raw.capturedById)),
    extraction: extraction ? { status: str(extraction.status) ?? 'NOT_APPLICABLE', kind: str(extraction.kind), fieldCount: typeof extraction.fieldCount === 'number' ? extraction.fieldCount : 0 } : null,
    classification: classification ? { status: str(classification.status) ?? 'NOT_RUN' } : null,
    duplicateDecision: duplicate && str(duplicate.decision) && str(duplicate.decision) !== 'NONE' ? { decision: str(duplicate.decision)!, candidateLeadIds: Array.isArray(duplicate.candidateLeadIds) ? duplicate.candidateLeadIds.filter((id): id is string => typeof id === 'string') : [] } : null,
    files: (lead.captureFiles ?? []).map((file) => ({ fileId: file.fileId, label: file.label ?? null })),
  };
};

export const LEAD_360_LIMITS = { timeline: 30, tasks: 8, interactions: 10, members: 100 } as const;

const OPEN_TASK_STATUSES = new Set(['TODO', 'IN_PROGRESS']);

export const isOpenTask = (task: Pick<TaskRecord, 'status'>): boolean =>
  task.status === null || OPEN_TASK_STATUSES.has(task.status);

const byDueAsc = (left: { dueAt: string | null }, right: { dueAt: string | null }): number => {
  if (left.dueAt === right.dueAt) {
    return 0;
  }

  if (left.dueAt === null) {
    return 1;
  }

  if (right.dueAt === null) {
    return -1;
  }

  return left.dueAt < right.dueAt ? -1 : 1;
};

// What the caller may do here. Derived from the platform's own answers
// (object permissions, admin flag) and the record (ownership) — never from
// the body, and the server re-decides on every mutation regardless.
export const deriveCapabilities = ({
  caller,
  lead,
  onboarding,
}: {
  caller: CallerContext;
  lead: Pick<LeadContext['lead'], 'ownerId' | 'status'>;
  onboarding: { reviewerId: string | null } | null;
}): Lead360Capabilities => {
  const can = (object: string) => caller.objectPermissions[object]?.update === true;
  const isOwner = lead.ownerId !== null && lead.ownerId === caller.workspaceMemberId;
  const isUnassigned = lead.ownerId === null;
  const closed = lead.status !== null && isClosedOrArchived(lead.status);
  const canEditLead = can('lvLead');
  const canWorkOnboarding = can('lvOnboarding') || caller.isAdmin;
  const isReviewer = onboarding?.reviewerId !== null && onboarding?.reviewerId === caller.workspaceMemberId;

  return {
    canEdit: canEditLead,
    // Logging a contact is part of working a lead: allowed to anyone the
    // platform lets write interactions, and to lead-writers on leads they can
    // see (the route creates on their behalf with the session actor).
    canLogInteraction: (can('lvInteraction') || canEditLead) && !closed,
    canCreateTask: can('task'),
    canAddNote: can('note'),
    canChangeStatus: canEditLead && !closed,
    // Reassigning someone else's lead is an administrator's call; the owner
    // may hand over their own lead.
    canChangeOwner: caller.isAdmin || (canEditLead && isOwner),
    canClaim: canEditLead && isUnassigned && !closed,
    canGovern: canEditLead,
    canViewOnboarding: onboarding !== null,
    canWorkOnboarding,
    canReviewDocuments: canWorkOnboarding && (isReviewer || caller.isAdmin || onboarding?.reviewerId === null),
    canViewIntelligence: true,
    canCapture: canEditLead,
  };
};

const titleCase = (value: string | null | undefined): string =>
  (value ?? '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (character) => character.toUpperCase());

export const buildTimeline = ({
  context,
  assignmentHistory,
  auditRows,
  insightDecisions,
  memberById,
}: {
  context: LeadContext;
  assignmentHistory: AssignmentHistoryRow[];
  auditRows: AuditRow[];
  insightDecisions: InsightDecisionRow[];
  memberById: Map<string, MemberSummary>;
}): TimelineEntry[] => {
  const name = (id: string | null | undefined): string => (id ? (memberById.get(id)?.displayName ?? 'a team member') : 'unassigned');
  const entries: TimelineEntry[] = [];
  const { lead } = context;

  const capture = summariseCapture(lead, (id) => (id ? (memberById.get(id) ?? null) : null));
  const captureDetail = capture
    ? [
        `Captured via ${capture.methodLabel}${capture.platformLabel ? ` (${capture.platformLabel})` : ''}`,
        capture.capturedBy ? `by ${capture.capturedBy.displayName}` : null,
        capture.originalHandle ? `@${capture.originalHandle}` : capture.originalUrl,
        capture.extraction && capture.extraction.status === 'EXTRACTED' ? `${capture.extraction.fieldCount} field${capture.extraction.fieldCount === 1 ? '' : 's'} read automatically and confirmed` : capture.extraction && capture.extraction.status !== 'NOT_APPLICABLE' ? `automatic extraction ${capture.extraction.status.toLowerCase()}` : null,
        capture.duplicateDecision ? `duplicate check: ${titleCase(capture.duplicateDecision.decision).toLowerCase()}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : lead.source
      ? `Source: ${titleCase(lead.source)}`
      : null;

  entries.push({ id: `created-${lead.id}`, kind: 'LEAD_CREATED', at: lead.createdAt, title: 'Lead created', detail: captureDetail, tone: 'neutral', target: null });

  for (const row of assignmentHistory) {
    if (!row.assignedAt) {
      continue;
    }

    const reassigned = row.fromOwnerId !== null;

    entries.push({
      id: `assign-${row.id}`,
      kind: 'ASSIGNMENT',
      at: row.assignedAt,
      title: row.toOwnerId === null ? 'Left unassigned' : reassigned ? `Reassigned to ${name(row.toOwnerId)}` : `Assigned to ${name(row.toOwnerId)}`,
      detail: [row.strategy ? titleCase(row.strategy) : null, row.reason].filter(Boolean).join(' — ') || null,
      tone: row.toOwnerId === null ? 'warning' : 'info',
      target: null,
    });
  }

  for (const row of context.interactions) {
    const at = row.occurredAt;

    if (!at) {
      continue;
    }

    const parts = [row.outcome ? titleCase(row.outcome) : null, row.nextFollowUpAt ? `Next follow-up: ${row.nextFollowUpAt.slice(0, 10)}` : null].filter(Boolean);

    entries.push({
      id: `interaction-${row.id}`,
      kind: 'INTERACTION',
      at,
      title: `${titleCase(row.channel)}${row.direction ? ` · ${titleCase(row.direction)}` : ''}`,
      detail: [row.name, ...parts].filter(Boolean).join(' · ') || null,
      tone: row.sentiment === 'NEGATIVE' ? 'danger' : row.sentiment === 'POSITIVE' ? 'success' : 'neutral',
      target: { object: 'lvInteraction', recordId: row.id },
    });
  }

  for (const row of context.tasks) {
    entries.push({
      id: `task-${row.id}`,
      kind: 'TASK',
      at: row.createdAt,
      title: row.status === 'DONE' ? `Task done: ${row.title ?? 'untitled'}` : `Task: ${row.title ?? 'untitled'}`,
      detail: row.dueAt ? `Due ${row.dueAt.slice(0, 16).replace('T', ' ')}` : null,
      tone: row.status === 'DONE' ? 'success' : 'neutral',
      target: { object: 'task', recordId: row.id },
    });
  }

  for (const row of context.notes) {
    entries.push({
      id: `note-${row.id}`,
      kind: 'NOTE',
      at: row.updatedAt,
      title: `Note: ${row.title ?? 'untitled'}`,
      detail: row.body ? row.body.slice(0, 160) : null,
      tone: 'neutral',
      target: { object: 'note', recordId: row.id },
    });
  }

  for (const row of context.slas) {
    if (row.breachedAt) {
      entries.push({ id: `sla-breach-${row.id}`, kind: 'SLA', at: row.breachedAt, title: `SLA breached: ${row.name ?? titleCase(row.rule)}`, detail: null, tone: 'danger', target: { object: 'lvSla', recordId: row.id } });
    }

    if (row.resolvedAt) {
      entries.push({ id: `sla-resolved-${row.id}`, kind: 'SLA', at: row.resolvedAt, title: `SLA met: ${row.name ?? titleCase(row.rule)}`, detail: null, tone: 'success', target: { object: 'lvSla', recordId: row.id } });
    }
  }

  if (context.onboarding) {
    const onboarding = context.onboarding;

    entries.push({
      id: `onboarding-${onboarding.id}`,
      kind: 'ONBOARDING',
      at: onboarding.submittedAt ?? onboarding.updatedAt,
      title: onboarding.submittedAt ? 'Onboarding submitted for review' : `Onboarding ${titleCase(onboarding.status).toLowerCase()}`,
      detail: onboarding.currentStep ? `Step: ${ONBOARDING_STEP_LABELS[onboarding.currentStep as OnboardingStep] ?? titleCase(onboarding.currentStep)}` : null,
      tone: onboarding.status === 'REJECTED' ? 'danger' : onboarding.status === 'APPROVED' || onboarding.status === 'ACTIVATED' ? 'success' : 'info',
      target: { object: 'lvOnboarding', recordId: onboarding.id },
    });

    for (const document of onboarding.documents) {
      if (document.verificationState === 'REJECTED' || document.verificationState === 'VERIFIED' || document.verificationState === 'EXPIRED') {
        entries.push({
          id: `document-${document.id}`,
          kind: 'DOCUMENT',
          at: onboarding.updatedAt,
          title: `Document ${titleCase(document.verificationState).toLowerCase()}: ${document.name ?? titleCase(document.documentType)}`,
          detail: document.rejectionReason,
          tone: document.verificationState === 'VERIFIED' ? 'success' : 'danger',
          target: { object: 'lvOnboardingDocument', recordId: document.id },
        });
      }
    }
  }

  for (const row of auditRows) {
    if (!row.at || !row.action) {
      continue;
    }

    const metadata = row.metadata ?? {};
    const from = typeof metadata.from === 'string' ? metadata.from : null;
    const to = typeof metadata.to === 'string' ? metadata.to : null;
    const isStatus = row.action === 'STATUS_CHANGE' || row.action === 'ARCHIVE' || row.action === 'CLOSE' || row.action === 'MARK_DUPLICATE' || row.action === 'REOPEN';

    if (row.action === 'OWNER_CHANGE') {
      // Assignment history already carries the owner change itself; the audit
      // row would duplicate it in the timeline.
      continue;
    }

    if (row.action === 'INTERACTION_LOGGED' || row.action === 'TASK_CREATED' || row.action === 'NOTE_CREATED') {
      // The record itself is already an entry above.
      continue;
    }

    entries.push({
      id: `audit-${row.id}`,
      kind: isStatus ? 'STATUS' : 'GOVERNANCE',
      at: row.at,
      title: isStatus && to ? `Status → ${titleCase(to)}${from ? ` (was ${titleCase(from).toLowerCase()})` : ''}` : `${titleCase(row.action)}${row.outcome && row.outcome !== 'APPLIED' ? ` (${row.outcome.toLowerCase()})` : ''}`,
      detail: [name(row.actorId), row.reason].filter(Boolean).join(' — ') || null,
      tone: row.outcome === 'REFUSED' ? 'warning' : isStatus ? 'info' : 'neutral',
      target: null,
    });
  }

  for (const row of insightDecisions) {
    if (!row.decidedAt || !row.humanDecision) {
      continue;
    }

    entries.push({
      id: `insight-${row.id}`,
      kind: 'AI_DECISION',
      at: row.decidedAt,
      title: `${titleCase(row.insightType)}: ${titleCase(row.humanDecision).toLowerCase()}`,
      detail: `Decided by ${name(row.decidedById)}`,
      tone: 'neutral',
      target: null,
    });
  }

  return entries.sort((left, right) => (left.at < right.at ? 1 : left.at > right.at ? -1 : 0)).slice(0, LEAD_360_LIMITS.timeline);
};

export const summariseOnboarding = ({
  context,
  progress,
  memberById,
}: {
  context: LeadContext;
  progress: readonly StepProgress[];
  memberById: Map<string, MemberSummary>;
}): OnboardingSummary | null => {
  const onboarding = context.onboarding;

  if (!onboarding) {
    return null;
  }

  const documents: DocumentSummary[] = onboarding.documents.map((row) => ({
    id: row.id,
    name: row.name,
    documentType: row.documentType,
    verificationState: row.verificationState,
    uploadedAt: null,
    expiresAt: row.expiresAt,
    reviewer: null,
    rejectionReason: row.rejectionReason,
  }));
  const count = (state: string) => documents.filter((document) => document.verificationState === state).length;

  return {
    id: onboarding.id,
    status: onboarding.status,
    currentStep: onboarding.currentStep,
    progressPercentage: onboarding.progressPercentage,
    completedSteps: progress.filter((step) => step.isComplete).length,
    totalSteps: progress.length,
    steps: progress.map((step) => ({ step: step.step, label: ONBOARDING_STEP_LABELS[step.step], isComplete: step.isComplete, missingCount: step.missingCount })),
    reviewer: onboarding.reviewerId ? (memberById.get(onboarding.reviewerId) ?? null) : null,
    submittedAt: onboarding.submittedAt,
    documents,
    pendingDocuments: count('PENDING') + count('UNDER_REVIEW') + count('NEEDS_REPLACEMENT'),
    rejectedDocuments: count('REJECTED'),
    expiredDocuments: count('EXPIRED'),
  };
};

export const composeLead360 = ({
  context,
  caller,
  now,
  memberById,
  members,
  assignmentHistory,
  auditRows,
  insightDecisions,
  onboardingProgress,
  intelligence,
}: {
  context: LeadContext;
  caller: CallerContext & { workspaceMemberId: string };
  now: string;
  memberById: Map<string, MemberSummary>;
  members: MemberSummary[];
  assignmentHistory: AssignmentHistoryRow[];
  auditRows: AuditRow[];
  insightDecisions: InsightDecisionRow[];
  onboardingProgress: readonly StepProgress[];
  intelligence: Lead360Model['intelligence'];
}): Lead360Model => {
  const { lead } = context;
  const member = (id: string | null | undefined): MemberSummary | null => (id ? (memberById.get(id) ?? null) : null);
  const toTask = (task: TaskRecord): TaskSummary => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueAt: task.dueAt,
    priority: task.lvPriority,
    assignee: member(task.assigneeId),
    isOverdue: isOpenTask(task) && task.dueAt !== null && task.dueAt < now,
    sourceInteractionId: task.lvSourceInteractionId,
  });
  const openTasks = context.tasks.filter(isOpenTask).map(toTask).sort(byDueAsc);
  const nextTask = openTasks[0] ?? null;
  const onboarding = summariseOnboarding({ context, progress: onboardingProgress, memberById });
  const capabilities = deriveCapabilities({ caller, lead, onboarding: context.onboarding ? { reviewerId: context.onboarding.reviewerId } : null });
  const openSlas = context.slas.filter((row) => row.resolvedAt === null);
  const status = lead.status && isLeadStatus(lead.status) ? lead.status : null;

  return {
    ok: true,
    now,
    lead: { ...lead, owner: member(lead.ownerId) },
    caller: { workspaceMemberId: caller.workspaceMemberId, lens: caller.lens, isAdmin: caller.isAdmin, isOwner: lead.ownerId === caller.workspaceMemberId },
    capabilities,
    settableStatuses: SETTABLE_STATUSES.filter((candidate) => candidate !== status),
    nextAction: { task: nextTask, suggestion: intelligence.nextBestAction.primary },
    openTasks: openTasks.slice(0, LEAD_360_LIMITS.tasks),
    interactions: context.interactions.slice(0, LEAD_360_LIMITS.interactions).map((row) => ({ ...row, actor: member(row.actorId) })),
    notes: context.notes,
    timeline: buildTimeline({ context, assignmentHistory, auditRows, insightDecisions, memberById }),
    onboarding,
    slas: openSlas.map((row) => ({ id: row.id, name: row.name, rule: row.rule, status: row.status, dueAt: row.dueAt, breachedAt: row.breachedAt })),
    intelligence,
    assignment: {
      history: assignmentHistory.slice(0, 5).map((row) => ({ ...row, from: member(row.fromOwnerId), to: member(row.toOwnerId) })),
    },
    members: capabilities.canChangeOwner || capabilities.canClaim || capabilities.canCreateTask ? members : [],
    attention: {
      overdueFollowUp: openTasks.some((task) => task.isOverdue) || (lead.nextFollowUpAt !== null && lead.nextFollowUpAt < now),
      noNextAction: nextTask === null && !lead.nextAction,
      slaBreach: openSlas.some((row) => row.breachedAt !== null || row.status === 'BREACHED' || row.status === 'ESCALATED'),
      missingDocuments: onboarding !== null && (onboarding.rejectedDocuments > 0 || onboarding.expiredDocuments > 0 || (onboarding.status !== 'NOT_STARTED' && onboarding.documents.length === 0)),
      noInteraction: context.interactions.length === 0,
    },
    capture: summariseCapture(lead, member),
  };
};
