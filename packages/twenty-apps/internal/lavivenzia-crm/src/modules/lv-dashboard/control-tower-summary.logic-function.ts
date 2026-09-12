import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_CONTROL_TOWER_SUMMARY_ID } from 'src/constants/universal-identifiers';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { parseControlTowerFilters } from 'src/modules/lv-dashboard/metrics/control-tower-filters';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { buildControlTowerSummary } from 'src/modules/lv-dashboard/services/control-tower-summary';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// POST /control-tower/summary { filters? }
//
// Admin-only. Authorization is decided here from the platform's view of the
// caller (the WORKSPACE settings permission, which the Main Admin / Admin
// roles hold and no team role does) — not from a flag in the body, not from
// the sidebar hiding the page. Everything below runs delegated, so an
// administrator's own object permissions still bound what is returned.

type Input = { filters?: unknown };

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'The Control Tower is for signed-in administrators.' };
  }

  try {
    const client = new DelegatedGraphqlClient();
    const caller = await resolveCaller(client);

    if (!caller.isAdmin) {
      return {
        ok: false,
        refusal: 'NOT_AUTHORIZED',
        error: 'The Control Tower is available to administrators only.',
      };
    }

    const summary = await buildControlTowerSummary({
      client,
      filters: parseControlTowerFilters(input.filters),
      now: new Date().toISOString(),
    });

    return { ok: true, ...summary };
  } catch (error) {
    console.error('[lv-control-tower-summary]', error instanceof Error ? error.message : String(error));

    return { ok: false, error: 'The Control Tower could not be loaded. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_CONTROL_TOWER_SUMMARY_ID,
  name: 'lv-control-tower-summary',
  description: 'Admin Control Tower: pipeline-wide operational summary with server-side filters; refuses non-administrators',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/control-tower/summary',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
