import { type Readiness } from 'src/modules/lv-core/services/activation-readiness';
import { listingReadiness, loadListingsForPartner, loadOnboardingWithDocuments, partnerReadiness, PARTNER_SELECT, type PartnerRecord } from 'src/modules/lv-core/services/ecosystem-service';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// The lead's ecosystem progression, for Lead 360: which partner (if any) the
// lead became, its experiences and properties, and whether the partner is
// ready to activate. Real relations only — a lead with no partner shows
// exactly that.

export type LeadEcosystem = {
  partner: { id: string; partnerCode: string | null; name: string | null; status: string | null; approvedAt: string | null; activatedAt: string | null; readiness: Readiness } | null;
  experiences: { id: string; code: string | null; name: string | null; status: string | null; readiness: Readiness }[];
  properties: { id: string; code: string | null; name: string | null; status: string | null; readiness: Readiness }[];
};

export const loadEcosystemForLead = async (delegated: DelegatedGraphqlClient, leadId: string, now: string): Promise<LeadEcosystem> => {
  const empty: LeadEcosystem = { partner: null, experiences: [], properties: [] };

  try {
    const { data } = await delegated.query<{ lvPartners?: { edges: { node: PartnerRecord }[] } }>(`query($leadId: UUID!) { lvPartners(first: 1, filter: { leadId: { eq: $leadId } }, orderBy: [{ createdAt: AscNullsLast }]) { edges { node { ${PARTNER_SELECT} } } } }`, { leadId });
    const partner = data.lvPartners?.edges?.[0]?.node ?? null;

    if (!partner) {
      return empty;
    }

    const [{ onboarding, documents }, experiences, properties] = await Promise.all([loadOnboardingWithDocuments(delegated, partner.onboardingId), loadListingsForPartner(delegated, 'experience', partner.id), loadListingsForPartner(delegated, 'property', partner.id)]);

    return {
      partner: { id: partner.id, partnerCode: partner.partnerCode, name: partner.name, status: partner.status, approvedAt: partner.approvedAt, activatedAt: partner.activatedAt, readiness: partnerReadiness({ partner, onboarding, documents, experiences, properties, now }) },
      experiences: experiences.map((row) => ({ id: row.id, code: row.code, name: row.name, status: row.status, readiness: listingReadiness({ kind: 'experience', listing: row, partner, now }) })),
      properties: properties.map((row) => ({ id: row.id, code: row.code, name: row.name, status: row.status, readiness: listingReadiness({ kind: 'property', listing: row, partner, now }) })),
    };
  } catch {
    return empty;
  }
};
