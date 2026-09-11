import { describe, expect, it } from 'vitest';

import {
  buildEscalationNotification,
  buildFollowUpNotification,
  buildLeadRepliedNotification,
  buildMentionNotification,
  buildSlaBreachNotification,
  deepLinkFor,
  NOTIFICATION_TYPES,
  notificationsForDocumentRejected,
  notificationsForOnboardingStatus,
  notificationsForOwnerChange,
  onboardingEventForStatus,
  shouldEmail,
} from 'src/modules/lv-notifications/utils/build-notification';

const CHANGED_AT = '2026-09-09T10:00:00.000Z';

const forOwnerChange = (
  overrides: Partial<Parameters<typeof notificationsForOwnerChange>[0]> = {},
) =>
  notificationsForOwnerChange({
    leadId: 'lead-1',
    leadName: 'Forest Table',
    previousOwnerWorkspaceMemberId: null,
    newOwnerWorkspaceMemberId: 'owner-1',
    assignedByName: null,
    priority: 'MEDIUM',
    changedAt: CHANGED_AT,
    ...overrides,
  });

describe('catalogue', () => {
  it('covers the twelve event types in the brief, plus the two SLA clock states', () => {
    expect([...NOTIFICATION_TYPES].sort()).toEqual(
      [
        'SLA_DUE_SOON',
        'SLA_DUE',
        'LEAD_ASSIGNED',
        'FOLLOW_UP_DUE',
        'FOLLOW_UP_OVERDUE',
        'SLA_BREACH',
        'LEAD_REPLIED',
        'ONBOARDING_STARTED',
        'ONBOARDING_COMPLETED',
        'DOCUMENT_REJECTED',
        'LEAD_REASSIGNED',
        'APPROVAL_REQUIRED',
        'MENTION',
        'ESCALATION',
      ].sort(),
    );
  });

  it('deep-links to the Twenty record page', () => {
    expect(deepLinkFor({ object: 'lvLead', recordId: 'x' })).toBe('/object/lvLead/x');
    expect(deepLinkFor({ object: 'task', recordId: 'y' })).toBe('/object/task/y');
  });
});

describe('assignment / reassignment', () => {
  it('notifies the new owner', () => {
    const [intent] = forOwnerChange();

    expect(intent?.recipientWorkspaceMemberId).toBe('owner-1');
    expect(intent?.type).toBe('LEAD_ASSIGNED');
    expect(intent?.title).toContain('Forest Table');
    expect(intent?.target).toEqual({ object: 'lvLead', recordId: 'lead-1' });
    expect(intent?.leadId).toBe('lead-1');
  });

  it('marks a transfer as a reassignment and remembers who lost it', () => {
    const [intent] = forOwnerChange({ previousOwnerWorkspaceMemberId: 'owner-0' });

    expect(intent?.type).toBe('LEAD_REASSIGNED');
    expect(intent?.title).toContain('reassigned');
    expect(intent?.metadata.previousOwnerWorkspaceMemberId).toBe('owner-0');
  });

  it('never notifies the previous owner — they can no longer open the lead', () => {
    const intents = forOwnerChange({ previousOwnerWorkspaceMemberId: 'owner-0' });

    expect(intents.map((intent) => intent.recipientWorkspaceMemberId)).toEqual(['owner-1']);
  });

  it('says who assigned it when a human did, and automatic otherwise', () => {
    expect(forOwnerChange({ assignedByName: 'Tim Apple' })[0]?.body).toContain('Tim Apple');
    expect(forOwnerChange()[0]?.body).toContain('automatically');
  });

  it('emits nothing when the lead is unassigned or the owner did not change', () => {
    expect(forOwnerChange({ newOwnerWorkspaceMemberId: null })).toEqual([]);
    expect(
      forOwnerChange({
        previousOwnerWorkspaceMemberId: 'owner-1',
        newOwnerWorkspaceMemberId: 'owner-1',
      }),
    ).toEqual([]);
  });

  describe('dedupe key', () => {
    it('is identical for a replay of the same event', () => {
      expect(forOwnerChange()[0]?.dedupeKey).toBe(forOwnerChange()[0]?.dedupeKey);
    });

    it('differs when the same person is assigned again later', () => {
      const first = forOwnerChange()[0]?.dedupeKey;
      const later = forOwnerChange({ changedAt: '2026-09-10T10:00:00.000Z' })[0]?.dedupeKey;

      expect(first).not.toBe(later);
    });

    it('distinguishes recipients, leads, and assignment from reassignment', () => {
      expect(forOwnerChange({ newOwnerWorkspaceMemberId: 'owner-2' })[0]?.dedupeKey).not.toBe(
        forOwnerChange()[0]?.dedupeKey,
      );
      expect(forOwnerChange({ leadId: 'lead-2' })[0]?.dedupeKey).not.toBe(
        forOwnerChange()[0]?.dedupeKey,
      );
      expect(
        forOwnerChange({ previousOwnerWorkspaceMemberId: 'owner-0' })[0]?.dedupeKey,
      ).not.toBe(forOwnerChange()[0]?.dedupeKey);
    });
  });

  describe('email', () => {
    it('stays in-app for ordinary work', () => {
      expect(forOwnerChange({ priority: 'MEDIUM' })[0]?.email).toBe(false);
      expect(forOwnerChange({ priority: 'LOW' })[0]?.email).toBe(false);
    });

    it('adds email for urgent leads', () => {
      expect(forOwnerChange({ priority: 'HIGH' })[0]?.email).toBe(true);
      expect(forOwnerChange({ priority: 'CRITICAL' })[0]?.email).toBe(true);
    });
  });
});

describe('email policy', () => {
  it('emails only the high-value types', () => {
    expect(shouldEmail('SLA_BREACH', 'LOW')).toBe(true);
    expect(shouldEmail('ESCALATION', 'LOW')).toBe(true);
    expect(shouldEmail('APPROVAL_REQUIRED', 'LOW')).toBe(true);
    expect(shouldEmail('DOCUMENT_REJECTED', 'LOW')).toBe(true);
  });

  it('never emails the chatter', () => {
    for (const type of [
      'FOLLOW_UP_DUE',
      'FOLLOW_UP_OVERDUE',
      'LEAD_REPLIED',
      'ONBOARDING_STARTED',
      'ONBOARDING_COMPLETED',
      'MENTION',
      'SLA_DUE_SOON',
      'SLA_DUE',
    ] as const) {
      expect(shouldEmail(type, 'CRITICAL')).toBe(false);
    }
  });
});

describe('follow-ups', () => {
  const base = {
    taskId: 'task-1',
    taskTitle: 'Call back',
    leadId: 'lead-1',
    leadName: 'Forest Table',
    assigneeWorkspaceMemberId: 'wm-1',
    dueAt: '2026-09-12T09:00:00.000Z',
    priority: 'MEDIUM' as const,
  };

  it('goes to the assignee and opens the task', () => {
    const intent = buildFollowUpNotification({ ...base, isOverdue: false });

    expect(intent.type).toBe('FOLLOW_UP_DUE');
    expect(intent.recipientWorkspaceMemberId).toBe('wm-1');
    expect(intent.target).toEqual({ object: 'task', recordId: 'task-1' });
    expect(intent.leadId).toBe('lead-1');
    expect(intent.email).toBe(false);
  });

  it('raises an overdue follow-up to at least HIGH', () => {
    expect(buildFollowUpNotification({ ...base, isOverdue: true }).priority).toBe('HIGH');
    expect(
      buildFollowUpNotification({ ...base, priority: 'CRITICAL', isOverdue: true }).priority,
    ).toBe('CRITICAL');
  });

  it('keys on the due time so a reschedule re-reminds but a re-sweep does not', () => {
    const a = buildFollowUpNotification({ ...base, isOverdue: false });
    const again = buildFollowUpNotification({ ...base, isOverdue: false });
    const moved = buildFollowUpNotification({
      ...base,
      dueAt: '2026-09-13T09:00:00.000Z',
      isOverdue: false,
    });

    expect(a.dedupeKey).toBe(again.dedupeKey);
    expect(a.dedupeKey).not.toBe(moved.dedupeKey);
  });

  it('keeps due and overdue as separate notifications for the same task', () => {
    expect(buildFollowUpNotification({ ...base, isOverdue: false }).dedupeKey).not.toBe(
      buildFollowUpNotification({ ...base, isOverdue: true }).dedupeKey,
    );
  });
});

describe('lead reply', () => {
  it('tells the owner, never below HIGH', () => {
    const intent = buildLeadRepliedNotification({
      leadId: 'lead-1',
      leadName: 'Forest Table',
      interactionId: 'int-1',
      channelLabel: 'WhatsApp',
      ownerWorkspaceMemberId: 'owner-1',
      priority: 'LOW',
    });

    expect(intent.type).toBe('LEAD_REPLIED');
    expect(intent.recipientWorkspaceMemberId).toBe('owner-1');
    expect(intent.priority).toBe('HIGH');
    expect(intent.body).toContain('whatsapp');
    expect(intent.dedupeKey).toBe('LEAD_REPLIED:int-1:owner-1');
  });
});

describe('onboarding', () => {
  it('maps the three interrupting statuses and ignores the rest', () => {
    expect(onboardingEventForStatus('INITIATED')).toBe('ONBOARDING_STARTED');
    expect(onboardingEventForStatus('INTERNAL_REVIEW')).toBe('APPROVAL_REQUIRED');
    expect(onboardingEventForStatus('ACTIVATED')).toBe('ONBOARDING_COMPLETED');
    expect(onboardingEventForStatus('IN_PROGRESS')).toBeNull();
    expect(onboardingEventForStatus('REJECTED')).toBeNull();
  });

  const base = {
    onboardingId: 'onb-1',
    onboardingName: 'Forest Table onboarding',
    changedAt: CHANGED_AT,
    reviewerWorkspaceMemberId: 'reviewer-1',
    leadId: 'lead-1',
    leadOwnerWorkspaceMemberId: 'owner-1',
  };

  it('on start, tells the reviewer (onboarding link) and the owner (lead link)', () => {
    const intents = notificationsForOnboardingStatus({ ...base, status: 'INITIATED' });

    expect(intents).toHaveLength(2);
    expect(intents[0]).toMatchObject({
      recipientWorkspaceMemberId: 'reviewer-1',
      target: { object: 'lvOnboarding', recordId: 'onb-1' },
    });
    expect(intents[1]).toMatchObject({
      recipientWorkspaceMemberId: 'owner-1',
      target: { object: 'lvLead', recordId: 'lead-1' },
    });
  });

  it('approval required goes to the reviewer only, with email', () => {
    const intents = notificationsForOnboardingStatus({ ...base, status: 'INTERNAL_REVIEW' });

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: 'APPROVAL_REQUIRED',
      recipientWorkspaceMemberId: 'reviewer-1',
      email: true,
      priority: 'HIGH',
    });
  });

  it('does not tell the owner twice when they are also the reviewer', () => {
    const intents = notificationsForOnboardingStatus({
      ...base,
      status: 'ACTIVATED',
      leadOwnerWorkspaceMemberId: 'reviewer-1',
    });

    expect(intents).toHaveLength(1);
  });

  it('emits nothing for a status that does not interrupt', () => {
    expect(notificationsForOnboardingStatus({ ...base, status: 'IN_PROGRESS' })).toEqual([]);
  });

  it('keys on onboarding, recipient and the change time', () => {
    const [a] = notificationsForOnboardingStatus({ ...base, status: 'INITIATED' });
    const [b] = notificationsForOnboardingStatus({
      ...base,
      status: 'INITIATED',
      changedAt: '2026-09-10T10:00:00.000Z',
    });

    expect(a?.dedupeKey).toContain('onb-1');
    expect(a?.dedupeKey).toContain('reviewer-1');
    expect(a?.dedupeKey).not.toBe(b?.dedupeKey);
  });
});

describe('document rejected', () => {
  const base = {
    documentId: 'doc-1',
    documentLabel: 'Identity proof',
    onboardingId: 'onb-1',
    reason: 'Blurry scan',
    changedAt: CHANGED_AT,
    reviewerWorkspaceMemberId: 'reviewer-1',
    leadId: 'lead-1',
    leadName: 'Forest Table',
    leadOwnerWorkspaceMemberId: 'owner-1',
  };

  it('links each recipient to a record they can open', () => {
    const intents = notificationsForDocumentRejected(base);

    expect(
      intents.map((intent) => [intent.recipientWorkspaceMemberId, intent.target.object]),
    ).toEqual([
      ['reviewer-1', 'lvOnboardingDocument'],
      ['owner-1', 'lvLead'],
    ]);
  });

  it('carries the reason and asks for email', () => {
    const [intent] = notificationsForDocumentRejected(base);

    expect(intent?.body).toContain('Blurry scan');
    expect(intent?.email).toBe(true);
    expect(intent?.priority).toBe('HIGH');
  });

  it('copes with a document that has no onboarding or lead', () => {
    const intents = notificationsForDocumentRejected({
      ...base,
      onboardingId: null,
      leadId: null,
      leadName: null,
      leadOwnerWorkspaceMemberId: null,
    });

    expect(intents).toHaveLength(1);
    expect(intents[0]?.recipientWorkspaceMemberId).toBe('reviewer-1');
  });
});

describe('mention', () => {
  it('opens the note and fires once per note per person', () => {
    const build = () =>
      buildMentionNotification({
        noteId: 'note-1',
        noteTitle: 'Site visit',
        mentionedWorkspaceMemberId: 'wm-2',
        authorName: 'Tim Apple',
        leadId: 'lead-1',
      });

    expect(build().target).toEqual({ object: 'note', recordId: 'note-1' });
    expect(build().title).toContain('Tim Apple');
    expect(build().dedupeKey).toBe('MENTION:note-1:wm-2');
    expect(build().email).toBe(false);
  });
});

describe('SLA breach and escalation (builders for Phase 4B)', () => {
  it('breach goes to the owner with email', () => {
    const intent = buildSlaBreachNotification({
      slaRecordId: 'sla-1',
      ruleLabel: 'New lead contact',
      ownerWorkspaceMemberId: 'owner-1',
      target: { object: 'lvLead', recordId: 'lead-1' },
      leadId: 'lead-1',
      subjectName: 'Forest Table',
      dueAt: '2026-09-10T10:00:00.000Z',
      priority: 'HIGH',
    });

    expect(intent.type).toBe('SLA_BREACH');
    expect(intent.email).toBe(true);
    expect(intent.dedupeKey).toBe('SLA_BREACH:sla-1:owner-1');
  });

  it('escalation goes to the manager as CRITICAL with email', () => {
    const intent = buildEscalationNotification({
      slaRecordId: 'sla-1',
      ruleLabel: 'New lead contact',
      managerWorkspaceMemberId: 'mgr-1',
      ownerName: 'Tim Apple',
      target: { object: 'lvLead', recordId: 'lead-1' },
      leadId: 'lead-1',
      subjectName: 'Forest Table',
      dueAt: '2026-09-10T10:00:00.000Z',
    });

    expect(intent.type).toBe('ESCALATION');
    expect(intent.priority).toBe('CRITICAL');
    expect(intent.email).toBe(true);
    expect(intent.body).toContain('Tim Apple');
    expect(intent.dedupeKey).toBe('ESCALATION:sla-1:mgr-1');
  });
});
