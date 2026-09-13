import { describe, expect, it } from 'vitest';

import {
  dayLabel,
  dueLabel,
  groupTimelineByDay,
  headerFields,
  localInputToIso,
  overviewWarnings,
  sectionOrderFor,
} from 'src/modules/lv-core/front-components/lead-360/lead-360-view';
import {
  buildTimeline,
  composeLead360,
  deriveCapabilities,
  isOpenTask,
  summariseOnboarding,
} from 'src/modules/lv-core/services/lead-360';
import { type CallerContext } from 'src/modules/lv-dashboard/services/caller-context';
import { assessDataQuality } from 'src/modules/lv-intelligence/engines/data-quality';
import { deriveLeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { recommendNextBestAction } from 'src/modules/lv-intelligence/engines/next-best-action';
import { scoreOpportunity } from 'src/modules/lv-intelligence/engines/opportunity-score';
import { assessRelationshipHealth } from 'src/modules/lv-intelligence/engines/relationship-health';
import { type LeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { stepProgress } from 'src/modules/lv-onboarding/utils/onboarding-progress';

// Lead 360 composition: capabilities come from the platform's answers and
// the record, never from the body; the timeline merges every source in
// order; the header shows exactly the brief's fields; role ordering differs
// per lens without hiding a section the server allowed.

const NOW = '2026-09-13T10:00:00.000Z';
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString();
const ahead = (days: number) => new Date(Date.parse(NOW) + days * DAY).toISOString();

const lead = (overrides: Partial<LeadContext['lead']> = {}): LeadContext['lead'] => ({
  id: 'lead-1',
  lvLeadId: 'LV-000042',
  name: 'Hilltop Retreat',
  organisationName: 'Hilltop Retreat Pvt Ltd',
  category: 'STAY',
  subcategory: 'HOMESTAY',
  location: 'Lonavala',
  source: 'WEBSITE',
  captureMode: 'MANUAL',
  status: 'INTERESTED',
  priority: 'HIGH',
  ownerId: 'member-owner',
  assignedAt: ago(10),
  emails: { primaryEmail: 'host@hilltop.in' },
  phones: { primaryPhoneNumber: null },
  website: null,
  instagram: null,
  languages: ['en', 'mr'],
  opportunityScore: null,
  dataCompleteness: 70,
  lastInteractionAt: ago(2),
  nextAction: null,
  nextFollowUpAt: null,
  onboardingStatus: null,
  rawCaptureInput: null,
  duplicateKeys: [],
  createdAt: ago(30),
  updatedAt: ago(1),
  ...overrides,
});

const context = (overrides: Partial<LeadContext> = {}): LeadContext => ({
  lead: lead(),
  interactions: [
    { id: 'int-1', name: 'Intro call', channel: 'PHONE', direction: 'OUTBOUND', occurredAt: ago(2), actorId: 'member-owner', purpose: 'INTRODUCTION', summary: 'Interested in hosting', sentiment: 'POSITIVE', outcome: 'INTERESTED', objections: null, commitments: null, nextAction: 'Send pricing', nextFollowUpAt: ahead(1), durationMinutes: 15 },
  ],
  tasks: [
    { id: 'task-done', title: 'Old task', status: 'DONE', dueAt: ago(5), assigneeId: 'member-owner', lvPriority: 'LOW', lvSourceInteractionId: null, createdAt: ago(6) },
    { id: 'task-late', title: 'Send pricing', status: 'TODO', dueAt: ago(1), assigneeId: 'member-owner', lvPriority: 'HIGH', lvSourceInteractionId: 'int-1', createdAt: ago(2) },
    { id: 'task-soon', title: 'Site visit', status: 'TODO', dueAt: ahead(3), assigneeId: 'member-other', lvPriority: 'MEDIUM', lvSourceInteractionId: null, createdAt: ago(1) },
  ],
  notes: [{ id: 'note-1', title: 'Owner background', body: 'Runs two homestays.', updatedAt: ago(3) }],
  slas: [{ id: 'sla-1', name: 'Follow-up', rule: 'FOLLOW_UP', status: 'BREACHED', dueAt: ago(1), breachedAt: ago(1), resolvedAt: null, escalationBlockedReason: null }],
  onboarding: {
    id: 'onb-1',
    name: 'Hilltop onboarding',
    status: 'IN_PROGRESS',
    currentStep: 'PRICING',
    progressPercentage: 40,
    reviewerId: 'member-reviewer',
    submittedAt: null,
    updatedAt: ago(1),
    answers: { BASIC_INFORMATION: { legalName: 'Asha Kulkarni', displayName: 'Hilltop Retreat', email: 'host@hilltop.in', phone: '+91 99999 99999' } },
    documents: [
      { id: 'doc-1', name: 'ID proof', documentType: 'IDENTITY', verificationState: 'REJECTED', expiresAt: null, rejectionReason: 'Blurry scan' },
      { id: 'doc-2', name: 'Licence', documentType: 'LICENSE', verificationState: 'PENDING', expiresAt: ahead(300), rejectionReason: null },
    ],
  },
  problems: [],
  loadedAt: NOW,
  ...overrides,
});

const caller = (overrides: Partial<Omit<CallerContext, 'workspaceMemberId'>> & { workspaceMemberId?: string } = {}): CallerContext & { workspaceMemberId: string } => ({
  workspaceMemberId: 'member-owner',
  userId: 'user-1',
  isAdmin: false,
  permissionFlags: [],
  objectPermissions: { lvLead: { read: true, update: true, softDelete: false, destroy: false }, task: { read: true, update: true, softDelete: false, destroy: false }, note: { read: true, update: true, softDelete: false, destroy: false } },
  lens: 'HUNTER',
  availableLenses: ['HUNTER'],
  ...overrides,
});

const memberById = new Map([
  ['member-owner', { id: 'member-owner', displayName: 'Tim Apple', email: 'tim@apple.dev' }],
  ['member-other', { id: 'member-other', displayName: 'Jony Ive', email: 'jony@apple.dev' }],
  ['member-reviewer', { id: 'member-reviewer', displayName: 'Rina Reviewer', email: 'rina@lv.test' }],
]);

const intelligenceFor = (ctx: LeadContext) => {
  const facts = deriveLeadFacts(ctx, NOW);

  return { opportunity: scoreOpportunity(facts), health: assessRelationshipHealth(facts), nextBestAction: recommendNextBestAction(facts), dataQuality: assessDataQuality(ctx, facts) };
};

const compose = (ctx = context(), who = caller()) =>
  composeLead360({
    context: ctx,
    caller: who,
    now: NOW,
    memberById,
    members: [...memberById.values()],
    assignmentHistory: [{ id: 'hist-1', assignedAt: ago(10), fromOwnerId: null, toOwnerId: 'member-owner', strategy: 'SCORED', reason: 'Category match' }],
    auditRows: [{ id: 'audit-1', action: 'STATUS_CHANGE', outcome: 'APPLIED', at: ago(4), actorId: 'member-owner', reason: null, targetObject: 'lvLead', targetRecordId: 'lead-1', metadata: { from: 'CONTACTED', to: 'INTERESTED' } }],
    insightDecisions: [{ id: 'ins-1', insightType: 'NEXT_BEST_ACTION', status: 'AI_CONFIRMED', humanDecision: 'ACCEPTED', decidedAt: ago(2), decidedById: 'member-owner' }],
    onboardingProgress: stepProgress(ctx.onboarding?.answers ?? {}),
    intelligence: intelligenceFor(ctx),
  });

describe('capabilities are derived from platform permissions and the record', () => {
  it('a hunter may log, task, note and change status on their own open lead, but not reassign to others', () => {
    const capabilities = deriveCapabilities({ caller: caller(), lead: { ownerId: 'member-owner', status: 'INTERESTED' }, onboarding: null });

    expect(capabilities).toMatchObject({ canLogInteraction: true, canCreateTask: true, canAddNote: true, canChangeStatus: true, canChangeOwner: true, canClaim: false, canWorkOnboarding: false, canReviewDocuments: false });
  });

  it('a hunter on someone else’s lead cannot change owner; on an unassigned lead may only claim', () => {
    expect(deriveCapabilities({ caller: caller(), lead: { ownerId: 'member-other', status: 'NEW' }, onboarding: null })).toMatchObject({ canChangeOwner: false, canClaim: false });
    expect(deriveCapabilities({ caller: caller(), lead: { ownerId: null, status: 'NEW' }, onboarding: null })).toMatchObject({ canChangeOwner: false, canClaim: true });
  });

  it('a closed lead offers no interaction or status change, and a read-only role gets no actions', () => {
    expect(deriveCapabilities({ caller: caller(), lead: { ownerId: 'member-owner', status: 'LOST' }, onboarding: null })).toMatchObject({ canLogInteraction: false, canChangeStatus: false });
    const oversight = deriveCapabilities({ caller: caller({ objectPermissions: {}, lens: 'OVERSIGHT' }), lead: { ownerId: 'member-owner', status: 'NEW' }, onboarding: null });

    expect(Object.entries(oversight).filter(([key, value]) => key !== 'canViewIntelligence' && value === true)).toEqual([]);
  });

  it('an admin may reassign anyone’s lead; only the assigned reviewer (or an admin) reviews documents', () => {
    const admin = caller({ isAdmin: true, workspaceMemberId: 'member-admin', objectPermissions: { lvLead: { read: true, update: true, softDelete: true, destroy: true }, lvOnboarding: { read: true, update: true, softDelete: false, destroy: false } } });

    expect(deriveCapabilities({ caller: admin, lead: { ownerId: 'member-owner', status: 'NEW' }, onboarding: { reviewerId: 'member-reviewer' } })).toMatchObject({ canChangeOwner: true, canReviewDocuments: true });
    const expert = caller({ workspaceMemberId: 'member-reviewer', objectPermissions: { lvOnboarding: { read: true, update: true, softDelete: false, destroy: false } }, lens: 'ONBOARDING' });

    expect(deriveCapabilities({ caller: expert, lead: { ownerId: 'member-owner', status: 'NEW' }, onboarding: { reviewerId: 'member-reviewer' } })).toMatchObject({ canReviewDocuments: true, canEdit: false });
    expect(deriveCapabilities({ caller: expert, lead: { ownerId: 'member-owner', status: 'NEW' }, onboarding: { reviewerId: 'member-other' } })).toMatchObject({ canReviewDocuments: false });
  });
});

describe('composition', () => {
  it('picks the earliest open task as next action, flags overdue, and bounds lists', () => {
    const model = compose();

    expect(model.nextAction.task?.id).toBe('task-late');
    expect(model.nextAction.task?.isOverdue).toBe(true);
    expect(model.openTasks.map((task) => task.id)).toEqual(['task-late', 'task-soon']);
    expect(model.openTasks[1].assignee?.displayName).toBe('Jony Ive');
    expect(isOpenTask({ status: 'DONE' })).toBe(false);
    expect(model.attention).toMatchObject({ overdueFollowUp: true, noNextAction: false, slaBreach: true, missingDocuments: true, noInteraction: false });
  });

  it('merges every source into one timeline, newest first, with the AI decision and status change', () => {
    const model = compose();
    const kinds = model.timeline.map((entry) => entry.kind);

    expect(kinds).toContain('LEAD_CREATED');
    expect(kinds).toContain('ASSIGNMENT');
    expect(kinds).toContain('INTERACTION');
    expect(kinds).toContain('TASK');
    expect(kinds).toContain('NOTE');
    expect(kinds).toContain('SLA');
    expect(kinds).toContain('ONBOARDING');
    expect(kinds).toContain('DOCUMENT');
    expect(kinds).toContain('STATUS');
    expect(kinds).toContain('AI_DECISION');

    for (let index = 1; index < model.timeline.length; index += 1) {
      expect(model.timeline[index - 1].at >= model.timeline[index].at).toBe(true);
    }

    const status = model.timeline.find((entry) => entry.kind === 'STATUS');

    expect(status?.title).toBe('Status → Interested (was contacted)');
    expect(model.timeline[model.timeline.length - 1].kind).toBe('LEAD_CREATED');
  });

  it('never surfaces an audit row for OWNER_CHANGE twice (assignment history already carries it)', () => {
    const entries = buildTimeline({
      context: context({ interactions: [], tasks: [], notes: [], slas: [], onboarding: null }),
      assignmentHistory: [{ id: 'h', assignedAt: ago(1), fromOwnerId: 'member-owner', toOwnerId: 'member-other', strategy: 'MANUAL', reason: 'handover' }],
      auditRows: [{ id: 'a', action: 'OWNER_CHANGE', outcome: 'APPLIED', at: ago(1), actorId: 'member-owner', reason: 'handover', targetObject: 'lvLead', targetRecordId: 'lead-1', metadata: {} }],
      insightDecisions: [],
      memberById,
    });

    expect(entries.filter((entry) => entry.kind === 'ASSIGNMENT')).toHaveLength(1);
    expect(entries.filter((entry) => entry.kind === 'GOVERNANCE')).toHaveLength(0);
    expect(entries.find((entry) => entry.kind === 'ASSIGNMENT')?.title).toBe('Reassigned to Jony Ive');
  });

  it('summarises onboarding with step and document counts, reviewer resolved', () => {
    const ctx = context();
    const summary = summariseOnboarding({ context: ctx, progress: stepProgress(ctx.onboarding?.answers ?? {}), memberById });

    expect(summary).toMatchObject({ id: 'onb-1', status: 'IN_PROGRESS', completedSteps: 1, rejectedDocuments: 1, pendingDocuments: 1, expiredDocuments: 0 });
    expect(summary?.reviewer?.displayName).toBe('Rina Reviewer');
    expect(summary?.steps[0]).toMatchObject({ step: 'BASIC_INFORMATION', isComplete: true });
    expect(summariseOnboarding({ context: context({ onboarding: null }), progress: [], memberById })).toBeNull();
  });

  it('withholds the member list from roles that cannot assign or create tasks', () => {
    expect(compose().members.length).toBeGreaterThan(0);
    expect(compose(context(), caller({ objectPermissions: {}, lens: 'OVERSIGHT' })).members).toEqual([]);
  });

  it('never offers the current status or an onboarding-mirrored status as a settable target', () => {
    const model = compose();

    expect(model.settableStatuses).not.toContain('INTERESTED');
    expect(model.settableStatuses).not.toContain('LIVE_ACTIVE');
    expect(model.settableStatuses).toContain('NEGOTIATION');
    expect(model.settableStatuses).toContain('FOLLOW_UP_LATER');
  });
});

describe('view helpers', () => {
  it('header shows exactly the fields the brief names, in order, with honest placeholders', () => {
    const fields = headerFields(compose(context({ lead: lead({ lvLeadId: null, ownerId: null, organisationName: null }) }), caller()));

    expect(fields.map((field) => field.label)).toEqual(['LV Lead ID', 'Organisation', 'Category', 'Subcategory', 'Location', 'Source', 'Owner', 'Status', 'Priority', 'Opportunity score', 'Relationship health', 'Last interaction', 'Next action', 'Next follow-up', 'Onboarding']);
    expect(fields[0].value).toBe('pending');
    expect(fields[1].value).toBe('—');
    expect(fields[6]).toMatchObject({ value: 'Unassigned', tone: 'warning' });
  });

  it('data-quality warnings come from the engine, plus no-interaction / no-follow-up from attention', () => {
    const model = compose(context({ interactions: [], tasks: [], lead: lead({ lastInteractionAt: null, phones: null, emails: null }) }));
    const warnings = overviewWarnings(model.intelligence.dataQuality, model.attention);
    const codes = warnings.map((warning) => warning.code);

    expect(codes).toContain('MISSING_CONTACT');
    expect(codes.some((code) => code === 'MISSING_NEXT_ACTION' || code === 'MISSING_NEXT_FOLLOW_UP' || code === 'NO_NEXT_FOLLOW_UP')).toBe(true);
    expect(codes.some((code) => code === 'STALE_LEAD' || code === 'NO_INTERACTION')).toBe(true);
  });

  it('orders sections by role without dropping any', () => {
    const hunter = sectionOrderFor('HUNTER');
    const coordinator = sectionOrderFor('COORDINATOR');
    const onboarding = sectionOrderFor('ONBOARDING');

    expect(hunter[0]).toBe('NEXT_ACTION');
    expect(coordinator.slice(0, 3)).toEqual(['NEXT_ACTION', 'TASKS', 'SLA']);
    expect(onboarding.slice(0, 2)).toEqual(['ONBOARDING', 'DOCUMENTS']);
    expect([...hunter].sort()).toEqual([...onboarding].sort());
    expect(new Set(hunter).size).toBe(hunter.length);
  });

  it('groups the timeline by day with Today / Yesterday labels and formats due dates', () => {
    const grouped = groupTimelineByDay(compose().timeline, NOW);

    expect(grouped.length).toBeGreaterThan(1);
    expect(grouped.every((day) => day.entries.every((entry) => entry.at.slice(0, 10) === day.day))).toBe(true);
    expect(dayLabel(NOW, NOW)).toBe('Today');
    expect(dayLabel(ago(1), NOW)).toBe('Yesterday');
    expect(dayLabel('2025-01-05T10:00:00.000Z', NOW)).toBe('Jan 5 2025');
    expect(dueLabel(ago(2), NOW)).toMatchObject({ tone: 'danger', text: 'Overdue by 2 days' });
    expect(dueLabel(null, NOW)).toMatchObject({ tone: 'neutral' });
    expect(localInputToIso('')).toBeNull();
    expect(localInputToIso('not a date')).toBeNull();
    expect(typeof localInputToIso('2026-09-14T11:00')).toBe('string');
  });
});
