import { describe, expect, it } from 'vitest';

import {
  DATA_BEARING_STEPS,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_SPECS,
} from 'src/modules/lv-onboarding/constants/onboarding-steps';
import {
  canSubmitForReview,
  completedSteps,
  isStepComplete,
  missingInformation,
  resumeStep,
  validateStep,
} from 'src/modules/lv-onboarding/utils/validate-onboarding';
import {
  answersMissing,
  completeAnswers,
} from 'src/modules/lv-onboarding/utils/__tests__/onboarding-fixtures';

describe('step definitions', () => {
  it('defines exactly the ten steps from the brief, in order', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'BASIC_INFORMATION',
      'ABOUT_YOU',
      'EXPERIENCE',
      'LOCATION',
      'PRICING',
      'AVAILABILITY',
      'IMAGES',
      'DOCUMENTS',
      'POLICIES',
      'FINAL_REVIEW',
    ]);
  });

  it('has a spec for every step', () => {
    expect(ONBOARDING_STEP_SPECS.map((spec) => spec.step)).toEqual([
      ...ONBOARDING_STEPS,
    ]);
  });

  it('treats final review as the only step without inputs', () => {
    const withoutFields = ONBOARDING_STEP_SPECS.filter(
      (spec) => spec.fields.length === 0,
    );

    expect(withoutFields.map((spec) => spec.step)).toEqual(['FINAL_REVIEW']);
    expect(DATA_BEARING_STEPS).toHaveLength(9);
  });

  it('gives every field a unique key within its step', () => {
    for (const spec of ONBOARDING_STEP_SPECS) {
      const keys = spec.fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('validateStep', () => {
  it('reports nothing for a complete submission', () => {
    const data = completeAnswers();

    for (const step of DATA_BEARING_STEPS) {
      expect(validateStep(step, data)).toEqual([]);
    }
  });

  it('reports every required field of an untouched step', () => {
    const issues = validateStep('BASIC_INFORMATION', {});

    expect(issues.map((issue) => issue.fieldKey).sort()).toEqual([
      'displayName',
      'email',
      'legalName',
      'phone',
    ]);
    expect(issues.every((issue) => issue.reason === 'EMPTY')).toBe(true);
  });

  it('ignores optional fields left blank', () => {
    expect(validateStep('BASIC_INFORMATION', completeAnswers())).toEqual([]);
  });

  it('flags an invalid email', () => {
    const data = completeAnswers();
    data.BASIC_INFORMATION = { ...data.BASIC_INFORMATION, email: 'not-an-email' };

    expect(validateStep('BASIC_INFORMATION', data)[0]).toMatchObject({
      fieldKey: 'email',
      reason: 'INVALID',
    });
  });

  it('flags an unparseable phone', () => {
    const data = completeAnswers();
    data.BASIC_INFORMATION = { ...data.BASIC_INFORMATION, phone: 'call me' };

    expect(validateStep('BASIC_INFORMATION', data)[0]).toMatchObject({
      fieldKey: 'phone',
      reason: 'INVALID',
    });
  });

  it('flags a bio that is too short rather than accepting a token answer', () => {
    const data = completeAnswers();
    data.ABOUT_YOU = { bio: 'I cook.' };

    expect(validateStep('ABOUT_YOU', data)[0]).toMatchObject({
      fieldKey: 'bio',
      reason: 'TOO_SHORT',
    });
  });

  it('flags too few photographs', () => {
    const data = completeAnswers();
    data.IMAGES = { images: ['files/1.jpg'] };

    expect(validateStep('IMAGES', data)[0]).toMatchObject({
      fieldKey: 'images',
      reason: 'TOO_FEW',
    });
  });

  it('treats whitespace as empty', () => {
    const data = completeAnswers();
    data.BASIC_INFORMATION = { ...data.BASIC_INFORMATION, legalName: '   ' };

    expect(validateStep('BASIC_INFORMATION', data)).toContainEqual(
      expect.objectContaining({ fieldKey: 'legalName', reason: 'EMPTY' }),
    );
  });

  describe('required consent', () => {
    it('rejects an unticked terms box', () => {
      const data = completeAnswers();
      data.POLICIES = { ...data.POLICIES, agreesToTerms: false };

      expect(validateStep('POLICIES', data)).toContainEqual(
        expect.objectContaining({ fieldKey: 'agreesToTerms' }),
      );
    });

    it('rejects a missing terms box', () => {
      expect(
        validateStep('POLICIES', answersMissing('POLICIES', 'agreesToTerms')),
      ).toContainEqual(expect.objectContaining({ fieldKey: 'agreesToTerms' }));
    });

    it('accepts only an explicit true', () => {
      const data = completeAnswers();
      data.POLICIES = { ...data.POLICIES, agreesToTerms: true };

      expect(validateStep('POLICIES', data)).toEqual([]);
    });
  });

  it('treats final review as always satisfied', () => {
    expect(validateStep('FINAL_REVIEW', {})).toEqual([]);
  });
});

describe('missingInformation', () => {
  it('is empty for a complete submission', () => {
    expect(missingInformation(completeAnswers())).toEqual([]);
  });

  it('lists issues in step order', () => {
    const issues = missingInformation({});
    const order = issues.map((issue) => ONBOARDING_STEPS.indexOf(issue.step));

    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('names the field so a partner knows what to fix', () => {
    expect(missingInformation({})[0]).toMatchObject({
      step: 'BASIC_INFORMATION',
      label: expect.any(String),
    });
  });
});

describe('canSubmitForReview', () => {
  it('allows a complete submission', () => {
    expect(canSubmitForReview(completeAnswers())).toEqual({ ok: true });
  });

  it('blocks a submission missing one required field', () => {
    const result = canSubmitForReview(answersMissing('PRICING', 'basePrice'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContainEqual(
        expect.objectContaining({ fieldKey: 'basePrice' }),
      );
    }
  });
});

describe('save and resume', () => {
  it('resumes at the first incomplete step', () => {
    expect(resumeStep({})).toBe('BASIC_INFORMATION');
  });

  it('skips steps already completed, even out of order', () => {
    const data = completeAnswers();
    delete data.PRICING;

    expect(resumeStep(data)).toBe('PRICING');
  });

  it('lands on final review when everything is done', () => {
    expect(resumeStep(completeAnswers())).toBe('FINAL_REVIEW');
  });

  it('counts completed steps', () => {
    expect(completedSteps(completeAnswers())).toHaveLength(9);
    expect(completedSteps({})).toEqual([]);
  });

  it('recognises a partially completed submission', () => {
    const data = completeAnswers();
    delete data.IMAGES;

    expect(isStepComplete('IMAGES', data)).toBe(false);
    expect(isStepComplete('PRICING', data)).toBe(true);
  });
});
