import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_ECOSYSTEM_READINESS_ID } from 'src/constants/universal-identifiers';
import { type EcosystemKind, listingReadiness, loadListing, loadListingsForPartner, loadOnboardingWithDocuments, loadPartner, partnerReadiness } from 'src/modules/lv-core/services/ecosystem-service';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// POST /ecosystem/readiness { kind, id }
//
// The deterministic activation-readiness check on its own (the 360 pages
// embed the same result; Lead 360 and the dashboards call this). Reads as the
// caller; computes; persists nothing.

type Input = { kind?: unknown; id?: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Readiness is for signed-in team members.' };
  }

  const kind = (['partner', 'experience', 'property'] as EcosystemKind[]).find((candidate) => candidate === input.kind);

  if (!kind || typeof input.id !== 'string' || !UUID.test(input.id)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'kind and a UUID id are required.' };
  }

  const delegated = new DelegatedGraphqlClient();
  const now = new Date().toISOString();

  try {
    if (kind === 'partner') {
      const partner = await loadPartner(delegated, input.id);

      if (!partner || partner.deletedAt) {
        return { ok: false, refusal: 'NOT_FOUND', error: 'Partner not found.' };
      }

      const [{ onboarding, documents }, experiences, properties] = await Promise.all([loadOnboardingWithDocuments(delegated, partner.onboardingId), loadListingsForPartner(delegated, 'experience', partner.id), loadListingsForPartner(delegated, 'property', partner.id)]);

      return { ok: true, kind, id: partner.id, readiness: partnerReadiness({ partner, onboarding, documents, experiences, properties, now }) };
    }

    const listing = await loadListing(delegated, kind, input.id);

    if (!listing || listing.deletedAt) {
      return { ok: false, refusal: 'NOT_FOUND', error: 'Record not found.' };
    }

    return { ok: true, kind, id: listing.id, readiness: listingReadiness({ kind, listing, partner: listing.partnerId ? await loadPartner(delegated, listing.partnerId) : null, now }) };
  } catch (error) {
    console.error('[lv-ecosystem] readiness failed:', error instanceof Error ? error.message : String(error));

    return { ok: false, error: 'Readiness could not be computed. Please try again.' };
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_ECOSYSTEM_READINESS_ID,
  name: 'lv-ecosystem-readiness',
  description: 'Deterministic activation-readiness check for a partner, experience or property (READY / NOT_READY with coded reasons); reads as the caller, writes nothing',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: { path: '/ecosystem/readiness', httpMethod: 'POST', isAuthRequired: true },
});
