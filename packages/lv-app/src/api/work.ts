import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { callRoute, graphql } from 'src/api/client';

// Work management.
//
// Everything on these screens is one of three things Twenty already stores and
// La Vivenzia already writes:
//
//   - a `task` attached to a lead through `taskTarget` — a follow-up,
//   - an `lvInteraction` — the record of a contact that happened,
//   - a `note` attached to a lead through `noteTarget`.
//
// There is no work object, no board, no sprint and **no standalone task**:
// every row here belongs to a relationship. `/tasks/create` and `/notes/create`
// both require a `leadId`, and `/tasks/update` re-reads `taskTargets` to check
// the task really is attached to the lead named in the body — so a row that
// cannot name its lead cannot be acted on, and nothing here pretends otherwise.
//
// The four lenses are not four queries. They are the buckets of
// `lv-followups/utils/follow-up-views.ts`, ported below so the screen and the
// server agree about what "today" means.

// ---------------------------------------------------------------------------
// Vocabulary — exactly what the backend stores
// ---------------------------------------------------------------------------

/** `TASK_STATUSES` in `lv-followups/utils/follow-up-views.ts`. */
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

/**
 * A follow-up's priority is the lead priority enum — `LeadPriority` in
 * `lv-core/constants/lead-lifecycle`. There is no separate task priority.
 *
 * It is read from GraphQL as `lvPriority` and written to `/tasks/create` as
 * `priority`. The asymmetry is the backend's, not a mistake here.
 */
export const TASK_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

/**
 * The five one-tap follow-ups in `lv-followups/utils/quick-actions.ts`. The key
 * is all the route needs: it fills title, due date and priority server-side, so
 * the button and the full form land on the same task.
 */
export const QUICK_ACTIONS = [
  { key: 'CALL_TOMORROW', label: 'Call tomorrow' },
  { key: 'FOLLOW_UP_2_DAYS', label: 'Follow up in 2 days' },
  { key: 'SEND_ONBOARDING_INFO', label: 'Send onboarding information' },
  { key: 'REVIEW_DOCUMENTS', label: 'Review documents' },
  { key: 'SCHEDULE_MEETING', label: 'Schedule meeting' },
] as const;

export type QuickActionKey = (typeof QUICK_ACTIONS)[number]['key'];

// ---------------------------------------------------------------------------
// Buckets — ported from lv-followups/utils/follow-up-views.ts
// ---------------------------------------------------------------------------

export type WorkTask = {
  id: string;
  title: string;
  dueAt: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  assigneeId: string | null;
  assigneeName: string | null;
  /** Null when the task has no `taskTarget` on a lead — it then cannot be acted on. */
  leadId: string | null;
  leadName: string | null;
  leadRef: string | null;
  /** The interaction this follow-up came out of, when one did. */
  sourceChannel: string | null;
  updatedAt: string | null;
};

export type WorkBucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'UNSCHEDULED';

/** The four screens in the inventory. `UNSCHEDULED` is shown inside Upcoming. */
export const WORK_LENSES = ['today', 'overdue', 'upcoming', 'completed'] as const;

export type WorkLens = (typeof WORK_LENSES)[number];

export const isWorkLens = (value: string | undefined): value is WorkLens =>
  (WORK_LENSES as readonly string[]).includes(value ?? '');

export const LENS_COPY: Record<WorkLens, { title: string; subtitle: string; empty: string }> = {
  today: { title: 'Due today', subtitle: 'The follow-ups you committed to for today.', empty: 'Nothing is due today.' },
  overdue: { title: 'Overdue', subtitle: 'Past their due date and still open.', empty: 'Nothing is overdue.' },
  upcoming: { title: 'Upcoming', subtitle: 'Scheduled for a later day, and anything with no date yet.', empty: 'Nothing is scheduled.' },
  completed: { title: 'Completed', subtitle: 'Follow-ups marked done, most recently updated first.', empty: 'Nothing has been completed yet.' },
};

const isCompleted = (task: Pick<WorkTask, 'status'>): boolean => task.status === 'DONE';

// Calendar-day comparison in the viewer's own offset. A follow-up is a human
// commitment: "today" is the working day, not the next 24 hours.
const dayKey = (isoTimestamp: string, timeZoneOffsetMinutes: number): string => {
  const parsed = Date.parse(isoTimestamp);

  if (Number.isNaN(parsed)) {
    return '';
  }

  return new Date(parsed + timeZoneOffsetMinutes * 60 * 1000).toISOString().slice(0, 10);
};

export const bucketFor = ({
  task,
  now,
  timeZoneOffsetMinutes = 0,
}: {
  task: Pick<WorkTask, 'status' | 'dueAt'>;
  now: string;
  timeZoneOffsetMinutes?: number;
}): WorkBucket => {
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

  return dueDay === todayDay ? 'TODAY' : 'UPCOMING';
};

const PRIORITY_RANK: Record<TaskPriority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Most urgent first: earlier due date, then higher priority, then a stable id. */
export const compareWork = (left: WorkTask, right: WorkTask): number => {
  const leftDue = left.dueAt === null ? Number.POSITIVE_INFINITY : Date.parse(left.dueAt);
  const rightDue = right.dueAt === null ? Number.POSITIVE_INFINITY : Date.parse(right.dueAt);

  if (leftDue !== rightDue) {
    return leftDue - rightDue;
  }

  const leftRank = PRIORITY_RANK[left.priority ?? 'MEDIUM'];
  const rightRank = PRIORITY_RANK[right.priority ?? 'MEDIUM'];

  return leftRank !== rightRank ? leftRank - rightRank : left.id.localeCompare(right.id);
};

export type WorkBuckets = Record<WorkBucket, WorkTask[]>;

export const groupWork = ({
  tasks,
  now,
  timeZoneOffsetMinutes = 0,
}: {
  tasks: readonly WorkTask[];
  now: string;
  timeZoneOffsetMinutes?: number;
}): WorkBuckets => {
  const buckets: WorkBuckets = { OVERDUE: [], TODAY: [], UPCOMING: [], COMPLETED: [], UNSCHEDULED: [] };

  for (const task of tasks) {
    buckets[bucketFor({ task, now, timeZoneOffsetMinutes })].push(task);
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sort(compareWork);
  }

  return buckets;
};

/** Which buckets a lens shows. Upcoming carries the undated work so it is never invisible. */
export const bucketsForLens = (lens: WorkLens): WorkBucket[] =>
  lens === 'today'
    ? ['TODAY']
    : lens === 'overdue'
      ? ['OVERDUE']
      : lens === 'upcoming'
        ? ['UPCOMING', 'UNSCHEDULED']
        : ['COMPLETED'];

export const tasksForLens = (buckets: WorkBuckets, lens: WorkLens): WorkTask[] =>
  bucketsForLens(lens).flatMap((bucket) => buckets[bucket]);

// ---------------------------------------------------------------------------
// Reading the work
// ---------------------------------------------------------------------------

type RawTask = {
  id?: string;
  title?: string | null;
  dueAt?: string | null;
  status?: string | null;
  lvPriority?: string | null;
  assigneeId?: string | null;
  updatedAt?: string | null;
  assignee?: { id?: string | null; name?: { firstName?: string | null; lastName?: string | null } | null } | null;
  lvSourceInteraction?: { channel?: string | null } | null;
  taskTargets?: { edges?: { node?: { targetLvLeadId?: string | null } | null }[] | null } | null;
};

type RawLead = { id?: string; name?: string | null; lvLeadId?: string | null };

/**
 * The selection proved in `lv-dashboard/services/dashboard-summary.ts`. Read as
 * the signed-in member, so Twenty's own task permission and CM-004's view of
 * the lead decide what comes back — this file never widens either.
 */
const TASK_SELECTION = `id title dueAt status lvPriority assigneeId updatedAt
      assignee { id name { firstName lastName } }
      lvSourceInteraction { channel }
      taskTargets { edges { node { targetLvLeadId } } }`;

/** Open work — the three live lenses. Mirrors `isOpenFilter` in the saved views. */
const OPEN_TASKS_QUERY = `query($first: Int!) {
  tasks(first: $first, filter: { status: { in: ["TODO", "IN_PROGRESS"] } }, orderBy: { dueAt: AscNullsLast }) {
    edges { node { ${TASK_SELECTION} } }
  }
}`;

/** Finished work, newest first. A separate page so a long history cannot crowd out today. */
const DONE_TASKS_QUERY = `query($first: Int!) {
  tasks(first: $first, filter: { status: { eq: "DONE" } }, orderBy: { updatedAt: DescNullsLast }) {
    edges { node { ${TASK_SELECTION} } }
  }
}`;

const LEADS_QUERY = `query($ids: [UUID!]) {
  lvLeads(first: 100, filter: { id: { in: $ids } }) { edges { node { id name lvLeadId } } }
}`;

/** How much work one screen reads. The server caps a page; these are ours. */
export const OPEN_PAGE = 200;
export const DONE_PAGE = 100;

const memberName = (member: RawTask['assignee']): string | null => {
  const joined = [member?.name?.firstName, member?.name?.lastName].filter(Boolean).join(' ').trim();

  return joined.length > 0 ? joined : null;
};

const asStatus = (value: string | null | undefined): TaskStatus =>
  (TASK_STATUSES as readonly string[]).includes(value ?? '') ? (value as TaskStatus) : 'TODO';

const asPriority = (value: string | null | undefined): TaskPriority | null =>
  (TASK_PRIORITIES as readonly string[]).includes(value ?? '') ? (value as TaskPriority) : null;

const leadIdOf = (row: RawTask): string | null =>
  (row.taskTargets?.edges ?? []).map((edge) => edge?.node?.targetLvLeadId).find((id): id is string => typeof id === 'string') ?? null;

const toTask = (row: RawTask, leads: Map<string, RawLead>): WorkTask => {
  const leadId = leadIdOf(row);
  const lead = leadId ? leads.get(leadId) : undefined;

  return {
    id: row.id ?? '',
    title: row.title?.trim() || 'Untitled follow-up',
    dueAt: row.dueAt ?? null,
    status: asStatus(row.status),
    priority: asPriority(row.lvPriority),
    assigneeId: row.assignee?.id ?? row.assigneeId ?? null,
    assigneeName: memberName(row.assignee),
    leadId,
    leadName: lead?.name ?? null,
    leadRef: lead?.lvLeadId ?? null,
    sourceChannel: row.lvSourceInteraction?.channel ?? null,
    updatedAt: row.updatedAt ?? null,
  };
};

export type WorkData = {
  buckets: WorkBuckets;
  counts: Record<WorkLens, number>;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useWork = (): WorkData => {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    const read = async () => {
      setLoading(true);
      setError(null);

      try {
        const [open, done] = await Promise.all([
          graphql<{ tasks?: { edges?: { node?: RawTask }[] } }>(OPEN_TASKS_QUERY, { first: OPEN_PAGE }),
          graphql<{ tasks?: { edges?: { node?: RawTask }[] } }>(DONE_TASKS_QUERY, { first: DONE_PAGE }),
        ]);

        const rows = [...(open.tasks?.edges ?? []), ...(done.tasks?.edges ?? [])]
          .map((edge) => edge?.node)
          .filter((node): node is RawTask => Boolean(node?.id));

        // One lookup for every lead these tasks belong to — the same two-step
        // the dashboard does, because a taskTarget carries an id and no name.
        const ids = [...new Set(rows.map(leadIdOf).filter((id): id is string => id !== null))].slice(0, 100);
        const leads = new Map<string, RawLead>();

        if (ids.length > 0) {
          const named = await graphql<{ lvLeads?: { edges?: { node?: RawLead }[] } }>(LEADS_QUERY, { ids });

          for (const edge of named.lvLeads?.edges ?? []) {
            if (edge?.node?.id) {
              leads.set(edge.node.id, edge.node);
            }
          }
        }

        if (live.current) {
          setTasks(rows.map((row) => toTask(row, leads)));
        }
      } catch (cause) {
        if (live.current) {
          // The server's own words. A refusal without its reason is a dead end.
          setError(cause instanceof Error ? cause.message : 'Your work could not be loaded.');
        }
      } finally {
        if (live.current) {
          setLoading(false);
        }
      }
    };

    void read();

    return () => {
      live.current = false;
    };
  }, [attempt]);

  const buckets = useMemo(
    () => groupWork({ tasks, now: new Date().toISOString(), timeZoneOffsetMinutes: -new Date().getTimezoneOffset() }),
    [tasks],
  );

  const counts = useMemo(
    () =>
      WORK_LENSES.reduce(
        (all, lens) => ({ ...all, [lens]: tasksForLens(buckets, lens).length }),
        {} as Record<WorkLens, number>,
      ),
    [buckets],
  );

  return { buckets, counts, loading, error, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

// ---------------------------------------------------------------------------
// Acting on the work
// ---------------------------------------------------------------------------

/**
 * `/tasks/update` takes the lead as well as the task and checks the two are
 * attached, so a task id on its own is never enough. A row without a lead is
 * shown with its actions disabled rather than failing when pressed.
 */
export const completeTask = (taskId: string, leadId: string) =>
  callRoute<{ ok: true }>('/tasks/update', { taskId, leadId, action: 'COMPLETE' });

export const reopenTask = (taskId: string, leadId: string) =>
  callRoute<{ ok: true }>('/tasks/update', { taskId, leadId, action: 'REOPEN' });

export const rescheduleTask = (taskId: string, leadId: string, dueAt: string, title?: string) =>
  callRoute<{ ok: true }>('/tasks/update', { taskId, leadId, action: 'RESCHEDULE', dueAt, ...(title ? { title } : {}) });

/**
 * A follow-up belongs to a relationship, so creating one starts by naming it.
 * The same `ilike` filter the global search uses, narrowed to leads — read as
 * the caller, so the picker can only offer leads this person may already see.
 */
const LEAD_SEARCH_QUERY = `query($term: String!) {
  lvLeads(first: 8, filter: { or: [{ name: { ilike: $term } }, { lvLeadId: { ilike: $term } }, { location: { ilike: $term } }] }) {
    edges { node { id name lvLeadId } }
  }
}`;

export type LeadOption = { id: string; name: string; ref: string | null };

export const searchLeads = async (term: string): Promise<LeadOption[]> => {
  const trimmed = term.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const data = await graphql<{ lvLeads?: { edges?: { node?: RawLead }[] } }>(LEAD_SEARCH_QUERY, { term: `%${trimmed}%` });

  return (data.lvLeads?.edges ?? [])
    .map((edge) => edge?.node)
    .filter((node): node is RawLead => Boolean(node?.id))
    .map((node) => ({ id: node.id ?? '', name: node.name ?? 'Unnamed lead', ref: node.lvLeadId ?? null }));
};

export type NewTask = {
  leadId: string;
  title?: string;
  description?: string;
  dueAt?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  quickAction?: QuickActionKey;
};

export const createTask = (input: NewTask) =>
  callRoute<{ ok: true; taskId?: string }>('/tasks/create', {
    ...input,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
  });

// ---------------------------------------------------------------------------
// 11.5 — the interactions log
// ---------------------------------------------------------------------------

export type LogEntry = {
  id: string;
  channel: string;
  direction: string;
  occurredAt: string | null;
  summary: string | null;
  purpose: string | null;
  outcome: string | null;
  durationMinutes: number | null;
  actorName: string | null;
  leadId: string | null;
  leadName: string | null;
  leadRef: string | null;
};

type RawLog = {
  id?: string;
  channel?: string | null;
  direction?: string | null;
  occurredAt?: string | null;
  summary?: { markdown?: string | null } | null;
  purpose?: string | null;
  outcome?: string | null;
  durationMinutes?: number | null;
  actor?: { name?: { firstName?: string | null; lastName?: string | null } | null } | null;
  lead?: { id?: string | null; name?: string | null; lvLeadId?: string | null } | null;
};

/**
 * The same object the inbox reads, flat and in time order rather than folded
 * into conversations. `summary` is RICH_TEXT, so it arrives as `{ markdown }`
 * and never as a string.
 */
const LOG_QUERY = `query($first: Int!) {
  lvInteractions(first: $first, orderBy: { occurredAt: DescNullsLast }) {
    edges { node {
      id channel direction occurredAt purpose outcome durationMinutes
      summary { markdown }
      actor { name { firstName lastName } }
      lead { id name lvLeadId }
    } }
  }
}`;

export const LOG_PAGE = 200;

export type LogFilters = { channel: string; direction: string; query: string };

export const EMPTY_LOG_FILTERS: LogFilters = { channel: 'ALL', direction: 'ALL', query: '' };

export const matchesLog = (entry: LogEntry, filters: LogFilters): boolean => {
  if (filters.channel !== 'ALL' && entry.channel !== filters.channel) {
    return false;
  }

  if (filters.direction !== 'ALL' && entry.direction !== filters.direction) {
    return false;
  }

  const needle = filters.query.trim().toLowerCase();

  if (needle.length === 0) {
    return true;
  }

  return [entry.leadName, entry.leadRef, entry.summary, entry.purpose, entry.outcome, entry.actorName]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(needle));
};

export type LogData = { entries: LogEntry[]; loading: boolean; error: string | null; reload: () => void };

export const useInteractionLog = (): LogData => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    const read = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await graphql<{ lvInteractions?: { edges?: { node?: RawLog }[] } }>(LOG_QUERY, { first: LOG_PAGE });
        const rows = (data.lvInteractions?.edges ?? [])
          .map((edge) => edge?.node)
          .filter((node): node is RawLog => Boolean(node?.id))
          .map(
            (row): LogEntry => ({
              id: row.id ?? '',
              channel: row.channel ?? 'FORM',
              direction: row.direction ?? 'OUTBOUND',
              occurredAt: row.occurredAt ?? null,
              summary: row.summary?.markdown?.trim() || null,
              purpose: row.purpose ?? null,
              outcome: row.outcome ?? null,
              durationMinutes: typeof row.durationMinutes === 'number' ? row.durationMinutes : null,
              actorName: [row.actor?.name?.firstName, row.actor?.name?.lastName].filter(Boolean).join(' ').trim() || null,
              leadId: row.lead?.id ?? null,
              leadName: row.lead?.name ?? null,
              leadRef: row.lead?.lvLeadId ?? null,
            }),
          );

        if (live.current) {
          setEntries(rows);
        }
      } catch (cause) {
        if (live.current) {
          setError(cause instanceof Error ? cause.message : 'The interactions log could not be loaded.');
        }
      } finally {
        if (live.current) {
          setLoading(false);
        }
      }
    };

    void read();

    return () => {
      live.current = false;
    };
  }, [attempt]);

  return { entries, loading, error, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

// ---------------------------------------------------------------------------
// 11.6 — notes
// ---------------------------------------------------------------------------

export type WorkNote = {
  id: string;
  title: string | null;
  body: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  authorName: string | null;
  leadId: string | null;
  leadName: string | null;
  leadRef: string | null;
};

type RawNote = {
  id?: string;
  title?: string | null;
  bodyV2?: { markdown?: string | null } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: { name?: string | null } | null;
  noteTargets?: { edges?: { node?: { targetLvLeadId?: string | null } | null }[] | null } | null;
};

/**
 * Twenty's own `note`, written by `/notes/create` as `bodyV2 { markdown }` and
 * attached through `noteTarget.targetLvLeadId`. `createdBy` is the platform's
 * actor stamp, not a relation, so it carries a plain name.
 */
const NOTES_QUERY = `query($first: Int!) {
  notes(first: $first, orderBy: { createdAt: DescNullsLast }) {
    edges { node {
      id title createdAt updatedAt
      bodyV2 { markdown }
      createdBy { name }
      noteTargets { edges { node { targetLvLeadId } } }
    } }
  }
}`;

export const NOTES_PAGE = 150;

export type NotesData = { notes: WorkNote[]; loading: boolean; error: string | null; reload: () => void };

export const useNotes = (): NotesData => {
  const [notes, setNotes] = useState<WorkNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    const read = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await graphql<{ notes?: { edges?: { node?: RawNote }[] } }>(NOTES_QUERY, { first: NOTES_PAGE });
        const rows = (data.notes?.edges ?? []).map((edge) => edge?.node).filter((node): node is RawNote => Boolean(node?.id));
        const ids = [
          ...new Set(
            rows
              .flatMap((row) => (row.noteTargets?.edges ?? []).map((edge) => edge?.node?.targetLvLeadId))
              .filter((id): id is string => typeof id === 'string'),
          ),
        ].slice(0, 100);
        const leads = new Map<string, RawLead>();

        if (ids.length > 0) {
          const named = await graphql<{ lvLeads?: { edges?: { node?: RawLead }[] } }>(LEADS_QUERY, { ids });

          for (const edge of named.lvLeads?.edges ?? []) {
            if (edge?.node?.id) {
              leads.set(edge.node.id, edge.node);
            }
          }
        }

        if (live.current) {
          setNotes(
            rows.map((row): WorkNote => {
              const leadId =
                (row.noteTargets?.edges ?? [])
                  .map((edge) => edge?.node?.targetLvLeadId)
                  .find((id): id is string => typeof id === 'string') ?? null;
              const lead = leadId ? leads.get(leadId) : undefined;

              return {
                id: row.id ?? '',
                title: row.title?.trim() || null,
                body: row.bodyV2?.markdown?.trim() || null,
                createdAt: row.createdAt ?? null,
                updatedAt: row.updatedAt ?? null,
                authorName: row.createdBy?.name?.trim() || null,
                leadId,
                leadName: lead?.name ?? null,
                leadRef: lead?.lvLeadId ?? null,
              };
            }),
          );
        }
      } catch (cause) {
        if (live.current) {
          setError(cause instanceof Error ? cause.message : 'Notes could not be loaded.');
        }
      } finally {
        if (live.current) {
          setLoading(false);
        }
      }
    };

    void read();

    return () => {
      live.current = false;
    };
  }, [attempt]);

  return { notes, loading, error, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

export const createNote = (leadId: string, body: string, title?: string) =>
  callRoute<{ ok: true; noteId?: string }>('/notes/create', { leadId, body, ...(title ? { title } : {}) });
