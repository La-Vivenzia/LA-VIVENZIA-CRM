import { useCallback, useEffect, useRef, useState } from 'react';

import { graphql } from 'src/api/client';

// People & organisations — the directory behind the ecosystem.
//
// These are Twenty's own `person` and `company` records, which La Vivenzia
// links to through the partner: `lvPartner.contact → person` and
// `lvPartner.organisation → company`, plus `lvExperience.host` and
// `lvProperty.manager`. That is the whole of the relationship — there is no
// link from a *lead* to a person, because in this product a lead already *is*
// the person or organisation it names.
//
// So a person's leads are reached the only way the data allows: through the
// partners they are the contact for. Nothing here invents a shortcut, and the
// screens say which way round the link runs.
//
// Read as the caller throughout, so object permissions bind. Read-only: there
// is no logic-function route that writes a person or a company, so this
// module never pretends to offer one.

export type Loadable<T> = { data: T | null; loading: boolean; error: string | null; forbidden: boolean; reload: () => void };

const FORBIDDEN = /forbidden|not allowed|permission|not permitted|403|NOT_AUTHORIZED/i;

/** One hook shape for all four screens: load, fail, refuse, retry. */
const useRead = <T,>(read: () => Promise<T>, deps: unknown[], fallback: string): Loadable<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);

      try {
        const result = await read();

        if (live.current) {
          setData(result);
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : fallback;

        if (live.current) {
          setForbidden(FORBIDDEN.test(message));
          // The server's own words, kept verbatim.
          setError(message);
        }
      } finally {
        if (live.current) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      live.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { data, loading, error, forbidden, reload: useCallback(() => setAttempt((n) => n + 1), []) };
};

const fullName = (name: { firstName?: string | null; lastName?: string | null } | null | undefined): string =>
  [name?.firstName, name?.lastName].filter(Boolean).join(' ').trim();

// ---------------------------------------------------------------------------
// 13.1 — the people list
// ---------------------------------------------------------------------------

export type DirectoryPerson = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  city: string | null;
  avatarUrl: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string | null;
};

type RawPerson = {
  id?: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  jobTitle?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  companyId?: string | null;
  company?: { id?: string | null; name?: string | null } | null;
};

const PERSON_FIELDS = `id createdAt jobTitle city avatarUrl companyId
      name { firstName lastName }
      emails { primaryEmail }
      phones { primaryPhoneNumber }
      company { id name }`;

const PEOPLE_QUERY = `query($first: Int!) {
  people(first: $first, orderBy: { createdAt: DescNullsLast }) {
    totalCount
    edges { node { ${PERSON_FIELDS} } }
  }
}`;

export const DIRECTORY_PAGE = 200;

const toPerson = (row: RawPerson): DirectoryPerson => ({
  id: row.id ?? '',
  // A person record with no name at all is still a record; it is shown as
  // unnamed rather than hidden, because hiding it loses the link to it.
  name: fullName(row.name) || 'Unnamed person',
  email: row.emails?.primaryEmail?.trim() || null,
  phone: row.phones?.primaryPhoneNumber?.trim() || null,
  jobTitle: row.jobTitle?.trim() || null,
  city: row.city?.trim() || null,
  avatarUrl: row.avatarUrl?.trim() || null,
  companyId: row.company?.id ?? row.companyId ?? null,
  companyName: row.company?.name?.trim() || null,
  createdAt: row.createdAt ?? null,
});

export type PeopleList = { people: DirectoryPerson[]; total: number | null };

export const usePeople = (): Loadable<PeopleList> =>
  useRead(
    async () => {
      const data = await graphql<{ people?: { totalCount?: number; edges?: { node?: RawPerson }[] } }>(PEOPLE_QUERY, { first: DIRECTORY_PAGE });

      return {
        people: (data.people?.edges ?? []).map((edge) => edge?.node).filter((node): node is RawPerson => Boolean(node?.id)).map(toPerson),
        total: data.people?.totalCount ?? null,
      };
    },
    [],
    'People could not be loaded.',
  );

export const matchesPerson = (person: DirectoryPerson, query: string): boolean => {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return true;
  }

  return [person.name, person.email, person.phone, person.jobTitle, person.city, person.companyName]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(needle));
};

// ---------------------------------------------------------------------------
// 13.2 — one person
// ---------------------------------------------------------------------------

export type LinkedPartner = { id: string; name: string; code: string | null; status: string | null; leadId: string | null; leadName: string | null; leadRef: string | null };
export type LinkedListing = { id: string; name: string; status: string | null; kind: 'experience' | 'property' };

export type PersonInteraction = {
  id: string;
  channel: string;
  direction: string;
  occurredAt: string | null;
  summary: string | null;
  leadId: string | null;
  leadName: string | null;
};

export type PersonDetail = {
  person: DirectoryPerson;
  partners: LinkedPartner[];
  listings: LinkedListing[];
  interactions: PersonInteraction[];
  /** The leads reached through this person's partners — the only link that exists. */
  leadIds: string[];
};

const PERSON_QUERY = `query($id: UUID!) {
  person(filter: { id: { eq: $id } }) {
    ${PERSON_FIELDS}
    lvPartners { edges { node { id name partnerCode status leadId lead { id name lvLeadId } } } }
    lvExperiencesHosted { edges { node { id name status } } }
    lvPropertiesManaged { edges { node { id name status } } }
  }
}`;

const INTERACTIONS_FOR_LEADS = `query($ids: [UUID!], $first: Int!) {
  lvInteractions(first: $first, filter: { leadId: { in: $ids } }, orderBy: { occurredAt: DescNullsLast }) {
    edges { node { id channel direction occurredAt summary { markdown } lead { id name } } }
  }
}`;

type RawListing = { id?: string; name?: string | null; status?: string | null };
type RawPartnerLink = {
  id?: string;
  name?: string | null;
  partnerCode?: string | null;
  status?: string | null;
  leadId?: string | null;
  lead?: { id?: string | null; name?: string | null; lvLeadId?: string | null } | null;
};

const toPartner = (row: RawPartnerLink): LinkedPartner => ({
  id: row.id ?? '',
  name: row.name?.trim() || 'Unnamed partner',
  code: row.partnerCode ?? null,
  status: row.status ?? null,
  leadId: row.lead?.id ?? row.leadId ?? null,
  leadName: row.lead?.name?.trim() || null,
  leadRef: row.lead?.lvLeadId ?? null,
});

export const usePerson = (personId: string | undefined): Loadable<PersonDetail> =>
  useRead(
    async () => {
      if (!personId) {
        throw new Error('No person was named.');
      }

      const data = await graphql<{
        person?: (RawPerson & {
          lvPartners?: { edges?: { node?: RawPartnerLink }[] };
          lvExperiencesHosted?: { edges?: { node?: RawListing }[] };
          lvPropertiesManaged?: { edges?: { node?: RawListing }[] };
        }) | null;
      }>(PERSON_QUERY, { id: personId });

      if (!data.person?.id) {
        throw new Error('That person could not be found, or is not visible to you.');
      }

      const partners = (data.person.lvPartners?.edges ?? []).map((edge) => edge?.node).filter((node): node is RawPartnerLink => Boolean(node?.id)).map(toPartner);
      const listings: LinkedListing[] = [
        ...(data.person.lvExperiencesHosted?.edges ?? []).map((edge) => edge?.node).filter((node): node is RawListing => Boolean(node?.id)).map((node) => ({
          id: node.id ?? '',
          name: node.name?.trim() || 'Unnamed experience',
          status: node.status ?? null,
          kind: 'experience' as const,
        })),
        ...(data.person.lvPropertiesManaged?.edges ?? []).map((edge) => edge?.node).filter((node): node is RawListing => Boolean(node?.id)).map((node) => ({
          id: node.id ?? '',
          name: node.name?.trim() || 'Unnamed property',
          status: node.status ?? null,
          kind: 'property' as const,
        })),
      ];

      const leadIds = [...new Set(partners.map((partner) => partner.leadId).filter((id): id is string => typeof id === 'string'))];
      let interactions: PersonInteraction[] = [];

      // Only ask when there is something to ask about: an empty `in` list is a
      // filter error, not an empty result.
      if (leadIds.length > 0) {
        const log = await graphql<{
          lvInteractions?: { edges?: { node?: { id?: string; channel?: string | null; direction?: string | null; occurredAt?: string | null; summary?: { markdown?: string | null } | null; lead?: { id?: string | null; name?: string | null } | null } }[] };
        }>(INTERACTIONS_FOR_LEADS, { ids: leadIds, first: 50 });

        interactions = (log.lvInteractions?.edges ?? [])
          .map((edge) => edge?.node)
          .filter((node): node is NonNullable<typeof node> => Boolean(node?.id))
          .map((node) => ({
            id: node.id ?? '',
            channel: node.channel ?? 'FORM',
            direction: node.direction ?? 'OUTBOUND',
            occurredAt: node.occurredAt ?? null,
            summary: node.summary?.markdown?.trim() || null,
            leadId: node.lead?.id ?? null,
            leadName: node.lead?.name?.trim() || null,
          }));
      }

      return { person: toPerson(data.person), partners, listings, interactions, leadIds };
    },
    [personId],
    'That person could not be loaded.',
  );

// ---------------------------------------------------------------------------
// 13.3 — the organisations list
// ---------------------------------------------------------------------------

export type DirectoryOrganisation = {
  id: string;
  name: string;
  website: string | null;
  city: string | null;
  region: string | null;
  employees: number | null;
  createdAt: string | null;
  peopleCount: number;
  partnerCount: number;
};

type RawCompany = {
  id?: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  address?: { addressCity?: string | null; addressState?: string | null; addressCountry?: string | null } | null;
  employees?: number | null;
  createdAt?: string | null;
  people?: { edges?: { node?: { id?: string } }[] } | null;
  lvPartners?: { edges?: { node?: RawPartnerLink }[] } | null;
};

const COMPANY_FIELDS = `id name employees createdAt
      domainName { primaryLinkUrl }
      address { addressCity addressState addressCountry }`;

const COMPANIES_QUERY = `query($first: Int!) {
  companies(first: $first, orderBy: { createdAt: DescNullsLast }) {
    totalCount
    edges { node {
      ${COMPANY_FIELDS}
      people { edges { node { id } } }
      lvPartners { edges { node { id } } }
    } }
  }
}`;

const toOrganisation = (row: RawCompany): DirectoryOrganisation => ({
  id: row.id ?? '',
  // Twenty creates a company row before it is named. Calling that "Unnamed"
  // is the truth; inventing a name from the domain would not be.
  name: row.name?.trim() || 'Unnamed organisation',
  website: row.domainName?.primaryLinkUrl?.trim() || null,
  city: row.address?.addressCity?.trim() || null,
  region: [row.address?.addressState, row.address?.addressCountry].filter((value) => value && value.trim().length > 0).join(', ') || null,
  employees: typeof row.employees === 'number' ? row.employees : null,
  createdAt: row.createdAt ?? null,
  peopleCount: (row.people?.edges ?? []).length,
  partnerCount: (row.lvPartners?.edges ?? []).length,
});

export type OrganisationList = { organisations: DirectoryOrganisation[]; total: number | null };

export const useOrganisations = (): Loadable<OrganisationList> =>
  useRead(
    async () => {
      const data = await graphql<{ companies?: { totalCount?: number; edges?: { node?: RawCompany }[] } }>(COMPANIES_QUERY, { first: DIRECTORY_PAGE });

      return {
        organisations: (data.companies?.edges ?? []).map((edge) => edge?.node).filter((node): node is RawCompany => Boolean(node?.id)).map(toOrganisation),
        total: data.companies?.totalCount ?? null,
      };
    },
    [],
    'Organisations could not be loaded.',
  );

export const matchesOrganisation = (organisation: DirectoryOrganisation, query: string): boolean => {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return true;
  }

  return [organisation.name, organisation.website, organisation.city, organisation.region]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => value.toLowerCase().includes(needle));
};

// ---------------------------------------------------------------------------
// 13.4 — one organisation
// ---------------------------------------------------------------------------

export type OrganisationDetail = {
  organisation: DirectoryOrganisation;
  people: DirectoryPerson[];
  partners: LinkedPartner[];
  listings: LinkedListing[];
};

const COMPANY_QUERY = `query($id: UUID!) {
  company(filter: { id: { eq: $id } }) {
    ${COMPANY_FIELDS}
    people { edges { node { ${PERSON_FIELDS} } } }
    lvPartners { edges { node { id name partnerCode status leadId lead { id name lvLeadId } } } }
  }
}`;

/** The second half of 13.4, because the two cannot be one document. */
const LISTINGS_FOR_PARTNERS = `query($ids: [UUID!], $first: Int!) {
  lvExperiences(first: $first, filter: { partnerId: { in: $ids } }) { edges { node { id name status } } }
  lvProperties(first: $first, filter: { partnerId: { in: $ids } }) { edges { node { id name status } } }
}`;

export const useOrganisation = (companyId: string | undefined): Loadable<OrganisationDetail> =>
  useRead(
    async () => {
      if (!companyId) {
        throw new Error('No organisation was named.');
      }

      const data = await graphql<{
        company?: (RawCompany & {
          people?: { edges?: { node?: RawPerson }[] };
          lvPartners?: { edges?: { node?: RawPartnerLink }[] };
        }) | null;
      }>(COMPANY_QUERY, { id: companyId });

      if (!data.company?.id) {
        throw new Error('That organisation could not be found, or is not visible to you.');
      }

      const partnerNodes = (data.company.lvPartners?.edges ?? [])
        .map((edge) => edge?.node)
        .filter((node): node is NonNullable<typeof node> => Boolean(node?.id));

      const partnerIds = partnerNodes.map((node) => node.id).filter((id): id is string => typeof id === 'string');
      let listings: LinkedListing[] = [];

      // Only ask when there is something to ask about: an empty `in` list is a
      // filter error, not an empty result.
      if (partnerIds.length > 0) {
        const extra = await graphql<{
          lvExperiences?: { edges?: { node?: RawListing }[] };
          lvProperties?: { edges?: { node?: RawListing }[] };
        }>(LISTINGS_FOR_PARTNERS, { ids: partnerIds, first: 100 });

        listings = [
          ...(extra.lvExperiences?.edges ?? []).map((edge) => edge?.node).filter((row): row is RawListing => Boolean(row?.id)).map((row) => ({
            id: row.id ?? '',
            name: row.name?.trim() || 'Unnamed experience',
            status: row.status ?? null,
            kind: 'experience' as const,
          })),
          ...(extra.lvProperties?.edges ?? []).map((edge) => edge?.node).filter((row): row is RawListing => Boolean(row?.id)).map((row) => ({
            id: row.id ?? '',
            name: row.name?.trim() || 'Unnamed property',
            status: row.status ?? null,
            kind: 'property' as const,
          })),
        ];
      }

      return {
        organisation: toOrganisation(data.company),
        people: (data.company.people?.edges ?? []).map((edge) => edge?.node).filter((node): node is RawPerson => Boolean(node?.id)).map(toPerson),
        partners: partnerNodes.map(toPartner),
        listings,
      };
    },
    [companyId],
    'That organisation could not be loaded.',
  );

/** Where a listing opens. Both kinds already have an ecosystem record screen. */
export const listingPath = (listing: LinkedListing): string =>
  listing.kind === 'experience' ? `/ecosystem/experiences/${listing.id}` : `/ecosystem/properties/${listing.id}`;
