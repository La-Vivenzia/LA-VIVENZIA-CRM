import { describe, expect, it } from 'vitest';

import {
  OPPORTUNITY_SCORE_MISSING_INPUTS,
  RELATIONSHIP_HEALTH_MISSING_INPUTS,
  scoreOrNull,
  unavailableScoringEngine,
  type ScoringSubject,
} from 'src/modules/lv-core/services/scoring';

const subject: ScoringSubject = {
  leadId: 'lead-1',
  category: 'STAY',
  subcategory: 'VILLA',
  location: 'Lonavala',
  source: 'WEBSITE',
  status: 'NEW',
  priority: 'HIGH',
  dataCompleteness: 80,
  hasWebsite: true,
  hasInstagram: true,
  interactionCount: 3,
  lastInteractionAt: '2026-09-10T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('scoring is refused, not faked', () => {
  it('refuses to produce an opportunity score', () => {
    const outcome = unavailableScoringEngine.scoreOpportunity(subject);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('NOT_IMPLEMENTED');
    }
  });

  it('refuses to produce a relationship health score', () => {
    const outcome = unavailableScoringEngine.scoreRelationshipHealth(subject);

    expect(outcome.ok).toBe(false);
  });

  it('yields null for the database column rather than a number', () => {
    expect(scoreOrNull(unavailableScoringEngine.scoreOpportunity(subject))).toBeNull();
    expect(
      scoreOrNull(unavailableScoringEngine.scoreRelationshipHealth(subject)),
    ).toBeNull();
  });

  it('names every blocker, so the gap is actionable rather than vague', () => {
    const outcome = unavailableScoringEngine.scoreOpportunity(subject);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.missingInputs).toBe(OPPORTUNITY_SCORE_MISSING_INPUTS);
      // Every factor AI-INTELLIGENCE.md names without a data source, plus the
      // two structural gaps (weights, thresholds).
      expect(outcome.missingInputs.length).toBeGreaterThanOrEqual(9);
    }
  });

  it('records that relationship health has no definition at all', () => {
    expect(RELATIONSHIP_HEALTH_MISSING_INPUTS[0]).toContain('defined nowhere');
  });

  it('is deterministic: refusing twice refuses identically', () => {
    expect(unavailableScoringEngine.scoreOpportunity(subject)).toEqual(
      unavailableScoringEngine.scoreOpportunity(subject),
    );
  });
});
