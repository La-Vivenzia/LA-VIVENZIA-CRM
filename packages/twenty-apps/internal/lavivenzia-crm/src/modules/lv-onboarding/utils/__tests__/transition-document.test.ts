import { describe, expect, it } from 'vitest';

import {
  canTransitionDocument,
  DOCUMENT_REASON_REQUIRED_STATES,
  DOCUMENT_TRANSITIONS,
  DOCUMENT_VERIFICATION_FLAGS,
  DOCUMENT_VERIFICATION_STATES,
  HUMAN_ONLY_DOCUMENT_STATES,
  isDocumentAcceptable,
  type DocumentVerificationState,
} from 'src/modules/lv-onboarding/constants/document-verification';
import {
  expireIfDue,
  outcomeForFlags,
  planReplacement,
  transitionDocument,
} from 'src/modules/lv-onboarding/utils/transition-document';

const AT = '2026-09-09T10:00:00.000Z';
const REVIEWER = 'wm-reviewer';

const attempt = (
  from: DocumentVerificationState,
  to: DocumentVerificationState,
  overrides: Partial<Parameters<typeof transitionDocument>[0]> = {},
) =>
  transitionDocument({
    from,
    to,
    at: AT,
    actorWorkspaceMemberId: REVIEWER,
    reason: 'because',
    flags: ['UNREADABLE'],
    ...overrides,
  });

describe('vocabulary', () => {
  it('defines the six verification states from the brief', () => {
    expect(DOCUMENT_VERIFICATION_STATES).toEqual([
      'PENDING',
      'UNDER_REVIEW',
      'VERIFIED',
      'REJECTED',
      'EXPIRED',
      'NEEDS_REPLACEMENT',
    ]);
  });

  it('defines the seven verification flags from the brief', () => {
    expect(DOCUMENT_VERIFICATION_FLAGS).toEqual([
      'UNREADABLE',
      'MISSING_PAGE',
      'EXPIRED',
      'NAME_MISMATCH',
      'INCONSISTENT_INFORMATION',
      'DUPLICATE',
      'WRONG_DOCUMENT_TYPE',
    ]);
  });

  it('treats only a verified document as acceptable', () => {
    for (const state of DOCUMENT_VERIFICATION_STATES) {
      expect(isDocumentAcceptable(state)).toBe(state === 'VERIFIED');
    }
  });

  it('never allows a state to transition to itself', () => {
    for (const state of DOCUMENT_VERIFICATION_STATES) {
      expect(DOCUMENT_TRANSITIONS[state]).not.toContain(state);
    }
  });

  it('lets every dead end return to PENDING so a partner can re-upload', () => {
    for (const state of ['REJECTED', 'EXPIRED', 'NEEDS_REPLACEMENT'] as const) {
      expect(canTransitionDocument(state, 'PENDING')).toBe(true);
    }
  });
});

describe('every state pair is decided explicitly', () => {
  const pairs = DOCUMENT_VERIFICATION_STATES.flatMap((from) =>
    DOCUMENT_VERIFICATION_STATES.map((to) => [from, to] as const),
  );

  it('exercises all 36 ordered pairs', () => {
    expect(pairs).toHaveLength(36);
  });

  it.each(pairs)('%s -> %s matches the table', (from, to) => {
    const result = attempt(from, to);
    const allowed = canTransitionDocument(from, to);

    expect(result.ok).toBe(allowed);

    if (!result.ok && !allowed) {
      expect(result.refusal).toBe('NOT_ALLOWED');
    }
  });
});

describe('reviewer decisions are human-only', () => {
  it.each(HUMAN_ONLY_DOCUMENT_STATES)(
    '%s cannot be applied automatically',
    (target) => {
      const from = DOCUMENT_VERIFICATION_STATES.find((state) =>
        canTransitionDocument(state, target),
      );

      const result = attempt(from as DocumentVerificationState, target, {
        actorWorkspaceMemberId: null,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toBe('ACTOR_REQUIRED');
      }
    },
  );

  it('allows EXPIRED without a human, because a date passing is a fact', () => {
    const result = attempt('VERIFIED', 'EXPIRED', {
      actorWorkspaceMemberId: null,
      reason: null,
    });

    expect(result.ok).toBe(true);
  });
});

describe('reasons and flags', () => {
  it.each(DOCUMENT_REASON_REQUIRED_STATES)('%s requires a reason', (target) => {
    const from = DOCUMENT_VERIFICATION_STATES.find((state) =>
      canTransitionDocument(state, target),
    );

    const result = attempt(from as DocumentVerificationState, target, {
      reason: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('REASON_REQUIRED');
    }
  });

  it('requires at least one flag to request a replacement', () => {
    const result = attempt('UNDER_REVIEW', 'NEEDS_REPLACEMENT', { flags: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('FLAGS_REQUIRED');
    }
  });

  it('does not demand flags for a plain rejection', () => {
    expect(attempt('UNDER_REVIEW', 'REJECTED', { flags: [] }).ok).toBe(true);
  });

  it('records the flags in the audit entry', () => {
    const result = attempt('UNDER_REVIEW', 'NEEDS_REPLACEMENT', {
      flags: ['MISSING_PAGE', 'UNREADABLE'],
    });

    expect(result.ok && result.audit.flags).toEqual([
      'MISSING_PAGE',
      'UNREADABLE',
    ]);
  });

  it('trims the recorded reason', () => {
    const result = attempt('UNDER_REVIEW', 'REJECTED', { reason: '  blurry  ' });

    expect(result.ok && result.audit.reason).toBe('blurry');
  });
});

describe('outcomeForFlags', () => {
  it('is null when nothing was flagged', () => {
    expect(outcomeForFlags([])).toBeNull();
  });

  it.each(['UNREADABLE', 'MISSING_PAGE', 'EXPIRED', 'WRONG_DOCUMENT_TYPE'] as const)(
    '%s needs a different file, so it means replacement',
    (flag) => {
      expect(outcomeForFlags([flag])).toBe('NEEDS_REPLACEMENT');
    },
  );

  it.each(['NAME_MISMATCH', 'INCONSISTENT_INFORMATION', 'DUPLICATE'] as const)(
    '%s is a judgement a reviewer resolves, so it means rejection',
    (flag) => {
      expect(outcomeForFlags([flag])).toBe('REJECTED');
    },
  );

  it('escalates to replacement when any flag needs a new file', () => {
    expect(outcomeForFlags(['NAME_MISMATCH', 'UNREADABLE'])).toBe(
      'NEEDS_REPLACEMENT',
    );
  });
});

describe('expireIfDue', () => {
  const VERIFIED_AT = '2026-09-09T10:00:00.000Z';

  it('expires a verified document whose date has passed', () => {
    const result = expireIfDue({
      state: 'VERIFIED',
      expiresAt: '2026-09-01T00:00:00.000Z',
      now: VERIFIED_AT,
    });

    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.state).toBe('EXPIRED');
      expect(result.audit.reason).toContain('2026-09-01');
      expect(result.audit.actorWorkspaceMemberId).toBeNull();
    }
  });

  it('leaves a document that has not expired alone', () => {
    expect(
      expireIfDue({
        state: 'VERIFIED',
        expiresAt: '2027-01-01T00:00:00.000Z',
        now: VERIFIED_AT,
      }),
    ).toBeNull();
  });

  it('ignores documents with no expiry', () => {
    expect(
      expireIfDue({ state: 'VERIFIED', expiresAt: null, now: VERIFIED_AT }),
    ).toBeNull();
  });

  it('only expires documents that were verified', () => {
    expect(
      expireIfDue({
        state: 'PENDING',
        expiresAt: '2026-01-01T00:00:00.000Z',
        now: VERIFIED_AT,
      }),
    ).toBeNull();
  });

  it('ignores an unparseable expiry rather than crashing', () => {
    expect(
      expireIfDue({ state: 'VERIFIED', expiresAt: 'soon', now: VERIFIED_AT }),
    ).toBeNull();
  });
});

describe('planReplacement', () => {
  it('supersedes the old document and starts the new one pending', () => {
    const plan = planReplacement({
      documentId: 'doc-1',
      currentState: 'UNDER_REVIEW',
      at: AT,
      actorWorkspaceMemberId: REVIEWER,
      reason: 'Second page missing',
      flags: ['MISSING_PAGE'],
    });

    expect(plan).toMatchObject({
      supersededDocumentId: 'doc-1',
      supersededState: 'NEEDS_REPLACEMENT',
      newDocumentState: 'PENDING',
    });
  });

  it('refuses a replacement an automated caller asked for', () => {
    const plan = planReplacement({
      documentId: 'doc-1',
      currentState: 'UNDER_REVIEW',
      at: AT,
      actorWorkspaceMemberId: null,
      reason: 'Second page missing',
      flags: ['MISSING_PAGE'],
    });

    expect('ok' in plan && plan.ok).toBe(false);
  });

  it('refuses a replacement with no flags', () => {
    const plan = planReplacement({
      documentId: 'doc-1',
      currentState: 'UNDER_REVIEW',
      at: AT,
      actorWorkspaceMemberId: REVIEWER,
      reason: 'Bad',
      flags: [],
    });

    expect('ok' in plan && plan.ok).toBe(false);
  });

  it('can replace an already-verified document', () => {
    const plan = planReplacement({
      documentId: 'doc-1',
      currentState: 'VERIFIED',
      at: AT,
      actorWorkspaceMemberId: REVIEWER,
      reason: 'Superseded by a newer certificate',
      flags: ['EXPIRED'],
    });

    expect('supersededDocumentId' in plan).toBe(true);
  });
});
