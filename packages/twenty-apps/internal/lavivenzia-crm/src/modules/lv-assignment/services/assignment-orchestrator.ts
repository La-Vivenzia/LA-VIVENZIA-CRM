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
};

// Notifying the new owner is NOT done here. Ownership can change three ways —
// this engine, a manual edit in the UI, an API call — and only one of them
// passes through this function. The lvLead.updated database event sees all
// three, so lv-on-lead-updated is the single producer of LEAD_ASSIGNED and
// LEAD_REASSIGNED, through the central notification service. Doing it here as
// well would double-notify every automatic assignment.

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
  isExplicitAction = false,
  eventKey = null,
}: {
  lead: AssignmentTarget;
  port: AssignmentPort;
  now: string;
  manualAssigneeId?: string | null;
  actorWorkspaceMemberId?: string | null;
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

  return {
    decision,
    ownerChanged,
    historyRecorded,
  };
};
