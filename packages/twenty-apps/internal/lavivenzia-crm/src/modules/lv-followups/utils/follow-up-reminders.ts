import { priorityOrDefault } from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  buildFollowUpNotification,
  type NotificationIntent,
} from 'src/modules/lv-notifications/utils/build-notification';

// Decides which open follow-up tasks deserve a reminder right now. Pure: the
// cron function fetches candidates and hands them here with a fixed clock, so
// the same input always yields the same intents — which, with the dedupe key
// on (task, dueAt), is what makes a re-run or a restarted worker harmless.

// A follow-up is "due" from this many hours before its due time. Long enough
// to act on, short enough to still be a reminder rather than a forecast.
export const FOLLOW_UP_DUE_WINDOW_HOURS = 4;

export type ReminderCandidate = {
  id: string;
  title: string;
  status: string | null;
  dueAt: string | null;
  assigneeWorkspaceMemberId: string | null;
  lvPriority: string | null;
  leadId: string | null;
  leadName: string | null;
};

export type ReminderKind = 'DUE' | 'OVERDUE' | null;

export const reminderKindFor = ({
  task,
  now,
  dueWindowHours = FOLLOW_UP_DUE_WINDOW_HOURS,
}: {
  task: ReminderCandidate;
  now: string;
  dueWindowHours?: number;
}): ReminderKind => {
  if (task.status === 'DONE' || task.dueAt === null || task.assigneeWorkspaceMemberId === null) {
    return null;
  }

  const due = Date.parse(task.dueAt);
  const at = Date.parse(now);

  if (Number.isNaN(due) || Number.isNaN(at)) {
    return null;
  }

  if (due < at) {
    return 'OVERDUE';
  }

  if (due - at <= dueWindowHours * 60 * 60 * 1000) {
    return 'DUE';
  }

  return null;
};

export const followUpReminders = ({
  tasks,
  now,
  dueWindowHours = FOLLOW_UP_DUE_WINDOW_HOURS,
}: {
  tasks: readonly ReminderCandidate[];
  now: string;
  dueWindowHours?: number;
}): NotificationIntent[] => {
  const intents: NotificationIntent[] = [];

  for (const task of tasks) {
    const kind = reminderKindFor({ task, now, dueWindowHours });

    if (kind === null || task.dueAt === null || task.assigneeWorkspaceMemberId === null) {
      continue;
    }

    intents.push(
      buildFollowUpNotification({
        taskId: task.id,
        taskTitle: task.title,
        leadId: task.leadId,
        leadName: task.leadName,
        assigneeWorkspaceMemberId: task.assigneeWorkspaceMemberId,
        dueAt: task.dueAt,
        priority: priorityOrDefault(task.lvPriority),
        isOverdue: kind === 'OVERDUE',
      }),
    );
  }

  return intents;
};
