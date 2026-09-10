import { describe, expect, it } from 'vitest';

import {
  aCandidate,
  aRule,
  NOW,
} from 'src/modules/lv-assignment/utils/__tests__/test-helpers';
import {
  findMatchingRule,
  selectAssignee,
} from 'src/modules/lv-assignment/utils/select-assignee';

describe('findMatchingRule', () => {
  const lead = {
    category: 'STAY',
    subcategory: 'VILLA',
    location: 'Lonavala',
    source: 'INSTAGRAM',
    languages: ['Marathi'],
  };

  it('returns null when no rule matches', () => {
    expect(
      findMatchingRule(
        [aRule({ id: 'r1', assigneeWorkspaceMemberId: 'a', whenCategory: 'EXPERIENCE' })],
        lead,
      ),
    ).toBeNull();
  });

  it('treats an absent condition as "any"', () => {
    const rule = aRule({ id: 'r1', assigneeWorkspaceMemberId: 'a' });

    expect(findMatchingRule([rule], lead)?.id).toBe('r1');
  });

  it('requires every present condition to match', () => {
    const matching = aRule({
      id: 'r1',
      assigneeWorkspaceMemberId: 'a',
      whenCategory: 'STAY',
      whenRegion: 'Lonavala',
    });
    const failing = aRule({
      id: 'r2',
      assigneeWorkspaceMemberId: 'b',
      whenCategory: 'STAY',
      whenRegion: 'Goa',
    });

    expect(findMatchingRule([failing, matching], lead)?.id).toBe('r1');
  });

  it('matches a language against any of the lead languages', () => {
    const rule = aRule({
      id: 'r1',
      assigneeWorkspaceMemberId: 'a',
      whenLanguage: 'Marathi',
    });

    expect(findMatchingRule([rule], lead)?.id).toBe('r1');
  });

  it('ignores inactive rules', () => {
    const rule = aRule({ id: 'r1', assigneeWorkspaceMemberId: 'a', isActive: false });

    expect(findMatchingRule([rule], lead)).toBeNull();
  });

  it('evaluates lower priority numbers first', () => {
    const second = aRule({ id: 'r2', assigneeWorkspaceMemberId: 'b', priority: 10 });
    const first = aRule({ id: 'r1', assigneeWorkspaceMemberId: 'a', priority: 1 });

    expect(findMatchingRule([second, first], lead)?.id).toBe('r1');
  });

  it('breaks a priority tie by id so ordering is deterministic', () => {
    const ruleB = aRule({ id: 'b', assigneeWorkspaceMemberId: 'x', priority: 5 });
    const ruleA = aRule({ id: 'a', assigneeWorkspaceMemberId: 'y', priority: 5 });

    expect(findMatchingRule([ruleB, ruleA], lead)?.id).toBe('a');
  });
});

describe('selectAssignee', () => {
  describe('precedence', () => {
    it('honours a manual assignee above every rule and score', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: { category: 'STAY', location: 'Lonavala' },
        manualAssigneeId: 'manual',
        candidates: [
          aCandidate({ workspaceMemberId: 'manual' }),
          aCandidate({
            workspaceMemberId: 'perfect',
            categories: ['STAY'],
            regions: ['Lonavala'],
          }),
        ],
        rules: [aRule({ id: 'r1', assigneeWorkspaceMemberId: 'perfect' })],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('manual');
      expect(decision.strategy).toBe('MANUAL');
    });

    it('honours a manual assignee even when they are at capacity', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: {},
        manualAssigneeId: 'full',
        candidates: [
          aCandidate({ workspaceMemberId: 'full', capacity: 3, openLeadCount: 3 }),
          aCandidate({ workspaceMemberId: 'free' }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('full');
      expect(decision.strategy).toBe('MANUAL');
    });

    it('refuses a manual assignee who is deactivated', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: {},
        manualAssigneeId: 'gone',
        candidates: [
          aCandidate({ workspaceMemberId: 'gone', isActive: false }),
          aCandidate({ workspaceMemberId: 'free' }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBeNull();
      expect(decision.unassignedReason).toContain('deactivated');
    });

    it('refuses a manual assignee who is not a team member', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: {},
        manualAssigneeId: 'stranger',
        candidates: [aCandidate({ workspaceMemberId: 'a' })],
      });

      expect(decision.assigneeWorkspaceMemberId).toBeNull();
      expect(decision.unassignedReason).toContain('not a known team member');
    });

    it('applies a matching rule above scoring', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: { category: 'STAY', location: 'Lonavala' },
        candidates: [
          aCandidate({ workspaceMemberId: 'ruled' }),
          aCandidate({
            workspaceMemberId: 'perfect',
            categories: ['STAY'],
            regions: ['Lonavala'],
          }),
        ],
        rules: [
          aRule({
            id: 'r1',
            assigneeWorkspaceMemberId: 'ruled',
            whenCategory: 'STAY',
          }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('ruled');
      expect(decision.strategy).toBe('RULE');
      expect(decision.matchedRuleId).toBe('r1');
    });

    it('falls back to scoring when the rule target is unavailable', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: { category: 'STAY' },
        candidates: [
          aCandidate({ workspaceMemberId: 'ruled', isActive: false }),
          aCandidate({ workspaceMemberId: 'scored', categories: ['STAY'] }),
        ],
        rules: [aRule({ id: 'r1', assigneeWorkspaceMemberId: 'ruled' })],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('scored');
      expect(decision.strategy).toBe('SCORED');
      expect(decision.matchedRuleId).toBe('r1');
      expect(decision.reasons.join(' ')).toContain('unavailable');
    });
  });

  describe('scoring', () => {
    it('prefers the best factor fit', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: { category: 'STAY', location: 'Lonavala', languages: ['Marathi'] },
        candidates: [
          aCandidate({ workspaceMemberId: 'weak', categories: ['STAY'] }),
          aCandidate({
            workspaceMemberId: 'strong',
            categories: ['STAY'],
            regions: ['Lonavala'],
            languages: ['Marathi'],
          }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('strong');
      expect(decision.strategy).toBe('SCORED');
      expect(decision.score).toBe(55);
    });

    it('prefers expertise over an idle but unqualified member', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: { category: 'STAY' },
        candidates: [
          aCandidate({ workspaceMemberId: 'idle', openLeadCount: 0 }),
          aCandidate({
            workspaceMemberId: 'expert',
            categories: ['STAY'],
            openLeadCount: 15,
          }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('expert');
    });

    it('keeps an existing relationship with the prior owner', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: { category: 'STAY', location: 'Lonavala' },
        existingRelationshipOwnerId: 'previous',
        candidates: [
          aCandidate({ workspaceMemberId: 'previous' }),
          aCandidate({
            workspaceMemberId: 'better-fit',
            categories: ['STAY'],
            regions: ['Lonavala'],
          }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('previous');
      expect(decision.reasons.join(' ')).toContain('Already owns a lead');
    });

    it('reports a score breakdown for every eligible candidate', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: { category: 'STAY' },
        candidates: [
          aCandidate({ workspaceMemberId: 'a', categories: ['STAY'] }),
          aCandidate({ workspaceMemberId: 'b' }),
        ],
      });

      expect(decision.scores).toHaveLength(2);
      expect(decision.scores.every((score) => score.factors.length === 5)).toBe(true);
    });
  });

  describe('round robin', () => {
    it('balances by workload when no factor matches', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: {},
        candidates: [
          aCandidate({ workspaceMemberId: 'A', openLeadCount: 18 }),
          aCandidate({ workspaceMemberId: 'B', openLeadCount: 9 }),
          aCandidate({ workspaceMemberId: 'C', openLeadCount: 14 }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('B');
      expect(decision.strategy).toBe('ROUND_ROBIN');
      expect(decision.score).toBe(0);
    });

    it('breaks a scoring tie by workload', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: { category: 'STAY' },
        candidates: [
          aCandidate({
            workspaceMemberId: 'busy',
            categories: ['STAY'],
            openLeadCount: 12,
          }),
          aCandidate({
            workspaceMemberId: 'light',
            categories: ['STAY'],
            openLeadCount: 2,
          }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBe('light');
      expect(decision.strategy).toBe('SCORED');
      expect(decision.reasons.join(' ')).toContain('Tied with');
    });
  });

  describe('unassignable leads', () => {
    it('reports when no team members exist', () => {
      const decision = selectAssignee({ now: NOW, lead: {}, candidates: [] });

      expect(decision.assigneeWorkspaceMemberId).toBeNull();
      expect(decision.strategy).toBe('NONE');
      expect(decision.unassignedReason).toContain('No team members');
    });

    it('reports when everyone is inactive or full', () => {
      const decision = selectAssignee({
        now: NOW,
        lead: {},
        candidates: [
          aCandidate({ workspaceMemberId: 'a', isActive: false }),
          aCandidate({ workspaceMemberId: 'b', capacity: 2, openLeadCount: 2 }),
        ],
      });

      expect(decision.assigneeWorkspaceMemberId).toBeNull();
      expect(decision.unassignedReason).toContain('at capacity');
      expect(decision.ineligible).toHaveLength(2);
    });
  });

  describe('determinism', () => {
    it('returns the same owner for the same inputs', () => {
      const request = {
        now: NOW,
        lead: { category: 'STAY', location: 'Pune' },
        candidates: [
          aCandidate({ workspaceMemberId: 'a', categories: ['STAY'] }),
          aCandidate({ workspaceMemberId: 'b', categories: ['STAY'] }),
          aCandidate({ workspaceMemberId: 'c', regions: ['Pune'] }),
        ],
      };

      const first = selectAssignee(request);
      const second = selectAssignee(request);

      expect(first.assigneeWorkspaceMemberId).toBe(second.assigneeWorkspaceMemberId);
    });

    it('does not depend on candidate ordering', () => {
      const candidates = [
        aCandidate({ workspaceMemberId: 'a', categories: ['STAY'], openLeadCount: 3 }),
        aCandidate({ workspaceMemberId: 'b', categories: ['STAY'], openLeadCount: 1 }),
        aCandidate({ workspaceMemberId: 'c', categories: ['STAY'], openLeadCount: 7 }),
      ];

      const forward = selectAssignee({ now: NOW, lead: { category: 'STAY' }, candidates });
      const reversed = selectAssignee({
        now: NOW,
        lead: { category: 'STAY' },
        candidates: [...candidates].reverse(),
      });

      expect(forward.assigneeWorkspaceMemberId).toBe('b');
      expect(reversed.assigneeWorkspaceMemberId).toBe('b');
    });
  });

  it('always explains its decision', () => {
    const decision = selectAssignee({
      now: NOW,
      lead: { category: 'STAY' },
      candidates: [aCandidate({ workspaceMemberId: 'a', categories: ['STAY'] })],
    });

    expect(decision.reasons.length).toBeGreaterThan(0);
  });
});
