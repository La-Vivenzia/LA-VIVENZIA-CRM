import {
  type AssignmentCandidate,
  type AssignmentDecision,
  type AssignmentLead,
  type AssignmentRequest,
  type AssignmentRule,
  type CandidateScore,
} from 'src/modules/lv-assignment/types/assignment.types';
import {
  partitionByEligibility,
  pickByRoundRobin,
} from 'src/modules/lv-assignment/utils/round-robin';
import { scoreCandidate } from 'src/modules/lv-assignment/utils/score-candidate';
import { locationKey } from 'src/modules/lv-capture/utils/normalize-input';

// The assignment engine. One deterministic function: same inputs always give
// the same owner, which is what makes it testable and what lets assignment
// history be a truthful record rather than a guess.
//
// Precedence, highest first:
//   1. MANUAL                 — a human named an owner
//   2. RULE                   — an admin-configured routing rule matched
//   3. EXISTING_RELATIONSHIP  — the prior owner is available, so continuity wins
//   4. SCORED                 — weighted factors produced a clear winner
//   5. ROUND_ROBIN            — no factor discriminated, so balance the load
//
// Nothing here calls a model. Every branch is auditable.

const matchesCondition = (
  condition: string | null | undefined,
  value: string | null | undefined,
): boolean => {
  if (condition === null || condition === undefined || condition === '') {
    return true;
  }

  return locationKey(condition) === locationKey(value);
};

const ruleMatchesLead = (rule: AssignmentRule, lead: AssignmentLead): boolean => {
  const languageMatches =
    rule.whenLanguage === null || rule.whenLanguage === undefined
      ? true
      : (lead.languages ?? []).some(
          (language) => locationKey(language) === locationKey(rule.whenLanguage),
        );

  return (
    matchesCondition(rule.whenCategory, lead.category) &&
    matchesCondition(rule.whenSubcategory, lead.subcategory) &&
    matchesCondition(rule.whenRegion, lead.location) &&
    matchesCondition(rule.whenSource, lead.source) &&
    matchesCondition(rule.whenPriority, lead.priority) &&
    languageMatches
  );
};

export const findMatchingRule = (
  rules: readonly AssignmentRule[],
  lead: AssignmentLead,
): AssignmentRule | null => {
  const ordered = [...rules]
    .filter((rule) => rule.isActive)
    .sort((left, right) =>
      left.priority === right.priority
        ? left.id.localeCompare(right.id)
        : left.priority - right.priority,
    );

  return ordered.find((rule) => ruleMatchesLead(rule, lead)) ?? null;
};

const decisionFor = ({
  candidate,
  strategy,
  score,
  reasons,
  scores,
  ineligible,
  matchedRuleId,
}: {
  candidate: AssignmentCandidate | null;
  strategy: AssignmentDecision['strategy'];
  score: number | null;
  reasons: readonly string[];
  scores: readonly CandidateScore[];
  ineligible: AssignmentDecision['ineligible'];
  matchedRuleId: string | null;
}): AssignmentDecision => ({
  assigneeWorkspaceMemberId: candidate?.workspaceMemberId ?? null,
  strategy,
  score,
  reasons,
  scores,
  ineligible,
  matchedRuleId,
  unassignedReason: null,
});

export const selectAssignee = (request: AssignmentRequest): AssignmentDecision => {
  const { lead, candidates, rules = [], manualAssigneeId, existingRelationshipOwnerId } =
    request;

  const { eligible, ineligible } = partitionByEligibility({
    candidates,
    priority: lead.priority,
  });

  // ---- 1. manual override -------------------------------------------------
  if (manualAssigneeId !== null && manualAssigneeId !== undefined && manualAssigneeId !== '') {
    const named = candidates.find(
      (candidate) => candidate.workspaceMemberId === manualAssigneeId,
    );

    if (named === undefined) {
      return {
        assigneeWorkspaceMemberId: null,
        strategy: 'NONE',
        score: null,
        reasons: [],
        scores: [],
        ineligible,
        matchedRuleId: null,
        unassignedReason: `Named assignee ${manualAssigneeId} is not a known team member.`,
      };
    }

    // A manual choice is honoured even when the member is at capacity — a human
    // overriding the engine is making an informed decision. Only a deactivated
    // member is refused, because they cannot act on the lead at all.
    if (!named.isActive) {
      return {
        assigneeWorkspaceMemberId: null,
        strategy: 'NONE',
        score: null,
        reasons: [],
        scores: [],
        ineligible,
        matchedRuleId: null,
        unassignedReason: `Named assignee ${named.displayName} is deactivated.`,
      };
    }

    return decisionFor({
      candidate: named,
      strategy: 'MANUAL',
      score: null,
      reasons: [`Manually assigned to ${named.displayName}.`],
      scores: [],
      ineligible,
      matchedRuleId: null,
    });
  }

  if (eligible.length === 0) {
    return {
      assigneeWorkspaceMemberId: null,
      strategy: 'NONE',
      score: null,
      reasons: [],
      scores: [],
      ineligible,
      matchedRuleId: null,
      unassignedReason:
        candidates.length === 0
          ? 'No team members are configured for assignment.'
          : 'Every team member is inactive or at capacity.',
    };
  }

  // ---- 2. admin rules -----------------------------------------------------
  const matchedRule = findMatchingRule(rules, lead);

  if (matchedRule !== null) {
    const target = eligible.find(
      (candidate) =>
        candidate.workspaceMemberId === matchedRule.assigneeWorkspaceMemberId,
    );

    if (target !== undefined) {
      return decisionFor({
        candidate: target,
        strategy: 'RULE',
        score: null,
        reasons: [
          `Matched assignment rule "${matchedRule.name}" -> ${target.displayName}.`,
        ],
        scores: [],
        ineligible,
        matchedRuleId: matchedRule.id,
      });
    }
    // Rule target is unavailable: fall through to scoring rather than leaving
    // the lead unowned. The rule id is still reported so the gap is visible.
  }

  // ---- 3. relationship continuity ----------------------------------------
  // PRODUCT-REQUIREMENTS.md §34 wants the team to stop re-asking a partner the
  // same questions. Continuity is therefore decisive, not merely heavy: if the
  // person who already owns this relationship can take the work, they keep it,
  // even when a stranger scores a better category/geography fit. The factor is
  // still reported in the score breakdown so the choice stays explainable.
  if (
    existingRelationshipOwnerId !== null &&
    existingRelationshipOwnerId !== undefined &&
    existingRelationshipOwnerId !== ''
  ) {
    const priorOwner = eligible.find(
      (candidate) => candidate.workspaceMemberId === existingRelationshipOwnerId,
    );

    if (priorOwner !== undefined) {
      const priorOwnerScore = scoreCandidate({
        lead,
        candidate: priorOwner,
        existingRelationshipOwnerId,
      });

      return decisionFor({
        candidate: priorOwner,
        strategy: 'EXISTING_RELATIONSHIP',
        score: priorOwnerScore.total,
        reasons: [
          `${priorOwner.displayName} already owns this relationship; kept for continuity.`,
          ...priorOwnerScore.factors
            .filter((factor) => factor.matched)
            .map((factor) => factor.detail),
        ],
        scores: [priorOwnerScore],
        ineligible,
        matchedRuleId: matchedRule?.id ?? null,
      });
    }
  }

  // ---- 4. weighted factors ------------------------------------------------
  const scores = eligible.map((candidate) =>
    scoreCandidate({ lead, candidate, existingRelationshipOwnerId }),
  );

  const topScore = Math.max(...scores.map((score) => score.total));

  const byMemberId = new Map(
    eligible.map((candidate) => [candidate.workspaceMemberId, candidate]),
  );

  // ---- 5. round robin -----------------------------------------------------
  // Used both as the tie-break among joint-top candidates and as the whole
  // decision when nothing matched (every total is 0).
  const leaders = scores.filter((score) => score.total === topScore);
  const winner = pickByRoundRobin(leaders);

  if (winner === undefined || winner === null) {
    return {
      assigneeWorkspaceMemberId: null,
      strategy: 'NONE',
      score: null,
      reasons: [],
      scores,
      ineligible,
      matchedRuleId: matchedRule?.id ?? null,
      unassignedReason: 'No candidate could be selected.',
    };
  }

  const candidate = byMemberId.get(winner.workspaceMemberId) ?? null;
  const isTie = leaders.length > 1;
  const strategy = topScore === 0 ? 'ROUND_ROBIN' : 'SCORED';

  const matchedFactors = winner.factors
    .filter((factor) => factor.matched)
    .map((factor) => factor.detail);

  const reasons =
    topScore === 0
      ? [
          `No routing factor matched; balanced by workload to ${candidate?.displayName ?? winner.workspaceMemberId} (${winner.openLeadCount} open leads).`,
        ]
      : [
          `Best factor fit (${topScore}/100) for ${candidate?.displayName ?? winner.workspaceMemberId}.`,
          ...matchedFactors,
          ...(isTie
            ? [
                `Tied with ${leaders.length - 1} other member(s); broken by workload (${winner.openLeadCount} open leads).`,
              ]
            : []),
        ];

  if (matchedRule !== null && byMemberId.has(matchedRule.assigneeWorkspaceMemberId) === false) {
    reasons.push(
      `Rule "${matchedRule.name}" matched but its assignee was unavailable; fell back to scoring.`,
    );
  }

  return decisionFor({
    candidate,
    strategy,
    score: topScore,
    reasons,
    scores,
    ineligible,
    matchedRuleId: matchedRule?.id ?? null,
  });
};
