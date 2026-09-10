import {
  type AssignmentDecision,
  type AssignmentStrategy,
} from 'src/modules/lv-assignment/types/assignment.types';

// Assignment history. SECURITY-RBAC.md requires ownership changes to be
// auditable, so every transfer — automatic or manual — writes one row stating
// who lost the lead, who gained it, which strategy chose them and why.

export type AssignmentHistoryEntry = {
  leadId: string;
  fromWorkspaceMemberId: string | null;
  toWorkspaceMemberId: string | null;
  strategy: AssignmentStrategy;
  score: number | null;
  matchedRuleId: string | null;
  // One flattened sentence per reason, in decision order.
  reason: string;
  assignedAt: string;
  // Who triggered it: a workspace member id for a manual action, null when the
  // engine acted on a database event.
  actorWorkspaceMemberId: string | null;
  // Identifies the *event*, not the resulting state, so a replayed database
  // event is refused by the unique index while a genuine later reassignment
  // still appends. Null means "always append" — an explicit human action that
  // supplied no key of its own.
  eventKey: string | null;
};

// Derived from the database event, which carries no id of its own, so the
// record id plus the event name is the stable thing available. A replay of
// lvLead.created for the same lead produces the same key, which is exactly
// what the unique index needs in order to reject it.
export const assignmentEventKey = ({
  eventName,
  leadId,
}: {
  eventName: string;
  leadId: string;
}): string => `${eventName}:${leadId}`;

export const buildAssignmentHistoryEntry = ({
  leadId,
  previousOwnerId,
  decision,
  now,
  actorWorkspaceMemberId = null,
  eventKey = null,
}: {
  leadId: string;
  previousOwnerId: string | null;
  decision: AssignmentDecision;
  now: string;
  actorWorkspaceMemberId?: string | null;
  eventKey?: string | null;
}): AssignmentHistoryEntry => {
  const reason =
    decision.assigneeWorkspaceMemberId === null
      ? (decision.unassignedReason ?? 'Lead could not be assigned.')
      : decision.reasons.join(' ');

  return {
    leadId,
    fromWorkspaceMemberId: previousOwnerId,
    toWorkspaceMemberId: decision.assigneeWorkspaceMemberId,
    strategy: decision.strategy,
    score: decision.score,
    matchedRuleId: decision.matchedRuleId,
    reason,
    assignedAt: now,
    actorWorkspaceMemberId,
    eventKey,
  };
};

// A no-op transfer is still worth recording when a human explicitly re-ran
// assignment, but not when the engine re-fires on an unrelated field update —
// otherwise history fills with noise and stops being readable.
//
// A failed assignment is always recorded even though "null -> null" is
// technically no change: a lead nobody can take is exactly what the Admin
// Control Tower has to surface, and silence would hide it.
export const shouldRecordAssignment = ({
  previousOwnerId,
  decision,
  isExplicitAction,
}: {
  previousOwnerId: string | null;
  decision: AssignmentDecision;
  isExplicitAction: boolean;
}): boolean => {
  if (isExplicitAction) {
    return true;
  }

  if (decision.strategy === 'NONE') {
    return true;
  }

  return previousOwnerId !== decision.assigneeWorkspaceMemberId;
};
