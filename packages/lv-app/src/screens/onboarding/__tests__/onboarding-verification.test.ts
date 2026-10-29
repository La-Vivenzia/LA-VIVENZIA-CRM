import { describe, expect, it } from 'vitest';

import type { OnboardingSummary } from 'src/api/onboarding';
import { PREDEFINED_REJECTION_REASONS } from 'src/design/onboarding';
import { ALL_FILTERS, COUNTER_FILTERS, TAB_FILTERS } from 'src/screens/OnboardingScreen';

const makeSummary = (overrides: Partial<OnboardingSummary> = {}): OnboardingSummary => ({
  id: 'ob-1',
  name: 'Test Partner',
  status: 'IN_PROGRESS',
  currentStep: 'BASIC_INFORMATION',
  progressPercentage: 40,
  healthScore: 60,
  submittedAt: null,
  updatedAt: new Date().toISOString(),
  reviewerId: null,
  reviewerName: null,
  leadId: 'lead-1',
  leadName: 'Test Lead',
  leadLocation: 'Pune, Amanora Town Centre',
  documentCount: 2,
  verifiedCount: 1,
  blockedCount: 0,
  ...overrides,
});

describe('Partner document verification rejection reasons', () => {
  it('supplies the exact predefined rejection reasons for partner documents', () => {
    expect(PREDEFINED_REJECTION_REASONS).toEqual([
      'Document blurred / illegible / cut off',
      'FSSAI / Business license expired',
      'Address does not match Pune pilot corridor (Amanora/Hadapsar)',
      'Bank passbook/cheque missing account number or IFSC',
    ]);
  });
});

describe('Pune corridor immediate client-side filters', () => {
  it('includes all required corridor filters in the segmented tab list', () => {
    const keys = TAB_FILTERS.map((f) => f.key);
    expect(keys).toContain('ALL');
    expect(keys).toContain('AMANORA');
    expect(keys).toContain('SEASONS');
    expect(keys).toContain('MAGARPATTA');
    expect(keys).toContain('HADAPSAR');
  });

  it('filters by Pune corridor locations case-insensitively', () => {
    const amanoraFilter = TAB_FILTERS.find((f) => f.key === 'AMANORA')!;
    const seasonsFilter = TAB_FILTERS.find((f) => f.key === 'SEASONS')!;
    const magarpattaFilter = TAB_FILTERS.find((f) => f.key === 'MAGARPATTA')!;
    const hadapsarFilter = TAB_FILTERS.find((f) => f.key === 'HADAPSAR')!;

    expect(amanoraFilter.matches(makeSummary({ leadLocation: 'Amanora Park Town, Pune' }), null)).toBe(true);
    expect(amanoraFilter.matches(makeSummary({ leadLocation: 'Koregaon Park' }), null)).toBe(false);

    expect(seasonsFilter.matches(makeSummary({ leadLocation: 'Near Seasons Mall, Magarpatta City' }), null)).toBe(true);
    expect(magarpattaFilter.matches(makeSummary({ leadLocation: 'Cybercity Magarpatta' }), null)).toBe(true);
    expect(hadapsarFilter.matches(makeSummary({ leadLocation: 'Hadapsar Industrial Estate' }), null)).toBe(true);
  });
});

describe('Onboarding status counters and filtering', () => {
  it('provides the required status counter keys without polluting segmented tabs', () => {
    const counterKeys = COUNTER_FILTERS.map((f) => f.key);
    expect(counterKeys).toEqual(['IN_PROGRESS', 'VERIFICATION', 'APPROVED']);

    // Segmented tab list should not contain counter-only keys
    const tabKeys = TAB_FILTERS.map((f) => f.key);
    for (const key of counterKeys) {
      expect(tabKeys).not.toContain(key);
    }
  });

  it('correctly matches In Progress onboarding statuses', () => {
    const inProgressFilter = ALL_FILTERS.find((f) => f.key === 'IN_PROGRESS')!;
    expect(inProgressFilter.matches(makeSummary({ status: 'IN_PROGRESS' }), null)).toBe(true);
    expect(inProgressFilter.matches(makeSummary({ status: 'INITIATED' }), null)).toBe(true);
    expect(inProgressFilter.matches(makeSummary({ status: 'WAITING_FOR_PARTNER' }), null)).toBe(true);
    expect(inProgressFilter.matches(makeSummary({ status: 'CHANGES_REQUESTED' }), null)).toBe(true);

    expect(inProgressFilter.matches(makeSummary({ status: 'VERIFICATION' }), null)).toBe(false);
    expect(inProgressFilter.matches(makeSummary({ status: 'APPROVED' }), null)).toBe(false);
  });

  it('correctly matches Under Verification onboarding statuses', () => {
    const verificationFilter = ALL_FILTERS.find((f) => f.key === 'VERIFICATION')!;
    expect(verificationFilter.matches(makeSummary({ status: 'VERIFICATION' }), null)).toBe(true);
    expect(verificationFilter.matches(makeSummary({ status: 'INTERNAL_REVIEW' }), null)).toBe(true);

    expect(verificationFilter.matches(makeSummary({ status: 'IN_PROGRESS' }), null)).toBe(false);
    expect(verificationFilter.matches(makeSummary({ status: 'APPROVED' }), null)).toBe(false);
  });

  it('correctly matches Approved onboarding statuses', () => {
    const approvedFilter = ALL_FILTERS.find((f) => f.key === 'APPROVED')!;
    expect(approvedFilter.matches(makeSummary({ status: 'APPROVED' }), null)).toBe(true);
    expect(approvedFilter.matches(makeSummary({ status: 'ACTIVATED' }), null)).toBe(true);

    expect(approvedFilter.matches(makeSummary({ status: 'VERIFICATION' }), null)).toBe(false);
    expect(approvedFilter.matches(makeSummary({ status: 'IN_PROGRESS' }), null)).toBe(false);
  });
});
