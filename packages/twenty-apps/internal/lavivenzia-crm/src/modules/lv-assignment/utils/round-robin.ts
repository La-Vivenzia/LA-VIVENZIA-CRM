import {
  type AssignmentCandidate,
  type CandidateScore,
  type IneligibilityReason,
} from 'src/modules/lv-assignment/types/assignment.types';
import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// Fraction of capacity above which a member is held back from CRITICAL leads.
// "Lead value" from ASSIGNMENT-SLA-NOTIFICATIONS.md expressed as a capacity
// reservation: the most valuable leads should not land on someone who is one
// lead away from being full.
export const CRITICAL_CAPACITY_HEADROOM_RATIO = 0.9;

export type EligibilityOutcome = {
  eligible: readonly AssignmentCandidate[];
  ineligible: ReadonlyArray<{
    workspaceMemberId: string;
    reason: IneligibilityReason;
  }>;
};

export const partitionByEligibility = ({
  candidates,
  priority,
}: {
  candidates: readonly AssignmentCandidate[];
  priority?: LeadPriority | null;
}): EligibilityOutcome => {
  const eligible: AssignmentCandidate[] = [];
  const ineligible: Array<{
    workspaceMemberId: string;
    reason: IneligibilityReason;
  }> = [];

  const reservedForCritical: AssignmentCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.isActive) {
      ineligible.push({
        workspaceMemberId: candidate.workspaceMemberId,
        reason: 'INACTIVE',
      });
      continue;
    }

    if (candidate.capacity <= 0) {
      ineligible.push({
        workspaceMemberId: candidate.workspaceMemberId,
        reason: 'ZERO_CAPACITY',
      });
      continue;
    }

    if (candidate.openLeadCount >= candidate.capacity) {
      ineligible.push({
        workspaceMemberId: candidate.workspaceMemberId,
        reason: 'AT_CAPACITY',
      });
      continue;
    }

    const isNearlyFull =
      candidate.openLeadCount / candidate.capacity >=
      CRITICAL_CAPACITY_HEADROOM_RATIO;

    if (priority === 'CRITICAL' && isNearlyFull) {
      reservedForCritical.push(candidate);
      continue;
    }

    eligible.push(candidate);
  }

  // The reservation is a preference, not a hard rule. If holding people back
  // would leave a critical lead unassigned, take the nearly-full members —
  // an owned lead beats an orphaned one.
  if (eligible.length === 0 && reservedForCritical.length > 0) {
    return { eligible: reservedForCritical, ineligible };
  }

  for (const candidate of reservedForCritical) {
    ineligible.push({
      workspaceMemberId: candidate.workspaceMemberId,
      reason: 'CAPACITY_RESERVED_FOR_CRITICAL',
    });
  }

  return { eligible, ineligible };
};

// Never-assigned members sort oldest, so a new joiner receives work before
// anyone gets a second lead.
const lastAssignedRank = (value: string | null): number =>
  value === null ? Number.NEGATIVE_INFINITY : Date.parse(value);

// "Smart round robin" from PRODUCT-REQUIREMENTS.md: distribute by actual
// workload rather than a rotating pointer, so the example
// (A=18, B=9, C=14 -> next lead goes to B) falls out naturally.
//
// Ordering, in strict precedence:
//   1. fewest open leads          — the load-balancing intent
//   2. least recently assigned    — fairness when loads are equal
//   3. workspace member id        — deterministic, so replays never differ
export const compareForRoundRobin = (
  left: Pick<CandidateScore, 'workspaceMemberId' | 'openLeadCount' | 'lastAssignedAt'>,
  right: Pick<CandidateScore, 'workspaceMemberId' | 'openLeadCount' | 'lastAssignedAt'>,
): number => {
  if (left.openLeadCount !== right.openLeadCount) {
    return left.openLeadCount - right.openLeadCount;
  }

  const leftRank = lastAssignedRank(left.lastAssignedAt);
  const rightRank = lastAssignedRank(right.lastAssignedAt);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.workspaceMemberId.localeCompare(right.workspaceMemberId);
};

export const pickByRoundRobin = <
  TCandidate extends Pick<
    CandidateScore,
    'workspaceMemberId' | 'openLeadCount' | 'lastAssignedAt'
  >,
>(
  candidates: readonly TCandidate[],
): TCandidate | null => {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort(compareForRoundRobin)[0] ?? null;
};
