import { describe, expect, it } from 'vitest';

import {
  canTransition,
  HUMAN_ONLY_TRANSITIONS,
  ONBOARDING_STATUSES,
  ONBOARDING_TRANSITIONS,
  REASON_REQUIRED_TRANSITIONS,
  type OnboardingStatus,
} from 'src/modules/lv-onboarding/constants/onboarding-status';
import {
  availableTransitions,
  transitionOnboarding,
} from 'src/modules/lv-onboarding/utils/transition-onboarding';
import { completeAnswers } from 'src/modules/lv-onboarding/utils/__tests__/onboarding-fixtures';

const AT = '2026-09-09T10:00:00.000Z';
const HUMAN = 'wm-reviewer';
const ALL_VERIFIED = { identityDocument: 'VERIFIED' } as const;

const attempt = (
  from: OnboardingStatus,
  to: OnboardingStatus,
  overrides: Partial<Parameters<typeof transitionOnboarding>[0]> = {},
) =>
  transitionOnboarding({
    from,
    to,
    at: AT,
    actorWorkspaceMemberId: HUMAN,
    reason: 'because',
    data: completeAnswers(),
    documents: ALL_VERIFIED,
    reviewerWorkspaceMemberId: HUMAN,
    ...overrides,
  });

describe('transition table', () => {
  it('covers all eleven statuses', () => {
    expect(ONBOARDING_STATUSES).toHaveLength(11);
    expect(Object.keys(ONBOARDING_TRANSITIONS).sort()).toEqual(
      [...ONBOARDING_STATUSES].sort(),
    );
  });

  it('only ever targets known statuses', () => {
    for (const targets of Object.values(ONBOARDING_TRANSITIONS)) {
      for (const target of targets) {
        expect(ONBOARDING_STATUSES).toContain(target);
      }
    }
  });

  it('never allows a status to transition to itself', () => {
    for (const status of ONBOARDING_STATUSES) {
      expect(ONBOARDING_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it('makes ACTIVATED the only terminal status', () => {
    const terminal = ONBOARDING_STATUSES.filter(
      (status) => ONBOARDING_TRANSITIONS[status].length === 0,
    );

    expect(terminal).toEqual(['ACTIVATED']);
  });

  it('lets a rejected partner reapply rather than stranding the record', () => {
    expect(canTransition('REJECTED', 'IN_PROGRESS')).toBe(true);
  });

  it('reaches every status from NOT_STARTED', () => {
    const seen = new Set<OnboardingStatus>(['NOT_STARTED']);
    const queue: OnboardingStatus[] = ['NOT_STARTED'];

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === undefined) {
        break;
      }

      for (const next of ONBOARDING_TRANSITIONS[current]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }

    expect([...seen].sort()).toEqual([...ONBOARDING_STATUSES].sort());
  });
});

describe('every status pair is decided explicitly', () => {
  // 11 x 11 = 121 pairs. Each is either in the table and accepted, or refused
  // with NOT_ALLOWED. Nothing is silently permitted.
  const pairs = ONBOARDING_STATUSES.flatMap((from) =>
    ONBOARDING_STATUSES.map((to) => [from, to] as const),
  );

  it('exercises all 121 ordered pairs', () => {
    expect(pairs).toHaveLength(121);
  });

  it.each(pairs)('%s -> %s matches the table', (from, to) => {
    const result = attempt(from, to);
    const allowed = canTransition(from, to);

    expect(result.ok).toBe(allowed);

    if (!result.ok && !allowed) {
      expect(result.refusal).toBe('NOT_ALLOWED');
    }
  });
});

describe('human approval is mandatory', () => {
  it.each(HUMAN_ONLY_TRANSITIONS)(
    '%s cannot be applied by an automated caller',
    (target) => {
      const from = ONBOARDING_STATUSES.find((status) =>
        canTransition(status, target),
      );

      expect(from).toBeDefined();

      const result = attempt(from as OnboardingStatus, target, {
        actorWorkspaceMemberId: null,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe('ACTOR_REQUIRED');
      }
    },
  );

  it('approval still succeeds when a human performs it', () => {
    expect(attempt('INTERNAL_REVIEW', 'APPROVED').ok).toBe(true);
  });

  it('does not require an actor for automatic progress transitions', () => {
    const result = attempt('IN_PROGRESS', 'VERIFICATION', {
      actorWorkspaceMemberId: null,
    });

    expect(result.ok).toBe(true);
  });
});

describe('written reason', () => {
  it.each(REASON_REQUIRED_TRANSITIONS)('%s requires a reason', (target) => {
    const from = ONBOARDING_STATUSES.find((status) =>
      canTransition(status, target),
    );

    const result = attempt(from as OnboardingStatus, target, { reason: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('REASON_REQUIRED');
    }
  });

  it('rejects a whitespace-only reason', () => {
    const result = attempt('INTERNAL_REVIEW', 'REJECTED', { reason: '   ' });

    expect(result.ok).toBe(false);
  });

  it('trims the reason it records', () => {
    const result = attempt('INTERNAL_REVIEW', 'REJECTED', {
      reason: '  not a fit  ',
    });

    expect(result.ok && result.audit.reason).toBe('not a fit');
  });
});

describe('submission completeness', () => {
  it('refuses verification when required information is missing', () => {
    const result = attempt('IN_PROGRESS', 'VERIFICATION', {
      data: { BASIC_INFORMATION: {} },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('INCOMPLETE_SUBMISSION');
      expect(result.message).toContain('missing');
    }
  });

  it('refuses verification when the answers were not supplied at all', () => {
    const result = attempt('IN_PROGRESS', 'VERIFICATION', { data: undefined });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('INCOMPLETE_SUBMISSION');
    }
  });

  it('allows verification once every step is complete', () => {
    expect(attempt('IN_PROGRESS', 'VERIFICATION').ok).toBe(true);
  });
});

describe('approval guards', () => {
  it('refuses approval without a named reviewer', () => {
    const result = attempt('INTERNAL_REVIEW', 'APPROVED', {
      reviewerWorkspaceMemberId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('REVIEWER_REQUIRED');
    }
  });

  it('refuses approval with no documents at all', () => {
    const result = attempt('INTERNAL_REVIEW', 'APPROVED', { documents: {} });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('DOCUMENTS_NOT_VERIFIED');
    }
  });

  it('refuses approval while any document is pending', () => {
    const result = attempt('INTERNAL_REVIEW', 'APPROVED', {
      documents: { identityDocument: 'VERIFIED', addressProof: 'PENDING' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('DOCUMENTS_NOT_VERIFIED');
    }
  });

  it('refuses approval when a document was rejected', () => {
    const result = attempt('INTERNAL_REVIEW', 'APPROVED', {
      documents: { identityDocument: 'REJECTED' },
    });

    expect(result.ok).toBe(false);
  });

  it('does not impose document guards on rejection', () => {
    expect(
      attempt('INTERNAL_REVIEW', 'REJECTED', { documents: {} }).ok,
    ).toBe(true);
  });
});

describe('audit entry', () => {
  it('records who, what, when and why', () => {
    const result = attempt('INTERNAL_REVIEW', 'REJECTED', {
      reason: 'Documents do not match the applicant',
      note: 'Second attempt',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.audit).toEqual({
        from: 'INTERNAL_REVIEW',
        to: 'REJECTED',
        at: AT,
        actorWorkspaceMemberId: HUMAN,
        reason: 'Documents do not match the applicant',
        note: 'Second attempt',
      });
    }
  });

  it('records a null actor for automatic transitions', () => {
    const result = attempt('IN_PROGRESS', 'VERIFICATION', {
      actorWorkspaceMemberId: null,
      reason: null,
    });

    expect(result.ok && result.audit.actorWorkspaceMemberId).toBeNull();
  });
});

describe('availableTransitions', () => {
  it('offers nothing from the terminal status', () => {
    expect(availableTransitions({ from: 'ACTIVATED' })).toEqual([]);
  });

  it('hides verification while the submission is incomplete', () => {
    const options = availableTransitions({
      from: 'IN_PROGRESS',
      data: { BASIC_INFORMATION: {} },
    });

    expect(options).not.toContain('VERIFICATION');
    expect(options).toContain('WAITING_FOR_PARTNER');
  });

  it('offers verification once the submission is complete', () => {
    expect(
      availableTransitions({ from: 'IN_PROGRESS', data: completeAnswers() }),
    ).toContain('VERIFICATION');
  });

  it('hides approval until documents are verified', () => {
    expect(
      availableTransitions({
        from: 'INTERNAL_REVIEW',
        data: completeAnswers(),
        documents: { identityDocument: 'PENDING' },
        reviewerWorkspaceMemberId: HUMAN,
      }),
    ).not.toContain('APPROVED');
  });

  it('offers approval when every guard is satisfied', () => {
    expect(
      availableTransitions({
        from: 'INTERNAL_REVIEW',
        data: completeAnswers(),
        documents: ALL_VERIFIED,
        reviewerWorkspaceMemberId: HUMAN,
      }),
    ).toContain('APPROVED');
  });

  it('never offers a transition the machine would refuse', () => {
    for (const from of ONBOARDING_STATUSES) {
      for (const to of availableTransitions({
        from,
        data: completeAnswers(),
        documents: ALL_VERIFIED,
        reviewerWorkspaceMemberId: HUMAN,
      })) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });
});
