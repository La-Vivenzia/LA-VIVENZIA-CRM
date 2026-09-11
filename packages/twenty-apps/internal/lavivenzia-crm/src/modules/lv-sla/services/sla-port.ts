import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { type NotificationPort } from 'src/modules/lv-notifications/services/notification-service';
import { type SlaRule, type SlaStatus } from 'src/modules/lv-sla/constants/sla-rules';
import {
  type SlaAuditEntry,
  type SlaRecord,
  type TargetFacts,
} from 'src/modules/lv-sla/services/sla-engine';

// Everything the SLA engine needs from the workspace, behind one interface.
//
// The important contract is the *claims*: every state-changing write is a
// conditional update ("set status=BREACHED where id=? and status=DUE") that
// returns whether THIS caller changed the row. Two evaluators — two workers,
// a restart mid-run, a cron overlapping a replay — race on the same row and
// exactly one wins each transition. That is the database protecting against
// duplicate side effects; no in-memory lock is involved.

export type NewSla = {
  name: string;
  rule: SlaRule;
  priority: LeadPriority;
  ownerWorkspaceMemberId: string | null;
  targetObject: SlaRecord['targetObject'];
  targetRecordId: string;
  leadId: string | null;
  onboardingId: string | null;
  documentId: string | null;
  startedAt: string;
  dueSoonAt: string;
  dueAt: string;
  breachAt: string;
  dedupeKey: string;
  sourceEvent: string;
  audit: SlaAuditEntry;
  metadata: Record<string, unknown>;
};

export type SlaTransitionClaim = {
  slaId: string;
  from: SlaStatus;
  to: SlaStatus;
  at: string;
  patch: Record<string, unknown>;
  audit: SlaAuditEntry;
  knownTrail: SlaAuditEntry[];
};

export type EscalationTaskDraft = {
  slaId: string;
  title: string;
  bodyMarkdown: string;
  assigneeWorkspaceMemberId: string;
  dueAt: string;
  leadId: string | null;
  onboardingId: string | null;
};

export type SlaPort = {
  // Insert, or DUPLICATE when the dedupeKey already exists (unique index).
  createIfAbsent(sla: NewSla): Promise<{ outcome: 'CREATED'; id: string } | { outcome: 'DUPLICATE' }>;

  listActionable(input: { statuses: readonly SlaStatus[]; limit: number }): Promise<SlaRecord[]>;
  listForTarget(input: {
    leadId?: string | null;
    onboardingId?: string | null;
    documentId?: string | null;
    statuses: readonly SlaStatus[];
  }): Promise<SlaRecord[]>;

  // Fresh facts about the target, relative to the SLA's startedAt.
  fetchFacts(sla: SlaRecord): Promise<TargetFacts>;

  // Conditional writes. Each returns true only when this call changed the row.
  claimTransition(claim: SlaTransitionClaim): Promise<boolean>;
  claimOwnerChange(input: {
    slaId: string;
    from: string | null;
    to: string | null;
    audit: SlaAuditEntry;
    knownTrail: SlaAuditEntry[];
  }): Promise<boolean>;
  claimEscalationOwner(input: {
    slaId: string;
    escalationOwnerWorkspaceMemberId: string;
    audit: SlaAuditEntry;
    knownTrail: SlaAuditEntry[];
  }): Promise<boolean>;
  claimEscalationTask(input: {
    slaId: string;
    taskId: string;
    at: string;
    audit: SlaAuditEntry;
    knownTrail: SlaAuditEntry[];
  }): Promise<boolean>;

  // Non-claim writes: idempotent by construction (same value in, same out).
  markEscalationBlocked(input: { slaId: string; reason: string; at: string }): Promise<void>;
  touchEvaluated(input: { slaId: string; at: string }): Promise<void>;
  appendAudit(input: { slaId: string; entry: SlaAuditEntry; lastNotifiedAt?: string }): Promise<void>;

  // Escalation task (Twenty task). find* lets a repair run re-link a task a
  // crashed run created but never attached.
  findEscalationTask(slaId: string): Promise<{ id: string } | null>;
  createEscalationTask(draft: EscalationTaskDraft): Promise<{ id: string }>;
  destroyTask(taskId: string): Promise<void>;

  // Resolved server-side from the workspace's configured escalation owner.
  resolveEscalationOwner(): Promise<{ workspaceMemberId: string; displayName: string | null } | null>;
  memberName(workspaceMemberId: string | null): Promise<string | null>;

  notifications: NotificationPort;
};
