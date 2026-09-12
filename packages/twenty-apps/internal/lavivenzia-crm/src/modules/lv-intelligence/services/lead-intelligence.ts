import { type AiInsightType } from 'src/modules/lv-ai/objects/ai-insight.object';
import { recordRulesRun } from 'src/modules/lv-ai/runtime/ai-runner';
import { type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';
import { fingerprintOf, type InsightRow, listInsightsForLead, upsertInsight } from 'src/modules/lv-ai/runtime/insight-store';
import { assessDataQuality, type DataQualityResult } from 'src/modules/lv-intelligence/engines/data-quality';
import { type DuplicateScanResult, scanDuplicates } from 'src/modules/lv-intelligence/engines/duplicate-scan';
import { deriveLeadFacts, type LeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { type NextBestActionResult, recommendNextBestAction } from 'src/modules/lv-intelligence/engines/next-best-action';
import { type OpportunityScoreResult, scoreOpportunity } from 'src/modules/lv-intelligence/engines/opportunity-score';
import { assessRelationshipHealth, type RelationshipHealthResult } from 'src/modules/lv-intelligence/engines/relationship-health';
import { type LeadContext, sourceRecordIds } from 'src/modules/lv-intelligence/services/lead-context';

// The deterministic half of lead intelligence: score, health, next best
// action, data quality and duplicates — computed from LeadFacts, persisted as
// RULES-origin insights, and mirrored (score only) onto the lead's
// engine-owned `opportunityScore` column so dashboards can count on it.
//
// Cost control: each engine's result carries a fingerprint of the facts it
// used. When the fingerprint matches the stored row nothing is written and no
// run is recorded; a page view of an unchanged lead costs zero writes.

export type DeterministicBundle = {
  facts: LeadFacts;
  opportunity: OpportunityScoreResult;
  health: RelationshipHealthResult;
  nextBestAction: NextBestActionResult;
  dataQuality: DataQualityResult;
  duplicates: DuplicateScanResult | null;
  insights: Record<string, InsightRow | null>;
  persisted: string[];
};

const factsFingerprint = (facts: LeadFacts, extra: unknown[] = []): string =>
  fingerprintOf([
    facts.status,
    facts.priority,
    facts.interactionCount,
    facts.inboundCount,
    facts.lastInteraction?.id ?? null,
    facts.lastInteraction?.outcome ?? null,
    facts.awaitingResponseSince,
    facts.hasEmail,
    facts.hasPhone,
    facts.hasCategory,
    facts.hasLocation,
    facts.hasNextAction,
    facts.nextFollowUpAt,
    facts.dataCompleteness,
    facts.openTasks.map((task) => `${task.id}:${task.dueAt ?? ''}`),
    facts.breachedSlas.map((sla) => sla.id),
    facts.onboarding ? [facts.onboarding.status, facts.onboarding.rejectedDocs, facts.onboarding.pendingDocs, facts.onboarding.expiredDocs] : null,
    facts.openProblems.map((problem) => problem.id),
    // Day-granular so "days since" buckets refresh without rewriting hourly.
    facts.now.slice(0, 10),
    ...extra,
  ]);

export const computeDeterministicInsights = async (options: {
  context: LeadContext;
  delegated: GraphqlClient;
  application: GraphqlClient;
  actorWorkspaceMemberId: string | null;
  includeDuplicates: boolean;
  now?: string;
}): Promise<DeterministicBundle> => {
  const { context, application } = options;
  const now = options.now ?? new Date().toISOString();
  const facts = deriveLeadFacts(context, now);
  const opportunity = scoreOpportunity(facts);
  const health = assessRelationshipHealth(facts);
  const nextBestAction = recommendNextBestAction(facts);
  const dataQuality = assessDataQuality(context, facts);
  const duplicates = options.includeDuplicates ? await scanDuplicates(options.delegated, context.lead, now).catch(() => null) : null;
  const sources = sourceRecordIds(context);
  const existing = await listInsightsForLead(application, context.lead.id);
  const persisted: string[] = [];
  const insights: Record<string, InsightRow | null> = {};

  const persist = async (type: AiInsightType, payload: unknown, summary: string, confidence: number | null, fingerprint: string, rulesVersion: string, extraSources: string[] = []) => {
    // A row computed from the same facts is reused whatever its status — a
    // rejected or dismissed suggestion must not reappear on the next page
    // view; only changed facts produce a new suggestion.
    const same = existing.find((row) => row.insightType === type && row.targetRecordId === context.lead.id && row.fingerprint === fingerprint && row.status !== 'UNAVAILABLE') ?? null;

    if (same) {
      insights[type] = same;

      return;
    }

    const startedAt = Date.now();
    const row = await upsertInsight(application, existing, {
      insightType: type,
      status: 'AI_SUGGESTED',
      origin: 'RULES',
      targetObject: 'lvLead',
      targetRecordId: context.lead.id,
      leadId: context.lead.id,
      provider: 'rules',
      model: null,
      promptVersion: rulesVersion,
      generatedAt: now,
      confidence,
      sourceRecordIds: [...sources, ...extraSources],
      payload,
      summary,
      fingerprint,
    });

    insights[type] = row;
    persisted.push(type);
    await recordRulesRun(
      application,
      { operation: type, actorWorkspaceMemberId: options.actorWorkspaceMemberId, targetObject: 'lvLead', targetRecordId: context.lead.id, sourceRecordIds: sources },
      rulesVersion,
      Date.now() - startedAt,
    );
  };

  const base = factsFingerprint(facts);

  await persist(
    'OPPORTUNITY_SCORE',
    opportunity,
    opportunity.available ? `Opportunity score ${opportunity.score}` : `Score unavailable: ${opportunity.detail}`,
    null,
    fingerprintOf([base, opportunity.rulesVersion]),
    opportunity.rulesVersion,
  );
  await persist('RELATIONSHIP_HEALTH', health, `Relationship ${health.state.toLowerCase()}: ${health.reasons.map((reason) => reason.reason).join('; ') || 'no concerns'}`, null, fingerprintOf([base, health.rulesVersion]), health.rulesVersion);
  await persist(
    'NEXT_BEST_ACTION',
    nextBestAction,
    nextBestAction.primary ? `${nextBestAction.primary.action}: ${nextBestAction.primary.title}` : 'No action recommended',
    nextBestAction.primary ? (nextBestAction.primary.confidence === 'HIGH' ? 0.9 : nextBestAction.primary.confidence === 'MEDIUM' ? 0.7 : 0.5) : null,
    fingerprintOf([base, nextBestAction.rulesVersion]),
    nextBestAction.rulesVersion,
  );
  await persist(
    'DATA_QUALITY',
    dataQuality,
    `${dataQuality.issues.length} data-quality issue(s), score ${dataQuality.score}`,
    null,
    fingerprintOf([base, dataQuality.rulesVersion, context.lead.emails?.primaryEmail ?? null, context.lead.website?.primaryLinkUrl ?? null, context.lead.organisationName, context.lead.name]),
    dataQuality.rulesVersion,
  );

  if (duplicates) {
    await persist(
      'DUPLICATE',
      duplicates,
      duplicates.candidates.length > 0 ? `${duplicates.candidates.length} possible duplicate(s), best ${duplicates.candidates[0]!.percent}%` : 'No duplicate candidate',
      duplicates.candidates[0] ? duplicates.candidates[0].percent / 100 : null,
      fingerprintOf([duplicates.rulesVersion, duplicates.candidates.map((candidate) => `${candidate.leadId}:${candidate.percent}`), context.lead.duplicateKeys ?? []]),
      duplicates.rulesVersion,
      duplicates.candidates.map((candidate) => candidate.leadId),
    );
  }

  // Mirror the deterministic score onto the lead's engine-owned column.
  const mirrored = opportunity.available ? opportunity.score : null;

  if (context.lead.opportunityScore !== mirrored) {
    await application
      .query(`mutation($id: UUID!, $data: LvLeadUpdateInput!) { updateLvLead(id: $id, data: $data) { id } }`, { id: context.lead.id, data: { opportunityScore: mirrored } })
      .catch(() => undefined);
  }

  return { facts, opportunity, health, nextBestAction, dataQuality, duplicates, insights, persisted };
};

// The model-origin insights already stored for the lead (summary,
// classification, conversation summaries, drafts, problem suggestions), so
// the page can show them without a new model call.
export const storedModelInsights = async (application: GraphqlClient, leadId: string): Promise<InsightRow[]> =>
  (await listInsightsForLead(application, leadId, ['LEAD_SUMMARY', 'CLASSIFICATION', 'CONVERSATION_SUMMARY', 'PROBLEM_SUGGESTION', 'DRAFT', 'ONBOARDING_ASSIST'])).filter(
    (row) => row.status !== 'AI_REJECTED',
  );
