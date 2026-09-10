import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// Today / Upcoming / Overdue / Completed. These are ordinary Twenty task views
// filtered on dueAt and status — no new storage, no scheduler.
//
// The predicates here exist because the same buckets have to be computed in two
// places that cannot share a saved view: the Lead Profile widget and any
// server-side digest. Keeping them in one tested module stops the two drifting.

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type FollowUpTask = {
  id: string;
  title: string;
  dueAt: string | null;
  status: TaskStatus;
  priority?: LeadPriority | null;
  assigneeWorkspaceMemberId?: string | null;
};

export type FollowUpBucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'UNSCHEDULED';

export const isCompleted = (task: FollowUpTask): boolean => task.status === 'DONE';

// Calendar-day comparison in the viewer's timezone offset. Follow-ups are human
// commitments — "today" means the working day, not the next 24 hours.
const dayKey = (isoTimestamp: string, timeZoneOffsetMinutes: number): string => {
  const parsed = Date.parse(isoTimestamp);

  if (Number.isNaN(parsed)) {
    return '';
  }

  return new Date(parsed + timeZoneOffsetMinutes * 60 * 1000)
    .toISOString()
    .slice(0, 10);
};

export const bucketFor = ({
  task,
  now,
  timeZoneOffsetMinutes = 0,
}: {
  task: FollowUpTask;
  now: string;
  timeZoneOffsetMinutes?: number;
}): FollowUpBucket => {
  if (isCompleted(task)) {
    return 'COMPLETED';
  }

  if (task.dueAt === null) {
    return 'UNSCHEDULED';
  }

  const dueDay = dayKey(task.dueAt, timeZoneOffsetMinutes);
  const todayDay = dayKey(now, timeZoneOffsetMinutes);

  if (dueDay === '') {
    return 'UNSCHEDULED';
  }

  if (dueDay < todayDay) {
    return 'OVERDUE';
  }

  if (dueDay === todayDay) {
    return 'TODAY';
  }

  return 'UPCOMING';
};

const PRIORITY_RANK: Record<LeadPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

// Most urgent first: earlier due date wins, then higher priority, then a stable
// id so two renders never disagree.
export const compareFollowUps = (left: FollowUpTask, right: FollowUpTask): number => {
  const leftDue = left.dueAt === null ? Number.POSITIVE_INFINITY : Date.parse(left.dueAt);
  const rightDue =
    right.dueAt === null ? Number.POSITIVE_INFINITY : Date.parse(right.dueAt);

  if (leftDue !== rightDue) {
    return leftDue - rightDue;
  }

  const leftRank = PRIORITY_RANK[left.priority ?? 'MEDIUM'];
  const rightRank = PRIORITY_RANK[right.priority ?? 'MEDIUM'];

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.id.localeCompare(right.id);
};

export type FollowUpBuckets = Record<FollowUpBucket, FollowUpTask[]>;

export const groupFollowUps = ({
  tasks,
  now,
  timeZoneOffsetMinutes = 0,
}: {
  tasks: readonly FollowUpTask[];
  now: string;
  timeZoneOffsetMinutes?: number;
}): FollowUpBuckets => {
  const buckets: FollowUpBuckets = {
    OVERDUE: [],
    TODAY: [],
    UPCOMING: [],
    COMPLETED: [],
    UNSCHEDULED: [],
  };

  for (const task of tasks) {
    buckets[bucketFor({ task, now, timeZoneOffsetMinutes })].push(task);
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sort(compareFollowUps);
  }

  return buckets;
};

// The single next thing to do for a lead: the most urgent open follow-up.
// Drives "Next action" on the Lead Profile.
export const nextActionFor = ({
  tasks,
  now,
  timeZoneOffsetMinutes = 0,
}: {
  tasks: readonly FollowUpTask[];
  now: string;
  timeZoneOffsetMinutes?: number;
}): FollowUpTask | null => {
  const buckets = groupFollowUps({ tasks, now, timeZoneOffsetMinutes });

  return (
    buckets.OVERDUE[0] ??
    buckets.TODAY[0] ??
    buckets.UPCOMING[0] ??
    buckets.UNSCHEDULED[0] ??
    null
  );
};
