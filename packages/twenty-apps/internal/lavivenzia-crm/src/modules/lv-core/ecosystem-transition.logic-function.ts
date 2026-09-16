import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_ECOSYSTEM_TRANSITION_ID } from 'src/constants/universal-identifiers';
import { applyListingTransition, applyOwnerChange, applyPartnerTransition, type EcosystemKind, listingReadiness, loadListing, loadListingsForPartner, loadOnboardingWithDocuments, loadPartner, partnerReadiness } from 'src/modules/lv-core/services/ecosystem-service';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// POST /ecosystem/transition { kind: 'partner' | 'experience' | 'property', id, action?: 'STATUS' | 'OWNER', to?, reason?, ownerId? }
//
// The one door for partner / experience / property lifecycle and ownership.
// Actor from the session; the record is read as the caller (permissions
// decide whether it exists for them); the transition table, the governance
// rule (no self-approval), the readiness gate and the platform's own write
// permission all have to agree; every outcome — applied or refused — is an
// audit row.

type Input = { kind?: unknown; id?: unknown; action?: unknown; to?: unknown; reason?: unknown; ownerId?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: EcosystemKind[] = ['partner', 'experience', 'property'];

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can change ecosystem records.' };
  }

  const kind = KINDS.find((candidate) => candidate === input.kind);

  if (!kind || typeof input.id !== 'string' || !UUID.test(input.id)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'kind (partner | experience | property) and a UUID id are required.' };
  }

  const action = input.action === 'OWNER' ? 'OWNER' : 'STATUS';
  const reason = typeof input.reason === 'string' && input.reason.trim().length > 0 ? input.reason.trim().slice(0, 500) : null;
  const delegated = new DelegatedGraphqlClient();
  const application = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();

  try {
    const caller = await resolveCaller(delegated);

    if (caller.workspaceMemberId === null) {
      return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can change ecosystem records.' };
    }

    if (kind === 'partner') {
      const partner = await loadPartner(delegated, input.id);

      if (!partner || partner.deletedAt) {
        return { ok: false, refusal: 'NOT_FOUND', error: 'Partner not found.' };
      }

      if (action === 'OWNER') {
        const ownerId = typeof input.ownerId === 'string' && UUID.test(input.ownerId) ? input.ownerId : null;

        return await applyOwnerChange({ delegated, application, caller, kind, record: partner, newOwnerId: ownerId, now });
      }

      if (typeof input.to !== 'string') {
        return { ok: false, refusal: 'INVALID_INPUT', error: 'to is required.' };
      }

      return await applyPartnerTransition({
        delegated,
        application,
        caller,
        partner,
        to: input.to,
        reason,
        now,
        readiness: async () => {
          const [{ onboarding, documents }, experiences, properties] = await Promise.all([loadOnboardingWithDocuments(delegated, partner.onboardingId), loadListingsForPartner(delegated, 'experience', partner.id), loadListingsForPartner(delegated, 'property', partner.id)]);

          return partnerReadiness({ partner, onboarding, documents, experiences, properties, now });
        },
      });
    }

    const listing = await loadListing(delegated, kind, input.id);

    if (!listing || listing.deletedAt) {
      return { ok: false, refusal: 'NOT_FOUND', error: `${kind === 'experience' ? 'Experience' : 'Property'} not found.` };
    }

    if (action === 'OWNER') {
      const ownerId = typeof input.ownerId === 'string' && UUID.test(input.ownerId) ? input.ownerId : null;

      return await applyOwnerChange({ delegated, application, caller, kind, record: listing, newOwnerId: ownerId, now });
    }

    if (typeof input.to !== 'string') {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'to is required.' };
    }

    return await applyListingTransition({
      delegated,
      application,
      caller,
      kind,
      listing,
      to: input.to,
      reason,
      now,
      readiness: async () => listingReadiness({ kind, listing, partner: listing.partnerId ? await loadPartner(delegated, listing.partnerId) : null, now }),
    });
  } catch (error) {
    console.error('[lv-ecosystem] transition failed:', error instanceof Error ? error.message : String(error));

    return { ok: false, error: 'The change could not be applied. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_ECOSYSTEM_TRANSITION_ID,
  name: 'lv-ecosystem-transition',
  description: 'Applies a partner / experience / property lifecycle or ownership change with server-side transition, permission, self-approval and readiness guards, audited',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/ecosystem/transition', httpMethod: 'POST', isAuthRequired: true },
});
