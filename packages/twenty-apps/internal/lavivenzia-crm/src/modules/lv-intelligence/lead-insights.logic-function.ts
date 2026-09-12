import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_AI_LEAD_INSIGHTS_ID } from 'src/constants/universal-identifiers';
import { computeDeterministicInsights, storedModelInsights } from 'src/modules/lv-intelligence/services/lead-intelligence';
import { beginLeadRoute, internalError, isRefusal } from 'src/modules/lv-intelligence/services/route-support';

// POST /ai/lead/insights { leadId, includeDuplicates? }
//
// The lead Intelligence tab's first request: deterministic insights
// (opportunity score, relationship health, next best action, data quality,
// duplicates) computed now from what the caller can see, plus whatever model
// insights (summary, classification, conversation summaries, drafts, problem
// suggestions) are already stored. Never calls the model — that is a
// separate, explicit request — so the tab is fast and free by default.

type Input = { leadId?: unknown; includeDuplicates?: unknown };

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const session = await beginLeadRoute<Input>(event);

  if (isRefusal(session)) {
    return session;
  }

  try {
    const bundle = await computeDeterministicInsights({
      context: session.context,
      delegated: session.delegated,
      application: session.application,
      actorWorkspaceMemberId: session.actorWorkspaceMemberId,
      includeDuplicates: session.input.includeDuplicates !== false,
    });
    const model = await storedModelInsights(session.application, session.context.lead.id);

    return {
      ok: true,
      lead: { id: session.context.lead.id, lvLeadId: session.context.lead.lvLeadId, name: session.context.lead.name, category: session.context.lead.category, subcategory: session.context.lead.subcategory, status: session.context.lead.status },
      ai: session.availability,
      facts: {
        interactionCount: bundle.facts.interactionCount,
        daysSinceLastInteraction: bundle.facts.daysSinceLastInteraction,
        openTasks: bundle.facts.openTasks.length,
        overdueTasks: bundle.facts.overdueTasks.length,
        breachedSlas: bundle.facts.breachedSlas.length,
      },
      opportunity: bundle.opportunity,
      health: bundle.health,
      nextBestAction: bundle.nextBestAction,
      dataQuality: bundle.dataQuality,
      duplicates: bundle.duplicates,
      insights: bundle.insights,
      modelInsights: model,
      recentInteractions: session.context.interactions.slice(0, 5).map((row) => ({ id: row.id, name: row.name, channel: row.channel, direction: row.direction, occurredAt: row.occurredAt, hasNotes: Boolean(row.summary && row.summary.trim().length >= 20) })),
      onboarding: session.context.onboarding ? { id: session.context.onboarding.id, status: session.context.onboarding.status } : null,
      persisted: bundle.persisted,
    };
  } catch (error) {
    return internalError('lv-ai-lead-insights', error);
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_AI_LEAD_INSIGHTS_ID,
  name: 'lv-ai-lead-insights',
  description: 'Deterministic lead intelligence (score, health, next best action, data quality, duplicates) plus stored AI insights, under the caller’s permissions',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/ai/lead/insights', httpMethod: 'POST', isAuthRequired: true },
});
