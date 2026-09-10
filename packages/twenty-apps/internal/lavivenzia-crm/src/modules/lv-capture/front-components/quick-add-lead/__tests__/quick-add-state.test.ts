import { describe, expect, it } from 'vitest';

import {
  CAPTURE_MODE_FIELDS,
  duplicateSummary,
  emptyStateMessage,
  initialQuickAddState,
  isBusy,
  isSubmitBlocked,
  QUICK_ADD_MODES,
  validateCapture,
  withCreatedLead,
  withDuplicates,
  withSubmissionError,
} from 'src/modules/lv-capture/front-components/quick-add-lead/quick-add-state';
import { type DuplicateMatch } from 'src/modules/lv-core/utils/duplicate-detection';

const match = (score: number, recordId = 'existing'): DuplicateMatch => ({
  recordId,
  score,
  percent: Math.round(score * 100),
  reasons: ['NAME_SIMILAR'],
});

describe('initialQuickAddState', () => {
  it('starts idle and empty', () => {
    const state = initialQuickAddState();

    expect(state.phase).toBe('IDLE');
    expect(state.draft).toBeNull();
    expect(state.duplicates).toEqual([]);
    expect(state.errors).toEqual([]);
    expect(state.createdLeadId).toBeNull();
  });
});

describe('capture modes', () => {
  it('offers the six modes a hunter can pick', () => {
    expect(QUICK_ADD_MODES).toEqual([
      'MANUAL',
      'WEBSITE_URL',
      'INSTAGRAM',
      'VISITING_CARD',
      'IMAGE',
      'REFERRAL',
    ]);
  });

  it('describes every mode, including the ones not offered in the dialog', () => {
    for (const mode of Object.keys(CAPTURE_MODE_FIELDS)) {
      const config = CAPTURE_MODE_FIELDS[mode as keyof typeof CAPTURE_MODE_FIELDS];

      expect(config.label.length).toBeGreaterThan(0);
      expect(config.hint.length).toBeGreaterThan(0);
    }
  });

  it('asks for a file in the image modes', () => {
    expect(CAPTURE_MODE_FIELDS.IMAGE.primaryInput).toBe('file');
    expect(CAPTURE_MODE_FIELDS.VISITING_CARD.primaryInput).toBe('file');
  });

  it('shows referrer inputs only for referral capture', () => {
    expect(CAPTURE_MODE_FIELDS.REFERRAL.showsReferrer).toBe(true);
    expect(CAPTURE_MODE_FIELDS.MANUAL.showsReferrer).toBe(false);
  });
});

describe('empty state', () => {
  it('gives mode-specific guidance before anything is typed', () => {
    expect(emptyStateMessage('INSTAGRAM')).toContain('Post links');
    expect(emptyStateMessage('MANUAL')).toContain('name is required');
  });
});

describe('validateCapture', () => {
  it('moves to VALIDATING with a draft on good input', () => {
    const state = validateCapture(initialQuickAddState(), {
      captureMode: 'MANUAL',
      name: 'Raj Sharma',
    });

    expect(state.phase).toBe('VALIDATING');
    expect(state.draft?.name).toBe('Raj Sharma');
    expect(state.errors).toEqual([]);
  });

  it('moves to ERROR with messages on bad input', () => {
    const state = validateCapture(initialQuickAddState(), { captureMode: 'MANUAL' });

    expect(state.phase).toBe('ERROR');
    expect(state.draft).toBeNull();
    expect(state.errors.length).toBeGreaterThan(0);
  });

  it('surfaces non-blocking warnings alongside a valid draft', () => {
    const state = validateCapture(initialQuickAddState(), {
      captureMode: 'MANUAL',
      name: 'Raj',
      phone: 'call me',
    });

    expect(state.phase).toBe('VALIDATING');
    expect(state.warnings.length).toBeGreaterThan(0);
  });
});

describe('withDuplicates', () => {
  it('stops for review when duplicates exist', () => {
    const state = withDuplicates(initialQuickAddState(), [match(0.9)]);

    expect(state.phase).toBe('DUPLICATES_FOUND');
  });

  it('proceeds straight to submitting when there are none', () => {
    const state = withDuplicates(initialQuickAddState(), []);

    expect(state.phase).toBe('SUBMITTING');
  });
});

describe('isSubmitBlocked', () => {
  it('blocks while work is in flight', () => {
    expect(isSubmitBlocked({ ...initialQuickAddState(), phase: 'SUBMITTING' })).toBe(
      true,
    );
    expect(isSubmitBlocked({ ...initialQuickAddState(), phase: 'VALIDATING' })).toBe(
      true,
    );
  });

  it('blocks on a strong unresolved duplicate', () => {
    const state = withDuplicates(initialQuickAddState(), [match(0.95)]);

    expect(isSubmitBlocked(state)).toBe(true);
  });

  it('allows submitting past a weak duplicate, which is only advisory', () => {
    const state = withDuplicates(initialQuickAddState(), [match(0.72)]);

    expect(isSubmitBlocked(state)).toBe(false);
  });

  it('does not block an idle form', () => {
    expect(isSubmitBlocked(initialQuickAddState())).toBe(false);
  });
});

describe('isBusy', () => {
  it('is true only while validating or submitting', () => {
    expect(isBusy({ ...initialQuickAddState(), phase: 'SUBMITTING' })).toBe(true);
    expect(isBusy({ ...initialQuickAddState(), phase: 'IDLE' })).toBe(false);
    expect(isBusy({ ...initialQuickAddState(), phase: 'ERROR' })).toBe(false);
  });
});

describe('error and success transitions', () => {
  it('records a submission error', () => {
    const state = withSubmissionError(initialQuickAddState(), 'Network unavailable');

    expect(state.phase).toBe('ERROR');
    expect(state.errors).toEqual(['Network unavailable']);
  });

  it('records the created lead and clears duplicates', () => {
    const withDupes = withDuplicates(initialQuickAddState(), [match(0.9)]);
    const state = withCreatedLead(withDupes, 'lead-1');

    expect(state.phase).toBe('SUCCESS');
    expect(state.createdLeadId).toBe('lead-1');
    expect(state.duplicates).toEqual([]);
  });
});

describe('duplicateSummary', () => {
  it('is null when there are no duplicates', () => {
    expect(duplicateSummary([])).toBeNull();
  });

  it('reports the strongest match as a percentage', () => {
    expect(duplicateSummary([match(0.91)])).toBe(
      '91% similar to an existing lead.',
    );
  });

  it('counts the remaining matches', () => {
    expect(duplicateSummary([match(0.91), match(0.8, 'other')])).toContain(
      '1 other match',
    );
  });
});
