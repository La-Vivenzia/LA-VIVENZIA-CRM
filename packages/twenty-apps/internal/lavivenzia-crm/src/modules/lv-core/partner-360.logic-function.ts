import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_PARTNER_360_ID } from 'src/constants/universal-identifiers';
import { composePartner360 } from 'src/modules/lv-core/services/ecosystem-360';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// POST /partners/360 { partnerId }
//
// One request builds the whole Partner 360 (ecosystem-360.ts): records read as
// the caller, readiness computed without persisting, actions decided from
// the caller's own permissions. An API key (no session member) is refused.

type Input = { partnerId?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Partner 360 is for signed-in team members.' };
  }

  if (typeof input.partnerId !== 'string' || !UUID.test(input.partnerId)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'partnerId must be a UUID.' };
  }

  try {
    const delegated = new DelegatedGraphqlClient();
    const caller = await resolveCaller(delegated);

    if (caller.workspaceMemberId === null) {
      return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Partner 360 is for signed-in team members.' };
    }

    return await composePartner360({ delegated, application: new CoreApiClient({ runAs: 'application' }), caller: { ...caller, workspaceMemberId: caller.workspaceMemberId }, partnerId: input.partnerId, now: new Date().toISOString() });
  } catch (error) {
    console.error('[lv-partner-360]', error instanceof Error ? error.message : String(error));

    return { ok: false, error: 'The page could not be loaded. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_PARTNER_360_ID,
  name: 'lv-partner-360',
  description: 'Composes the Partner 360 page — record, relations, onboarding, documents, readiness, timeline, audit and permitted actions — as the caller',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/partners/360', httpMethod: 'POST', isAuthRequired: true },
});
