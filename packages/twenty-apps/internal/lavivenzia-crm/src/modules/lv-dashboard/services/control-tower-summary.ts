import { LEAD_STATUS_LABELS, type LeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';
import { SLA_RULE_LABELS, type SlaRule } from 'src/modules/lv-sla/constants/sla-rules';
import {
  hasAnyFilter,
  leadScope,
  onboardingScope,
  ownerScope,
  slaScope,
  type ControlTowerFilters,
} from 'src/modules/lv-dashboard/metrics/control-tower-filters';
import {
  daysAgo,
  documentFilters,
  leadFilters,
  notificationFilters,
  onboardingFilters,
  slaFilters,
  taskFilters,
  THRESHOLDS,
  type Filter,
} from 'src/modules/lv-dashboard/metrics/definitions';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { OBJECTS, QueryBatch } from 'src/modules/lv-dashboard/services/query-batch';
import {
  type Kpi,
  type LeadRow,
  type ListSection,
  type OnboardingRow,
  type SlaRow,
  type TaskRow,
} from 'src/modules/lv-dashboard/services/dashboard-summary';
import { buildEcosystemSummary, type EcosystemSummary } from 'src/modules/lv-dashboard/services/ecosystem-summary';

// The Admin Control Tower: one operational view of the whole pipeline.
//
// Every number is a database aggregation over the real objects, ANDed with
// the validated filters. The route that calls this has already established
// that the caller is an administrator; the queries still run delegated, so a
// (hypothetical) admin with narrower object permissions would still see only
// what Twenty lets them see.

const LIST = 15;

const and = (...parts: Filter[]): Filter => {
  const clauses = parts.filter((part) => Object.keys(part).length > 0);

  return clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { and: clauses };
};

const LEAD_SELECTION =
  'id name lvLeadId status priority ownerId nextAction nextFollowUpAt lastInteractionAt updatedAt createdAt location organisationName category source emails { primaryEmail } phones { primaryPhoneNumber }';
const TASK_SELECTION = 'id title dueAt status assigneeId lvPriority taskTargets { edges { node { targetLvLeadId } } }';
const SLA_SELECTION =
  'id name rule status priority ownerId dueAt breachedAt escalatedAt escalationOwnerId escalationBlockedReason targetObject targetRecordId leadId onboardingId';
const ONBOARDING_SELECTION = 'id name status reviewerId leadId updatedAt';

export type ControlTowerSummary = {
  generatedAt: string;
  filters: ControlTowerFilters;
  filtered: boolean;
  kpis: Kpi[];
  sections: ListSection<Record<string, unknown>>[];
  breakdown: {
    slaByStatus: { key: string; label: string; count: number }[];
    slaByRule: { key: string; label: string; count: number }[];
    documentsByState: { key: string; count: number }[];
    onboardingByStatus: { key: string; count: number }[];
    leadsByStatus: { key: string; label: string; count: number }[];
  };
  contactBreakdown: Kpi[];
  notificationHealth: Kpi[];
  systemHealth: { key: string; label: string; value: string | number | null; detail: string }[];
  members: { id: string; name: string }[];
  notes: string[];
  partial: string[];
  // Day 9 — partners, experiences, properties and the onboarding pipeline.
  ecosystem: EcosystemSummary;
};

type MemberRow = { id: string; name?: { firstName?: string | null; lastName?: string | null } | null };

const memberName = (member: MemberRow | undefined): string =>
  [member?.name?.firstName, member?.name?.lastName].filter(Boolean).join(' ') || '—';

export const buildControlTowerSummary = async ({
  client,
  filters,
  now,
}: {
  client: DelegatedGraphqlClient;
  filters: ControlTowerFilters;
  now: string;
}): Promise<ControlTowerSummary> => {
  const scope = leadScope(filters);
  const sla = slaScope(filters);
  const onboarding = onboardingScope(filters);
  const task = ownerScope(filters, 'assigneeId');
  const batch = new QueryBatch();

  // 1. Unowned leads
  const unownedCount = batch.count(OBJECTS.lead, and(scope, leadFilters.open(), leadFilters.unowned()));
  const unownedList = batch.list<LeadRow>(OBJECTS.lead, {
    filter: and(scope, leadFilters.open(), leadFilters.unowned()),
    orderBy: [{ createdAt: 'AscNullsLast' }],
    first: LIST,
    selection: LEAD_SELECTION,
  });

  // 2. Overdue follow-ups
  const overdueList = batch.list<TaskRow>(OBJECTS.task, {
    filter: and(task, taskFilters.overdue(now)),
    orderBy: [{ dueAt: 'AscNullsLast' }],
    first: LIST,
    selection: TASK_SELECTION,
  });

  // 3. Hot leads without follow-up
  const hotList = batch.list<LeadRow>(OBJECTS.lead, {
    filter: and(scope, leadFilters.hotWithoutFollowUp()),
    orderBy: [{ updatedAt: 'AscNullsLast' }],
    first: LIST,
    selection: LEAD_SELECTION,
  });

  // 4. Stuck leads
  const stuckList = batch.list<LeadRow>(OBJECTS.lead, {
    filter: and(scope, leadFilters.stuck(now)),
    orderBy: [{ lastInteractionAt: 'AscNullsFirst' }],
    first: LIST,
    selection: LEAD_SELECTION,
  });

  // 5. Stuck onboardings
  const staleOnboardings = batch.list<OnboardingRow>(OBJECTS.onboarding, {
    filter: and(onboarding, onboardingFilters.stale(now)),
    orderBy: [{ updatedAt: 'AscNullsLast' }],
    first: LIST,
    selection: ONBOARDING_SELECTION,
  });
  const awaitingApproval = batch.list<OnboardingRow>(OBJECTS.onboarding, {
    filter: and(onboarding, onboardingFilters.awaitingApproval()),
    orderBy: [{ updatedAt: 'AscNullsLast' }],
    first: LIST,
    selection: ONBOARDING_SELECTION,
  });
  const waitingDocs = batch.count(OBJECTS.onboarding, and(onboarding, onboardingFilters.waitingForDocuments()));
  const onboardingBreachedSlas = batch.list<SlaRow>(OBJECTS.sla, {
    filter: and(sla, slaFilters.breached(), { onboardingId: { is: 'NOT_NULL' } }),
    orderBy: [{ dueAt: 'AscNullsLast' }],
    first: LIST,
    selection: SLA_SELECTION,
  });
  const onboardingByStatus = batch.groupBy(OBJECTS.onboarding, 'status', onboarding);

  // 6. SLA breaches
  const breachedList = batch.list<SlaRow>(OBJECTS.sla, {
    filter: and(sla, slaFilters.unresolvedBreach()),
    orderBy: [{ breachedAt: 'AscNullsLast' }],
    first: LIST,
    selection: SLA_SELECTION,
  });
  const slaByStatus = batch.groupBy(OBJECTS.sla, 'status', sla);
  const slaByRule = batch.groupBy(OBJECTS.sla, 'rule', and(sla, slaFilters.open()));
  const escalatedCount = batch.count(OBJECTS.sla, and(sla, slaFilters.escalated()));
  const blockedCount = batch.count(OBJECTS.sla, and(sla, slaFilters.blocked()));

  // 7. Incomplete contact data
  const noContactCount = batch.count(OBJECTS.lead, and(scope, leadFilters.noContactChannel()));
  const noEmailCount = batch.count(OBJECTS.lead, and(scope, leadFilters.open(), leadFilters.noEmail()));
  const noPhoneCount = batch.count(OBJECTS.lead, and(scope, leadFilters.open(), leadFilters.noPhone()));
  const noOrgCount = batch.count(OBJECTS.lead, and(scope, leadFilters.noOrganisation()));
  const noLocationCount = batch.count(OBJECTS.lead, and(scope, leadFilters.noLocation()));
  // (waitingDocs, noEmailCount, noPhoneCount feed the informational breakdown below)
  const noContactList = batch.list<LeadRow>(OBJECTS.lead, {
    filter: and(scope, leadFilters.noContactChannel()),
    orderBy: [{ createdAt: 'DescNullsLast' }],
    first: LIST,
    selection: LEAD_SELECTION,
  });

  // 8. Duplicate candidates
  const markedDuplicates = batch.list<LeadRow>(OBJECTS.lead, {
    filter: and(scope, leadFilters.markedDuplicate()),
    orderBy: [{ updatedAt: 'DescNullsLast' }],
    first: LIST,
    selection: LEAD_SELECTION,
  });
  const flaggedDuplicates = batch.list<LeadRow & { duplicateKeys?: string[] | null }>(OBJECTS.lead, {
    filter: and(scope, leadFilters.flaggedDuplicateKeys()),
    orderBy: [{ updatedAt: 'DescNullsLast' }],
    first: LIST,
    selection: `${LEAD_SELECTION} duplicateKeys`,
  });

  // 9 / 10. Approvals and document backlog
  const docsUnderReview = batch.count(OBJECTS.document, documentFilters.state(['UNDER_REVIEW']));
  const docsByState = batch.groupBy(OBJECTS.document, 'verificationState', {});
  const backlogList = batch.list<{ id: string; name: string | null; verificationState: string | null; onboardingId: string | null; updatedAt: string | null }>(
    OBJECTS.document,
    {
      filter: documentFilters.backlog(),
      orderBy: [{ updatedAt: 'AscNullsLast' }],
      first: LIST,
      selection: 'id name verificationState onboardingId updatedAt',
    },
  );

  // 11. Notification health
  const unreadUrgent = batch.count(OBJECTS.notification, notificationFilters.unreadUrgent());
  const slaNotifications = batch.count(OBJECTS.notification, notificationFilters.slaRecent(now));
  const escalationNotifications = batch.count(OBJECTS.notification, notificationFilters.escalationsRecent(now));
  const emailFailed = batch.count(OBJECTS.notification, notificationFilters.emailFailed());
  const emailSkipped = batch.count(OBJECTS.notification, notificationFilters.emailSkipped());

  // 12. System health (real signals only)
  const lastEvaluated = batch.list<{ id: string; lastEvaluatedAt: string | null }>(OBJECTS.sla, {
    filter: { lastEvaluatedAt: { is: 'NOT_NULL' } },
    orderBy: [{ lastEvaluatedAt: 'DescNullsLast' }],
    first: 1,
    selection: 'id lastEvaluatedAt',
  });
  const openSlaCount = batch.count(OBJECTS.sla, and(sla, slaFilters.open()));
  const leadsByStatus = batch.groupBy(OBJECTS.lead, 'status', scope);
  // Day 6: unresolved problems and AI activity are part of system health.
  const openProblems = batch.count(OBJECTS.problem, { status: { in: ['OPEN', 'IN_PROGRESS'] } });
  const aiRunsWeek = batch.count(OBJECTS.aiRun, { createdAt: { gte: daysAgo(now, 7) } });
  const aiFailuresWeek = batch.count(OBJECTS.aiRun, { and: [{ createdAt: { gte: daysAgo(now, 7) } }, { status: { in: ['FAILED', 'UNAVAILABLE'] } }] });
  const auditEvents = batch.count(OBJECTS.auditEvent, {
    at: { gte: new Date(Date.parse(now) - 7 * 86_400_000).toISOString() },
  });

  const [{ data, errors }, ecosystem] = await Promise.all([batch.run(client), buildEcosystemSummary(client, now)]);
  const partial = errors.length > 0 ? ['Some sections could not be loaded.'] : [];

  partial.push(...ecosystem.partial);

  // Members for owner filter + naming (bounded).
  const members = new Map<string, MemberRow>();

  try {
    const membersResult = await client.query<{ workspaceMembers?: { edges?: { node?: MemberRow }[] } }>(
      `query { workspaceMembers(first: 100) { edges { node { id name { firstName lastName } } } } }`,
    );

    for (const edge of membersResult.data.workspaceMembers?.edges ?? []) {
      if (edge.node?.id) {
        members.set(edge.node.id, edge.node);
      }
    }
  } catch {
    partial.push('Team members could not be loaded.');
  }

  const owner = (id: string | null | undefined) => (id ? memberName(members.get(id)) : 'Unowned');
  const leadRow = (lead: LeadRow & { emails?: { primaryEmail?: string | null } | null; phones?: { primaryPhoneNumber?: string | null } | null; duplicateKeys?: string[] | null }) => ({
    ...lead,
    ownerName: owner(lead.ownerId),
    statusLabel: lead.status ? (LEAD_STATUS_LABELS[lead.status as LeadStatus] ?? lead.status) : null,
    hasEmail: Boolean(lead.emails?.primaryEmail),
    hasPhone: Boolean(lead.phones?.primaryPhoneNumber),
    target: { object: 'lvLead', recordId: lead.id },
  });
  const slaRow = (row: SlaRow & { escalationOwnerId?: string | null; escalationBlockedReason?: string | null }) => ({
    ...row,
    ruleLabel: row.rule ? (SLA_RULE_LABELS[row.rule as SlaRule] ?? row.rule) : null,
    ownerName: owner(row.ownerId),
    escalationOwnerName: row.escalationOwnerId ? owner(row.escalationOwnerId) : null,
    target: row.leadId
      ? { object: 'lvLead', recordId: row.leadId }
      : row.onboardingId
        ? { object: 'lvOnboarding', recordId: row.onboardingId }
        : row.targetObject && row.targetRecordId
          ? { object: row.targetObject, recordId: row.targetRecordId }
          : null,
    slaTarget: { object: 'lvSla', recordId: row.id },
  });

  // Lead names for tasks.
  const overdue = overdueList(data);
  const taskLeadIds = [
    ...new Set(
      overdue.rows
        .flatMap((row) => (row.taskTargets?.edges ?? []).map((edge) => edge.node?.targetLvLeadId))
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];
  const leadNames = new Map<string, { name: string | null; lvLeadId: string | null }>();

  if (taskLeadIds.length > 0) {
    const lookup = new QueryBatch();
    const readLeads = lookup.list<LeadRow>(OBJECTS.lead, { filter: { id: { in: taskLeadIds } }, first: 100, selection: 'id name lvLeadId' });
    const { data: leadData } = await lookup.run(client);

    for (const row of readLeads(leadData).rows) {
      leadNames.set(row.id, { name: row.name, lvLeadId: row.lvLeadId });
    }
  }

  const taskRow = (row: TaskRow) => {
    const leadId = (row.taskTargets?.edges ?? []).map((edge) => edge.node?.targetLvLeadId).find((id): id is string => typeof id === 'string') ?? null;

    return {
      id: row.id,
      title: row.title,
      dueAt: row.dueAt,
      priority: row.lvPriority,
      assigneeId: row.assigneeId,
      ownerName: owner(row.assigneeId),
      leadId,
      leadName: leadId ? (leadNames.get(leadId)?.name ?? null) : null,
      lvLeadId: leadId ? (leadNames.get(leadId)?.lvLeadId ?? null) : null,
      target: { object: 'task', recordId: row.id },
      leadTarget: leadId ? { object: 'lvLead', recordId: leadId } : null,
    };
  };
  const onboardingRow = (row: OnboardingRow) => ({
    ...row,
    reviewerName: owner(row.reviewerId),
    target: { object: 'lvOnboarding', recordId: row.id },
  });

  const unowned = unownedList(data);
  const hot = hotList(data);
  const stuck = stuckList(data);
  const stale = staleOnboardings(data);
  const approvals = awaitingApproval(data);
  const onbBreached = onboardingBreachedSlas(data);
  const breached = breachedList(data);
  const noContact = noContactList(data);
  const marked = markedDuplicates(data);
  const flagged = flaggedDuplicates(data);
  const backlog = backlogList(data);
  const slaStatus = slaByStatus(data);
  const slaRule = slaByRule(data);
  const docs = docsByState(data);
  const onbStatus = onboardingByStatus(data);
  const leadStatus = leadsByStatus(data);
  const lastRun = lastEvaluated(data).rows[0]?.lastEvaluatedAt ?? null;

  const kpis: Kpi[] = [
    { key: 'unowned', label: 'Unowned leads', value: unownedCount(data), emptyText: 'Every open lead has an owner', tone: 'danger', link: { object: 'lvLead' } },
    { key: 'overdue', label: 'Overdue follow-ups', value: overdue.totalCount, emptyText: 'No follow-up is overdue', tone: 'danger', link: { object: 'task' } },
    { key: 'breached', label: 'SLA breached / escalated', value: breached.totalCount, emptyText: 'No unresolved SLA breach', tone: 'danger', link: { object: 'lvSla' } },
    { key: 'hot', label: 'Hot leads without follow-up', value: hot.totalCount, emptyText: 'Every high-priority lead has a follow-up scheduled', tone: 'warning', link: { object: 'lvLead' } },
    { key: 'approvals', label: 'Pending approvals', value: approvals.totalCount + docsUnderReview(data), emptyText: 'Nothing is waiting for approval', tone: 'warning', link: { object: 'lvOnboarding' } },
    { key: 'noContact', label: 'Leads with no contact channel', value: noContactCount(data), emptyText: 'Every open lead has an email or phone', tone: 'warning', link: { object: 'lvLead' } },
  ];

  // Informational contact-data breakdown (these fields are optional in the spec).
  const contactBreakdown: Kpi[] = [
    { key: 'noEmail', label: 'Open leads without email', value: noEmailCount(data), emptyText: 'Every open lead has an email', tone: 'neutral', link: { object: 'lvLead' } },
    { key: 'noPhone', label: 'Open leads without phone', value: noPhoneCount(data), emptyText: 'Every open lead has a phone', tone: 'neutral', link: { object: 'lvLead' } },
    { key: 'noOrg', label: 'Open leads without organisation', value: noOrgCount(data), emptyText: 'Every open lead names an organisation', tone: 'neutral', link: { object: 'lvLead' } },
    { key: 'noLocation', label: 'Open leads without location', value: noLocationCount(data), emptyText: 'Every open lead has a location', tone: 'neutral', link: { object: 'lvLead' } },
    { key: 'waitingDocs', label: 'Onboardings waiting on the partner', value: waitingDocs(data), emptyText: 'No onboarding is waiting on the partner', tone: 'neutral', link: { object: 'lvOnboarding' } },
  ];

  const sections: ListSection<Record<string, unknown>>[] = [
    { key: 'unowned', title: '1 · Unowned leads', emptyText: 'Every open lead has an owner.', totalCount: unowned.totalCount, rows: unowned.rows.map(leadRow) },
    { key: 'overdue', title: '2 · Overdue follow-ups', emptyText: 'No follow-up is overdue.', totalCount: overdue.totalCount, rows: overdue.rows.map(taskRow) },
    { key: 'hot', title: '3 · Hot leads without follow-up', emptyText: 'Every high/critical open lead has a next follow-up.', totalCount: hot.totalCount, rows: hot.rows.map(leadRow) },
    { key: 'stuck', title: `4 · Stuck leads (no contact ${THRESHOLDS.STUCK_LEAD_DAYS} days)`, emptyText: `No actionable lead has gone ${THRESHOLDS.STUCK_LEAD_DAYS} days without contact.`, totalCount: stuck.totalCount, rows: stuck.rows.map(leadRow) },
    { key: 'stuckOnboardings', title: `5 · Stuck onboardings (no update ${THRESHOLDS.STALE_ONBOARDING_DAYS} days)`, emptyText: `Every open onboarding moved in the last ${THRESHOLDS.STALE_ONBOARDING_DAYS} days.`, totalCount: stale.totalCount, rows: stale.rows.map(onboardingRow) },
    { key: 'onboardingBreached', title: '5b · Onboarding SLAs breached', emptyText: 'No onboarding or document SLA is breached.', totalCount: onbBreached.totalCount, rows: onbBreached.rows.map(slaRow) },
    { key: 'breached', title: '6 · SLA breaches (unresolved)', emptyText: 'No breached or escalated SLA is unresolved.', totalCount: breached.totalCount, rows: breached.rows.map(slaRow) },
    { key: 'noContact', title: '7 · Incomplete contact data (no email and no phone)', emptyText: 'Every open lead has at least one contact channel.', totalCount: noContact.totalCount, rows: noContact.rows.map(leadRow) },
    { key: 'markedDuplicates', title: '8 · Marked duplicates', emptyText: 'No lead is marked DUPLICATE.', totalCount: marked.totalCount, rows: marked.rows.map(leadRow) },
    { key: 'flaggedDuplicates', title: '8b · Flagged at capture (duplicate keys)', emptyText: 'No lead carries duplicate keys from capture.', totalCount: flagged.totalCount, rows: flagged.rows.map(leadRow) },
    { key: 'approvals', title: '9 · Pending onboarding approvals', emptyText: 'No onboarding is in internal review.', totalCount: approvals.totalCount, rows: approvals.rows.map(onboardingRow) },
    { key: 'backlog', title: '10 · Document verification backlog', emptyText: 'No document is pending, rejected, replaceable or expired.', totalCount: backlog.totalCount, rows: backlog.rows.map((doc) => ({ ...doc, target: { object: 'lvOnboardingDocument', recordId: doc.id } })) },
  ];

  const notificationHealth: Kpi[] = [
    { key: 'unreadUrgent', label: 'Unread high/critical notifications', value: unreadUrgent(data), emptyText: 'No urgent notification is unread', tone: 'warning', link: { object: 'lvNotification' } },
    { key: 'slaNotifications', label: 'SLA notifications (7 days)', value: slaNotifications(data), emptyText: 'No SLA notification in the last 7 days', tone: 'info', link: { object: 'lvNotification' } },
    { key: 'escalations', label: 'Escalations (7 days)', value: escalationNotifications(data), emptyText: 'No escalation in the last 7 days', tone: 'danger', link: { object: 'lvNotification' } },
    { key: 'emailFailed', label: 'Failed email deliveries', value: emailFailed(data), emptyText: 'No email delivery failed', tone: 'danger', link: { object: 'lvNotification' } },
    { key: 'emailSkipped', label: 'Emails skipped (no provider)', value: emailSkipped(data), emptyText: 'No email was skipped', tone: 'neutral', link: { object: 'lvNotification' } },
  ];

  const systemHealth = [
    { key: 'slaEvaluator', label: 'SLA evaluator last ran', value: lastRun, detail: lastRun ? `${Math.round((Date.parse(now) - Date.parse(lastRun)) / 60_000)} min ago (from the newest lastEvaluatedAt)` : 'No SLA has been evaluated yet' },
    { key: 'openSlas', label: 'Open SLAs', value: openSlaCount(data), detail: 'ON_TRACK, DUE_SOON, DUE, BREACHED, ESCALATED' },
    { key: 'escalated', label: 'Escalated SLAs', value: escalatedCount(data), detail: 'Escalation task created and manager notified' },
    { key: 'blocked', label: 'Escalations blocked', value: blockedCount(data), detail: 'Breached with no escalation owner configured (LV_ESCALATION_OWNER_EMAIL)' },
    { key: 'auditEvents', label: 'Governance audit events (7 days)', value: auditEvents(data), detail: 'Archive / close / duplicate / restore / permanent delete' },
    { key: 'openProblems', label: 'Unresolved problems', value: openProblems(data), detail: 'Confirmed problems with status OPEN or IN_PROGRESS' },
    { key: 'aiRuns', label: 'AI operations (7 days)', value: aiRunsWeek(data), detail: `${aiFailuresWeek(data)} failed or unavailable` },
  ];

  const notes = [
    '"Hot" = priority HIGH or CRITICAL on an open lead (no opportunity score exists yet).',
    `"Stuck lead" = open workload status, created more than ${THRESHOLDS.STUCK_LEAD_DAYS} days ago, no interaction within ${THRESHOLDS.STUCK_LEAD_DAYS} days.`,
    `"Stuck onboarding" = open status with no update for ${THRESHOLDS.STALE_ONBOARDING_DAYS} days; breached onboarding/document SLAs and internal reviews are listed separately.`,
    'Incomplete contact data = open lead with neither a primary email nor a primary phone; the other counts (email, phone, organisation, location) are informational — those fields are not mandatory in the specification.',
    'Duplicates: leads a human marked DUPLICATE, and leads the capture step flagged with duplicate keys. Cross-record matching is not run here.',
    'Team filter = a set of owners; the data model has no team object.',
    'Uptime and infrastructure metrics are not shown — nothing in the CRM records them.',
    'Ecosystem: "not active" counts records by status; per-record activation readiness (documents, pricing, availability, approval) is computed on each 360 page, not estimated here.',
  ];

  return {
    generatedAt: now,
    filters,
    filtered: hasAnyFilter(filters),
    kpis,
    sections,
    breakdown: {
      slaByStatus: ['ON_TRACK', 'DUE_SOON', 'DUE', 'BREACHED', 'ESCALATED', 'RESOLVED'].map((key) => ({ key, label: key.replace('_', ' ').toLowerCase(), count: slaStatus[key] ?? 0 })),
      slaByRule: (Object.keys(SLA_RULE_LABELS) as SlaRule[]).map((key) => ({ key, label: SLA_RULE_LABELS[key], count: slaRule[key] ?? 0 })),
      documentsByState: ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'NEEDS_REPLACEMENT', 'EXPIRED'].map((key) => ({ key, count: docs[key] ?? 0 })),
      onboardingByStatus: Object.entries(onbStatus).filter(([key]) => key !== '__null').map(([key, count]) => ({ key, count })),
      leadsByStatus: Object.entries(leadStatus).filter(([key]) => key !== '__null').map(([key, count]) => ({ key, label: LEAD_STATUS_LABELS[key as LeadStatus] ?? key, count })),
    },
    contactBreakdown,
    notificationHealth,
    systemHealth,
    members: [...members.values()].map((member) => ({ id: member.id, name: memberName(member) })).sort((a, b) => a.name.localeCompare(b.name)),
    notes,
    partial,
    ecosystem,
  };
};
