import { describe, expect, it } from 'vitest';

import { aCandidate } from 'src/modules/lv-assignment/utils/__tests__/test-helpers';
import {
  FACTOR_WEIGHTS,
  MAX_FACTOR_SCORE,
  scoreCandidate,
} from 'src/modules/lv-assignment/utils/score-candidate';

const factor = (
  result: ReturnType<typeof scoreCandidate>,
  name: keyof typeof FACTOR_WEIGHTS,
) => result.factors.find((entry) => entry.factor === name);

describe('scoreCandidate', () => {
  it('weights sum to 100 so a total reads as a percentage fit', () => {
    expect(MAX_FACTOR_SCORE).toBe(100);
  });

  it('scores zero when nothing about the lead is known', () => {
    const result = scoreCandidate({
      lead: {},
      candidate: aCandidate({ workspaceMemberId: 'a' }),
    });

    expect(result.total).toBe(0);
    expect(result.factors.every((entry) => !entry.matched)).toBe(true);
  });

  describe('category', () => {
    it('matches a covered category', () => {
      const result = scoreCandidate({
        lead: { category: 'STAY' },
        candidate: aCandidate({ workspaceMemberId: 'a', categories: ['STAY'] }),
      });

      expect(factor(result, 'CATEGORY')?.matched).toBe(true);
      expect(result.total).toBe(FACTOR_WEIGHTS.CATEGORY);
    });

    it('does not match a different category', () => {
      const result = scoreCandidate({
        lead: { category: 'STAY' },
        candidate: aCandidate({ workspaceMemberId: 'a', categories: ['EXPERIENCE'] }),
      });

      expect(factor(result, 'CATEGORY')?.matched).toBe(false);
      expect(result.total).toBe(0);
    });
  });

  describe('geography', () => {
    it('matches an exact location', () => {
      const result = scoreCandidate({
        lead: { location: 'Lonavala' },
        candidate: aCandidate({ workspaceMemberId: 'a', regions: ['Lonavala'] }),
      });

      expect(factor(result, 'GEOGRAPHY')?.matched).toBe(true);
    });

    it('matches when the member covers a broader region than the lead', () => {
      const result = scoreCandidate({
        lead: { location: 'Lonavala, Maharashtra' },
        candidate: aCandidate({ workspaceMemberId: 'a', regions: ['Maharashtra'] }),
      });

      expect(factor(result, 'GEOGRAPHY')?.matched).toBe(true);
    });

    it('is case and punctuation insensitive', () => {
      const result = scoreCandidate({
        lead: { location: 'PUNE.' },
        candidate: aCandidate({ workspaceMemberId: 'a', regions: ['pune'] }),
      });

      expect(factor(result, 'GEOGRAPHY')?.matched).toBe(true);
    });

    it('does not match an unrelated region', () => {
      const result = scoreCandidate({
        lead: { location: 'Goa' },
        candidate: aCandidate({ workspaceMemberId: 'a', regions: ['Pune'] }),
      });

      expect(factor(result, 'GEOGRAPHY')?.matched).toBe(false);
    });
  });

  describe('language', () => {
    it('matches on any shared language', () => {
      const result = scoreCandidate({
        lead: { languages: ['Marathi', 'English'] },
        candidate: aCandidate({ workspaceMemberId: 'a', languages: ['English'] }),
      });

      expect(factor(result, 'LANGUAGE')?.matched).toBe(true);
    });

    it('does not match with no overlap', () => {
      const result = scoreCandidate({
        lead: { languages: ['Marathi'] },
        candidate: aCandidate({ workspaceMemberId: 'a', languages: ['French'] }),
      });

      expect(factor(result, 'LANGUAGE')?.matched).toBe(false);
    });
  });

  describe('expertise', () => {
    it('matches on sub-category', () => {
      const result = scoreCandidate({
        lead: { subcategory: 'VILLA' },
        candidate: aCandidate({ workspaceMemberId: 'a', subcategories: ['VILLA'] }),
      });

      expect(factor(result, 'EXPERTISE')?.matched).toBe(true);
    });
  });

  describe('existing relationship', () => {
    it('matches only the prior owner', () => {
      const result = scoreCandidate({
        lead: {},
        candidate: aCandidate({ workspaceMemberId: 'a' }),
        existingRelationshipOwnerId: 'a',
      });

      expect(factor(result, 'EXISTING_RELATIONSHIP')?.matched).toBe(true);
      expect(result.total).toBe(FACTOR_WEIGHTS.EXISTING_RELATIONSHIP);
    });

    it('does not match a different member', () => {
      const result = scoreCandidate({
        lead: {},
        candidate: aCandidate({ workspaceMemberId: 'b' }),
        existingRelationshipOwnerId: 'a',
      });

      expect(factor(result, 'EXISTING_RELATIONSHIP')?.matched).toBe(false);
    });

    it('outweighs any single other factor', () => {
      const weights = Object.entries(FACTOR_WEIGHTS)
        .filter(([name]) => name !== 'EXISTING_RELATIONSHIP')
        .map(([, weight]) => weight);

      expect(
        weights.every((weight) => weight < FACTOR_WEIGHTS.EXISTING_RELATIONSHIP),
      ).toBe(true);
    });
  });

  it('accumulates every matched factor to a perfect fit', () => {
    const result = scoreCandidate({
      lead: {
        category: 'STAY',
        subcategory: 'VILLA',
        location: 'Lonavala',
        languages: ['English'],
      },
      candidate: aCandidate({
        workspaceMemberId: 'a',
        categories: ['STAY'],
        subcategories: ['VILLA'],
        regions: ['Lonavala'],
        languages: ['English'],
      }),
      existingRelationshipOwnerId: 'a',
    });

    expect(result.total).toBe(100);
  });

  it('explains every factor whether or not it matched', () => {
    const result = scoreCandidate({
      lead: { category: 'STAY' },
      candidate: aCandidate({ workspaceMemberId: 'a' }),
    });

    expect(result.factors).toHaveLength(5);
    expect(result.factors.every((entry) => entry.detail.length > 0)).toBe(true);
  });
});
