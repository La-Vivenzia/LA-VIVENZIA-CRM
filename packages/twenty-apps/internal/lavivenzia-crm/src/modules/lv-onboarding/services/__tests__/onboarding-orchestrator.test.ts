import { describe, expect, it, vi } from 'vitest';

import {
  applyOnboardingTransition,
  type OnboardingPort,
  type OnboardingRecord,
} from 'src/modules/lv-onboarding/services/onboarding-orchestrator';
import { completeAnswers } from 'src/modules/lv-onboarding/utils/__tests__/onboarding-fixtures';

const AT = '2026-09-09T10:00:00.000Z';
const HUMAN = 'wm-reviewer';

const aRecord = (overrides: Partial<OnboardingRecord> = {}): OnboardingRecord => ({
  id: 'onb-1',
  leadId: 'lead-1',
  status: 'INTERNAL_REVIEW',
  answers: completeAnswers(),
  auditTrail: [],
  reviewerWorkspaceMemberId: HUMAN,
  ...overrides,
});

const aPort = (
  record: OnboardingRecord | null = aRecord(),
  documents: Record<string, 'VERIFIED' | 'PENDING' | 'REJECTED'> = {
    identityDocument: 'VERIFIED',
  },
): OnboardingPort => ({
  getOnboarding: vi.fn(async () => record),
  getDocumentStates: vi.fn(async () => documents),
  applyPatch: vi.fn(async () => undefined),
  syncLeadOnboardingStatus: vi.fn(async () => undefined),
});

const apply = (port: OnboardingPort, overrides: Record<string, unknown> = {}) =>
  applyOnboardingTransition({
    onboardingId: 'onb-1',
    to: 'APPROVED',
    at: AT,
    port,
    actorWorkspaceMemberId: HUMAN,
    ...overrides,
  });

describe('applyOnboardingTransition', () => {
  it('applies an allowed transition and records the audit entry', async () => {
    const port = aPort();

    const result = await apply(port);

    expect(result.ok).toBe(true);
    expect(port.applyPatch).toHaveBeenCalledOnce();
    expect(port.syncLeadOnboardingStatus).toHaveBeenCalledWith({
      leadId: 'lead-1',
      status: 'APPROVED',
    });
  });

  it('reports a missing onboarding rather than throwing', async () => {
    const result = await apply(aPort(null));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('NOT_FOUND');
    }
  });

  describe('guards run server-side, not only in the UI', () => {
    it('refuses approval without a human actor', async () => {
      const result = await apply(aPort(), { actorWorkspaceMemberId: null });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe('ACTOR_REQUIRED');
      }
    });

    it('refuses approval while a document is unverified', async () => {
      const result = await apply(aPort(aRecord(), { identityDocument: 'PENDING' }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe('DOCUMENTS_NOT_VERIFIED');
      }
    });

    it('refuses approval with no reviewer anywhere', async () => {
      const result = await apply(
        aPort(aRecord({ reviewerWorkspaceMemberId: null })),
        { reviewerWorkspaceMemberId: null },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe('REVIEWER_REQUIRED');
      }
    });

    it('refuses a transition the machine does not allow', async () => {
      const result = await apply(aPort(aRecord({ status: 'NOT_STARTED' })));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe('NOT_ALLOWED');
      }
    });

    it('writes nothing when a transition is refused', async () => {
      const port = aPort();

      await apply(port, { actorWorkspaceMemberId: null });

      expect(port.applyPatch).not.toHaveBeenCalled();
      expect(port.syncLeadOnboardingStatus).not.toHaveBeenCalled();
    });

    it('refuses rejection without a reason', async () => {
      const result = await apply(aPort(), { to: 'REJECTED', reason: null });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe('REASON_REQUIRED');
      }
    });
  });

  describe('audit trail', () => {
    it('appends rather than replaces', async () => {
      const existing = {
        from: 'VERIFICATION' as const,
        to: 'INTERNAL_REVIEW' as const,
        at: '2026-09-08T10:00:00.000Z',
        actorWorkspaceMemberId: 'someone',
        reason: null,
        note: null,
      };
      const port = aPort(aRecord({ auditTrail: [existing] }));

      await apply(port);

      const patch = vi.mocked(port.applyPatch).mock.calls[0]?.[0].patch;

      expect(patch?.auditTrail).toHaveLength(2);
      expect(patch?.auditTrail[0]).toEqual(existing);
      expect(patch?.auditTrail[1]).toMatchObject({
        from: 'INTERNAL_REVIEW',
        to: 'APPROVED',
        actorWorkspaceMemberId: HUMAN,
      });
    });

    it('records the reason on a rejection', async () => {
      const port = aPort();

      await apply(port, { to: 'REJECTED', reason: 'Identity could not be confirmed' });

      const patch = vi.mocked(port.applyPatch).mock.calls[0]?.[0].patch;

      expect(patch?.decisionReason).toBe('Identity could not be confirmed');
      expect(patch?.auditTrail.at(-1)?.reason).toBe(
        'Identity could not be confirmed',
      );
    });
  });

  describe('recomputed fields', () => {
    it('recomputes progress and health from the stored answers', async () => {
      const port = aPort();

      await apply(port);

      const patch = vi.mocked(port.applyPatch).mock.calls[0]?.[0].patch;

      expect(patch?.progressPercentage).toBe(100);
      expect(patch?.healthScore).toBeGreaterThan(0);
    });

    it('stamps submittedAt when moving to verification', async () => {
      const port = aPort(aRecord({ status: 'IN_PROGRESS' }));

      await apply(port, { to: 'VERIFICATION', actorWorkspaceMemberId: null });

      const patch = vi.mocked(port.applyPatch).mock.calls[0]?.[0].patch;

      expect(patch?.submittedAt).toBe(AT);
      expect(patch?.decidedAt).toBeUndefined();
    });

    it('stamps decidedAt on approval', async () => {
      const port = aPort();

      await apply(port);

      expect(
        vi.mocked(port.applyPatch).mock.calls[0]?.[0].patch.decidedAt,
      ).toBe(AT);
    });

    it('stamps activatedAt on activation', async () => {
      const port = aPort(aRecord({ status: 'APPROVED' }));

      await apply(port, { to: 'ACTIVATED' });

      expect(
        vi.mocked(port.applyPatch).mock.calls[0]?.[0].patch.activatedAt,
      ).toBe(AT);
    });
  });

  it('skips the lead sync when the onboarding has no lead', async () => {
    const port = aPort(aRecord({ leadId: null }));

    const result = await apply(port);

    expect(result.ok).toBe(true);
    expect(port.syncLeadOnboardingStatus).not.toHaveBeenCalled();
  });
});
