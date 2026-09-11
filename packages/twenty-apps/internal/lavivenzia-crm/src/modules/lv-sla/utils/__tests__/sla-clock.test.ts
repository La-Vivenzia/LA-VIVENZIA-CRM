import { describe, expect, it } from 'vitest';

import { SLA_RULES } from 'src/modules/lv-sla/constants/sla-rules';
import { clockStateAt, hoursUntil, scheduleFor } from 'src/modules/lv-sla/utils/sla-clock';
import {
  entersInterested,
  entersMissingDocument,
  entersNewLeadContact,
  entersOnboardingInitiated,
  isActionableNewLeadStatus,
} from 'src/modules/lv-sla/utils/sla-triggers';

const T0 = '2026-09-10T08:00:00.000Z';
const plus = (hours: number) => new Date(Date.parse(T0) + hours * 3_600_000).toISOString();

describe('scheduleFor', () => {
  it('24h rule: due soon at 18h, due at 24h, breached at 25h', () => {
    expect(scheduleFor({ rule: 'NEW_LEAD_CONTACT', startedAt: T0 })).toEqual({
      startedAt: T0,
      dueSoonAt: plus(18),
      dueAt: plus(24),
      breachAt: plus(25),
    });
    expect(scheduleFor({ rule: 'ONBOARDING_FIRST_ACTION', startedAt: T0 }).dueAt).toBe(plus(24));
  });

  it('48h rule: due soon at 36h, due at 48h, breached at 49h', () => {
    expect(scheduleFor({ rule: 'INTERESTED_FOLLOW_UP', startedAt: T0 })).toEqual({
      startedAt: T0,
      dueSoonAt: plus(36),
      dueAt: plus(48),
      breachAt: plus(49),
    });
    expect(scheduleFor({ rule: 'MISSING_DOCUMENT', startedAt: T0 }).dueSoonAt).toBe(plus(36));
  });

  it('is timezone-safe: an offset timestamp is normalised to the same UTC instant', () => {
    const utc = scheduleFor({ rule: 'NEW_LEAD_CONTACT', startedAt: '2026-09-10T08:00:00.000Z' });
    const ist = scheduleFor({ rule: 'NEW_LEAD_CONTACT', startedAt: '2026-09-10T13:30:00.000+05:30' });

    expect(ist).toEqual(utc);
    expect(utc.dueAt.endsWith('Z')).toBe(true);
  });

  it('is deterministic — the same input always gives the same schedule', () => {
    for (const rule of SLA_RULES) {
      expect(scheduleFor({ rule, startedAt: T0 })).toEqual(scheduleFor({ rule, startedAt: T0 }));
    }
  });

  it('refuses garbage rather than scheduling nonsense', () => {
    expect(() => scheduleFor({ rule: 'NEW_LEAD_CONTACT', startedAt: 'yesterday' })).toThrow();
  });
});

describe('clockStateAt — time travel over the 24h rule', () => {
  const schedule = scheduleFor({ rule: 'NEW_LEAD_CONTACT', startedAt: T0 });
  const at = (hours: number) => clockStateAt({ schedule, now: plus(hours) });

  it('walks ON_TRACK → DUE_SOON → DUE → BREACHED at the documented moments', () => {
    expect(at(0)).toBe('ON_TRACK');
    expect(at(10)).toBe('ON_TRACK');
    expect(at(17.99)).toBe('ON_TRACK');
    expect(at(18)).toBe('DUE_SOON');
    expect(at(23.99)).toBe('DUE_SOON');
    expect(at(24)).toBe('DUE');
    expect(at(24.99)).toBe('DUE');
    expect(at(25)).toBe('BREACHED');
    expect(at(240)).toBe('BREACHED');
  });
});

describe('clockStateAt — time travel over the 48h rule', () => {
  const schedule = scheduleFor({ rule: 'MISSING_DOCUMENT', startedAt: T0 });
  const at = (hours: number) => clockStateAt({ schedule, now: plus(hours) });

  it('walks the same states at 36h / 48h / 49h', () => {
    expect(at(35.99)).toBe('ON_TRACK');
    expect(at(36)).toBe('DUE_SOON');
    expect(at(48)).toBe('DUE');
    expect(at(49)).toBe('BREACHED');
  });
});

describe('hoursUntil', () => {
  it('counts down and goes negative once overdue', () => {
    expect(hoursUntil(plus(24), plus(10))).toBe(14);
    expect(hoursUntil(plus(24), plus(30))).toBe(-6);
  });
});

describe('triggers', () => {
  it('rule 1 starts for an actionable new lead, not a preliminary capture', () => {
    expect(isActionableNewLeadStatus('NEW')).toBe(true);
    expect(isActionableNewLeadStatus('ASSIGNED')).toBe(true);
    expect(isActionableNewLeadStatus('DISCOVERED')).toBe(false);
    expect(isActionableNewLeadStatus('CONTACTED')).toBe(false);
    expect(entersNewLeadContact('DISCOVERED', 'NEW')).toBe(true);
    expect(entersNewLeadContact(null, 'NEW')).toBe(true);
    expect(entersNewLeadContact('NEW', 'ASSIGNED')).toBe(false);
    expect(entersNewLeadContact('CONTACTED', 'NEW')).toBe(false);
  });

  it('rule 2 starts on entering INTERESTED only', () => {
    expect(entersInterested('ENGAGED', 'INTERESTED')).toBe(true);
    expect(entersInterested('INTERESTED', 'INTERESTED')).toBe(false);
    expect(entersInterested('INTERESTED', 'NEGOTIATION')).toBe(false);
  });

  it('rule 3 starts on INITIATED only', () => {
    expect(entersOnboardingInitiated('INVITED', 'INITIATED')).toBe(true);
    expect(entersOnboardingInitiated('INITIATED', 'IN_PROGRESS')).toBe(false);
  });

  it('rule 4 starts when a document needs obtaining again', () => {
    expect(entersMissingDocument('UNDER_REVIEW', 'REJECTED')).toBe(true);
    expect(entersMissingDocument('VERIFIED', 'NEEDS_REPLACEMENT')).toBe(true);
    expect(entersMissingDocument('VERIFIED', 'EXPIRED')).toBe(true);
    expect(entersMissingDocument('REJECTED', 'NEEDS_REPLACEMENT')).toBe(false);
    expect(entersMissingDocument('REJECTED', 'PENDING')).toBe(false);
  });
});
