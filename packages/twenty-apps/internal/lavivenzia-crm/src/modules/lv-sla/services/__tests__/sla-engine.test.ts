import { describe, expect, it } from 'vitest';

import { canAdvanceSla } from 'src/modules/lv-sla/constants/sla-rules';
import {
  expectedOwnerFor,
  planEvaluation,
  resolutionFor,
  type SlaRecord,
  type TargetFacts,
} from 'src/modules/lv-sla/services/sla-engine';
import { scheduleFor } from 'src/modules/lv-sla/utils/sla-clock';

const T0 = '2026-09-10T08:00:00.000Z';
const plus = (hours: number) => new Date(Date.parse(T0) + hours * 3_600_000).toISOString();

const aSla = (overrides: Partial<SlaRecord> = {}): SlaRecord => {
  const rule = overrides.rule ?? 'NEW_LEAD_CONTACT';
  const schedule = scheduleFor({ rule, startedAt: T0 });

  return {
    id: 'sla-1',
    name: 'New lead contact — Forest Table',
    rule,
    status: 'ON_TRACK',
    priority: 'MEDIUM',
    ownerWorkspaceMemberId: 'wm-a',
    escalationOwnerWorkspaceMemberId: null,
    escalationTaskId: null,
    targetObject: 'lvLead',
    targetRecordId: 'lead-1',
    leadId: 'lead-1',
    onboardingId: null,
    documentId: null,
    ...schedule,
    breachedAt: null,
    escalatedAt: null,
    resolvedAt: null,
    auditTrail: [],
    ...overrides,
  };
};

const leadFacts = (overrides: Partial<Extract<TargetFacts, { kind: 'LEAD' }>> = {}): TargetFacts => ({
  kind: 'LEAD',
  name: 'Forest Table',
  status: 'ASSIGNED',
  ownerWorkspaceMemberId: 'wm-a',
  outwardContactSinceStart: false,
  followUpCompletedSinceStart: false,
  ...overrides,
});

const plan = (sla: SlaRecord, facts: TargetFacts, hours: number, manager: string | null = 'wm-mgr') =>
  planEvaluation({ sla, facts, now: plus(hours), escalationOwnerWorkspaceMemberId: manager });

describe('state machine', () => {
  it('only advances, and never out of RESOLVED', () => {
    expect(canAdvanceSla('ON_TRACK', 'DUE_SOON')).toBe(true);
    expect(canAdvanceSla('ON_TRACK', 'BREACHED')).toBe(true);
    expect(canAdvanceSla('DUE', 'DUE_SOON')).toBe(false);
    expect(canAdvanceSla('BREACHED', 'DUE')).toBe(false);
    expect(canAdvanceSla('RESOLVED', 'BREACHED')).toBe(false);
    expect(canAdvanceSla('ESCALATED', 'RESOLVED')).toBe(true);
  });
});

describe('time travel — 24h new lead contact', () => {
  const sla = aSla();

  it('T0+10h: on track, nothing to do', () => {
    expect(plan(sla, leadFacts(), 10)).toMatchObject({ summary: 'no change' });
  });

  it('T0+18h: DUE_SOON', () => {
    expect(plan(sla, leadFacts(), 18).transition).toEqual({ from: 'ON_TRACK', to: 'DUE_SOON' });
  });

  it('T0+24h: DUE (not yet breached)', () => {
    const p = plan(aSla({ status: 'DUE_SOON' }), leadFacts(), 24);

    expect(p.transition).toEqual({ from: 'DUE_SOON', to: 'DUE' });
    expect(p.escalate).toBeUndefined();
  });

  it('T0+25h: BREACHED and escalation planned', () => {
    const p = plan(aSla({ status: 'DUE' }), leadFacts(), 25);

    expect(p.transition).toEqual({ from: 'DUE', to: 'BREACHED' });
    expect(p.escalate).toEqual({ escalationOwnerWorkspaceMemberId: 'wm-mgr' });
  });

  it('an evaluator that was down jumps straight from ON_TRACK to BREACHED', () => {
    expect(plan(sla, leadFacts(), 30).transition).toEqual({ from: 'ON_TRACK', to: 'BREACHED' });
  });

  it('next run on a BREACHED, already-escalated SLA is a no-op', () => {
    const p = plan(aSla({ status: 'ESCALATED', escalationTaskId: 'task-1' }), leadFacts(), 40);

    expect(p.transition).toBeUndefined();
    expect(p.escalate).toBeUndefined();
    expect(p.summary).toContain('awaiting resolution');
  });

  it('BREACHED with no escalation owner configured is reported blocked, not invented', () => {
    const p = plan(aSla({ status: 'BREACHED' }), leadFacts(), 30, null);

    expect(p.escalate).toEqual({ escalationOwnerWorkspaceMemberId: null });
    expect(p.summary).toContain('escalation blocked');
  });

  it('BREACHED with a task already linked does not escalate again', () => {
    const p = plan(aSla({ status: 'BREACHED', escalationTaskId: 'task-1' }), leadFacts(), 30);

    expect(p.escalate).toBeUndefined();
  });
});

describe('time travel — 48h rules reach the same states at 36h / 48h / 49h', () => {
  for (const rule of ['INTERESTED_FOLLOW_UP', 'MISSING_DOCUMENT'] as const) {
    const sla = aSla({
      rule,
      targetObject: rule === 'MISSING_DOCUMENT' ? 'lvOnboardingDocument' : 'lvLead',
      targetRecordId: rule === 'MISSING_DOCUMENT' ? 'doc-1' : 'lead-1',
      documentId: rule === 'MISSING_DOCUMENT' ? 'doc-1' : null,
    });
    const facts: TargetFacts =
      rule === 'MISSING_DOCUMENT'
        ? {
            kind: 'DOCUMENT',
            name: 'Identity',
            verificationState: 'REJECTED',
            onboardingStatus: 'IN_PROGRESS',
            reviewerWorkspaceMemberId: 'wm-c',
            leadOwnerWorkspaceMemberId: 'wm-a',
            replacementRegistered: false,
          }
        : leadFacts({ status: 'INTERESTED' });

    it(`${rule}`, () => {
      expect(plan(sla, facts, 35).transition).toBeUndefined();
      expect(plan(sla, facts, 36).transition?.to).toBe('DUE_SOON');
      expect(plan(sla, facts, 48).transition?.to).toBe('DUE');
      expect(plan(sla, facts, 49).transition?.to).toBe('BREACHED');
    });
  }
});

describe('time travel — 24h onboarding first action', () => {
  const sla = aSla({
    rule: 'ONBOARDING_FIRST_ACTION',
    targetObject: 'lvOnboarding',
    targetRecordId: 'onb-1',
    onboardingId: 'onb-1',
    ownerWorkspaceMemberId: 'wm-c',
  });
  const facts: TargetFacts = {
    kind: 'ONBOARDING',
    name: 'Forest Table onboarding',
    status: 'INITIATED',
    reviewerWorkspaceMemberId: 'wm-c',
    leadOwnerWorkspaceMemberId: 'wm-a',
    documentReviewedSinceStart: false,
  };

  it('follows the 24h clock', () => {
    expect(plan(sla, facts, 17).transition).toBeUndefined();
    expect(plan(sla, facts, 18).transition?.to).toBe('DUE_SOON');
    expect(plan(sla, facts, 25).transition?.to).toBe('BREACHED');
  });

  it('resolves when the reviewer moves the onboarding on, or reviews a document', () => {
    expect(resolutionFor(sla, { ...facts, status: 'IN_PROGRESS' })).toBe('ONBOARDING_PROGRESSED');
    expect(resolutionFor(sla, { ...facts, documentReviewedSinceStart: true })).toBe('DOCUMENT_REVIEWED');
    expect(resolutionFor(sla, facts)).toBeNull();
  });
});

describe('resolution', () => {
  it('new lead contact: an outward interaction or reaching CONTACTED resolves; a closed lead resolves', () => {
    const sla = aSla();

    expect(resolutionFor(sla, leadFacts())).toBeNull();
    expect(resolutionFor(sla, leadFacts({ outwardContactSinceStart: true }))).toBe('CONTACT_LOGGED');
    expect(resolutionFor(sla, leadFacts({ status: 'CONTACTED' }))).toBe('LEAD_CONTACTED');
    expect(resolutionFor(sla, leadFacts({ status: 'NEGOTIATION' }))).toBe('LEAD_CONTACTED');
    expect(resolutionFor(sla, leadFacts({ status: 'NOT_INTERESTED' }))).toBe('LEAD_CLOSED');
    expect(resolutionFor(sla, { kind: 'GONE' })).toBe('TARGET_GONE');
  });

  it('interested follow-up: contact, completed task, or leaving INTERESTED resolves', () => {
    const sla = aSla({ rule: 'INTERESTED_FOLLOW_UP' });

    expect(resolutionFor(sla, leadFacts({ status: 'INTERESTED' }))).toBeNull();
    expect(resolutionFor(sla, leadFacts({ status: 'INTERESTED', outwardContactSinceStart: true }))).toBe('FOLLOW_UP_LOGGED');
    expect(resolutionFor(sla, leadFacts({ status: 'INTERESTED', followUpCompletedSinceStart: true }))).toBe('FOLLOW_UP_COMPLETED');
    expect(resolutionFor(sla, leadFacts({ status: 'NEGOTIATION' }))).toBe('LEAD_PROGRESSED');
    expect(resolutionFor(sla, leadFacts({ status: 'ENGAGED' }))).toBe('LEAD_STATUS_CHANGED');
    expect(resolutionFor(sla, leadFacts({ status: 'LOST' }))).toBe('LEAD_CLOSED');
  });

  it('missing document: resubmission, verification, replacement or a closed onboarding resolves', () => {
    const sla = aSla({ rule: 'MISSING_DOCUMENT', targetObject: 'lvOnboardingDocument', targetRecordId: 'doc-1' });
    const doc = (overrides: Partial<Extract<TargetFacts, { kind: 'DOCUMENT' }>>): TargetFacts => ({
      kind: 'DOCUMENT',
      name: 'Identity',
      verificationState: 'REJECTED',
      onboardingStatus: 'IN_PROGRESS',
      reviewerWorkspaceMemberId: 'wm-c',
      leadOwnerWorkspaceMemberId: 'wm-a',
      replacementRegistered: false,
      ...overrides,
    });

    expect(resolutionFor(sla, doc({}))).toBeNull();
    expect(resolutionFor(sla, doc({ verificationState: 'PENDING' }))).toBe('DOCUMENT_RESUBMITTED');
    expect(resolutionFor(sla, doc({ verificationState: 'VERIFIED' }))).toBe('DOCUMENT_VERIFIED');
    expect(resolutionFor(sla, doc({ replacementRegistered: true }))).toBe('DOCUMENT_REPLACED');
    expect(resolutionFor(sla, doc({ onboardingStatus: 'REJECTED' }))).toBe('ONBOARDING_CLOSED');
  });

  it('a resolution wins over the clock, even when breached', () => {
    const p = plan(aSla({ status: 'DUE' }), leadFacts({ status: 'CONTACTED' }), 40);

    expect(p.resolve).toEqual({ reason: 'LEAD_CONTACTED' });
    expect(p.transition).toBeUndefined();
    expect(p.escalate).toBeUndefined();
  });

  it('a RESOLVED SLA is never touched again, whatever the clock says', () => {
    expect(plan(aSla({ status: 'RESOLVED' }), leadFacts(), 500)).toEqual({ summary: 'already resolved' });
  });

  it('an ESCALATED SLA can still resolve when the action finally happens', () => {
    const p = plan(aSla({ status: 'ESCALATED', escalationTaskId: 't' }), leadFacts({ outwardContactSinceStart: true }), 80);

    expect(p.resolve?.reason).toBe('CONTACT_LOGGED');
  });
});

describe('reassignment', () => {
  it('follows the record owner without touching the deadline', () => {
    const p = plan(aSla(), leadFacts({ ownerWorkspaceMemberId: 'wm-b' }), 10);

    expect(p.reassignTo).toEqual({ from: 'wm-a', to: 'wm-b' });
    expect(p.transition).toBeUndefined();
  });

  it('reassigns and transitions in the same evaluation when both apply', () => {
    const p = plan(aSla(), leadFacts({ ownerWorkspaceMemberId: 'wm-b' }), 20);

    expect(p.reassignTo?.to).toBe('wm-b');
    expect(p.transition?.to).toBe('DUE_SOON');
  });

  it('an unassigned lead leaves the SLA unowned, not orphaned', () => {
    expect(plan(aSla(), leadFacts({ ownerWorkspaceMemberId: null }), 1).reassignTo).toEqual({ from: 'wm-a', to: null });
  });

  it('resolves ownership per target type', () => {
    expect(expectedOwnerFor(leadFacts({ ownerWorkspaceMemberId: 'x' }))).toBe('x');
    expect(
      expectedOwnerFor({
        kind: 'ONBOARDING',
        name: '',
        status: 'INITIATED',
        reviewerWorkspaceMemberId: 'rev',
        leadOwnerWorkspaceMemberId: 'own',
        documentReviewedSinceStart: false,
      }),
    ).toBe('rev');
    expect(
      expectedOwnerFor({
        kind: 'DOCUMENT',
        name: '',
        verificationState: 'REJECTED',
        onboardingStatus: 'IN_PROGRESS',
        reviewerWorkspaceMemberId: 'rev',
        leadOwnerWorkspaceMemberId: null,
        replacementRegistered: false,
      }),
    ).toBe('rev');
    expect(expectedOwnerFor({ kind: 'GONE' })).toBeUndefined();
  });
});
