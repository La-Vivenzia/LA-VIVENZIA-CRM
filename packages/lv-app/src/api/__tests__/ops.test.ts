import { describe, expect, it } from 'vitest';

import {
  AUDIT_OUTCOMES,
  CONTROL_TOWER_GROUPS,
  EMPTY_AUDIT_FILTERS,
  matchesAudit,
  opsLinkFor,
  SLA_BOARD_COLUMNS,
  SLA_STATUS_LABELS,
  SLA_STATUS_TONE,
  SLA_STATUSES,
  type AuditEvent,
} from 'src/api/ops';

// The leadership screens compute almost nothing — that is the point. What they
// do decide is which bucket a row belongs in, where a record opens, and what a
// filter means, and those are the things worth pinning down.

describe('SLA vocabulary', () => {
  it('names and tones every status the backend can store', () => {
    for (const status of SLA_STATUSES) {
      expect(SLA_STATUS_LABELS[status], `${status} has no label`).toBeTruthy();
      expect(SLA_STATUS_TONE[status], `${status} has no tone`).toBeTruthy();
    }
  });

  it('boards the open clocks and leaves resolved out', () => {
    // A board is what is still running; resolved work is counted, not columned.
    expect(SLA_BOARD_COLUMNS).toEqual(['ON_TRACK', 'DUE_SOON', 'DUE', 'BREACHED', 'ESCALATED']);
    expect(SLA_BOARD_COLUMNS).not.toContain('RESOLVED');
  });

  it('treats breached and escalated as the same severity', () => {
    expect(SLA_STATUS_TONE.BREACHED).toBe('danger');
    expect(SLA_STATUS_TONE.ESCALATED).toBe('danger');
  });
});

describe('CONTROL_TOWER_GROUPS', () => {
  it('names each section exactly once across the groups', () => {
    const all = CONTROL_TOWER_GROUPS.flatMap((group) => group.sections);

    expect(new Set(all).size).toBe(all.length);
  });

  it('puts the breach and overdue lists in Critical', () => {
    const critical = CONTROL_TOWER_GROUPS.find((group) => group.key === 'critical');

    expect(critical?.tone).toBe('danger');
    expect(critical?.sections).toContain('breached');
    expect(critical?.sections).toContain('overdue');
  });
});

describe('opsLinkFor', () => {
  it('opens the objects this application has a screen for', () => {
    expect(opsLinkFor('lvLead', 'abc')).toBe('/leads/abc');
    expect(opsLinkFor('lead', 'abc')).toBe('/leads/abc');
    expect(opsLinkFor('lvOnboarding', 'abc')).toBe('/onboarding/abc');
    expect(opsLinkFor('lvPartner', 'abc')).toBe('/ecosystem/partners/abc');
  });

  it('refuses to invent a route for anything else', () => {
    // An audit row can target a task or a note; neither has a screen of its own,
    // so the row is named and left alone rather than linked into a 404.
    expect(opsLinkFor('task', 'abc')).toBeNull();
    expect(opsLinkFor('note', 'abc')).toBeNull();
    expect(opsLinkFor('lvLead', null)).toBeNull();
    expect(opsLinkFor(null, 'abc')).toBeNull();
  });
});

describe('matchesAudit', () => {
  const event: AuditEvent = {
    id: 'a1',
    name: 'TASK_COMPLETED · Phase 11 verification',
    action: 'TASK_COMPLETED',
    outcome: 'APPLIED',
    targetObject: 'task',
    targetRecordId: 'f7a2',
    targetLabel: 'Phase 11 verification — safe to delete',
    at: '2026-10-01T13:26:41.526Z',
    reason: null,
    actorName: 'LV Test',
  };

  it('passes everything when nothing is filtered', () => {
    expect(matchesAudit(event, EMPTY_AUDIT_FILTERS)).toBe(true);
  });

  it('filters by action and outcome', () => {
    expect(matchesAudit(event, { ...EMPTY_AUDIT_FILTERS, action: 'TASK_COMPLETED' })).toBe(true);
    expect(matchesAudit(event, { ...EMPTY_AUDIT_FILTERS, action: 'LEAD_CREATED' })).toBe(false);
    expect(matchesAudit(event, { ...EMPTY_AUDIT_FILTERS, outcome: 'APPLIED' })).toBe(true);
    expect(matchesAudit(event, { ...EMPTY_AUDIT_FILTERS, outcome: 'REFUSED' })).toBe(false);
  });

  it('searches the target, the actor and the reason', () => {
    expect(matchesAudit(event, { ...EMPTY_AUDIT_FILTERS, query: 'safe to delete' })).toBe(true);
    expect(matchesAudit(event, { ...EMPTY_AUDIT_FILTERS, query: 'LV Test' })).toBe(true);
    expect(matchesAudit(event, { ...EMPTY_AUDIT_FILTERS, query: 'onboarding' })).toBe(false);
  });

  it('keeps refusals and failures findable', () => {
    // An audit trail that only shows what succeeded is not an audit trail.
    const refused: AuditEvent = { ...event, id: 'a2', outcome: 'REFUSED', reason: 'Not yours to work' };

    expect(AUDIT_OUTCOMES).toContain('REFUSED');
    expect(matchesAudit(refused, { ...EMPTY_AUDIT_FILTERS, outcome: 'REFUSED' })).toBe(true);
    expect(matchesAudit(refused, { ...EMPTY_AUDIT_FILTERS, query: 'not yours' })).toBe(true);
  });
});
