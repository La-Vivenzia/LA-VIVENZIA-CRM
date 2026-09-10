import { describe, expect, it } from 'vitest';

import {
  toAssignmentCandidate,
  toAssignmentRule,
} from 'src/modules/lv-assignment/services/core-api-assignment-port';

describe('toAssignmentCandidate', () => {
  it('builds a display name from the member name parts', () => {
    expect(
      toAssignmentCandidate({
        id: 'm1',
        name: { firstName: 'Tim', lastName: 'Apple' },
      }).displayName,
    ).toBe('Tim Apple');
  });

  it('falls back to the id when the member has no name', () => {
    expect(toAssignmentCandidate({ id: 'm1' }).displayName).toBe('m1');
  });

  it('treats a member as assignable unless explicitly turned off', () => {
    expect(toAssignmentCandidate({ id: 'm1' }).isActive).toBe(true);
    expect(
      toAssignmentCandidate({ id: 'm1', lvAcceptsLeads: false }).isActive,
    ).toBe(false);
  });

  it('applies a default capacity when none is configured', () => {
    expect(toAssignmentCandidate({ id: 'm1' }).capacity).toBe(25);
    expect(toAssignmentCandidate({ id: 'm1', lvLeadCapacity: 5 }).capacity).toBe(5);
  });

  describe('workload', () => {
    it('counts only leads in an open status', () => {
      const candidate = toAssignmentCandidate({
        id: 'm1',
        lvLeads: [
          { status: 'CONTACTED' },
          { status: 'INTERESTED' },
          { status: 'LOST' },
          { status: 'DUPLICATE' },
          { status: 'LIVE_ACTIVE' },
        ],
      });

      expect(candidate.openLeadCount).toBe(2);
    });

    it('ignores unrecognised statuses rather than miscounting them', () => {
      expect(
        toAssignmentCandidate({ id: 'm1', lvLeads: [{ status: 'NOT_A_STATUS' }] })
          .openLeadCount,
      ).toBe(0);
    });

    it('is zero for a member with no leads', () => {
      expect(toAssignmentCandidate({ id: 'm1' }).openLeadCount).toBe(0);
    });
  });

  describe('last assigned', () => {
    it('takes the most recent lead timestamp', () => {
      expect(
        toAssignmentCandidate({
          id: 'm1',
          lvLeads: [
            { status: 'NEW', updatedAt: '2026-01-01T00:00:00.000Z' },
            { status: 'NEW', updatedAt: '2026-09-01T00:00:00.000Z' },
          ],
        }).lastAssignedAt,
      ).toBe('2026-09-01T00:00:00.000Z');
    });

    it('is null for a member who has never been assigned', () => {
      expect(toAssignmentCandidate({ id: 'm1' }).lastAssignedAt).toBeNull();
    });
  });

  it('defaults every routing attribute to an empty list', () => {
    const candidate = toAssignmentCandidate({ id: 'm1' });

    expect(candidate.regions).toEqual([]);
    expect(candidate.categories).toEqual([]);
    expect(candidate.subcategories).toEqual([]);
    expect(candidate.languages).toEqual([]);
  });
});

describe('toAssignmentRule', () => {
  it('maps a configured rule', () => {
    const rule = toAssignmentRule({
      id: 'r1',
      name: 'Stay leads',
      isActive: true,
      evaluationOrder: 5,
      whenCategory: 'STAY',
      assigneeId: 'm1',
    });

    expect(rule).toMatchObject({
      id: 'r1',
      name: 'Stay leads',
      isActive: true,
      priority: 5,
      whenCategory: 'STAY',
      assigneeWorkspaceMemberId: 'm1',
    });
  });

  it('drops a rule with no assignee, which could never route anything', () => {
    expect(toAssignmentRule({ id: 'r1', whenCategory: 'STAY' })).toBeNull();
  });

  it('treats a rule as active unless explicitly disabled', () => {
    expect(toAssignmentRule({ id: 'r1', assigneeId: 'm1' })?.isActive).toBe(true);
    expect(
      toAssignmentRule({ id: 'r1', assigneeId: 'm1', isActive: false })?.isActive,
    ).toBe(false);
  });

  it('defaults evaluation order to 0', () => {
    expect(toAssignmentRule({ id: 'r1', assigneeId: 'm1' })?.priority).toBe(0);
  });
});
