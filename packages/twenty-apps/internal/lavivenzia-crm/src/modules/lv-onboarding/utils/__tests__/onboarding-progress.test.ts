import { describe, expect, it } from 'vitest';

import {
  onboardingHealth,
  progressPercentage,
  stepProgress,
} from 'src/modules/lv-onboarding/utils/onboarding-progress';
import {
  answersMissing,
  completeAnswers,
} from 'src/modules/lv-onboarding/utils/__tests__/onboarding-fixtures';

describe('progressPercentage', () => {
  it('is 0 for an untouched submission', () => {
    expect(progressPercentage({})).toBe(0);
  });

  it('is 100 when every data-bearing step is complete', () => {
    expect(progressPercentage(completeAnswers())).toBe(100);
  });

  it('drops when a required field is removed', () => {
    expect(progressPercentage(answersMissing('PRICING', 'basePrice'))).toBeLessThan(
      100,
    );
  });

  it('counts whole steps, not fields', () => {
    // 8 of 9 steps complete -> 89%.
    expect(progressPercentage(answersMissing('PRICING', 'basePrice'))).toBe(89);
  });

  it('never exceeds 100 or drops below 0', () => {
    const value = progressPercentage(completeAnswers());

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  });
});

describe('stepProgress', () => {
  it('reports one entry per data-bearing step', () => {
    expect(stepProgress({})).toHaveLength(9);
  });

  it('marks completion and counts what is missing', () => {
    const progress = stepProgress(answersMissing('PRICING', 'basePrice'));
    const pricing = progress.find((entry) => entry.step === 'PRICING');
    const location = progress.find((entry) => entry.step === 'LOCATION');

    expect(pricing).toMatchObject({ isComplete: false, missingCount: 1 });
    expect(location).toMatchObject({ isComplete: true, missingCount: 0 });
  });

  it('reports how many required fields each step has', () => {
    const basic = stepProgress({}).find(
      (entry) => entry.step === 'BASIC_INFORMATION',
    );

    expect(basic?.requiredCount).toBe(4);
  });
});

describe('onboardingHealth', () => {
  it('is 0 for an empty submission with no documents', () => {
    expect(onboardingHealth({ data: {} }).score).toBe(0);
  });

  it('breaks the score into four explainable parts summing to 100 weight', () => {
    const { breakdown } = onboardingHealth({ data: completeAnswers() });

    expect(breakdown).toHaveLength(4);
    expect(breakdown.reduce((total, part) => total + part.weight, 0)).toBe(100);
  });

  it('never exceeds 100', () => {
    const data = completeAnswers();
    data.IMAGES = { images: Array.from({ length: 40 }, (_v, i) => `f${i}.jpg`) };
    data.ABOUT_YOU = {
      ...data.ABOUT_YOU,
      yearsOfExperience: 11,
      website: 'forest-table.com',
      instagram: '@foresttable',
    };

    const { score } = onboardingHealth({
      data,
      documents: { identityDocument: 'VERIFIED' },
    });

    expect(score).toBeLessThanOrEqual(100);
  });

  it('is below 100 for a complete-but-minimal submission — required is not excellent', () => {
    const { score } = onboardingHealth({
      data: completeAnswers(),
      documents: { identityDocument: 'VERIFIED' },
    });

    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThan(100);
  });

  it('rewards optional detail', () => {
    const bare = onboardingHealth({ data: completeAnswers() }).score;

    const richer = completeAnswers();
    richer.ABOUT_YOU = {
      ...richer.ABOUT_YOU,
      yearsOfExperience: 11,
      website: 'forest-table.com',
      instagram: '@foresttable',
    };

    expect(onboardingHealth({ data: richer }).score).toBeGreaterThan(bare);
  });

  it('keeps rewarding photographs past the three-image minimum', () => {
    const three = onboardingHealth({ data: completeAnswers() }).score;

    const six = completeAnswers();
    six.IMAGES = {
      images: ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg'],
    };

    expect(onboardingHealth({ data: six }).score).toBeGreaterThan(three);
  });

  describe('documents', () => {
    it('earns nothing when none are uploaded', () => {
      const { breakdown } = onboardingHealth({ data: completeAnswers() });
      const documents = breakdown.find((part) => part.label === 'Documents verified');

      expect(documents?.earned).toBe(0);
      expect(documents?.detail).toContain('No documents');
    });

    it('earns full marks when all are verified', () => {
      const { breakdown } = onboardingHealth({
        data: completeAnswers(),
        documents: { identityDocument: 'VERIFIED', addressProof: 'VERIFIED' },
      });
      const documents = breakdown.find((part) => part.label === 'Documents verified');

      expect(documents?.earned).toBe(documents?.weight);
    });

    it('is penalised by a rejected document', () => {
      const good = onboardingHealth({
        data: completeAnswers(),
        documents: { a: 'VERIFIED', b: 'VERIFIED' },
      }).score;

      const bad = onboardingHealth({
        data: completeAnswers(),
        documents: { a: 'VERIFIED', b: 'REJECTED' },
      }).score;

      expect(bad).toBeLessThan(good);
    });

    it('never goes negative when everything is rejected', () => {
      const { breakdown } = onboardingHealth({
        data: completeAnswers(),
        documents: { a: 'REJECTED', b: 'REJECTED' },
      });
      const documents = breakdown.find((part) => part.label === 'Documents verified');

      expect(documents?.earned).toBe(0);
    });

    it('treats pending as not yet earned', () => {
      const pending = onboardingHealth({
        data: completeAnswers(),
        documents: { a: 'PENDING' },
      }).score;
      const verified = onboardingHealth({
        data: completeAnswers(),
        documents: { a: 'VERIFIED' },
      }).score;

      expect(pending).toBeLessThan(verified);
    });
  });

  it('explains every component', () => {
    const { breakdown } = onboardingHealth({ data: completeAnswers() });

    expect(breakdown.every((part) => part.detail.length > 0)).toBe(true);
  });
});
