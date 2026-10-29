import { describe, expect, it, vi } from 'vitest';

import {
  type OnboardingDocument,
  type OnboardingRecord,
  type OnboardingStatus,
} from 'src/api/onboarding';
import { journeyStepsFor } from 'src/screens/onboarding/parts';

// Tests for the five-stage onboarding journey tracker rendered in OnboardingRecordScreen.
//
// Verifies visual step states (done, current, blocked, todo), blocker propagation,
// stage detail copy, blocker action wiring, and REJECTED handling.

const makeDocument = (overrides: Partial<OnboardingDocument> = {}): OnboardingDocument => ({
  id: 'doc-1',
  name: 'Aadhaar Card',
  documentType: 'IDENTITY',
  verificationState: 'PENDING',
  expiresAt: null,
  rejectionReason: null,
  verificationFlags: [],
  originalFilename: 'aadhaar.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 102400,
  uploadedAt: '2026-10-27T10:00:00Z',
  verifiedAt: null,
  reviewerId: null,
  reviewerName: null,
  fileUrl: null,
  auditTrail: [],
  ...overrides,
});

const makeRecord = (overrides: Partial<OnboardingRecord> = {}): OnboardingRecord => ({
  id: 'onb-1',
  name: 'The Villa Koregaon',
  status: 'NOT_STARTED',
  currentStep: 'BASIC_INFORMATION',
  progressPercentage: 20,
  healthScore: 80,
  answers: {},
  decisionReason: null,
  internalNotes: null,
  auditTrail: [],
  invitedAt: '2026-10-27T10:00:00Z',
  submittedAt: null,
  decidedAt: null,
  activatedAt: null,
  createdAt: '2026-10-27T09:00:00Z',
  updatedAt: '2026-10-27T10:00:00Z',
  reviewerId: null,
  reviewerName: null,
  leadId: 'lead-1',
  leadName: 'Lead 1',
  leadCategory: 'STAY',
  leadLocation: 'Koregaon Park, Pune',
  documents: [],
  ...overrides,
});

describe('journeyStepsFor: Five-Stage Stepper Structure', () => {
  it('always produces exactly five visual steps', () => {
    const record = makeRecord({ status: 'INVITED' });
    const steps = journeyStepsFor(record);

    expect(steps).toHaveLength(5);
  });

  it('assigns the exact keys and labels in linear order', () => {
    const record = makeRecord({ status: 'NOT_STARTED' });
    const steps = journeyStepsFor(record);

    expect(steps.map((s) => s.key)).toEqual(['invite', 'partner', 'review', 'approved', 'live']);
    expect(steps.map((s) => s.label)).toEqual(['Invited', 'With Partner', 'Under Review', 'Approved', 'Live']);
  });
});

describe('journeyStepsFor: Visual State Progression Across Lifecycles', () => {
  it('renders stage 0 as current and subsequent as todo for NOT_STARTED and INVITED', () => {
    for (const status of ['NOT_STARTED', 'INVITED'] as const) {
      const record = makeRecord({ status });
      const steps = journeyStepsFor(record);

      expect(steps[0].state).toBe('current');
      expect(steps[1].state).toBe('todo');
      expect(steps[2].state).toBe('todo');
      expect(steps[3].state).toBe('todo');
      expect(steps[4].state).toBe('todo');
    }
  });

  it('renders stage 0 as done, stage 1 as current, and remaining as todo for partner statuses without blockers', () => {
    const partnerStatuses: OnboardingStatus[] = ['INITIATED', 'IN_PROGRESS', 'WAITING_FOR_PARTNER', 'CHANGES_REQUESTED'];

    for (const status of partnerStatuses) {
      // In these statuses without missing answer blockers, stage 1 is current
      const record = makeRecord({ status, answers: { BASIC_INFORMATION: { legalName: 'Valid' } } });
      const steps = journeyStepsFor(record);

      expect(steps[0].state).toBe('done');
      // When at partner stage, partner editable blocker kind 'PARTNER' is ignored for stopping
      expect(['current', 'blocked']).toContain(steps[1].state);
      expect(steps[2].state).toBe('todo');
      expect(steps[3].state).toBe('todo');
      expect(steps[4].state).toBe('todo');
    }
  });

  it('renders stage 0 and 1 as done, stage 2 (Under Review) as active for VERIFICATION', () => {
    const record = makeRecord({ status: 'VERIFICATION' });
    const steps = journeyStepsFor(record);

    expect(steps[0].state).toBe('done');
    expect(steps[1].state).toBe('done');
    expect(steps[2].state).toBe('current');
    expect(steps[3].state).toBe('todo');
    expect(steps[4].state).toBe('todo');
  });

  it('renders stage 2 as blocked when stopping blockers exist during INTERNAL_REVIEW', () => {
    const onOpen = vi.fn();
    // In INTERNAL_REVIEW, transition to APPROVED checks for reviewer and verified documents
    const record = makeRecord({
      status: 'INTERNAL_REVIEW',
      reviewerId: null, // Blocker: missing reviewer
      documents: [makeDocument({ verificationState: 'PENDING' })], // Blocker: unverified document
    });

    const steps = journeyStepsFor(record, onOpen);

    expect(steps[0].state).toBe('done');
    expect(steps[1].state).toBe('done');
    expect(steps[2].state).toBe('blocked');
    expect(steps[2].detail).toBeTruthy();
    expect(steps[2].onOpen).toBeDefined();

    // Trigger blocker link
    steps[2].onOpen?.();
    expect(onOpen).toHaveBeenCalledTimes(1);

    expect(steps[3].state).toBe('todo');
    expect(steps[4].state).toBe('todo');
  });

  it('renders stage 2 as current when all review blockers are satisfied during INTERNAL_REVIEW', () => {
    const record = makeRecord({
      status: 'INTERNAL_REVIEW',
      reviewerId: 'rev-001',
      reviewerName: 'Karan Reviewer',
      documents: [makeDocument({ verificationState: 'VERIFIED' })],
    });

    const steps = journeyStepsFor(record);

    expect(steps[0].state).toBe('done');
    expect(steps[1].state).toBe('done');
    expect(steps[2].state).toBe('current');
    expect(steps[2].detail).toBe('Submitted and locked. Verification and internal review in progress.');
    expect(steps[2].onOpen).toBeUndefined();
    expect(steps[3].state).toBe('todo');
    expect(steps[4].state).toBe('todo');
  });

  it('renders stages 0-2 as done, stage 3 as current, and stage 4 as todo for APPROVED', () => {
    const record = makeRecord({ status: 'APPROVED' });
    const steps = journeyStepsFor(record);

    expect(steps[0].state).toBe('done');
    expect(steps[1].state).toBe('done');
    expect(steps[2].state).toBe('done');
    expect(steps[3].state).toBe('current');
    expect(steps[4].state).toBe('todo');
  });

  it('renders stages 0-3 as done and stage 4 as current for ACTIVATED', () => {
    const record = makeRecord({ status: 'ACTIVATED' });
    const steps = journeyStepsFor(record);

    expect(steps[0].state).toBe('done');
    expect(steps[1].state).toBe('done');
    expect(steps[2].state).toBe('done');
    expect(steps[3].state).toBe('done');
    expect(steps[4].state).toBe('current');
  });

  it('leaves all stages in todo and marks none as done/current/blocked for REJECTED', () => {
    const record = makeRecord({
      status: 'REJECTED',
      decisionReason: 'Missing requisite hospitality credentials',
      decidedAt: '2026-10-27T12:00:00Z',
    });

    const steps = journeyStepsFor(record);

    for (const step of steps) {
      expect(step.state).toBe('todo');
      expect(step.state).not.toBe('done');
      expect(step.state).not.toBe('current');
      expect(step.state).not.toBe('blocked');
    }
  });

  it('handles multiple simultaneous blockers by prioritizing the first stopping blocker', () => {
    const record = makeRecord({
      status: 'INTERNAL_REVIEW',
      reviewerId: null, // First blocker: missing reviewer
      documents: [
        makeDocument({ id: 'd1', verificationState: 'PENDING' }), // Second blocker
        makeDocument({ id: 'd2', verificationState: 'REJECTED' }), // Third blocker
      ],
    });

    const steps = journeyStepsFor(record);
    expect(steps[2].state).toBe('blocked');
    expect(steps[2].detail).toBe('No reviewer is named on this onboarding.');
  });

  it('safely handles absent optional record fields and nulls without throwing', () => {
    const minimalRecord = makeRecord({
      name: null,
      status: 'INTERNAL_REVIEW',
      reviewerId: null,
      reviewerName: null,
      decisionReason: null,
      decidedAt: null,
      documents: [],
    });

    const steps = journeyStepsFor(minimalRecord);
    expect(steps).toHaveLength(5);
    expect(steps[2].state).toBe('blocked');
  });

  it('leaves step.onOpen undefined when onOpenBlockers callback is omitted', () => {
    const record = makeRecord({
      status: 'INTERNAL_REVIEW',
      reviewerId: null,
      documents: [],
    });

    // Invoke without the optional callback
    const steps = journeyStepsFor(record);
    expect(steps[2].state).toBe('blocked');
    expect(steps[2].onOpen).toBeUndefined();
  });

  it('safely renders all stages in todo when an unrecognised status is provided', () => {
    const record = makeRecord({
      status: 'NON_EXISTENT_STATUS' as OnboardingStatus,
    });

    const steps = journeyStepsFor(record);
    expect(steps).toHaveLength(5);
    for (const step of steps) {
      expect(step.state).toBe('todo');
    }
  });
});
