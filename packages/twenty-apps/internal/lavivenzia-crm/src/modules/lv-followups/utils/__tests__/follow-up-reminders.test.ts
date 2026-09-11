import { describe, expect, it } from 'vitest';

import {
  followUpReminders,
  reminderKindFor,
  type ReminderCandidate,
} from 'src/modules/lv-followups/utils/follow-up-reminders';

const NOW = '2026-09-11T12:00:00.000Z';

const aTask = (overrides: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  id: 'task-1',
  title: 'Call back',
  status: 'TODO',
  dueAt: '2026-09-11T14:00:00.000Z',
  assigneeWorkspaceMemberId: 'wm-1',
  lvPriority: 'MEDIUM',
  leadId: 'lead-1',
  leadName: 'Forest Table',
  ...overrides,
});

describe('reminderKindFor', () => {
  it('is DUE inside the window and nothing before it', () => {
    expect(reminderKindFor({ task: aTask({ dueAt: '2026-09-11T15:59:00.000Z' }), now: NOW })).toBe('DUE');
    expect(reminderKindFor({ task: aTask({ dueAt: '2026-09-11T16:01:00.000Z' }), now: NOW })).toBeNull();
  });

  it('is OVERDUE the moment the due time has passed', () => {
    expect(reminderKindFor({ task: aTask({ dueAt: '2026-09-11T11:59:59.000Z' }), now: NOW })).toBe(
      'OVERDUE',
    );
  });

  it('ignores done, unscheduled and unassigned tasks', () => {
    expect(reminderKindFor({ task: aTask({ status: 'DONE' }), now: NOW })).toBeNull();
    expect(reminderKindFor({ task: aTask({ dueAt: null }), now: NOW })).toBeNull();
    expect(
      reminderKindFor({ task: aTask({ assigneeWorkspaceMemberId: null }), now: NOW }),
    ).toBeNull();
  });

  it('ignores garbage timestamps rather than throwing in a cron', () => {
    expect(reminderKindFor({ task: aTask({ dueAt: 'yesterday' }), now: NOW })).toBeNull();
  });
});

describe('followUpReminders', () => {
  it('produces one intent per task needing a reminder, addressed to the assignee', () => {
    const intents = followUpReminders({
      tasks: [
        aTask(),
        aTask({ id: 'task-2', dueAt: '2026-09-10T09:00:00.000Z', assigneeWorkspaceMemberId: 'wm-2' }),
        aTask({ id: 'task-3', dueAt: '2026-09-20T09:00:00.000Z' }),
      ],
      now: NOW,
    });

    expect(intents.map((intent) => [intent.type, intent.recipientWorkspaceMemberId])).toEqual([
      ['FOLLOW_UP_DUE', 'wm-1'],
      ['FOLLOW_UP_OVERDUE', 'wm-2'],
    ]);
  });

  it('is deterministic for a fixed clock — a re-run yields identical dedupe keys', () => {
    const tasks = [aTask(), aTask({ id: 'task-2', dueAt: '2026-09-10T09:00:00.000Z' })];

    const first = followUpReminders({ tasks, now: NOW }).map((intent) => intent.dedupeKey);
    const again = followUpReminders({ tasks, now: '2026-09-11T12:15:00.000Z' }).map(
      (intent) => intent.dedupeKey,
    );

    expect(first).toEqual(again);
  });

  it('carries the lead so the centre can show who the follow-up is for', () => {
    const [intent] = followUpReminders({ tasks: [aTask()], now: NOW });

    expect(intent?.leadId).toBe('lead-1');
    expect(intent?.body).toContain('Forest Table');
    expect(intent?.target).toEqual({ object: 'task', recordId: 'task-1' });
  });
});
