import { describe, expect, it } from 'vitest';

import {
  bucketFor,
  bucketsForLens,
  compareWork,
  EMPTY_LOG_FILTERS,
  groupWork,
  isWorkLens,
  matchesLog,
  tasksForLens,
  WORK_LENSES,
  type LogEntry,
  type WorkTask,
} from 'src/api/work';

// `bucketFor` and `compareWork` are a port of
// `lv-followups/utils/follow-up-views.ts`. These cases are deliberately the
// server's own, so the screen and the saved views cannot drift apart without
// one of the two suites going red.

const NOW = '2026-09-09T12:00:00.000Z';

const aTask = (overrides: Partial<WorkTask> & Pick<WorkTask, 'id'>): WorkTask => ({
  title: `task ${overrides.id}`,
  dueAt: null,
  status: 'TODO',
  priority: null,
  assigneeId: null,
  assigneeName: null,
  leadId: 'lead-1',
  leadName: 'A lead',
  leadRef: 'LV-000001',
  sourceChannel: null,
  updatedAt: null,
  ...overrides,
});

describe('bucketFor', () => {
  it('buckets a past due date as overdue', () => {
    expect(bucketFor({ task: aTask({ id: 't', dueAt: '2026-09-08T09:00:00.000Z' }), now: NOW })).toBe('OVERDUE');
  });

  it('buckets the same calendar day as today', () => {
    expect(bucketFor({ task: aTask({ id: 't', dueAt: '2026-09-09T23:00:00.000Z' }), now: NOW })).toBe('TODAY');
  });

  it('treats a time earlier today as today, not overdue', () => {
    // A 9am task at noon is still today's work, not a missed commitment.
    expect(bucketFor({ task: aTask({ id: 't', dueAt: '2026-09-09T09:00:00.000Z' }), now: NOW })).toBe('TODAY');
  });

  it('buckets a future date as upcoming', () => {
    expect(bucketFor({ task: aTask({ id: 't', dueAt: '2026-09-11T09:00:00.000Z' }), now: NOW })).toBe('UPCOMING');
  });

  it('buckets a done task as completed regardless of date', () => {
    expect(bucketFor({ task: aTask({ id: 't', status: 'DONE', dueAt: '2026-09-01T09:00:00.000Z' }), now: NOW })).toBe('COMPLETED');
  });

  it('buckets a task with no due date as unscheduled', () => {
    expect(bucketFor({ task: aTask({ id: 't' }), now: NOW })).toBe('UNSCHEDULED');
  });

  it('treats an in-progress task as still open', () => {
    expect(bucketFor({ task: aTask({ id: 't', status: 'IN_PROGRESS', dueAt: '2026-09-08T09:00:00.000Z' }), now: NOW })).toBe('OVERDUE');
  });

  it('handles an unparseable due date without crashing', () => {
    expect(bucketFor({ task: aTask({ id: 't', dueAt: 'not a date' }), now: NOW })).toBe('UNSCHEDULED');
  });

  it('uses the viewer day, not UTC', () => {
    // 22:00 UTC on the 9th is 03:30 on the 10th in IST (+330).
    const task = aTask({ id: 't', dueAt: '2026-09-09T22:00:00.000Z' });

    expect(bucketFor({ task, now: NOW })).toBe('TODAY');
    expect(bucketFor({ task, now: NOW, timeZoneOffsetMinutes: 330 })).toBe('UPCOMING');
  });
});

describe('compareWork', () => {
  it('orders by due date first', () => {
    const early = aTask({ id: 'a', dueAt: '2026-09-09T09:00:00.000Z' });
    const late = aTask({ id: 'b', dueAt: '2026-09-10T09:00:00.000Z' });

    expect([late, early].sort(compareWork).map((task) => task.id)).toEqual(['a', 'b']);
  });

  it('breaks a date tie by priority', () => {
    const low = aTask({ id: 'a', dueAt: NOW, priority: 'LOW' });
    const critical = aTask({ id: 'b', dueAt: NOW, priority: 'CRITICAL' });

    expect([low, critical].sort(compareWork).map((task) => task.id)).toEqual(['b', 'a']);
  });

  it('sorts undated work last', () => {
    const dated = aTask({ id: 'a', dueAt: '2026-12-31T09:00:00.000Z' });
    const undated = aTask({ id: 'b' });

    expect([undated, dated].sort(compareWork).map((task) => task.id)).toEqual(['a', 'b']);
  });
});

describe('groupWork', () => {
  it('returns every bucket even when empty', () => {
    expect(Object.keys(groupWork({ tasks: [], now: NOW })).sort()).toEqual(['COMPLETED', 'OVERDUE', 'TODAY', 'UNSCHEDULED', 'UPCOMING']);
  });

  it('splits work into the four lenses plus unscheduled', () => {
    const buckets = groupWork({
      tasks: [
        aTask({ id: 'overdue', dueAt: '2026-09-01T09:00:00.000Z' }),
        aTask({ id: 'today', dueAt: '2026-09-09T15:00:00.000Z' }),
        aTask({ id: 'upcoming', dueAt: '2026-09-20T09:00:00.000Z' }),
        aTask({ id: 'done', status: 'DONE' }),
        aTask({ id: 'undated' }),
      ],
      now: NOW,
    });

    expect(buckets.OVERDUE.map((task) => task.id)).toEqual(['overdue']);
    expect(buckets.TODAY.map((task) => task.id)).toEqual(['today']);
    expect(buckets.UPCOMING.map((task) => task.id)).toEqual(['upcoming']);
    expect(buckets.COMPLETED.map((task) => task.id)).toEqual(['done']);
    expect(buckets.UNSCHEDULED.map((task) => task.id)).toEqual(['undated']);
  });
});

describe('lenses', () => {
  it('recognises only the four screens in the inventory', () => {
    expect(WORK_LENSES.every(isWorkLens)).toBe(true);
    expect(isWorkLens('unscheduled')).toBe(false);
    expect(isWorkLens(undefined)).toBe(false);
  });

  it('shows undated work inside Upcoming so it is never invisible', () => {
    expect(bucketsForLens('upcoming')).toEqual(['UPCOMING', 'UNSCHEDULED']);

    const buckets = groupWork({
      tasks: [aTask({ id: 'later', dueAt: '2026-09-20T09:00:00.000Z' }), aTask({ id: 'undated' })],
      now: NOW,
    });

    expect(tasksForLens(buckets, 'upcoming').map((task) => task.id)).toEqual(['later', 'undated']);
  });

  it('covers every bucket across the four lenses', () => {
    const covered = new Set(WORK_LENSES.flatMap(bucketsForLens));

    expect([...covered].sort()).toEqual(['COMPLETED', 'OVERDUE', 'TODAY', 'UNSCHEDULED', 'UPCOMING']);
  });
});

describe('matchesLog', () => {
  const entry: LogEntry = {
    id: 'i1',
    channel: 'WHATSAPP',
    direction: 'INBOUND',
    occurredAt: NOW,
    summary: 'Asked about the monthly cap',
    purpose: 'PRICING',
    outcome: null,
    durationMinutes: null,
    actorName: 'LV Test',
    leadId: 'lead-1',
    leadName: 'Sunset Villa',
    leadRef: 'LV-000003',
  };

  it('passes everything when nothing is filtered', () => {
    expect(matchesLog(entry, EMPTY_LOG_FILTERS)).toBe(true);
  });

  it('filters by channel and direction', () => {
    expect(matchesLog(entry, { ...EMPTY_LOG_FILTERS, channel: 'EMAIL' })).toBe(false);
    expect(matchesLog(entry, { ...EMPTY_LOG_FILTERS, channel: 'WHATSAPP' })).toBe(true);
    expect(matchesLog(entry, { ...EMPTY_LOG_FILTERS, direction: 'OUTBOUND' })).toBe(false);
  });

  it('searches the lead, the reference and what was said', () => {
    expect(matchesLog(entry, { ...EMPTY_LOG_FILTERS, query: 'sunset' })).toBe(true);
    expect(matchesLog(entry, { ...EMPTY_LOG_FILTERS, query: 'LV-000003' })).toBe(true);
    expect(matchesLog(entry, { ...EMPTY_LOG_FILTERS, query: 'monthly cap' })).toBe(true);
    expect(matchesLog(entry, { ...EMPTY_LOG_FILTERS, query: 'onboarding' })).toBe(false);
  });
});
