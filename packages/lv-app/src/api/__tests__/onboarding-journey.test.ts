import { describe, expect, it } from 'vitest';

import {
  HUMAN_ONLY_TRANSITIONS,
  ONBOARDING_JOURNEY,
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUSES,
  ONBOARDING_TRANSITIONS,
  PARTNER_EDITABLE,
  REASON_REQUIRED_TRANSITIONS,
  stageOf,
  TRANSITION_COPY,
  UNDER_REVIEW,
  type OnboardingStatus,
  type OnboardingSummary,
} from 'src/api/onboarding';
import { STATUS_TONE } from 'src/screens/onboarding/parts';

// Tests for the Pune Pilot CRM Task 2 five-stage onboarding journey taxonomy.
//
// Verifies the exact five-stage visual mapping, 11 machine status mappings,
// transition invariants, queue filtering/sorting alignment, and human guards.

describe('Five-Stage Onboarding Journey Taxonomy', () => {
  it('defines exactly five visual stages in ONBOARDING_JOURNEY', () => {
    expect(ONBOARDING_JOURNEY).toHaveLength(5);
  });

  it('declares the expected stage keys in linear progression order', () => {
    const keys = ONBOARDING_JOURNEY.map((stage) => stage.key);
    expect(keys).toEqual(['invite', 'partner', 'review', 'approved', 'live']);
  });

  it('declares the exact Option A visual labels in order', () => {
    const labels = ONBOARDING_JOURNEY.map((stage) => stage.label);
    expect(labels).toEqual(['Invited', 'With Partner', 'Under Review', 'Approved', 'Live']);
  });

  it('provides a meaningful descriptive explanation for every stage', () => {
    for (const stage of ONBOARDING_JOURNEY) {
      expect(stage.meaning.trim().length).toBeGreaterThan(15);
      expect(stage.label.trim().length).toBeGreaterThan(0);
      expect(stage.statuses.length).toBeGreaterThan(0);
    }
  });
});

describe('11 Machine Status to 5 Visual Stage Mappings (stageOf)', () => {
  it('maps NOT_STARTED and INVITED to stage 0 (invite)', () => {
    expect(stageOf('NOT_STARTED')).toBe(0);
    expect(stageOf('INVITED')).toBe(0);
    expect(ONBOARDING_JOURNEY[0].key).toBe('invite');
    expect(ONBOARDING_JOURNEY[0].label).toBe('Invited');
  });

  it('maps partner editable statuses to stage 1 (partner)', () => {
    const partnerStatuses: OnboardingStatus[] = ['INITIATED', 'IN_PROGRESS', 'WAITING_FOR_PARTNER', 'CHANGES_REQUESTED'];
    for (const status of partnerStatuses) {
      expect(stageOf(status)).toBe(1);
    }
    expect(ONBOARDING_JOURNEY[1].key).toBe('partner');
    expect(ONBOARDING_JOURNEY[1].label).toBe('With Partner');
  });

  it('maps VERIFICATION and INTERNAL_REVIEW to the same stage 2 (review)', () => {
    expect(stageOf('VERIFICATION')).toBe(2);
    expect(stageOf('INTERNAL_REVIEW')).toBe(2);
    expect(stageOf('VERIFICATION')).toBe(stageOf('INTERNAL_REVIEW'));
    expect(ONBOARDING_JOURNEY[2].key).toBe('review');
    expect(ONBOARDING_JOURNEY[2].label).toBe('Under Review');
  });

  it('maps APPROVED and ACTIVATED to distinct stages 3 and 4', () => {
    expect(stageOf('APPROVED')).toBe(3);
    expect(stageOf('ACTIVATED')).toBe(4);
    expect(stageOf('APPROVED')).not.toBe(stageOf('ACTIVATED'));
    expect(ONBOARDING_JOURNEY[3].key).toBe('approved');
    expect(ONBOARDING_JOURNEY[3].label).toBe('Approved');
    expect(ONBOARDING_JOURNEY[4].key).toBe('live');
    expect(ONBOARDING_JOURNEY[4].label).toBe('Live');
  });

  it('excludes REJECTED from the linear stages (-1) to preserve re-application handling', () => {
    expect(stageOf('REJECTED')).toBe(-1);
    for (const stage of ONBOARDING_JOURNEY) {
      expect(stage.statuses).not.toContain('REJECTED');
    }
  });

  it('accounts for all 11 machine statuses without any undefined mapping', () => {
    expect(ONBOARDING_STATUSES).toHaveLength(11);
    for (const status of ONBOARDING_STATUSES) {
      const idx = stageOf(status);
      if (status === 'REJECTED') {
        expect(idx).toBe(-1);
      } else {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(5);
        expect(ONBOARDING_JOURNEY[idx].statuses).toContain(status);
      }
      expect(ONBOARDING_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe('Domain Groupings and Boundaries', () => {
  it('maintains UNDER_REVIEW as VERIFICATION and INTERNAL_REVIEW', () => {
    expect(UNDER_REVIEW).toEqual(['VERIFICATION', 'INTERNAL_REVIEW']);
    for (const status of UNDER_REVIEW) {
      expect(stageOf(status)).toBe(2);
    }
  });

  it('maintains PARTNER_EDITABLE as the four active form editing statuses', () => {
    expect(PARTNER_EDITABLE).toEqual(['INITIATED', 'IN_PROGRESS', 'WAITING_FOR_PARTNER', 'CHANGES_REQUESTED']);
    for (const status of PARTNER_EDITABLE) {
      expect(stageOf(status)).toBe(1);
    }
  });
});

describe('Queue Sorting and Filtering Consistency', () => {
  const makeSummary = (id: string, status: OnboardingStatus, updatedAt: string): OnboardingSummary => ({
    id,
    name: `Partner ${id}`,
    status,
    currentStep: null,
    progressPercentage: 50,
    healthScore: 70,
    submittedAt: null,
    updatedAt,
    reviewerId: null,
    reviewerName: null,
    leadId: null,
    leadName: null,
    leadLocation: 'Koregaon Park, Pune',
    documentCount: 2,
    verifiedCount: 1,
    blockedCount: 0,
  });

  it('sorts queue rows by stage index order then by updatedAt descending', () => {
    const rows: OnboardingSummary[] = [
      makeSummary('1', 'ACTIVATED', '2026-10-27T10:00:00Z'),
      makeSummary('2', 'INVITED', '2026-10-27T12:00:00Z'),
      makeSummary('3', 'INTERNAL_REVIEW', '2026-10-27T11:00:00Z'),
      makeSummary('4', 'VERIFICATION', '2026-10-27T14:00:00Z'),
      makeSummary('5', 'IN_PROGRESS', '2026-10-27T09:00:00Z'),
      makeSummary('6', 'APPROVED', '2026-10-27T08:00:00Z'),
    ];

    const sorted = rows.slice().sort((left, right) =>
      stageOf(left.status) - stageOf(right.status) || Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? '')
    );

    const sortedIds = sorted.map((row) => row.id);
    // Stage 0: 2 (INVITED)
    // Stage 1: 5 (IN_PROGRESS)
    // Stage 2: 4 (VERIFICATION, updated 14:00), 3 (INTERNAL_REVIEW, updated 11:00)
    // Stage 3: 6 (APPROVED)
    // Stage 4: 1 (ACTIVATED)
    expect(sortedIds).toEqual(['2', '5', '4', '3', '6', '1']);
  });

  it('filters with-partner rows correctly matching ONBOARDING_JOURNEY[1].statuses', () => {
    const statuses = ONBOARDING_JOURNEY[1].statuses;
    expect(statuses.includes('IN_PROGRESS')).toBe(true);
    expect(statuses.includes('WAITING_FOR_PARTNER')).toBe(true);
    expect(statuses.includes('CHANGES_REQUESTED')).toBe(true);
    expect(statuses.includes('INITIATED')).toBe(true);
    expect(statuses.includes('VERIFICATION')).toBe(false);
    expect(statuses.includes('APPROVED')).toBe(false);
  });
});

describe('Transition Safety & Guardrails Invariants', () => {
  it('preserves all transition entries in ONBOARDING_TRANSITIONS', () => {
    for (const status of ONBOARDING_STATUSES) {
      expect(Array.isArray(ONBOARDING_TRANSITIONS[status])).toBe(true);
    }
  });

  it('allows REJECTED records to reapply by transitioning to IN_PROGRESS', () => {
    expect(ONBOARDING_TRANSITIONS.REJECTED).toEqual(['IN_PROGRESS']);
  });

  it('marks ACTIVATED as terminal with zero outgoing transitions', () => {
    expect(ONBOARDING_TRANSITIONS.ACTIVATED).toEqual([]);
  });

  it('enforces mandatory reasons on REJECTED and CHANGES_REQUESTED', () => {
    expect(REASON_REQUIRED_TRANSITIONS).toContain('REJECTED');
    expect(REASON_REQUIRED_TRANSITIONS).toContain('CHANGES_REQUESTED');
  });

  it('restricts governance transitions to human actors only', () => {
    expect(HUMAN_ONLY_TRANSITIONS).toEqual(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'ACTIVATED']);
  });
});

describe('Defensive Edge Cases & Status Invariants', () => {
  it('returns -1 for unknown, unexpected or malformed status strings without throwing', () => {
    expect(stageOf('UNKNOWN_STATUS' as OnboardingStatus)).toBe(-1);
    expect(stageOf('' as OnboardingStatus)).toBe(-1);
    expect(stageOf('INVALID' as OnboardingStatus)).toBe(-1);
  });

  it('provides comprehensive TRANSITION_COPY for all 11 machine statuses', () => {
    for (const status of ONBOARDING_STATUSES) {
      const copy = TRANSITION_COPY[status];
      expect(copy, `Missing TRANSITION_COPY for ${status}`).toBeDefined();
      expect(copy.verb.trim().length).toBeGreaterThan(0);
      expect(copy.consequence.trim().length).toBeGreaterThan(0);
    }
  });

  it('provides a defined STATUS_TONE for all 11 machine statuses', () => {
    for (const status of ONBOARDING_STATUSES) {
      const tone = STATUS_TONE[status];
      expect(tone, `Missing STATUS_TONE for ${status}`).toBeDefined();
      expect(['neutral', 'info', 'warning', 'success', 'danger']).toContain(tone);
    }
  });
});
