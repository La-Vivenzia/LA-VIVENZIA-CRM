import { LEAD_STATUS_LABELS, type LeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';
import { INTERACTION_CHANNELS } from 'src/modules/lv-interactions/constants/interaction-vocabulary';
import { type CallerContext, type DashboardLens } from 'src/modules/lv-dashboard/services/caller-context';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { buildEcosystemSummary } from 'src/modules/lv-dashboard/services/ecosystem-summary';
import { OBJECTS, QueryBatch } from 'src/modules/lv-dashboard/services/query-batch';
import {
  CONVERSION_STATUSES,
  INACTIVE_STATUSES,
  PIPELINE_STATUSES,
  bucketForChannel,
  dayBounds,
  documentFilters,
  interactionFilters,
  leadFilters,
  onboardingFilters,
  onboardingHealthFor,
  slaFilters,
  taskFilters,
  type ChannelBucket,
  type Filter,
  type OnboardingHealth,
} from 'src/modules/lv-dashboard/metrics/definitions';

// The role dashboards. One function per lens, each building a single batched
// query (counts, group-bys, bounded lists) and shaping the result for the UI.
//
// "My" means the caller's own records: leads they own, tasks assigned to
// them, SLAs they are responsible for, onboardings they review. For a governed
// role CM-004 already narrows every query to that; the explicit owner filter
// makes the numbers mean the same thing for an admin looking at the Hunter
// lens. Org-wide numbers belong to the Control Tower.

const LIST = 10;
const RECENT = 8;

const and = (...parts: Filter[]): Filter => ({ and: parts.filter((part) => Object.keys(part).length > 0) });

export type LeadRow = {
  id: string;
  name: string | null;
  lvLeadId: string | null;
  status: string | null;
  priority: string | null;
  ownerId: string | null;
  nextAction?: string | null;
  nextFollowUpAt?: string | null;
  lastInteractionAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  location?: string | null;
  organisationName?: string | null;
};

const LEAD_SELECTION =
  'id name lvLeadId status priority ownerId nextAction nextFollowUpAt lastInteractionAt updatedAt createdAt location organisationName';

export type TaskRow = {
  id: string;
  title: string | null;
  dueAt: string | null;
  status: string | null;
  assigneeId: string | null;
  lvPriority: string | null;
  lvSourceInteraction?: { channel?: string | null } | null;
  taskTargets?: { edges?: { node?: { targetLvLeadId?: string | null } }[] } | null;
};

const TASK_SELECTION =
  'id title dueAt status assigneeId lvPriority lvSourceInteraction { channel } taskTargets { edges { node { targetLvLeadId } } }';

export type SlaRow = {
  id: string;
  name: string | null;
  rule: string | null;
  status: string | null;
  priority: string | null;
  ownerId: string | null;
  dueAt: string | null;
  breachedAt: string | null;
  escalatedAt: string | null;
  targetObject: string | null;
  targetRecordId: string | null;
  leadId: string | null;
  onboardingId: string | null;
};

const SLA_SELECTION =
  'id name rule status priority ownerId dueAt breachedAt escalatedAt targetObject targetRecordId leadId onboardingId';

export type OnboardingRow = {
  id: string;
  name: string | null;
  status: string | null;
  reviewerId: string | null;
  leadId: string | null;
  updatedAt: string | null;
  progressPercentage?: number | null;
};

const ONBOARDING_SELECTION = 'id name status reviewerId leadId updatedAt progressPercentage';

export type DocumentRow = {
  id: string;
  name: string | null;
  verificationState: string | null;
  onboardingId: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
};

const DOCUMENT_SELECTION = 'id name verificationState onboardingId updatedAt expiresAt';

export type Kpi = {
  key: string;
  label: string;
  value: number | null;
  // What a zero (or a null) means, in words.
  emptyText: string;
  unavailableReason?: string;
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
  // Where a click goes: an object list, or nothing.
  link?: { object: string } | null;
};

export type ListSection<T> = { key: string; title: string; emptyText: string; totalCount: number; rows: T[] };

export type ActivityItem = {
  kind: 'INTERACTION' | 'NOTE' | 'ASSIGNMENT' | 'STATUS' | 'FOLLOW_UP' | 'ONBOARDING' | 'DOCUMENT' | 'SLA';
  at: string;
  title: string;
  detail: string | null;
  target: { object: string; recordId: string } | null;
};

export type DashboardSummary = {
  lens: DashboardLens;
  availableLenses: DashboardLens[];
  generatedAt: string;
  workspaceMemberId: string | null;
  kpis: Kpi[];
  pipeline: { key: string; label: string; count: number }[];
  inactive: { key: string; label: string; count: number }[];
  conversion: { key: string; label: string; count: number }[];
  actions: ListSection<Record<string, unknown>>[];
  quality: Kpi[];
  channels: { channel: string; count: number }[];
  health: { state: OnboardingHealth; count: number }[];
  activity: ActivityItem[];
  // Definitions shown in the UI's "what does this mean" affordance.
  notes: string[];
  partial: string[];
  // Day 9 — ecosystem counts for the lenses that oversee the pipeline
  // (ADMIN, OVERSIGHT, ONBOARDING); empty for personal lenses.
  ecosystem: Kpi[];
};

const statusRows = (
  counts: Record<string, number>,
  statuses: readonly LeadStatus[],
): { key: string; label: string; count: number }[] =>
  statuses.map((status) => ({ key: status, label: LEAD_STATUS_LABELS[status], count: counts[status] ?? 0 }));

const leadIdsOf = (tasks: TaskRow[]): string[] => [
  ...new Set(
    tasks
      .flatMap((task) => (task.taskTargets?.edges ?? []).map((edge) => edge.node?.targetLvLeadId))
      .filter((id): id is string => typeof id === 'string'),
  ),
];

const leadNameLookup = async (
  client: DelegatedGraphqlClient,
  ids: string[],
): Promise<Map<string, { name: string | null; lvLeadId: string | null }>> => {
  const map = new Map<string, { name: string | null; lvLeadId: string | null }>();

  if (ids.length === 0) {
    return map;
  }

  const batch = new QueryBatch();
  const read = batch.list<LeadRow>(OBJECTS.lead, {
    filter: { id: { in: ids.slice(0, 100) } },
    first: 100,
    selection: 'id name lvLeadId',
  });
  const { data } = await batch.run(client);

  for (const row of read(data).rows) {
    map.set(row.id, { name: row.name, lvLeadId: row.lvLeadId });
  }

  return map;
};

const decorateTasks = (
  tasks: TaskRow[],
  leads: Map<string, { name: string | null; lvLeadId: string | null }>,
) =>
  tasks.map((task) => {
    const leadId = leadIdsOf([task])[0] ?? null;

    return {
      id: task.id,
      title: task.title,
      dueAt: task.dueAt,
      status: task.status,
      assigneeId: task.assigneeId,
      priority: task.lvPriority,
      channel: task.lvSourceInteraction?.channel ?? null,
      leadId,
      leadName: leadId ? (leads.get(leadId)?.name ?? null) : null,
      lvLeadId: leadId ? (leads.get(leadId)?.lvLeadId ?? null) : null,
      target: { object: 'task', recordId: task.id },
    };
  });

const slaTarget = (sla: SlaRow): { object: string; recordId: string } | null =>
  sla.leadId
    ? { object: 'lvLead', recordId: sla.leadId }
    : sla.onboardingId
      ? { object: 'lvOnboarding', recordId: sla.onboardingId }
      : sla.targetObject && sla.targetRecordId
        ? { object: sla.targetObject, recordId: sla.targetRecordId }
        : null;

const decorateSlas = (slas: SlaRow[]) =>
  slas.map((sla) => ({ ...sla, target: slaTarget(sla), slaTarget: { object: 'lvSla', recordId: sla.id } }));

const decorateLeads = (leads: LeadRow[]) =>
  leads.map((lead) => ({ ...lead, target: { object: 'lvLead', recordId: lead.id } }));

// ---------------------------------------------------------------------------

export const buildDashboardSummary = async ({
  client,
  caller,
  lens,
  now,
  timeZoneOffsetMinutes,
}: {
  client: DelegatedGraphqlClient;
  caller: CallerContext;
  lens: DashboardLens;
  now: string;
  timeZoneOffsetMinutes: number;
}): Promise<DashboardSummary> => {
  const me = caller.workspaceMemberId;
  const today = dayBounds(now, timeZoneOffsetMinutes);
  // Personal lenses scope to the caller; ADMIN / OVERSIGHT show whatever
  // CM-004 lets the caller see (everything, for those roles).
  const personal = lens === 'HUNTER' || lens === 'COORDINATOR' || lens === 'ONBOARDING';
  const myLead: Filter = personal && me ? leadFilters.mine(me) : {};
  const myTask: Filter = personal && me ? taskFilters.mine(me) : {};
  const mySla: Filter = personal && me ? slaFilters.mine(me) : {};
  const myOnboarding: Filter = personal && me ? onboardingFilters.mine(me) : {};
  const partial: string[] = [];
  const notes: string[] = [];

  const batch = new QueryBatch();

  // ---- counts shared by every lens
  const pipeline = batch.groupBy(OBJECTS.lead, 'status', myLead);
  const scored = batch.count(OBJECTS.lead, and(myLead, leadFilters.scored()));
  const highOpportunity = batch.count(OBJECTS.lead, and(myLead, leadFilters.highOpportunity()));
  const priorityGroups = batch.groupBy(OBJECTS.lead, 'priority', and(myLead, leadFilters.open()));
  const noContact = batch.count(OBJECTS.lead, and(myLead, leadFilters.noContactChannel()));
  const markedDuplicate = batch.count(OBJECTS.lead, and(myLead, leadFilters.markedDuplicate()));
  const flaggedDuplicate = batch.count(OBJECTS.lead, and(myLead, leadFilters.flaggedDuplicateKeys()));

  // ---- lens-specific
  const readers: Record<string, unknown> = {};

  if (lens === 'HUNTER' || lens === 'ADMIN' || lens === 'OVERSIGHT') {
    readers.newToday = batch.count(OBJECTS.lead, and(myLead, leadFilters.createdBetween(today.start, today.end)));
    readers.firstContact = batch.count(OBJECTS.sla, and(mySla, slaFilters.open(), slaFilters.rule('NEW_LEAD_CONTACT')));
    readers.overdueTasks = batch.count(OBJECTS.task, and(myTask, taskFilters.overdue(now)));
    readers.slaBreaches = batch.count(OBJECTS.sla, and(mySla, slaFilters.breached()));
    readers.highPriority = batch.count(OBJECTS.lead, and(myLead, leadFilters.highPriority()));
    readers.firstContactList = batch.list<SlaRow>(OBJECTS.sla, {
      filter: and(mySla, slaFilters.open(), slaFilters.rule('NEW_LEAD_CONTACT')),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: LIST,
      selection: SLA_SELECTION,
    });
    readers.overdueTaskList = batch.list<TaskRow>(OBJECTS.task, {
      filter: and(myTask, taskFilters.overdue(now)),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: LIST,
      selection: TASK_SELECTION,
    });
    readers.slaDueList = batch.list<SlaRow>(OBJECTS.sla, {
      filter: and(mySla, slaFilters.due()),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: LIST,
      selection: SLA_SELECTION,
    });
    readers.slaBreachedList = batch.list<SlaRow>(OBJECTS.sla, {
      filter: and(mySla, slaFilters.breached()),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: LIST,
      selection: SLA_SELECTION,
    });
    readers.noNextAction = batch.list<LeadRow>(OBJECTS.lead, {
      filter: and(myLead, leadFilters.noNextAction()),
      orderBy: [{ updatedAt: 'AscNullsLast' }],
      first: LIST,
      selection: LEAD_SELECTION,
    });
    readers.noNextFollowUp = batch.list<LeadRow>(OBJECTS.lead, {
      filter: and(myLead, leadFilters.noNextFollowUp()),
      orderBy: [{ updatedAt: 'AscNullsLast' }],
      first: LIST,
      selection: LEAD_SELECTION,
    });
    readers.highNoRecent = batch.list<LeadRow>(OBJECTS.lead, {
      filter: and(myLead, leadFilters.highPriorityNoRecentInteraction(now)),
      orderBy: [{ lastInteractionAt: 'AscNullsFirst' }],
      first: LIST,
      selection: LEAD_SELECTION,
    });
  }

  if (lens === 'COORDINATOR') {
    readers.dueToday = batch.list<TaskRow>(OBJECTS.task, {
      filter: and(myTask, taskFilters.dueBetween(today.start, today.end)),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: 50,
      selection: TASK_SELECTION,
    });
    readers.overdueTaskList = batch.list<TaskRow>(OBJECTS.task, {
      filter: and(myTask, taskFilters.overdue(now)),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: LIST,
      selection: TASK_SELECTION,
    });
    readers.dueSoonList = batch.list<TaskRow>(OBJECTS.task, {
      filter: and(myTask, taskFilters.dueSoon(now, today.end)),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: LIST,
      selection: TASK_SELECTION,
    });
    readers.awaiting = batch.list<{ id: string; leadId: string | null; occurredAt: string | null; channel: string | null }>(
      OBJECTS.interaction,
      {
        filter: interactionFilters.awaitingResponse(now),
        orderBy: [{ occurredAt: 'DescNullsLast' }],
        first: 50,
        selection: 'id leadId occurredAt channel',
      },
    );
    readers.likely = batch.list<LeadRow>(OBJECTS.lead, {
      filter: and(myLead, leadFilters.likelyToConvert()),
      orderBy: [{ updatedAt: 'DescNullsLast' }],
      first: LIST,
      selection: LEAD_SELECTION,
    });
    readers.stuck = batch.list<LeadRow>(OBJECTS.lead, {
      filter: and(myLead, leadFilters.stuck(now)),
      orderBy: [{ lastInteractionAt: 'AscNullsFirst' }],
      first: LIST,
      selection: LEAD_SELECTION,
    });
    readers.noNextAction = batch.list<LeadRow>(OBJECTS.lead, {
      filter: and(myLead, leadFilters.noNextAction()),
      orderBy: [{ updatedAt: 'AscNullsLast' }],
      first: LIST,
      selection: LEAD_SELECTION,
    });
    readers.noNextFollowUp = batch.list<LeadRow>(OBJECTS.lead, {
      filter: and(myLead, leadFilters.noNextFollowUp()),
      orderBy: [{ updatedAt: 'AscNullsLast' }],
      first: LIST,
      selection: LEAD_SELECTION,
    });
    readers.noResponse = batch.count(OBJECTS.lead, and(myLead, leadFilters.noResponse()));
    readers.unowned = batch.count(OBJECTS.lead, and(leadFilters.open(), leadFilters.unowned()));
    readers.channels = batch.groupBy(OBJECTS.interaction, 'channel', interactionFilters.inWindow(now));
  }

  if (lens === 'ONBOARDING') {
    readers.onboardingByStatus = batch.groupBy(OBJECTS.onboarding, 'status', myOnboarding);
    readers.stale = batch.count(OBJECTS.onboarding, and(myOnboarding, onboardingFilters.stale(now)));
    readers.firstActionDue = batch.list<SlaRow>(OBJECTS.sla, {
      filter: and(mySla, slaFilters.due(), slaFilters.rule('ONBOARDING_FIRST_ACTION')),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: LIST,
      selection: SLA_SELECTION,
    });
    readers.onboardingBreached = batch.list<SlaRow>(OBJECTS.sla, {
      filter: and(mySla, slaFilters.breached(), { rule: { in: ['ONBOARDING_FIRST_ACTION', 'MISSING_DOCUMENT'] } }),
      orderBy: [{ dueAt: 'AscNullsLast' }],
      first: LIST,
      selection: SLA_SELECTION,
    });
    readers.missingDocs = batch.count(OBJECTS.sla, and(slaFilters.open(), slaFilters.rule('MISSING_DOCUMENT')));
    readers.docsByState = batch.groupBy(OBJECTS.document, 'verificationState', {});
    readers.rejectedDocs = batch.list<DocumentRow>(OBJECTS.document, {
      filter: documentFilters.rejected(),
      orderBy: [{ updatedAt: 'DescNullsLast' }],
      first: LIST,
      selection: DOCUMENT_SELECTION,
    });
    readers.replacementDocs = batch.list<DocumentRow>(OBJECTS.document, {
      filter: documentFilters.needsReplacement(),
      orderBy: [{ updatedAt: 'DescNullsLast' }],
      first: LIST,
      selection: DOCUMENT_SELECTION,
    });
    readers.expiringDocs = batch.list<DocumentRow>(OBJECTS.document, {
      filter: documentFilters.nearingExpiry(now),
      orderBy: [{ expiresAt: 'AscNullsLast' }],
      first: LIST,
      selection: DOCUMENT_SELECTION,
    });
    readers.approvals = batch.list<OnboardingRow>(OBJECTS.onboarding, {
      filter: and(myOnboarding, onboardingFilters.awaitingApproval()),
      orderBy: [{ updatedAt: 'AscNullsLast' }],
      first: LIST,
      selection: ONBOARDING_SELECTION,
    });
    readers.openOnboardings = batch.list<OnboardingRow>(OBJECTS.onboarding, {
      filter: and(myOnboarding, onboardingFilters.open()),
      orderBy: [{ updatedAt: 'AscNullsLast' }],
      first: 25,
      selection: ONBOARDING_SELECTION,
    });
    readers.openSlasForOnboardings = batch.list<SlaRow>(OBJECTS.sla, {
      filter: and(mySla, slaFilters.open(), { onboardingId: { is: 'NOT_NULL' } }),
      first: 100,
      selection: SLA_SELECTION,
    });
    readers.blockingDocs = batch.list<DocumentRow>(OBJECTS.document, {
      filter: documentFilters.state(['REJECTED', 'NEEDS_REPLACEMENT', 'EXPIRED']),
      first: 100,
      selection: 'id onboardingId verificationState name updatedAt expiresAt',
    });
  }

  // ---- recent activity (every lens; bounded)
  readers.recentInteractions = batch.list<{
    id: string;
    name: string | null;
    channel: string | null;
    outcome: string | null;
    occurredAt: string | null;
    leadId: string | null;
  }>(OBJECTS.interaction, {
    filter: interactionFilters.recent(now),
    orderBy: [{ occurredAt: 'DescNullsLast' }],
    first: RECENT,
    selection: 'id name channel outcome occurredAt leadId',
  });
  readers.recentNotes = batch.list<{ id: string; title: string | null; updatedAt: string | null }>(OBJECTS.note, {
    filter: { updatedAt: { gte: new Date(Date.parse(now) - 14 * 86_400_000).toISOString() } },
    orderBy: [{ updatedAt: 'DescNullsLast' }],
    first: RECENT,
    selection: 'id title updatedAt',
  });
  readers.recentAssignments = batch.list<{
    id: string;
    name: string | null;
    strategy: string | null;
    assignedAt: string | null;
    leadId: string | null;
  }>(OBJECTS.assignmentHistory, {
    filter: {},
    orderBy: [{ assignedAt: 'DescNullsLast' }],
    first: RECENT,
    selection: 'id name strategy assignedAt leadId',
  });
  readers.recentTasks = batch.list<TaskRow>(OBJECTS.task, {
    filter: and(myTask, taskFilters.recent(now)),
    orderBy: [{ updatedAt: 'DescNullsLast' }],
    first: RECENT,
    selection: TASK_SELECTION,
  });
  readers.recentLeadUpdates = batch.list<LeadRow>(OBJECTS.lead, {
    filter: and(myLead, leadFilters.recentlyUpdated(now)),
    orderBy: [{ updatedAt: 'DescNullsLast' }],
    first: RECENT,
    selection: LEAD_SELECTION,
  });
  readers.recentOnboardings = batch.list<OnboardingRow>(OBJECTS.onboarding, {
    filter: and(myOnboarding, onboardingFilters.recent(now)),
    orderBy: [{ updatedAt: 'DescNullsLast' }],
    first: RECENT,
    selection: ONBOARDING_SELECTION,
  });
  readers.recentSlas = batch.list<SlaRow>(OBJECTS.sla, {
    filter: and(mySla, slaFilters.recent(now)),
    orderBy: [{ updatedAt: 'DescNullsLast' }],
    first: RECENT,
    selection: SLA_SELECTION,
  });
  if (lens === 'ONBOARDING') {
    readers.recentDocs = batch.list<DocumentRow>(OBJECTS.document, {
      filter: documentFilters.recent(now),
      orderBy: [{ updatedAt: 'DescNullsLast' }],
      first: RECENT,
      selection: DOCUMENT_SELECTION,
    });
  }

  const { data, errors } = await batch.run(client);

  if (errors.length > 0) {
    partial.push(...errors.map(() => 'Some sections could not be loaded.'));
  }

  // Helpers to read typed results.
  const read = <T>(key: string): T => (readers[key] as (data: Record<string, unknown>) => T)(data);
  const listOf = <T>(key: string): { rows: T[]; totalCount: number } =>
    key in readers ? read<{ rows: T[]; totalCount: number }>(key) : { rows: [], totalCount: 0 };
  const countOf = (key: string): number => (key in readers ? read<number>(key) : 0);

  const pipelineCounts = pipeline(data);
  const priorityCounts = priorityGroups(data);
  const kpis: Kpi[] = [];
  const actions: ListSection<Record<string, unknown>>[] = [];
  const quality: Kpi[] = [];
  let channels: { channel: string; count: number }[] = [];
  let health: { state: OnboardingHealth; count: number }[] = [];

  // Lead names for task rows (one bounded lookup).
  const taskRows = [
    ...listOf<TaskRow>('overdueTaskList').rows,
    ...listOf<TaskRow>('dueToday').rows,
    ...listOf<TaskRow>('dueSoonList').rows,
    ...listOf<TaskRow>('recentTasks').rows,
  ];
  const awaitingLeadIds = listOf<{ leadId: string | null }>('awaiting')
    .rows.map((row) => row.leadId)
    .filter((id): id is string => typeof id === 'string');
  const leadNames = await leadNameLookup(client, [
    ...leadIdsOf(taskRows),
    ...awaitingLeadIds,
    ...listOf<{ leadId: string | null }>('recentInteractions').rows.map((row) => row.leadId).filter((id): id is string => typeof id === 'string'),
  ]);

  if (lens === 'HUNTER' || lens === 'ADMIN' || lens === 'OVERSIGHT') {
    const scope = personal ? 'My' : 'All';

    kpis.push(
      { key: 'newToday', label: `${scope} new leads today`, value: countOf('newToday'), emptyText: 'No new leads created today', tone: 'info', link: { object: 'lvLead' } },
      { key: 'firstContact', label: 'Leads awaiting first contact', value: countOf('firstContact'), emptyText: 'Every lead has been contacted', tone: 'warning', link: { object: 'lvSla' } },
      { key: 'overdueTasks', label: `${scope === 'My' ? 'My ' : ''}overdue follow-ups`, value: countOf('overdueTasks'), emptyText: 'No overdue follow-ups', tone: 'danger', link: { object: 'task' } },
      { key: 'slaBreaches', label: `${scope === 'My' ? 'My ' : ''}SLA breaches`, value: countOf('slaBreaches'), emptyText: 'No SLA breaches', tone: 'danger', link: { object: 'lvSla' } },
      { key: 'highPriority', label: 'High-priority leads', value: countOf('highPriority'), emptyText: 'No high-priority leads open', tone: 'warning', link: { object: 'lvLead' } },
      // Day 6: Opportunity Score v1 (rules, opportunity-score-v1) is mirrored
      // onto lvLead.opportunityScore; "high" is ≥ 70. Unavailable only while
      // no lead has been scored yet.
      scored(data) > 0
        ? { key: 'highOpportunity', label: 'High-opportunity leads (score ≥ 70)', value: highOpportunity(data), emptyText: 'No open lead scores 70 or more', tone: 'success', link: { object: 'lvLead' } }
        : {
            key: 'highOpportunity',
            label: 'High-opportunity leads',
            value: null,
            emptyText: 'No lead has been scored yet',
            unavailableReason: 'Opportunity Score v1 is computed when a lead’s Intelligence tab is opened, when an interaction is logged, or by the hourly refresh; none has run yet.',
            tone: 'neutral',
          },
    );

    const firstContact = listOf<SlaRow>('firstContactList');
    const overdue = listOf<TaskRow>('overdueTaskList');
    const due = listOf<SlaRow>('slaDueList');
    const breached = listOf<SlaRow>('slaBreachedList');
    const noNextAction = listOf<LeadRow>('noNextAction');
    const noNextFollowUp = listOf<LeadRow>('noNextFollowUp');
    const highNoRecent = listOf<LeadRow>('highNoRecent');

    actions.push(
      { key: 'firstContact', title: 'Leads without first contact', emptyText: 'Every lead has had a first contact.', totalCount: firstContact.totalCount, rows: decorateSlas(firstContact.rows) },
      { key: 'overdueFollowUps', title: 'Overdue follow-ups', emptyText: 'No follow-up is overdue.', totalCount: overdue.totalCount, rows: decorateTasks(overdue.rows, leadNames) },
      { key: 'slaDue', title: 'SLA due', emptyText: 'Nothing is due in the next window.', totalCount: due.totalCount, rows: decorateSlas(due.rows) },
      { key: 'slaBreached', title: 'SLA breached', emptyText: 'No breached SLA.', totalCount: breached.totalCount, rows: decorateSlas(breached.rows) },
      { key: 'noNextAction', title: 'Leads without a next action', emptyText: 'Every open lead has a next action.', totalCount: noNextAction.totalCount, rows: decorateLeads(noNextAction.rows) },
      { key: 'noNextFollowUp', title: 'Leads without a next follow-up', emptyText: 'Every open lead has a follow-up scheduled.', totalCount: noNextFollowUp.totalCount, rows: decorateLeads(noNextFollowUp.rows) },
      { key: 'highNoRecent', title: 'High-priority leads without recent interaction', emptyText: 'Every high-priority lead was touched in the last 7 days.', totalCount: highNoRecent.totalCount, rows: decorateLeads(highNoRecent.rows) },
    );
    notes.push('"Recent interaction" means an interaction in the last 7 days; "stuck" means an actionable lead with no contact for 14 days.');
  }

  if (lens === 'COORDINATOR') {
    const dueToday = listOf<TaskRow>('dueToday');
    const buckets: Record<ChannelBucket, TaskRow[]> = { calls: [], emails: [], whatsapp: [], meetings: [], other: [] };

    for (const task of dueToday.rows) {
      buckets[bucketForChannel(task.lvSourceInteraction?.channel)].push(task);
    }

    const overdue = listOf<TaskRow>('overdueTaskList');
    const dueSoon = listOf<TaskRow>('dueSoonList');
    const awaiting = listOf<{ id: string; leadId: string | null; occurredAt: string | null; channel: string | null }>('awaiting');
    const awaitingLeads = [...new Map(awaiting.rows.filter((row) => row.leadId).map((row) => [row.leadId as string, row])).values()];
    const likely = listOf<LeadRow>('likely');
    const stuck = listOf<LeadRow>('stuck');
    const noNextAction = listOf<LeadRow>('noNextAction');
    const noNextFollowUp = listOf<LeadRow>('noNextFollowUp');

    kpis.push(
      { key: 'calls', label: 'Calls due today', value: buckets.calls.length, emptyText: 'No calls due today', tone: 'info', link: { object: 'task' } },
      { key: 'emails', label: 'Emails due today', value: buckets.emails.length, emptyText: 'No emails due today', tone: 'info', link: { object: 'task' } },
      { key: 'whatsapp', label: 'WhatsApp follow-ups due', value: buckets.whatsapp.length, emptyText: 'No WhatsApp follow-ups due today', tone: 'info', link: { object: 'task' } },
      { key: 'meetings', label: 'Meetings due today', value: buckets.meetings.length, emptyText: 'No meetings due today', tone: 'info', link: { object: 'task' } },
      { key: 'overdue', label: 'Overdue follow-ups', value: overdue.totalCount, emptyText: 'No overdue follow-ups', tone: 'danger', link: { object: 'task' } },
      { key: 'awaiting', label: 'Waiting for response', value: awaitingLeads.length, emptyText: 'Nobody is waiting on a reply', tone: 'warning' },
      { key: 'likely', label: 'Likely to convert', value: likely.totalCount, emptyText: 'No interested/negotiating lead is marked high priority', tone: 'success', link: { object: 'lvLead' } },
      { key: 'stuck', label: 'Stuck leads', value: stuck.totalCount, emptyText: 'No lead has been silent for 14 days', tone: 'danger', link: { object: 'lvLead' } },
    );

    actions.push(
      { key: 'dueToday', title: 'Due today', emptyText: 'Nothing is due today.', totalCount: dueToday.totalCount, rows: decorateTasks(dueToday.rows.slice(0, LIST), leadNames) },
      { key: 'overdue', title: 'Overdue', emptyText: 'No follow-up is overdue.', totalCount: overdue.totalCount, rows: decorateTasks(overdue.rows, leadNames) },
      { key: 'dueSoon', title: 'Due soon (next 3 days)', emptyText: 'Nothing is due in the next 3 days.', totalCount: dueSoon.totalCount, rows: decorateTasks(dueSoon.rows, leadNames) },
      {
        key: 'awaiting',
        title: 'Waiting for response',
        emptyText: 'No interaction in the last 14 days is awaiting a reply.',
        totalCount: awaitingLeads.length,
        rows: awaitingLeads.slice(0, LIST).map((row) => ({
          id: row.id,
          leadId: row.leadId,
          leadName: row.leadId ? (leadNames.get(row.leadId)?.name ?? null) : null,
          lvLeadId: row.leadId ? (leadNames.get(row.leadId)?.lvLeadId ?? null) : null,
          channel: row.channel,
          since: row.occurredAt,
          target: row.leadId ? { object: 'lvLead', recordId: row.leadId } : null,
        })),
      },
      { key: 'noNextAction', title: 'No next action', emptyText: 'Every open lead has a next action.', totalCount: noNextAction.totalCount, rows: decorateLeads(noNextAction.rows) },
      { key: 'noNextFollowUp', title: 'No next follow-up', emptyText: 'Every open lead has a follow-up scheduled.', totalCount: noNextFollowUp.totalCount, rows: decorateLeads(noNextFollowUp.rows) },
      { key: 'likely', title: 'Likely to convert', emptyText: 'No interested or negotiating lead is marked high priority.', totalCount: likely.totalCount, rows: decorateLeads(likely.rows) },
      { key: 'stuck', title: 'Stuck leads', emptyText: 'No actionable lead has gone 14 days without contact.', totalCount: stuck.totalCount, rows: decorateLeads(stuck.rows) },
    );

    const channelCounts = read<Record<string, number>>('channels');

    channels = INTERACTION_CHANNELS.map((channel) => ({ channel, count: channelCounts[channel] ?? 0 }));
    quality.push(
      { key: 'noResponse', label: 'No response', value: countOf('noResponse'), emptyText: 'No lead is in "No response"', tone: 'warning', link: { object: 'lvLead' } },
      { key: 'unowned', label: 'Unowned leads', value: countOf('unowned'), emptyText: 'Every open lead has an owner', tone: 'danger', link: { object: 'lvLead' } },
    );
    notes.push(
      'Channel buckets come from the interaction a follow-up task was created from; tasks without a source interaction count as "other".',
      '"Likely to convert" = INTERESTED or NEGOTIATION and priority HIGH/CRITICAL (no opportunity score exists yet).',
      'Communication activity counts interactions in the last 30 days.',
    );
  }

  if (lens === 'ONBOARDING') {
    const byStatus = read<Record<string, number>>('onboardingByStatus');
    const firstActionDue = listOf<SlaRow>('firstActionDue');
    const breached = listOf<SlaRow>('onboardingBreached');
    const rejected = listOf<DocumentRow>('rejectedDocs');
    const replacement = listOf<DocumentRow>('replacementDocs');
    const expiring = listOf<DocumentRow>('expiringDocs');
    const approvals = listOf<OnboardingRow>('approvals');
    const open = listOf<OnboardingRow>('openOnboardings');
    const openSlas = listOf<SlaRow>('openSlasForOnboardings').rows;
    const blockingDocs = listOf<DocumentRow>('blockingDocs').rows;
    const docsByState = read<Record<string, number>>('docsByState');

    kpis.push(
      { key: 'inProgress', label: 'In progress', value: (byStatus.IN_PROGRESS ?? 0) + (byStatus.INITIATED ?? 0), emptyText: 'No onboarding in progress', tone: 'info', link: { object: 'lvOnboarding' } },
      { key: 'waitingDocs', label: 'Waiting for documents', value: (byStatus.WAITING_FOR_PARTNER ?? 0) + (byStatus.CHANGES_REQUESTED ?? 0), emptyText: 'Nobody is waiting on documents', tone: 'warning', link: { object: 'lvOnboarding' } },
      { key: 'review', label: 'Ready for review', value: byStatus.INTERNAL_REVIEW ?? 0, emptyText: 'Nothing awaits your decision', tone: 'warning', link: { object: 'lvOnboarding' } },
      { key: 'firstActionDue', label: 'First-action SLA due', value: firstActionDue.totalCount, emptyText: 'No first-action SLA is due', tone: 'warning', link: { object: 'lvSla' } },
      { key: 'breached', label: 'Onboarding SLA breached', value: breached.totalCount, emptyText: 'No onboarding SLA breached', tone: 'danger', link: { object: 'lvSla' } },
      { key: 'stale', label: 'Stuck (no update 7 days)', value: countOf('stale'), emptyText: 'Every open onboarding moved in the last 7 days', tone: 'danger', link: { object: 'lvOnboarding' } },
    );

    // Health derived from facts only.
    const slasByOnboarding = new Map<string, SlaRow[]>();

    for (const sla of openSlas) {
      if (sla.onboardingId) {
        slasByOnboarding.set(sla.onboardingId, [...(slasByOnboarding.get(sla.onboardingId) ?? []), sla]);
      }
    }

    const blockedOnboardingIds = new Set(blockingDocs.map((doc) => doc.onboardingId).filter(Boolean));
    const healthCounts: Record<OnboardingHealth, number> = { HEALTHY: 0, NEEDS_ATTENTION: 0, BLOCKED: 0 };
    const withoutOpenTask: OnboardingRow[] = [];

    for (const onboarding of open.rows) {
      const slas = slasByOnboarding.get(onboarding.id) ?? [];
      const state = onboardingHealthFor({
        hasBlockingDocument: blockedOnboardingIds.has(onboarding.id),
        hasBreachedSla: slas.some((sla) => sla.status === 'BREACHED' || sla.status === 'ESCALATED'),
        hasDueSla: slas.some((sla) => sla.status === 'DUE_SOON' || sla.status === 'DUE'),
        updatedAt: onboarding.updatedAt ?? now,
        now,
      });

      healthCounts[state] += 1;
      withoutOpenTask.push(onboarding);
    }

    health = (Object.keys(healthCounts) as OnboardingHealth[]).map((state) => ({ state, count: healthCounts[state] }));

    actions.push(
      { key: 'firstActionDue', title: 'First-action SLA due', emptyText: 'No onboarding first action is due.', totalCount: firstActionDue.totalCount, rows: decorateSlas(firstActionDue.rows) },
      { key: 'breached', title: 'Onboarding SLA breached', emptyText: 'No onboarding or document SLA is breached.', totalCount: breached.totalCount, rows: decorateSlas(breached.rows) },
      { key: 'missingDocs', title: 'Missing documents (open SLAs)', emptyText: 'No document is outstanding.', totalCount: countOf('missingDocs'), rows: [] },
      { key: 'rejectedDocs', title: 'Rejected documents', emptyText: 'No rejected document.', totalCount: rejected.totalCount, rows: rejected.rows.map((doc) => ({ ...doc, target: { object: 'lvOnboardingDocument', recordId: doc.id } })) },
      { key: 'replacementDocs', title: 'Documents requiring replacement', emptyText: 'No document needs replacing.', totalCount: replacement.totalCount, rows: replacement.rows.map((doc) => ({ ...doc, target: { object: 'lvOnboardingDocument', recordId: doc.id } })) },
      { key: 'expiringDocs', title: 'Documents nearing expiry (30 days)', emptyText: 'No verified document expires in the next 30 days.', totalCount: expiring.totalCount, rows: expiring.rows.map((doc) => ({ ...doc, target: { object: 'lvOnboardingDocument', recordId: doc.id } })) },
      { key: 'approvals', title: 'Approvals waiting for review', emptyText: 'Nothing is waiting for your decision.', totalCount: approvals.totalCount, rows: approvals.rows.map((row) => ({ ...row, target: { object: 'lvOnboarding', recordId: row.id } })) },
    );

    quality.push(
      { key: 'docPending', label: 'Pending verification', value: (docsByState.PENDING ?? 0) + (docsByState.UNDER_REVIEW ?? 0), emptyText: 'No document awaits verification', tone: 'info', link: { object: 'lvOnboardingDocument' } },
      { key: 'docVerified', label: 'Approved', value: docsByState.VERIFIED ?? 0, emptyText: 'No verified document yet', tone: 'success', link: { object: 'lvOnboardingDocument' } },
      { key: 'docRejected', label: 'Rejected', value: docsByState.REJECTED ?? 0, emptyText: 'No rejected document', tone: 'danger', link: { object: 'lvOnboardingDocument' } },
      { key: 'docReplacement', label: 'Needs replacement', value: docsByState.NEEDS_REPLACEMENT ?? 0, emptyText: 'No document needs replacing', tone: 'warning', link: { object: 'lvOnboardingDocument' } },
      { key: 'docExpired', label: 'Expired', value: docsByState.EXPIRED ?? 0, emptyText: 'No expired document', tone: 'warning', link: { object: 'lvOnboardingDocument' } },
      { key: 'docMissing', label: 'Missing (open SLA)', value: countOf('missingDocs'), emptyText: 'No document is outstanding', tone: 'warning', link: { object: 'lvSla' } },
    );
    notes.push(
      'Onboarding health: BLOCKED = a rejected/replacement/expired document or a breached SLA; NEEDS ATTENTION = an SLA due or no update for 7 days; otherwise HEALTHY. The stored healthScore is not computed yet and is not used.',
      '"Onboarding records without next action" is not shown: the onboarding object has no next-action field.',
    );
  }

  if (lens === 'OVERSIGHT') {
    notes.push('Read-only oversight view: figures cover every record your role can read.');
  }

  // Lead quality (all lenses)
  const total = Object.values(pipelineCounts).reduce((sum, count) => sum + count, 0);

  quality.unshift(
    { key: 'priorityCritical', label: 'Critical priority (open)', value: priorityCounts.CRITICAL ?? 0, emptyText: 'No critical lead open', tone: 'danger', link: { object: 'lvLead' } },
    { key: 'priorityHigh', label: 'High priority (open)', value: priorityCounts.HIGH ?? 0, emptyText: 'No high-priority lead open', tone: 'warning', link: { object: 'lvLead' } },
    { key: 'incompleteContact', label: 'Open leads with no email and no phone', value: noContact(data), emptyText: 'Every open lead has a contact channel', tone: 'warning', link: { object: 'lvLead' } },
    { key: 'duplicates', label: 'Duplicate candidates', value: markedDuplicate(data) + flaggedDuplicate(data), emptyText: 'No lead is marked or flagged as a duplicate', tone: 'neutral', link: { object: 'lvLead' } },
    scored(data) > 0
      ? { key: 'opportunity', label: 'Leads scored (Opportunity v1)', value: scored(data), emptyText: 'No lead scored yet', tone: 'info', link: { object: 'lvLead' } }
      : {
          key: 'opportunity',
          label: 'Opportunity score',
          value: null,
          emptyText: `Unavailable — 0 of ${total} leads are scored`,
          unavailableReason: 'Opportunity Score v1 runs on the lead Intelligence tab, on new interactions and hourly; no lead has been scored yet.',
          tone: 'neutral',
        },
    {
      key: 'relationshipHealth',
      label: 'Relationship health',
      value: null,
      emptyText: 'Per-lead state — open a lead’s Intelligence tab',
      unavailableReason: 'Relationship health is a per-lead state (HEALTHY / ATTENTION / AT_RISK / DORMANT / UNKNOWN) computed by relationship-health-v1 on each lead; it is not aggregated into one number here.',
      tone: 'neutral',
    },
  );

  // Recent activity, merged and sorted.
  const activity: ActivityItem[] = [];

  for (const row of listOf<{ id: string; name: string | null; channel: string | null; outcome: string | null; occurredAt: string | null; leadId: string | null }>('recentInteractions').rows) {
    activity.push({ kind: 'INTERACTION', at: row.occurredAt ?? now, title: row.name || `${row.channel ?? 'Interaction'}`, detail: [row.leadId ? leadNames.get(row.leadId)?.name : null, row.outcome].filter(Boolean).join(' · ') || null, target: row.leadId ? { object: 'lvLead', recordId: row.leadId } : null });
  }

  for (const row of listOf<{ id: string; title: string | null; updatedAt: string | null }>('recentNotes').rows) {
    activity.push({ kind: 'NOTE', at: row.updatedAt ?? now, title: row.title || 'Note', detail: null, target: { object: 'note', recordId: row.id } });
  }

  for (const row of listOf<{ id: string; name: string | null; strategy: string | null; assignedAt: string | null; leadId: string | null }>('recentAssignments').rows) {
    activity.push({ kind: 'ASSIGNMENT', at: row.assignedAt ?? now, title: `Assignment: ${row.strategy ?? ''}`.trim(), detail: row.name, target: row.leadId ? { object: 'lvLead', recordId: row.leadId } : null });
  }

  for (const task of decorateTasks(listOf<TaskRow>('recentTasks').rows, leadNames)) {
    activity.push({ kind: 'FOLLOW_UP', at: task.dueAt ?? now, title: task.title ?? 'Follow-up', detail: [task.leadName, task.status].filter(Boolean).join(' · ') || null, target: task.target });
  }

  for (const lead of listOf<LeadRow>('recentLeadUpdates').rows) {
    activity.push({ kind: 'STATUS', at: lead.updatedAt ?? now, title: lead.name ?? 'Lead', detail: lead.status ? LEAD_STATUS_LABELS[lead.status as LeadStatus] ?? lead.status : null, target: { object: 'lvLead', recordId: lead.id } });
  }

  for (const row of listOf<OnboardingRow>('recentOnboardings').rows) {
    activity.push({ kind: 'ONBOARDING', at: row.updatedAt ?? now, title: row.name ?? 'Onboarding', detail: row.status, target: { object: 'lvOnboarding', recordId: row.id } });
  }

  for (const row of listOf<DocumentRow>('recentDocs').rows) {
    activity.push({ kind: 'DOCUMENT', at: row.updatedAt ?? now, title: row.name ?? 'Document', detail: row.verificationState, target: { object: 'lvOnboardingDocument', recordId: row.id } });
  }

  for (const sla of listOf<SlaRow>('recentSlas').rows) {
    activity.push({ kind: 'SLA', at: sla.dueAt ?? now, title: sla.name ?? 'SLA', detail: sla.status, target: slaTarget(sla) });
  }

  activity.sort((a, b) => b.at.localeCompare(a.at));

  let ecosystem: Kpi[] = [];

  if (lens === 'ADMIN' || lens === 'OVERSIGHT' || lens === 'ONBOARDING') {
    try {
      const summary = await buildEcosystemSummary(client, now);

      ecosystem = [
        ...summary.partners.filter((kpi) => ['partnersTotal', 'partnersPending', 'partnersActive', 'partnersAttention'].includes(kpi.key)),
        ...summary.experiences.filter((kpi) => ['experiencesTotal', 'experiencesVerification', 'experiencesActive'].includes(kpi.key)),
        ...summary.properties.filter((kpi) => ['propertiesTotal', 'propertiesVerification', 'propertiesActive'].includes(kpi.key)),
        ...summary.onboarding.filter((kpi) => ['onbAwaiting', 'onbBlocked', 'docsExpired'].includes(kpi.key)),
      ];
      partial.push(...summary.partial);
    } catch {
      partial.push('Ecosystem counts could not be loaded.');
    }
  }

  return {
    ecosystem,
    lens,
    availableLenses: caller.availableLenses,
    generatedAt: now,
    workspaceMemberId: me,
    kpis,
    pipeline: statusRows(pipelineCounts, PIPELINE_STATUSES),
    inactive: statusRows(pipelineCounts, INACTIVE_STATUSES),
    conversion: statusRows(pipelineCounts, CONVERSION_STATUSES),
    actions,
    quality,
    channels,
    health,
    activity: activity.slice(0, 20),
    notes,
    partial,
  };
};
