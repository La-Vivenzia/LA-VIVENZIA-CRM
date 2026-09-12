import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_DASHBOARD_SUMMARY_ID } from 'src/constants/universal-identifiers';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { clampTimeZoneOffset } from 'src/modules/lv-dashboard/metrics/definitions';
import { resolveCaller, type DashboardLens } from 'src/modules/lv-dashboard/services/caller-context';
import { buildDashboardSummary } from 'src/modules/lv-dashboard/services/dashboard-summary';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// POST /dashboard/summary { lens?, timeZoneOffsetMinutes? }
//
// The role dashboard for whoever is signed in. Runs DELEGATED: every count and
// list is computed by the database under the caller's own permissions and
// CM-004 scoping — the route adds no visibility, it only chooses the shape.
//
// The lens is derived from the caller's permissions server-side; a requested
// lens is honoured only if it is one the caller may use. Nothing in the body
// names a member, an owner or a role.

const LENSES: DashboardLens[] = ['HUNTER', 'COORDINATOR', 'ONBOARDING', 'ADMIN', 'OVERSIGHT'];

type Input = { lens?: unknown; timeZoneOffsetMinutes?: unknown };

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Dashboards are for signed-in team members.' };
  }

  try {
    const client = new DelegatedGraphqlClient();
    const caller = await resolveCaller(client);
    const requested = typeof input.lens === 'string' && (LENSES as string[]).includes(input.lens) ? (input.lens as DashboardLens) : null;
    const lens = requested && caller.availableLenses.includes(requested) ? requested : caller.lens;

    const summary = await buildDashboardSummary({
      client,
      caller,
      lens,
      now: new Date().toISOString(),
      timeZoneOffsetMinutes: clampTimeZoneOffset(input.timeZoneOffsetMinutes),
    });

    return {
      ok: true,
      ...summary,
      capabilities: {
        isAdmin: caller.isAdmin,
        controlTower: caller.isAdmin,
      },
    };
  } catch (error) {
    // Never a stack trace to the browser; the detail goes to the function log.
    console.error('[lv-dashboard-summary]', error instanceof Error ? error.message : String(error));

    return { ok: false, error: 'The dashboard could not be loaded. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_DASHBOARD_SUMMARY_ID,
  name: 'lv-dashboard-summary',
  description: 'Role-aware operational dashboard for the signed-in member, computed server-side under CM-004',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/dashboard/summary',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
