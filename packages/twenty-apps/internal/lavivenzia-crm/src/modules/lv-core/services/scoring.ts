// Opportunity score and relationship health — deliberately NOT computed.
//
// AI-INTELLIGENCE.md names ten factors for the opportunity score ("strategic
// relevance, uniqueness, location, quality, demand, digital presence,
// reviews/reputation, completeness, customer appeal and partnership
// potential") and asks that the score always be explained. It defines no
// weights, no thresholds and no data source for any of them, and six have no
// corresponding field anywhere in the schema. Relationship health is named in
// DATA-MODEL.md and PRODUCT-REQUIREMENTS.md with no definition at all.
//
// A number invented to fill those fields would be worse than an empty one: a
// coordinator would sort by it, prioritise by it and trust it, and it would
// mean nothing. So the contract exists, the fields stay null, and what is
// missing is written down where the next person will find it.
//
// This file contains no scoring arithmetic on purpose. When the business
// inputs below are settled, implement a ScoringEngine and register it; nothing
// else has to change.

import { type LeadPriority, type LeadStatus } from 'src/modules/lv-core/constants/lead-lifecycle';

// Everything about a lead that a scorer could legitimately see today. If a
// factor cannot be derived from this shape, its input does not yet exist.
export type ScoringSubject = {
  leadId: string;
  category: string | null;
  subcategory: string | null;
  location: string | null;
  source: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  // 0-100, already computed at capture time from which fields were supplied.
  dataCompleteness: number | null;
  hasWebsite: boolean;
  hasInstagram: boolean;
  interactionCount: number;
  lastInteractionAt: string | null;
  createdAt: string;
};

export type ScoreExplanation = {
  factor: string;
  contribution: number;
  evidence: string;
};

export type Score = {
  // 0-100.
  value: number;
  // AI-INTELLIGENCE.md: "Always explain the score." A scorer that cannot
  // explain itself does not satisfy the requirement, so this is not optional.
  explanation: readonly ScoreExplanation[];
  computedAt: string;
};

export type ScoringOutcome =
  | { ok: true; score: Score }
  | { ok: false; reason: 'NOT_IMPLEMENTED'; missingInputs: readonly string[] };

export type ScoringEngine = {
  scoreOpportunity(subject: ScoringSubject): ScoringOutcome;
  scoreRelationshipHealth(subject: ScoringSubject): ScoringOutcome;
};

// What the specification names but the system cannot yet observe. Each entry
// is a real blocker: a decision or a data source that does not exist.
export const OPPORTUNITY_SCORE_MISSING_INPUTS = [
  'strategic relevance — no definition of what La Vivenzia considers strategic, and no field holding it',
  'uniqueness — no comparable-inventory data to judge distinctiveness against',
  'quality — no inspection, rating or standards data captured anywhere',
  'demand — no booking, enquiry-volume or seasonality signal exists',
  'reviews/reputation — no external review source is integrated',
  'customer appeal — undefined; overlaps quality and demand with no stated distinction',
  'partnership potential — undefined; no commercial terms are recorded on a lead',
  'weights — the ten factors are listed with no relative importance',
  'thresholds — no stated mapping from factors to a 0-100 value',
] as const;

export const RELATIONSHIP_HEALTH_MISSING_INPUTS = [
  'definition — named in DATA-MODEL.md and PRODUCT-REQUIREMENTS.md, defined nowhere',
  'scale — no stated range, banding or meaning for a healthy value',
  'decay — no rule for how silence degrades health over time',
  'inputs — no statement of which signals (recency, sentiment, reciprocity) count, or how much',
] as const;

// The engine the application currently runs with. It refuses, by design, and
// says exactly why. Swap it for a real implementation once the inputs exist.
export const unavailableScoringEngine: ScoringEngine = {
  scoreOpportunity: () => ({
    ok: false,
    reason: 'NOT_IMPLEMENTED',
    missingInputs: OPPORTUNITY_SCORE_MISSING_INPUTS,
  }),
  scoreRelationshipHealth: () => ({
    ok: false,
    reason: 'NOT_IMPLEMENTED',
    missingInputs: RELATIONSHIP_HEALTH_MISSING_INPUTS,
  }),
};

// Writers call this. It returns null while no engine can score, which is what
// keeps the database column honestly empty instead of confidently wrong.
export const scoreOrNull = (
  outcome: ScoringOutcome,
): number | null => (outcome.ok ? outcome.score.value : null);
