import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_PERMANENT_DELETE_ID } from 'src/constants/universal-identifiers';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { isDeletableObject, type DeletableObject, type Dependents } from 'src/modules/lv-governance/services/governance';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

// POST /records/delete-impact { object, recordId }
//
// The pre-flight for a permanent deletion: what depends on the record, and
// whether THIS caller holds the destroy permission for that object (read from
// the platform's view of the caller, never from the body).
//
// Why the route does not delete: a logic function acts with the application's
// own role even when delegated, and that role deliberately has no destroy or
// soft-delete permission (see roles/default-role.ts) — verified live: a Main
// Admin's delegated destroy is refused by the platform. Permanent deletion is
// therefore Twenty's own two-step path (Delete → Trash → Permanently destroy),
// gated by the caller's role permission (only Main Admin holds destroy), and
// every trash / restore / destroy is audited by the *.deleted / *.restored /
// *.destroyed event functions in this module, whichever path performed it.

type Input = { object?: unknown; recordId?: unknown };

const UUID = /^[0-9a-f-]{36}$/i;

const SINGULAR: Record<DeletableObject, string> = {
  lvLead: 'lvLead',
  lvOnboarding: 'lvOnboarding',
  lvOnboardingDocument: 'lvOnboardingDocument',
};

const count = async (client: CoreApiClient, plural: string, filter: Record<string, unknown>): Promise<number> => {
  try {
    const result = await client.query({ [plural]: { __args: { first: 1, filter }, totalCount: true } });

    return Number((result as Record<string, { totalCount?: number }>)[plural]?.totalCount ?? 0);
  } catch {
    return 0;
  }
};

// What a destroy takes with it (CASCADE) or orphans (SET_NULL). Counted with
// the application role so the numbers are complete even when the caller
// cannot see some dependents.
export const countDependents = async (application: CoreApiClient, object: DeletableObject, recordId: string): Promise<Dependents> => {
  if (object === 'lvLead') {
    return {
      interactions: await count(application, 'lvInteractions', { leadId: { eq: recordId } }),
      onboardings: await count(application, 'lvOnboardings', { leadId: { eq: recordId } }),
      assignmentHistory: await count(application, 'lvAssignmentHistories', { leadId: { eq: recordId } }),
      notifications: await count(application, 'lvNotifications', { leadId: { eq: recordId } }),
      slas: await count(application, 'lvSlas', { leadId: { eq: recordId } }),
      followUpTasks: await count(application, 'taskTargets', { targetLvLeadId: { eq: recordId } }),
      notes: await count(application, 'noteTargets', { targetLvLeadId: { eq: recordId } }),
    };
  }

  if (object === 'lvOnboarding') {
    return {
      documents: await count(application, 'lvOnboardingDocuments', { onboardingId: { eq: recordId } }),
      slas: await count(application, 'lvSlas', { onboardingId: { eq: recordId } }),
    };
  }

  return {
    slas: await count(application, 'lvSlas', { documentId: { eq: recordId } }),
    replacements: await count(application, 'lvOnboardingDocuments', { replacesId: { eq: recordId } }),
  };
};

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can review a deletion.' };
  }

  if (!isDeletableObject(input.object)) {
    return { ok: false, error: 'object must be lvLead, lvOnboarding or lvOnboardingDocument.' };
  }

  if (typeof input.recordId !== 'string' || !UUID.test(input.recordId)) {
    return { ok: false, error: 'recordId is required.' };
  }

  const object = input.object;
  const recordId = input.recordId;
  const delegated = new CoreApiClient();

  let label = recordId;
  let exists = false;

  try {
    const result = await delegated.query({
      [SINGULAR[object]]: { __args: { filter: { id: { eq: recordId } } }, id: true, name: true },
    });
    const row = (result as Record<string, { id?: string; name?: string | null } | null>)[SINGULAR[object]];

    exists = Boolean(row?.id);
    label = row?.name?.trim() || recordId;
  } catch {
    exists = false;
  }

  if (!exists) {
    return { ok: false, refusal: 'NOT_FOUND', error: 'That record does not exist.' };
  }

  try {
    const caller = await resolveCaller(new DelegatedGraphqlClient());
    const permission = caller.objectPermissions[object];
    const dependents = await countDependents(new CoreApiClient({ runAs: 'application' }), object, recordId);

    return {
      ok: true,
      object,
      recordId,
      label,
      dependents,
      dependentTotal: Object.values(dependents).reduce((sum, value) => sum + value, 0),
      canSoftDelete: permission?.softDelete === true,
      canDestroy: permission?.destroy === true,
      path: [
        'Delete the record (moves it to the trash; audited as TRASH).',
        'Open Settings → Trash, or the record in the trash view, and choose “Permanently destroy” (audited as PERMANENT_DELETE).',
        'Only the Main Admin role holds the destroy permission; everyone else is refused by the platform.',
      ],
    };
  } catch (error) {
    console.error('[lv-delete-impact]', describeError(error));

    return { ok: false, error: 'The deletion impact could not be computed. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_PERMANENT_DELETE_ID,
  name: 'lv-delete-impact',
  description: 'Pre-flight for permanent deletion: dependents that would be destroyed or unlinked, and whether the caller may destroy',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/records/delete-impact',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
