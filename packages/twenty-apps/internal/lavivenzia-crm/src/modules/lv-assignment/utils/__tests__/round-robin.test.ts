import { describe, expect, it } from 'vitest';

import { aCandidate } from 'src/modules/lv-assignment/utils/__tests__/test-helpers';
import {
  CRITICAL_CAPACITY_HEADROOM_RATIO,
  compareForRoundRobin,
  partitionByEligibility,
  pickByRoundRobin,
} from 'src/modules/lv-assignment/utils/round-robin';

describe('partitionByEligibility', () => {
  it('excludes inactive members', () => {
    const { eligible, ineligible } = partitionByEligibility({
      candidates: [aCandidate({ workspaceMemberId: 'a', isActive: false })],
    });

    expect(eligible).toHaveLength(0);
    expect(ineligible).toEqual([{ workspaceMemberId: 'a', reason: 'INACTIVE' }]);
  });

  it('excludes members with zero capacity', () => {
    const { eligible, ineligible } = partitionByEligibility({
      candidates: [aCandidate({ workspaceMemberId: 'a', capacity: 0 })],
    });

    expect(eligible).toHaveLength(0);
    expect(ineligible[0]?.reason).toBe('ZERO_CAPACITY');
  });

  it('excludes members already at capacity', () => {
    const { eligible, ineligible } = partitionByEligibility({
      candidates: [
        aCandidate({ workspaceMemberId: 'a', capacity: 5, openLeadCount: 5 }),
      ],
    });

    expect(eligible).toHaveLength(0);
    expect(ineligible[0]?.reason).toBe('AT_CAPACITY');
  });

  it('keeps members with headroom', () => {
    const { eligible } = partitionByEligibility({
      candidates: [
        aCandidate({ workspaceMemberId: 'a', capacity: 5, openLeadCount: 4 }),
      ],
    });

    expect(eligible.map((candidate) => candidate.workspaceMemberId)).toEqual(['a']);
  });

  describe('critical lead capacity reservation', () => {
    it('holds back nearly-full members for CRITICAL leads', () => {
      const { eligible, ineligible } = partitionByEligibility({
        candidates: [
          aCandidate({ workspaceMemberId: 'full', capacity: 10, openLeadCount: 9 }),
          aCandidate({ workspaceMemberId: 'free', capacity: 10, openLeadCount: 1 }),
        ],
        priority: 'CRITICAL',
      });

      expect(eligible.map((candidate) => candidate.workspaceMemberId)).toEqual(['free']);
      expect(ineligible).toContainEqual({
        workspaceMemberId: 'full',
        reason: 'CAPACITY_RESERVED_FOR_CRITICAL',
      });
    });

    it('does not hold anyone back for non-critical leads', () => {
      const { eligible } = partitionByEligibility({
        candidates: [
          aCandidate({ workspaceMemberId: 'full', capacity: 10, openLeadCount: 9 }),
        ],
        priority: 'HIGH',
      });

      expect(eligible).toHaveLength(1);
    });

    it('releases the reservation rather than leaving a critical lead unowned', () => {
      const { eligible } = partitionByEligibility({
        candidates: [
          aCandidate({ workspaceMemberId: 'full', capacity: 10, openLeadCount: 9 }),
        ],
        priority: 'CRITICAL',
      });

      expect(eligible.map((candidate) => candidate.workspaceMemberId)).toEqual(['full']);
    });

    it('applies the reservation exactly at the threshold', () => {
      const openLeadCount = 10 * CRITICAL_CAPACITY_HEADROOM_RATIO;

      const { eligible } = partitionByEligibility({
        candidates: [
          aCandidate({ workspaceMemberId: 'at', capacity: 10, openLeadCount }),
          aCandidate({ workspaceMemberId: 'below', capacity: 10, openLeadCount: 0 }),
        ],
        priority: 'CRITICAL',
      });

      expect(eligible.map((candidate) => candidate.workspaceMemberId)).toEqual(['below']);
    });
  });
});

describe('compareForRoundRobin / pickByRoundRobin', () => {
  const entry = (
    workspaceMemberId: string,
    openLeadCount: number,
    lastAssignedAt: string | null = null,
  ) => ({ workspaceMemberId, openLeadCount, lastAssignedAt });

  it('picks the least loaded member — the A=18 B=9 C=14 case', () => {
    const winner = pickByRoundRobin([
      entry('A', 18),
      entry('B', 9),
      entry('C', 14),
    ]);

    expect(winner?.workspaceMemberId).toBe('B');
  });

  it('breaks a load tie by least recently assigned', () => {
    const winner = pickByRoundRobin([
      entry('A', 5, '2026-09-09T09:00:00.000Z'),
      entry('B', 5, '2026-09-01T09:00:00.000Z'),
    ]);

    expect(winner?.workspaceMemberId).toBe('B');
  });

  it('treats a never-assigned member as the least recently assigned', () => {
    const winner = pickByRoundRobin([
      entry('A', 5, '2026-01-01T00:00:00.000Z'),
      entry('newcomer', 5, null),
    ]);

    expect(winner?.workspaceMemberId).toBe('newcomer');
  });

  it('falls back to a stable id ordering so replays never differ', () => {
    const winner = pickByRoundRobin([
      entry('zeta', 3, '2026-09-09T09:00:00.000Z'),
      entry('alpha', 3, '2026-09-09T09:00:00.000Z'),
    ]);

    expect(winner?.workspaceMemberId).toBe('alpha');
  });

  it('returns null for an empty candidate list', () => {
    expect(pickByRoundRobin([])).toBeNull();
  });

  it('does not mutate the input array', () => {
    const input = [entry('B', 9), entry('A', 1)];
    const snapshot = input.map((item) => item.workspaceMemberId);

    pickByRoundRobin(input);

    expect(input.map((item) => item.workspaceMemberId)).toEqual(snapshot);
  });

  it('orders load before recency', () => {
    expect(
      compareForRoundRobin(
        entry('busy-but-idle', 10, '2020-01-01T00:00:00.000Z'),
        entry('light-but-recent', 1, '2026-09-09T09:59:00.000Z'),
      ),
    ).toBeGreaterThan(0);
  });

  it('distributes evenly across repeated rounds', () => {
    const load: Record<string, number> = { A: 0, B: 0, C: 0 };

    for (let round = 0; round < 9; round += 1) {
      const winner = pickByRoundRobin(
        Object.entries(load).map(([id, count]) => entry(id, count)),
      );

      load[winner?.workspaceMemberId ?? 'A'] += 1;
    }

    expect(load).toEqual({ A: 3, B: 3, C: 3 });
  });
});
