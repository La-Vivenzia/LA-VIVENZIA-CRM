import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_AI_SCORE_REFRESH_ID } from 'src/constants/universal-identifiers';
import { applicationClient } from 'src/modules/lv-ai/runtime/clients';
import { OPEN_WORKLOAD_STATUSES } from 'src/modules/lv-dashboard/metrics/definitions';
import { loadLeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { computeDeterministicInsights } from 'src/modules/lv-intelligence/services/lead-intelligence';

// Hourly: recompute the deterministic insights for open leads so that
// time-based signals (recency, overdue, silence) and the mirrored
// opportunityScore stay current without anyone opening the lead. Bounded to
// 100 leads per run, most recently updated first; day-granular fingerprints
// mean an unchanged lead costs nothing to re-check. No model call here, ever.

const BATCH = 100;

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const clock = typeof (event as { clock?: unknown } | null)?.clock === 'string' ? String((event as { clock: string }).clock) : new Date().toISOString();

  try {
    const application = applicationClient();
    const { data } = await application.query<{ lvLeads?: { edges: { node: { id: string } }[] } }>(
      `query($filter: LvLeadFilterInput) { lvLeads(first: ${BATCH}, filter: $filter, orderBy: [{ updatedAt: DescNullsLast }]) { edges { node { id } } } }`,
      { filter: { status: { in: [...OPEN_WORKLOAD_STATUSES] } } },
    );
    const ids = (data.lvLeads?.edges ?? []).map((edge) => edge.node.id);
    let refreshed = 0;
    let unchanged = 0;

    for (const id of ids) {
      const context = await loadLeadContext(application, application, id);

      if (!context) {
        continue;
      }

      const bundle = await computeDeterministicInsights({ context, delegated: application, application, actorWorkspaceMemberId: null, includeDuplicates: false, now: clock });

      if (bundle.persisted.length > 0) {
        refreshed += 1;
      } else {
        unchanged += 1;
      }
    }

    return { scanned: ids.length, refreshed, unchanged, clock };
  } catch (error) {
    console.error('[lv-ai-score-refresh]', error instanceof Error ? error.message : String(error));

    return { scanned: 0, error: 'failed' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_AI_SCORE_REFRESH_ID,
  name: 'lv-ai-score-refresh',
  description: 'Hourly deterministic refresh of opportunity score, relationship health, next best action and data quality for open leads',
  timeoutSeconds: 120,
  handler,
  cronTriggerSettings: { pattern: '17 * * * *' },
});
