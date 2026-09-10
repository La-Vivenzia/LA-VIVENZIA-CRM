import { describe, expect, it } from 'vitest';

import { type AssignmentDecision } from 'src/modules/lv-assignment/types/assignment.types';
import {
  buildAssignmentHistoryEntry,
  shouldRecordAssignment,
} from 'src/modules/lv-assignment/utils/build-assignment-history';
import { NOW } from 'src/modules/lv-assignment/utils/__tests__/test-helpers';

const aDecision = (overrides: Partial<AssignmentDecision> = {}): AssignmentDecision => ({
  assigneeWorkspaceMemberId: 'new-owner',
  strategy: 'SCORED',
  score: 40,
  reasons: ['Best factor fit (40/100) for New Owner.', 'Covers category STAY'],
  scores: [],
  ineligible: [],
  matchedRuleId: null,
  unassignedReason: null,
  ...overrides,
});

describe('buildAssignmentHistoryEntry', () => {
  it('records both sides of a transfer', () => {
    const entry = buildAssignmentHistoryEntry({
      leadId: 'lead-1',
      previousOwnerId: 'old-owner',
      decision: aDecision(),
      now: NOW,
    });

    expect(entry.fromWorkspaceMemberId).toBe('old-owner');
    expect(entry.toWorkspaceMemberId).toBe('new-owner');
    expect(entry.assignedAt).toBe(NOW);
  });

  it('captures the strategy, score and rule that decided it', () => {
    const entry = buildAssignmentHistoryEntry({
      leadId: 'lead-1',
      previousOwnerId: null,
      decision: aDecision({ strategy: 'RULE', matchedRuleId: 'rule-7', score: null }),
      now: NOW,
    });

    expect(entry.strategy).toBe('RULE');
    expect(entry.matchedRuleId).toBe('rule-7');
    expect(entry.score).toBeNull();
  });

  it('flattens the reasons into one readable sentence', () => {
    const entry = buildAssignmentHistoryEntry({
      leadId: 'lead-1',
      previousOwnerId: null,
      decision: aDecision(),
      now: NOW,
    });

    expect(entry.reason).toContain('Best factor fit');
    expect(entry.reason).toContain('Covers category STAY');
  });

  it('records why a lead could not be assigned', () => {
    const entry = buildAssignmentHistoryEntry({
      leadId: 'lead-1',
      previousOwnerId: null,
      decision: aDecision({
        assigneeWorkspaceMemberId: null,
        strategy: 'NONE',
        reasons: [],
        unassignedReason: 'Every team member is inactive or at capacity.',
      }),
      now: NOW,
    });

    expect(entry.toWorkspaceMemberId).toBeNull();
    expect(entry.reason).toContain('at capacity');
  });

  it('attributes a manual action to the actor', () => {
    const entry = buildAssignmentHistoryEntry({
      leadId: 'lead-1',
      previousOwnerId: 'old',
      decision: aDecision({ strategy: 'MANUAL' }),
      now: NOW,
      actorWorkspaceMemberId: 'admin-1',
    });

    expect(entry.actorWorkspaceMemberId).toBe('admin-1');
  });

  it('leaves the actor null for engine-driven assignment', () => {
    const entry = buildAssignmentHistoryEntry({
      leadId: 'lead-1',
      previousOwnerId: null,
      decision: aDecision(),
      now: NOW,
    });

    expect(entry.actorWorkspaceMemberId).toBeNull();
  });
});

describe('shouldRecordAssignment', () => {
  it('records a genuine owner change', () => {
    expect(
      shouldRecordAssignment({
        previousOwnerId: 'a',
        decision: aDecision({ assigneeWorkspaceMemberId: 'b' }),
        isExplicitAction: false,
      }),
    ).toBe(true);
  });

  it('skips a no-op re-run so history stays readable', () => {
    expect(
      shouldRecordAssignment({
        previousOwnerId: 'a',
        decision: aDecision({ assigneeWorkspaceMemberId: 'a' }),
        isExplicitAction: false,
      }),
    ).toBe(false);
  });

  it('always records an explicit human action, even a no-op', () => {
    expect(
      shouldRecordAssignment({
        previousOwnerId: 'a',
        decision: aDecision({ assigneeWorkspaceMemberId: 'a' }),
        isExplicitAction: true,
      }),
    ).toBe(true);
  });
});
