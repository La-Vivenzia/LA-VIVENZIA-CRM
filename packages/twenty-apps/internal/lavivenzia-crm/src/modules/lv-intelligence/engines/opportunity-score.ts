import { type LeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { PROMPT_VERSIONS } from 'src/modules/lv-ai/prompts/prompt-registry';

// Opportunity Score v1 — the "engagement & readiness" model.
//
// Day 1 refused to invent a score because AI-INTELLIGENCE.md named ten
// factors (strategic relevance, uniqueness, demand, reputation, …) with no
// weights and no data behind six of them. That is still true. This model does
// NOT pretend to measure those. It measures only what the CRM records today —
// where the lead is in the funnel, whether the partner engages, how recently,
// how complete the qualification data is, and whether the deal is moving —
// with weights written down here and repeated in DAY_6_AI_INTELLIGENCE.md.
//
// Model (0–100, clamped):
//   Funnel stage      0–40   from status (table below)
//   Responsiveness    0–20   inbound interactions: ≥2 → 20, 1 → 12, none but
//                            outbound exists → 4, none at all → 0
//   Recency           0–15   last interaction ≤3d → 15, ≤7d → 11, ≤14d → 7,
//                            ≤30d → 3, older → 0
//   Qualification     0–15   dataCompleteness × 0.15 (null → 0, counted
//                            as missing information)
//   Momentum          0–10   next follow-up scheduled and not overdue → 6,
//                            open onboarding progressing → +4
//   Penalties         −25    breached/escalated SLA −10, overdue follow-up
//                            −6, awaiting response >7d −5, no contact channel
//                            −4 (cap −25)
//
// SCORE_UNAVAILABLE when the lead has no interaction, no completeness figure
// and no status beyond DISCOVERED/NEW — there is nothing to score but the
// lead's existence, and a number there would be fiction.
//
// Positive/negative/missing lists are the explanation; the UI shows them
// verbatim next to the number.

export const OPPORTUNITY_RULES_VERSION = PROMPT_VERSIONS.opportunityScore;

export const STAGE_POINTS: Record<string, number> = {
  DISCOVERED: 2,
  NEW: 4,
  QUALIFYING: 8,
  ASSIGNED: 10,
  CONTACTED: 14,
  ENGAGED: 20,
  INTERESTED: 28,
  NEGOTIATION: 34,
  ONBOARDING_INITIATED: 36,
  ONBOARDING_IN_PROGRESS: 38,
  VERIFICATION: 39,
  APPROVED: 40,
  LIVE_ACTIVE: 40,
  GROWTH: 40,
  FOLLOW_UP_LATER: 10,
  NO_RESPONSE: 4,
};

export type ScoreFactor = { factor: string; points: number; evidence: string };

export type OpportunityScoreResult =
  | {
      available: true;
      score: number;
      positive: ScoreFactor[];
      negative: ScoreFactor[];
      missing: string[];
      rulesVersion: string;
      generatedAt: string;
    }
  | { available: false; reason: 'SCORE_UNAVAILABLE'; detail: string; missing: string[]; rulesVersion: string; generatedAt: string };

const HIGH_OPPORTUNITY_THRESHOLD = 70;

export const isHighOpportunity = (score: number | null | undefined): boolean => typeof score === 'number' && score >= HIGH_OPPORTUNITY_THRESHOLD;

export const scoreOpportunity = (facts: LeadFacts): OpportunityScoreResult => {
  const missing: string[] = [];
  const generatedAt = facts.now;

  if (facts.isInactive && facts.status !== 'FOLLOW_UP_LATER' && facts.status !== 'NO_RESPONSE') {
    return {
      available: false,
      reason: 'SCORE_UNAVAILABLE',
      detail: `The lead is ${facts.status.toLowerCase().replace(/_/g, ' ')}; closed and archived leads are not scored.`,
      missing,
      rulesVersion: OPPORTUNITY_RULES_VERSION,
      generatedAt,
    };
  }

  const bareLead = facts.interactionCount === 0 && facts.dataCompleteness === null && (facts.status === 'DISCOVERED' || facts.status === 'NEW');

  if (bareLead) {
    return {
      available: false,
      reason: 'SCORE_UNAVAILABLE',
      detail: 'Insufficient data: no interaction has been recorded and the qualification data is not assessed yet.',
      missing: ['first interaction', 'qualification data (contact, organisation, location, category)'],
      rulesVersion: OPPORTUNITY_RULES_VERSION,
      generatedAt,
    };
  }

  const positive: ScoreFactor[] = [];
  const negative: ScoreFactor[] = [];

  const stage = STAGE_POINTS[facts.status] ?? 0;

  positive.push({ factor: 'Funnel stage', points: stage, evidence: `Status ${facts.status.toLowerCase().replace(/_/g, ' ')}` });

  let responsiveness = 0;

  if (facts.inboundCount >= 2) {
    responsiveness = 20;
  } else if (facts.inboundCount === 1) {
    responsiveness = 12;
  } else if (facts.outboundCount > 0) {
    responsiveness = 4;
  }

  if (responsiveness > 0) {
    positive.push({ factor: 'Responsiveness', points: responsiveness, evidence: `${facts.inboundCount} inbound, ${facts.outboundCount} outbound interaction(s)` });
  } else {
    missing.push('any recorded interaction');
  }

  const days = facts.daysSinceLastInteraction;
  const recency = days === null ? 0 : days <= 3 ? 15 : days <= 7 ? 11 : days <= 14 ? 7 : days <= 30 ? 3 : 0;

  if (recency > 0) {
    positive.push({ factor: 'Recency', points: recency, evidence: `Last interaction ${days} day(s) ago` });
  } else if (days !== null) {
    negative.push({ factor: 'Recency', points: 0, evidence: `Last interaction ${days} day(s) ago` });
  }

  if (facts.dataCompleteness === null) {
    missing.push('qualification completeness');
  } else {
    const qualification = Math.round(facts.dataCompleteness * 0.15);

    positive.push({ factor: 'Qualification data', points: qualification, evidence: `${facts.dataCompleteness}% of qualification fields present` });
  }

  let momentum = 0;

  if (facts.nextFollowUpAt && !facts.nextFollowUpOverdue) {
    momentum += 6;
    positive.push({ factor: 'Next follow-up scheduled', points: 6, evidence: `Follow-up on ${facts.nextFollowUpAt.slice(0, 10)}` });
  } else {
    missing.push('next follow-up date');
  }

  if (facts.onboarding && facts.onboarding.status && !['ACTIVATED', 'REJECTED', 'NOT_STARTED'].includes(facts.onboarding.status)) {
    momentum += 4;
    positive.push({ factor: 'Onboarding in progress', points: 4, evidence: `Onboarding ${facts.onboarding.status.toLowerCase().replace(/_/g, ' ')}${facts.onboarding.progress !== null ? `, ${facts.onboarding.progress}%` : ''}` });
  }

  let penalty = 0;

  if (facts.breachedSlas.length > 0) {
    penalty += 10;
    negative.push({ factor: 'SLA breached', points: -10, evidence: `${facts.breachedSlas.length} breached / escalated SLA(s)` });
  }

  if (facts.overdueTasks.length > 0 || facts.nextFollowUpOverdue) {
    penalty += 6;
    negative.push({ factor: 'Overdue follow-up', points: -6, evidence: facts.overdueTasks[0] ? `"${facts.overdueTasks[0].title ?? 'Follow-up'}" overdue by ${facts.overdueTasks[0].overdueDays} day(s)` : 'Next follow-up date has passed' });
  }

  if (facts.awaitingResponseDays !== null && facts.awaitingResponseDays > 7) {
    penalty += 5;
    negative.push({ factor: 'Waiting for response', points: -5, evidence: `No reply for ${facts.awaitingResponseDays} day(s)` });
  }

  if (!facts.hasEmail && !facts.hasPhone) {
    penalty += 4;
    negative.push({ factor: 'No contact channel', points: -4, evidence: 'Neither email nor phone recorded' });
    missing.push('email or phone');
  }

  if (!facts.hasCategory) {
    missing.push('category');
  }

  if (!facts.hasLocation) {
    missing.push('location');
  }

  const raw = stage + responsiveness + recency + (facts.dataCompleteness === null ? 0 : Math.round(facts.dataCompleteness * 0.15)) + momentum - Math.min(25, penalty);
  const score = Math.max(0, Math.min(100, raw));

  return { available: true, score, positive: positive.filter((f) => f.points > 0), negative, missing, rulesVersion: OPPORTUNITY_RULES_VERSION, generatedAt };
};
