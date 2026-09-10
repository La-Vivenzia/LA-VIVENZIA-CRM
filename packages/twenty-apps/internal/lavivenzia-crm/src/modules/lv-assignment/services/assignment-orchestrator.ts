import {
  type AssignmentCandidate,
  type AssignmentDecision,
  type AssignmentLead,
  type AssignmentRule,
} from 'src/modules/lv-assignment/types/assignment.types';
import {
  buildAssignmentHistoryEntry,
  shouldRecordAssignment,
  type AssignmentHistoryEntry,
} from 'src/modules/lv-assignment/utils/build-assignment-history';
import { selectAssignee } from 'src/modules/lv-assignment/utils/select-assignee';
import {
  STATUS_AFTER_ASSIGNMENT,
  type LeadPriority,
  type LeadStatus,
} from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  notificationsForAssignment,
  type NotificationDraft,
} from 'src/modules/lv-notifications/utils/build-notification';

// Everything the orchestrator needs from the outside world, behind one
// interface. The logic function supplies a CoreApiClient-backed implementation;
// tests supply a fake. Keeping I/O at the edge is what makes the assignment
// path testable without a running workspace.
export type AssignmentPort = {
  listAssignableMembers(): Promise<readonly AssignmentCandidate[]>;
  listActiveRules(): Promise<readonly AssignmentRule[]>;
  // Owner of an earlier lead for the same organisation/person, if any.
  findExistingRelationshipOwnerId(lead: {
    id: string;
    organisationName?: string | null;
    duplicateKeys?: readonly string[] | null;
  }): Promise<string | null>;
  applyOwner(input: {
    leadId: string;
    ownerWorkspaceMemberId: string | null;
    status: LeadStatus;
    assignedAt: string;
  }): Promise<void>;
  // Returns false when the entry's eventKey was already present — a replay,
  // not a failure. Implementations must not treat that as an error, and must
  // not swallow anything else.
  recordHistory(entry: AssignmentHistoryEntry): Promise<boolean>;
  // Must upsert on dedupeKey so a retried invocation cannot notify twice.
  upsertNotifications(drafts: readonly NotificationDraft[]): Promise<void>;
};

export type AssignmentTarget = {
  id: string;
  name: string;
  currentOwnerWorkspaceMemberId: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  organisationName?: string | null;
  duplicateKeys?: readonly string[] | null;
} & AssignmentLead;

export type AssignLeadOutcome = {
  decision: AssignmentDecision;
  ownerChanged: boolean;
  // True only when a row was actually appended. A replayed event reports
  // false, which is how the caller can tell a fresh run from a retry.
  historyRecorded: boolean;
  notificationsSent: number;
};

// Statuses at or beyond which re-running assignment would be interference
// rather than help: the lead is already being worked, closed, or live.
const isAlreadyOwnedAndWorking = (status: LeadStatus): boolean =>
  status !== 'DISCOVERED' && status !== 'NEW' && status !== 'QUALIFYING';

export const assignLead = async ({
  lead,
  port,
  now,
  manualAssigneeId = null,
  actorWorkspaceMemberId = null,
  actorDisplayName = null,
  isExplicitAction = false,
  eventKey = null,
}: {
  lead: AssignmentTarget;
  port: AssignmentPort;
  now: string;
  manualAssigneeId?: string | null;
  actorWorkspaceMemberId?: string | null;
  actorDisplayName?: string | null;
  isExplicitAction?: boolean;
  // Supplied by automatic callers so a replayed event cannot append twice.
  eventKey?: string | null;
}): Promise<AssignLeadOutcome> => {
  const [candidates, rules, existingRelationshipOwnerId] = await Promise.all([
    port.listAssignableMembers(),
    port.listActiveRules(),
    port.findExistingRelationshipOwnerId(lead),
  ]);

  const decision = selectAssignee({
    lead,
    candidates,
    rules,
    existingRelationshipOwnerId,
    manualAssigneeId,
    now,
  });

  const previousOwnerId = lead.currentOwnerWorkspaceMemberId;
  const ownerChanged = decision.assigneeWorkspaceMemberId !== previousOwnerId;

  if (ownerChanged && decision.assigneeWorkspaceMemberId !== null) {
    // Only advance the lifecycle from an early state. A lead already at
    // CONTACTED or beyond keeps its status when ownership moves — reassigning
    // work must not rewind the funnel.
    const status = isAlreadyOwnedAndWorking(lead.status)
      ? lead.status
      : STATUS_AFTER_ASSIGNMENT;

    await port.applyOwner({
      leadId: lead.id,
      ownerWorkspaceMemberId: decision.assigneeWorkspaceMemberId,
      status,
      assignedAt: now,
    });
  }

  const shouldRecord = shouldRecordAssignment({
    previousOwnerId,
    decision,
    isExplicitAction,
  });

  const historyRecorded = shouldRecord
    ? await port.recordHistory(
        buildAssignmentHistoryEntry({
          leadId: lead.id,
          previousOwnerId,
          decision,
          now,
          actorWorkspaceMemberId,
          eventKey,
        }),
      )
    : false;

  const notifications = notificationsForAssignment({
    leadId: lead.id,
    leadName: lead.name,
    previousOwnerId,
    newOwnerId: decision.assigneeWorkspaceMemberId,
    assignedByName: actorDisplayName,
    priority: lead.priority,
    now,
  });

  if (notifications.length > 0) {
    await port.upsertNotifications(notifications);
  }

  return {
    decision,
    ownerChanged,
    historyRecorded,
    notificationsSent: notifications.length,
  };
};
