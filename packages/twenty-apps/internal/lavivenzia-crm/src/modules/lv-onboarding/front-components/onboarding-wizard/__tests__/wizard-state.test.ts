import { describe, expect, it } from 'vitest';

import {
  canAdvance,
  currentIssues,
  goBack,
  goNext,
  goToStep,
  initialWizardState,
  isFinalStep,
  isFirstStep,
  isReadOnly,
  readOnlyReason,
  setAnswer,
  stepNumber,
  summarise,
  withSaveState,
  withSubmitError,
} from 'src/modules/lv-onboarding/front-components/onboarding-wizard/wizard-state';
import { completeAnswers } from 'src/modules/lv-onboarding/utils/__tests__/onboarding-fixtures';

const fresh = () => initialWizardState({ status: 'IN_PROGRESS', data: {} });
const done = () =>
  initialWizardState({ status: 'IN_PROGRESS', data: completeAnswers() });

describe('initialWizardState', () => {
  it('starts a new partner at the first step', () => {
    expect(fresh().step).toBe('BASIC_INFORMATION');
  });

  it('resumes a returning partner at their first incomplete step', () => {
    const data = completeAnswers();
    delete data.PRICING;

    expect(
      initialWizardState({ status: 'IN_PROGRESS', data }).step,
    ).toBe('PRICING');
  });

  it('sends a finished partner to final review', () => {
    expect(done().step).toBe('FINAL_REVIEW');
  });

  it('shows no errors before the partner has tried to advance', () => {
    expect(currentIssues(fresh())).toEqual([]);
  });
});

describe('read-only states', () => {
  it('lets the partner edit while in progress', () => {
    expect(isReadOnly(fresh())).toBe(false);
  });

  it.each(['VERIFICATION', 'INTERNAL_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVATED'] as const)(
    'locks the form in %s',
    (status) => {
      expect(
        isReadOnly(initialWizardState({ status, data: completeAnswers() })),
      ).toBe(true);
    },
  );

  it('lets the partner edit again after changes are requested', () => {
    expect(
      isReadOnly(
        initialWizardState({ status: 'CHANGES_REQUESTED', data: completeAnswers() }),
      ),
    ).toBe(false);
  });

  it('explains why the form is locked', () => {
    expect(readOnlyReason('INTERNAL_REVIEW')).toContain('review');
    expect(readOnlyReason('REJECTED')).toContain('not accepted');
    expect(readOnlyReason('IN_PROGRESS')).toBeNull();
  });
});

describe('answers', () => {
  it('records an answer against the current step', () => {
    const next = setAnswer(fresh(), 'legalName', 'Raj Sharma');

    expect(next.data.BASIC_INFORMATION?.legalName).toBe('Raj Sharma');
  });

  it('does not disturb other steps', () => {
    const state = setAnswer(done(), 'legalName', 'Changed');

    expect(state.data.PRICING).toEqual(done().data.PRICING);
  });

  it('clears a stale saved badge when the partner edits again', () => {
    const saved = withSaveState(fresh(), 'SAVED');

    expect(setAnswer(saved, 'legalName', 'Raj').saveState).toBe('IDLE');
  });

  it('does not mask a save error', () => {
    const errored = withSaveState(fresh(), 'ERROR', 'Network down');

    expect(setAnswer(errored, 'legalName', 'Raj').saveState).toBe('ERROR');
  });
});

describe('navigation', () => {
  it('blocks advancing from an incomplete step and reveals the errors', () => {
    const blocked = goNext(fresh());

    expect(blocked.step).toBe('BASIC_INFORMATION');
    expect(blocked.hasAttemptedAdvance).toBe(true);
    expect(currentIssues(blocked).length).toBeGreaterThan(0);
  });

  it('advances once the step is valid', () => {
    let state = fresh();
    for (const [key, value] of Object.entries(
      completeAnswers().BASIC_INFORMATION ?? {},
    )) {
      state = setAnswer(state, key, value);
    }

    expect(canAdvance(state)).toBe(true);
    expect(goNext(state).step).toBe('ABOUT_YOU');
  });

  it('always allows going back, even from an incomplete step', () => {
    const onSecond = goToStep(fresh(), 'ABOUT_YOU');

    expect(goBack(onSecond).step).toBe('BASIC_INFORMATION');
  });

  it('does not fall off either end', () => {
    expect(goBack(fresh()).step).toBe('BASIC_INFORMATION');
    expect(goNext(done()).step).toBe('FINAL_REVIEW');
  });

  it('clears revealed errors when moving to another step', () => {
    const blocked = goNext(fresh());

    expect(goToStep(blocked, 'PRICING').hasAttemptedAdvance).toBe(false);
  });

  it('knows the ends of the journey', () => {
    expect(isFirstStep(fresh())).toBe(true);
    expect(isFinalStep(done())).toBe(true);
    expect(isFinalStep(fresh())).toBe(false);
  });
});

describe('summary', () => {
  it('reports zero progress for a new application', () => {
    const summary = summarise(fresh());

    expect(summary.progress).toBe(0);
    expect(summary.canSubmit).toBe(false);
    expect(summary.blockingCount).toBeGreaterThan(0);
  });

  it('reports full progress and allows submission when complete', () => {
    const summary = summarise(done());

    expect(summary.progress).toBe(100);
    expect(summary.canSubmit).toBe(true);
    expect(summary.blockingCount).toBe(0);
  });

  it('reports a health score separate from progress', () => {
    const summary = summarise(done());

    // Complete but minimal: fully progressed, not yet excellent.
    expect(summary.progress).toBe(100);
    expect(summary.health).toBeLessThan(100);
  });

  it('lists per-step progress for the checklist', () => {
    expect(summarise(fresh()).steps).toHaveLength(9);
  });
});

describe('save and submit feedback', () => {
  it('carries a save error message', () => {
    const state = withSaveState(fresh(), 'ERROR', 'Could not save');

    expect(state.saveState).toBe('ERROR');
    expect(state.saveError).toBe('Could not save');
  });

  it('carries a submit error', () => {
    expect(withSubmitError(fresh(), 'Server refused').submitError).toBe(
      'Server refused',
    );
  });
});

describe('step labelling', () => {
  it('numbers the data-bearing steps out of nine', () => {
    expect(stepNumber('BASIC_INFORMATION')).toBe('Step 1 of 9');
    expect(stepNumber('POLICIES')).toBe('Step 9 of 9');
  });

  it('labels the final step as review rather than a number', () => {
    expect(stepNumber('FINAL_REVIEW')).toBe('Review');
  });
});
