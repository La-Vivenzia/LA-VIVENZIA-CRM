import { describe, expect, it } from 'vitest';

import {
  bucketFor,
  compareFollowUps,
  groupFollowUps,
  nextActionFor,
  type FollowUpTask,
} from 'src/modules/lv-followups/utils/follow-up-views';

const NOW = '2026-09-09T12:00:00.000Z';

const aTask = (
  overrides: Partial<FollowUpTask> & Pick<FollowUpTask, 'id'>,
): FollowUpTask => ({
  title: `task ${overrides.id}`,
  dueAt: null,
  status: 'TODO',
  ...overrides,
});

describe('bucketFor', () => {
  it('buckets a past due date as overdue', () => {
    expect(
      bucketFor({ task: aTask({ id: 't', dueAt: '2026-09-08T09:00:00.000Z' }), now: NOW }),
    ).toBe('OVERDUE');
  });

  it('buckets the same calendar day as today', () => {
    expect(
      bucketFor({ task: aTask({ id: 't', dueAt: '2026-09-09T23:00:00.000Z' }), now: NOW }),
    ).toBe('TODAY');
  });

  it('treats a time earlier today as today, not overdue', () => {
    // A 9am task at noon is still today's work, not a missed commitment.
    expect(
      bucketFor({ task: aTask({ id: 't', dueAt: '2026-09-09T09:00:00.000Z' }), now: NOW }),
    ).toBe('TODAY');
  });

  it('buckets a future date as upcoming', () => {
    expect(
      bucketFor({ task: aTask({ id: 't', dueAt: '2026-09-11T09:00:00.000Z' }), now: NOW }),
    ).toBe('UPCOMING');
  });

  it('buckets a done task as completed regardless of date', () => {
    expect(
      bucketFor({
        task: aTask({ id: 't', dueAt: '2026-01-01T09:00:00.000Z', status: 'DONE' }),
        now: NOW,
      }),
    ).toBe('COMPLETED');
  });

  it('buckets a task with no due date as unscheduled', () => {
    expect(bucketFor({ task: aTask({ id: 't' }), now: NOW })).toBe('UNSCHEDULED');
  });

  it('treats an in-progress task as still open', () => {
    expect(
      bucketFor({
        task: aTask({ id: 't', dueAt: '2026-09-08T09:00:00.000Z', status: 'IN_PROGRESS' }),
        now: NOW,
      }),
    ).toBe('OVERDUE');
  });

  it('handles an unparseable due date without crashing', () => {
    expect(bucketFor({ task: aTask({ id: 't', dueAt: 'nonsense' }), now: NOW })).toBe(
      'UNSCHEDULED',
    );
  });

  describe('timezone', () => {
    it('uses the viewer day, not UTC', () => {
      // 22:00 UTC on the 9th is 03:30 on the 10th in IST (+330).
      const task = aTask({ id: 't', dueAt: '2026-09-09T22:00:00.000Z' });

      expect(bucketFor({ task, now: NOW })).toBe('TODAY');
      expect(bucketFor({ task, now: NOW, timeZoneOffsetMinutes: 330 })).toBe(
        'UPCOMING',
      );
    });
  });
});

describe('compareFollowUps', () => {
  it('orders by due date first', () => {
    const sorted = [
      aTask({ id: 'late', dueAt: '2026-09-12T09:00:00.000Z' }),
      aTask({ id: 'early', dueAt: '2026-09-10T09:00:00.000Z' }),
    ].sort(compareFollowUps);

    expect(sorted[0]?.id).toBe('early');
  });

  it('breaks a date tie by priority', () => {
    const sorted = [
      aTask({ id: 'low', dueAt: '2026-09-10T09:00:00.000Z', priority: 'LOW' }),
      aTask({ id: 'critical', dueAt: '2026-09-10T09:00:00.000Z', priority: 'CRITICAL' }),
    ].sort(compareFollowUps);

    expect(sorted[0]?.id).toBe('critical');
  });

  it('is deterministic when date and priority tie', () => {
    const sorted = [
      aTask({ id: 'b', dueAt: '2026-09-10T09:00:00.000Z' }),
      aTask({ id: 'a', dueAt: '2026-09-10T09:00:00.000Z' }),
    ].sort(compareFollowUps);

    expect(sorted[0]?.id).toBe('a');
  });

  it('sorts undated tasks last', () => {
    const sorted = [
      aTask({ id: 'undated' }),
      aTask({ id: 'dated', dueAt: '2026-09-10T09:00:00.000Z' }),
    ].sort(compareFollowUps);

    expect(sorted[0]?.id).toBe('dated');
  });
});

describe('groupFollowUps', () => {
  const tasks = [
    aTask({ id: 'overdue', dueAt: '2026-09-01T09:00:00.000Z' }),
    aTask({ id: 'today', dueAt: '2026-09-09T18:00:00.000Z' }),
    aTask({ id: 'upcoming', dueAt: '2026-09-15T09:00:00.000Z' }),
    aTask({ id: 'done', dueAt: '2026-09-02T09:00:00.000Z', status: 'DONE' }),
    aTask({ id: 'unscheduled' }),
  ];

  it('splits tasks into the four working views plus unscheduled', () => {
    const buckets = groupFollowUps({ tasks, now: NOW });

    expect(buckets.OVERDUE.map((task) => task.id)).toEqual(['overdue']);
    expect(buckets.TODAY.map((task) => task.id)).toEqual(['today']);
    expect(buckets.UPCOMING.map((task) => task.id)).toEqual(['upcoming']);
    expect(buckets.COMPLETED.map((task) => task.id)).toEqual(['done']);
    expect(buckets.UNSCHEDULED.map((task) => task.id)).toEqual(['unscheduled']);
  });

  it('returns every bucket even when empty', () => {
    const buckets = groupFollowUps({ tasks: [], now: NOW });

    expect(Object.keys(buckets).sort()).toEqual([
      'COMPLETED',
      'OVERDUE',
      'TODAY',
      'UNSCHEDULED',
      'UPCOMING',
    ]);
  });

  it('sorts within each bucket', () => {
    const buckets = groupFollowUps({
      tasks: [
        aTask({ id: 'later', dueAt: '2026-09-05T09:00:00.000Z' }),
        aTask({ id: 'earlier', dueAt: '2026-09-01T09:00:00.000Z' }),
      ],
      now: NOW,
    });

    expect(buckets.OVERDUE.map((task) => task.id)).toEqual(['earlier', 'later']);
  });
});

describe('nextActionFor', () => {
  it('prefers the most overdue commitment', () => {
    const next = nextActionFor({
      tasks: [
        aTask({ id: 'today', dueAt: '2026-09-09T18:00:00.000Z' }),
        aTask({ id: 'overdue', dueAt: '2026-09-01T09:00:00.000Z' }),
      ],
      now: NOW,
    });

    expect(next?.id).toBe('overdue');
  });

  it('falls through overdue to today to upcoming', () => {
    expect(
      nextActionFor({
        tasks: [
          aTask({ id: 'upcoming', dueAt: '2026-09-20T09:00:00.000Z' }),
          aTask({ id: 'today', dueAt: '2026-09-09T18:00:00.000Z' }),
        ],
        now: NOW,
      })?.id,
    ).toBe('today');
  });

  it('surfaces an unscheduled task rather than showing nothing', () => {
    expect(
      nextActionFor({ tasks: [aTask({ id: 'unscheduled' })], now: NOW })?.id,
    ).toBe('unscheduled');
  });

  it('ignores completed work', () => {
    expect(
      nextActionFor({
        tasks: [aTask({ id: 'done', dueAt: '2026-09-01T09:00:00.000Z', status: 'DONE' })],
        now: NOW,
      }),
    ).toBeNull();
  });

  it('returns null when there is nothing to do', () => {
    expect(nextActionFor({ tasks: [], now: NOW })).toBeNull();
  });
});
