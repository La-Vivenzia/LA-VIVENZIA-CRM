import { useCallback, useEffect, useRef, useState } from 'react';

import { callRoute, graphql, refusalCode, type RouteRefusal } from 'src/api/client';

// The ecosystem: the partners La Vivenzia works with, and the properties and
// experiences they put on the platform.
//
// Five routes stand behind it, all of them reading or writing as the person
// signed in, so the server decides what they may see and do:
//   /partners/360      the whole partner page, composed server-side
//   /properties/360    the same for a property
//   /experiences/360   the same for an experience
//   /ecosystem/readiness   the activation check on its own
//   /ecosystem/transition  a status change or an owner change
//
// The lists have no route of their own and are read through GraphQL.
//
// Nothing here recomputes a permission or a readiness reason. `capabilities`,
// `settableStatuses` and `readiness` all arrive decided; the interface's job
// is to show them, not to have an opinion about them.

export type EcosystemKind = 'partner' | 'property' | 'experience';

export const KIND_LABELS: Record<EcosystemKind, { one: string; many: string; path: string }> = {
  partner: { one: 'Partner', many: 'Partners', path: 'partners' },
  property: { one: 'Property', many: 'Properties', path: 'properties' },
  experience: { one: 'Experience', many: 'Experiences', path: 'experiences' },
};

export const kindFromPath = (path: string | undefined): EcosystemKind | null =>
  (Object.keys(KIND_LABELS) as EcosystemKind[]).find((kind) => KIND_LABELS[kind].path === path) ?? null;

// ---------------------------------------------------------------------------
// Vocabulary, mirrored from `constants/ecosystem-lifecycle.ts`
// ---------------------------------------------------------------------------

export const PARTNER_STATUSES = ['PROSPECTIVE', 'ONBOARDING', 'APPROVED', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'INACTIVE', 'OFFBOARDED'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  PROSPECTIVE: 'Prospective',
  ONBOARDING: 'Onboarding',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
  OFFBOARDED: 'Offboarded',
};

export const LISTING_STATUSES = ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUIRED', 'READY', 'LIVE', 'PAUSED', 'SUSPENDED', 'RETIRED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** The server's own labels — note READY reads "Approved" and LIVE "Active". */
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  CHANGES_REQUIRED: 'Changes required',
  READY: 'Approved',
  LIVE: 'Active',
  PAUSED: 'Paused',
  SUSPENDED: 'Suspended',
  RETIRED: 'Archived',
};

/** `LEAD_CATEGORY_LABELS` in `constants/lead-taxonomy.ts`. */
export const CATEGORY_LABELS: Record<string, string> = {
  EXPERIENCE: 'Experience ecosystem',
  STAY: 'Stay ecosystem',
  BUSINESS_PARTNER: 'Business partner',
  PEOPLE_COMMUNITY: 'People / Community',
};

/**
 * A stored enum, said the way a person would say it. Subcategories, partner
 * types and property types have no label table on the server, so the value is
 * turned into a sentence rather than shouted in upper snake case — a raw
 * PROPERTY_OWNER on screen is the Twenty habit this product is replacing.
 */
export const humanise = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined || value.trim() === '') {
    return null;
  }

  return CATEGORY_LABELS[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
};

export const statusLabel = (kind: EcosystemKind, status: string | null): string => {
  if (status === null) {
    return 'No status';
  }

  return kind === 'partner'
    ? (PARTNER_STATUS_LABELS[status as PartnerStatus] ?? status)
    : (LISTING_STATUS_LABELS[status as ListingStatus] ?? status);
};

/** `PARTNER_ATTENTION_STATUSES` / `LISTING_ATTENTION_STATUSES`. */
export const ATTENTION_STATUSES: Record<EcosystemKind, readonly string[]> = {
  partner: ['ONBOARDING', 'APPROVED', 'SUSPENDED'],
  property: ['IN_REVIEW', 'CHANGES_REQUIRED', 'SUSPENDED'],
  experience: ['IN_REVIEW', 'CHANGES_REQUIRED', 'SUSPENDED'],
};

/** `PARTNER_REASON_REQUIRED` / `LISTING_REASON_REQUIRED`. */
export const REASON_REQUIRED: Record<EcosystemKind, readonly string[]> = {
  partner: ['SUSPENDED', 'OFFBOARDED', 'PAUSED'],
  property: ['CHANGES_REQUIRED', 'SUSPENDED', 'RETIRED', 'PAUSED'],
  experience: ['CHANGES_REQUIRED', 'SUSPENDED', 'RETIRED', 'PAUSED'],
};

export const requiresReason = (kind: EcosystemKind, to: string): boolean => REASON_REQUIRED[kind].includes(to);

/** `PARTNER_READINESS_GATED` / `LISTING_READINESS_GATED` — refused when not ready. */
export const READINESS_GATED: Record<EcosystemKind, readonly string[]> = {
  partner: ['ACTIVE'],
  property: ['LIVE'],
  experience: ['LIVE'],
};

export const isReadinessGated = (kind: EcosystemKind, to: string): boolean => READINESS_GATED[kind].includes(to);

/** What each status change does, so a button is never just a word. */
export const STATUS_COPY: Record<string, string> = {
  ONBOARDING: 'Starts onboarding. The partner is asked for their profile and documents.',
  APPROVED: 'Records that the partner has been approved, but is not yet live.',
  ACTIVE: 'Puts the partner live. Refused unless the readiness check passes.',
  PAUSED: 'Pauses them temporarily. Nothing is lost and it can be undone.',
  SUSPENDED: 'Suspends them with your reason on the record. A deliberate stop, not a pause.',
  INACTIVE: 'Marks them inactive. They stay in the ecosystem and can be brought back.',
  OFFBOARDED: 'Ends the relationship. Nothing follows this.',
  PROSPECTIVE: 'Back to prospective — nothing has started yet.',
  DRAFT: 'Back to a draft that nobody outside is looking at.',
  IN_REVIEW: 'Submits it for review. It leaves the owner and joins the review queue.',
  CHANGES_REQUIRED: 'Sends it back with your reason, for the owner to fix.',
  READY: 'Approves it. It is not live yet — activation is a separate decision.',
  LIVE: 'Publishes it. Refused unless the readiness check passes.',
  RETIRED: 'Archives it with your reason. Nothing follows this.',
};

// ---------------------------------------------------------------------------
// Shapes the routes return
// ---------------------------------------------------------------------------

export type MemberRef = { id: string; displayName: string | null; email: string | null };

export type ReadinessReason = { code: string; text: string; area: 'PROFILE' | 'DOCUMENTS' | 'COMMERCIAL' | 'APPROVAL' | 'RELATIONS' };

export type Readiness = { status: 'READY' | 'NOT_READY'; reasons: ReadinessReason[]; checkedAt: string; checks: number };

export const READINESS_AREAS: { key: ReadinessReason['area']; label: string; meaning: string }[] = [
  { key: 'PROFILE', label: 'Profile', meaning: 'What the record itself is missing.' },
  { key: 'DOCUMENTS', label: 'Documents', meaning: 'Verification that has not been completed.' },
  { key: 'COMMERCIAL', label: 'Commercial', meaning: 'Pricing, capacity and availability.' },
  { key: 'APPROVAL', label: 'Approval', meaning: 'A decision somebody still has to make.' },
  { key: 'RELATIONS', label: 'Relationships', meaning: 'A link to another record that is missing or not ready.' },
];

export type TimelineEntry = {
  id: string;
  kind: 'CREATED' | 'AUDIT' | 'ONBOARDING' | 'DOCUMENT' | 'INTERACTION' | 'ASSIGNMENT' | 'STATUS';
  at: string;
  title: string;
  detail: string | null;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  actor: MemberRef | null;
  target: { object: string; recordId: string } | null;
};

export type DocumentView = {
  id: string;
  name: string | null;
  documentType: string | null;
  verificationState: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  bucket: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'EXPIRED';
};

export type ListingSummary = {
  id: string;
  code: string | null;
  name: string | null;
  status: string | null;
  statusLabel: string;
  location: string | null;
  capacity: number | null;
  category: string | null;
  propertyType: string | null;
  owner: MemberRef | null;
  readiness: Readiness;
};

export type Capabilities = {
  canEdit: boolean;
  canChangeStatus: boolean;
  canGovern: boolean;
  canChangeOwner: boolean;
  canClaim: boolean;
  canCreateListing: boolean;
  isOwner: boolean;
};

export type SettableStatus = { value: string; label: string; governed: boolean };

export type AuditRow = {
  id: string;
  action: string;
  outcome: string | null;
  at: string | null;
  reason: string | null;
  targetLabel: string | null;
  actor: MemberRef | null;
};

/** What `/partners/360` returns. */
export type Partner360 = {
  ok: true;
  now: string;
  partner: Record<string, unknown> & {
    id: string;
    name: string | null;
    partnerCode: string | null;
    status: string | null;
    statusLabel: string;
    partnerType: string | null;
    category: string | null;
    subcategory: string | null;
    description: string | null;
    location: string | null;
    languages: string[] | null;
    approvedAt: string | null;
    activatedAt: string | null;
    createdAt: string | null;
    owner: MemberRef | null;
    emails: { primaryEmail: string | null } | null;
    phones: { primaryPhoneNumber: string | null } | null;
    website: { primaryLinkUrl: string | null } | null;
    instagram: { primaryLinkUrl: string | null } | null;
  };
  contact: { id: string; name: string | null; email: string | null; phone: string | null; city: string | null } | null;
  organisation: { id: string; name: string | null; domain: string | null; city: string | null } | null;
  lead: { id: string; lvLeadId: string | null; name: string | null; status: string | null; source: string | null; nextAction: string | null; nextFollowUpAt: string | null; relationshipHealth: number | null } | null;
  onboarding: { id: string; status: string | null; statusLabel?: string; progressPercentage: number | null; healthScore: number | null } | null;
  documents: DocumentView[];
  experiences: ListingSummary[];
  properties: ListingSummary[];
  readiness: Readiness;
  relationshipHealth: { value: number | null; reason: string | null };
  partnerHealth: { value: number | null; reason: string };
  interactions: { id: string; channel: string | null; occurredAt: string | null; summary: string | null; outcome: string | null; actor: MemberRef | null }[];
  tasks: { id: string; title: string | null; status: string | null; dueAt: string | null; assignee: MemberRef | null }[];
  notes: { id: string; title: string | null; updatedAt: string }[];
  timeline: TimelineEntry[];
  audit: AuditRow[];
  caller: { workspaceMemberId: string; isAdmin: boolean };
  capabilities: Capabilities;
  settableStatuses: SettableStatus[];
  members: MemberRef[];
};

/** What `/properties/360` and `/experiences/360` return. */
export type Listing360 = {
  ok: true;
  now: string;
  kind: 'experience' | 'property';
  listing: Record<string, unknown> & {
    id: string;
    name: string | null;
    status: string | null;
    statusLabel: string;
    statusReason: string | null;
    description: string | null;
    location: string | null;
    destination: string | null;
    capacity: number | null;
    basePrice: Money;
    priceUnit: string | null;
    images: unknown;
    owner: MemberRef | null;
    reviewer: MemberRef | null;
  };
  partner: { id: string; name: string | null; partnerCode: string | null; status: string | null; statusLabel: string; category: string | null; location: string | null; owner: MemberRef | null } | null;
  host: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  onboarding: { id: string; status: string | null; progressPercentage: number | null; healthScore: number | null } | null;
  documents: DocumentView[];
  readiness: Readiness;
  quality: { value: number | null; reason: string };
  timeline: TimelineEntry[];
  audit: AuditRow[];
  caller: { workspaceMemberId: string; isAdmin: boolean };
  capabilities: Capabilities;
  settableStatuses: SettableStatus[];
  members: MemberRef[];
};

export type Ecosystem360 = Partner360 | Listing360;

export const isPartner360 = (model: Ecosystem360): model is Partner360 => 'partner' in model && (model as Partner360).partner?.id !== undefined && !('listing' in model);

// ---------------------------------------------------------------------------
// The lists
// ---------------------------------------------------------------------------

export type EcosystemRow = {
  id: string;
  name: string | null;
  code: string | null;
  status: string | null;
  location: string | null;
  category: string | null;
  ownerId: string | null;
  ownerName: string | null;
  partnerId: string | null;
  partnerName: string | null;
  capacity: number | null;
  basePrice: Money;
  priceUnit: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

const MEMBER = 'owner { id name { firstName lastName } }';

const LIST_QUERIES: Record<EcosystemKind, string> = {
  partner: `query { lvPartners(first: 200, orderBy: { updatedAt: DescNullsLast }) { edges { node {
    id name partnerCode status location category createdAt updatedAt ownerId ${MEMBER}
  } } } }`,
  property: `query { lvProperties(first: 200, orderBy: { updatedAt: DescNullsLast }) { edges { node {
    id name propertyCode status location propertyType capacity basePrice { amountMicros currencyCode } priceUnit createdAt updatedAt ownerId ${MEMBER}
    partner { id name }
  } } } }`,
  experience: `query { lvExperiences(first: 200, orderBy: { updatedAt: DescNullsLast }) { edges { node {
    id name experienceCode status location category capacity basePrice { amountMicros currencyCode } priceUnit createdAt updatedAt ownerId ${MEMBER}
    partner { id name }
  } } } }`,
};

const PLURAL: Record<EcosystemKind, string> = { partner: 'lvPartners', property: 'lvProperties', experience: 'lvExperiences' };

type RawRow = {
  id: string;
  name?: string | null;
  partnerCode?: string | null;
  propertyCode?: string | null;
  experienceCode?: string | null;
  status?: string | null;
  location?: string | null;
  category?: string | null;
  propertyType?: string | null;
  capacity?: number | null;
  basePrice?: Money;
  priceUnit?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  ownerId?: string | null;
  owner?: { id?: string | null; name?: { firstName?: string | null; lastName?: string | null } | null } | null;
  partner?: { id?: string | null; name?: string | null } | null;
};

const displayName = (member: RawRow['owner']): string | null => {
  const joined = [member?.name?.firstName, member?.name?.lastName].filter(Boolean).join(' ').trim();

  return joined.length > 0 ? joined : null;
};

export const useEcosystemList = (kind: EcosystemKind) => {
  const [rows, setRows] = useState<EcosystemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const shown = useRef<EcosystemKind | null>(null);

  const load = useCallback(async () => {
    if (shown.current !== kind) {
      setRows(null);
      shown.current = kind;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await graphql<Record<string, { edges?: { node?: RawRow }[] }>>(LIST_QUERIES[kind]);
      const edges = data[PLURAL[kind]]?.edges ?? [];

      setRows(
        edges
          .map((edge) => edge.node)
          .filter((node): node is RawRow => Boolean(node?.id))
          .map((node) => ({
            id: node.id,
            name: node.name ?? null,
            code: node.partnerCode ?? node.propertyCode ?? node.experienceCode ?? null,
            status: node.status ?? null,
            location: node.location ?? null,
            category: node.category ?? node.propertyType ?? null,
            ownerId: node.ownerId ?? node.owner?.id ?? null,
            ownerName: displayName(node.owner),
            partnerId: node.partner?.id ?? null,
            partnerName: node.partner?.name ?? null,
            capacity: typeof node.capacity === 'number' ? node.capacity : null,
            basePrice: node.basePrice ?? null,
            priceUnit: node.priceUnit ?? null,
            updatedAt: node.updatedAt ?? null,
            createdAt: node.createdAt ?? null,
          })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The ${KIND_LABELS[kind].many.toLowerCase()} could not be loaded.`);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, error, loading, reload: load };
};

/** Just enough to count by: no names, no prices, no owners. */
const COUNT_QUERIES: Record<EcosystemKind, string> = {
  partner: 'query { lvPartners(first: 500) { edges { node { id status } } } }',
  property: 'query { lvProperties(first: 500) { edges { node { id status } } } }',
  experience: 'query { lvExperiences(first: 500) { edges { node { id status } } } }',
};

/**
 * The counts across all three kinds, for the overview. No route composes
 * this, so it is three reads — but of two fields each, not of the whole row.
 * The list beside it is already fetching one kind in full; asking for all
 * three again in full would be the same data twice on every page view.
 */
export const useEcosystemCounts = () => {
  const [counts, setCounts] = useState<Record<EcosystemKind, { total: number; live: number; attention: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);

    try {
      const entries = await Promise.all(
        (Object.keys(KIND_LABELS) as EcosystemKind[]).map(async (kind) => {
          const data = await graphql<Record<string, { edges?: { node?: RawRow }[] }>>(COUNT_QUERIES[kind]);
          const rows = (data[PLURAL[kind]]?.edges ?? []).map((edge) => edge.node).filter((node): node is RawRow => Boolean(node?.id));
          const live = rows.filter((row) => row.status === (kind === 'partner' ? 'ACTIVE' : 'LIVE')).length;

          return [kind, { total: rows.length, live, attention: rows.filter((row) => ATTENTION_STATUSES[kind].includes(row.status ?? '')).length }] as const;
        }),
      );

      setCounts(Object.fromEntries(entries) as Record<EcosystemKind, { total: number; live: number; attention: number }>);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The ecosystem could not be counted.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { counts, error, reload: load };
};

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

const ROUTE_OF: Record<EcosystemKind, string> = { partner: '/partners/360', property: '/properties/360', experience: '/experiences/360' };

export const useEcosystemRecord = (kind: EcosystemKind | null, id: string | undefined) => {
  const [model, setModel] = useState<Ecosystem360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // A refresh must not blank the page: a sheet open over the record would
  // unmount mid-decision. Only a different record clears it.
  const shown = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!kind || !id) {
      return;
    }

    if (shown.current !== id) {
      setModel(null);
      shown.current = id;
    }

    setLoading(true);
    setError(null);

    try {
      const body = kind === 'partner' ? { partnerId: id } : kind === 'property' ? { propertyId: id } : { experienceId: id };

      setModel(await callRoute<Ecosystem360>(ROUTE_OF[kind], body));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That record could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { model, error, loading, reload: load };
};

/** `/ecosystem/transition` — a status change, or an owner change. */
export const transitionEcosystem = (input: { kind: EcosystemKind; id: string; to: string; reason?: string | null }) =>
  callRoute<{ status: string }>('/ecosystem/transition', { kind: input.kind, id: input.id, action: 'STATUS', to: input.to, reason: input.reason ?? null });

export const changeEcosystemOwner = (input: { kind: EcosystemKind; id: string; ownerId: string | null }) =>
  callRoute<{ status: string }>('/ecosystem/transition', { kind: input.kind, id: input.id, action: 'OWNER', ownerId: input.ownerId });

/** `/ecosystem/readiness` — the activation check on its own. */
export const fetchReadiness = (kind: EcosystemKind, id: string) =>
  callRoute<{ kind: EcosystemKind; id: string; readiness: Readiness }>('/ecosystem/readiness', { kind, id });

// ---------------------------------------------------------------------------
// Creating a listing
// ---------------------------------------------------------------------------

// `/ecosystem/create` — a property or an experience, by hand, under a partner.
//
// Every field below is one the route actually reads. The ones it does *not*
// take matter as much: the code is allocated server-side, the status always
// starts at DRAFT, the owner is the caller, and the host (experience) or
// manager (property) is the partner's own contact. None of those is the
// person's to choose, so none of them is asked for.
//
// There is no email or phone in this contract. The route accepts neither for
// a listing, which is why this screen does not collect them.

/** A listing is always created under a partner, never on its own. */
export type ListingKind = Extract<EcosystemKind, 'property' | 'experience'>;

export type ListingDraft = {
  name: string;
  location: string;
  description: string;
  capacity: string;
  basePrice: string;
  priceUnit: string;
  /** Minutes for an experience, rooms for a property. */
  extra: string;
  /** Property only. */
  propertyType: string;
  /** Experience only. */
  hostName: string;
};

export type DuplicateMatch = { id: string; name: string | null; code: string | null; status: string | null; location: string | null; percent: number; reasons?: string[] };

export type CreatedListing = { id: string; code: string | null; kind: EcosystemKind; partnerId: string | null };

/**
 * The property types the server will accept. `PROPERTY_TYPE_OPTIONS` on the
 * server is the source of truth, and anything outside it is coerced to OTHER —
 * so this list is kept in step with it deliberately rather than invented here.
 */
export const PROPERTY_TYPES = [
  'VILLA',
  'HOMESTAY',
  'BOUTIQUE_HOTEL',
  'RESORT',
  'HOTEL',
  'FARMSTAY',
  'HERITAGE_PROPERTY',
  'LUXURY_STAY',
  'UNIQUE_STAY',
  'CAMP',
  'HOSTEL',
  'RETREAT_CENTRE',
  'PROPERTY_MANAGER',
  'PROPERTY_OWNER',
  'VENUE',
  'OTHER',
] as const;

/** The three whose humanised form reads wrong, said properly. */
const PROPERTY_TYPE_OVERRIDES: Record<string, string> = { BOUTIQUE_HOTEL: 'Boutique stay', CAMP: 'Glamping property', FARMSTAY: 'Farm stay' };

export const propertyTypeLabel = (value: string): string => PROPERTY_TYPE_OVERRIDES[value] ?? humanise(value) ?? value;

export const emptyListingDraft = (kind: ListingKind, partnerLocation: string | null): ListingDraft => ({
  name: '',
  // The partner's own location is the right first guess for a listing of
  // theirs, and the server falls back to it anyway when this is left empty.
  location: partnerLocation ?? '',
  description: '',
  capacity: '',
  basePrice: '',
  // The unit is free text on the server with no enum behind it, so it is
  // seeded with the one each kind is nearly always priced by.
  priceUnit: kind === 'experience' ? 'Per person' : 'Per night',
  extra: '',
  propertyType: 'VILLA',
  hostName: '',
});

/** A name is the only thing the route requires beyond the partner. */
export const listingDraftReady = (draft: ListingDraft): boolean => draft.name.trim().length >= 2;

export const createListing = (input: { kind: ListingKind; partnerId: string; draft: ListingDraft; createAnyway?: boolean }) =>
  callRoute<CreatedListing>('/ecosystem/create', {
    kind: input.kind,
    partnerId: input.partnerId,
    ...(input.createAnyway === true ? { duplicateDecision: 'CREATE_NEW' } : {}),
    fields: {
      name: input.draft.name.trim(),
      location: input.draft.location.trim(),
      description: input.draft.description.trim(),
      capacity: input.draft.capacity,
      basePrice: input.draft.basePrice,
      priceUnit: input.draft.priceUnit.trim(),
      ...(input.kind === 'experience'
        ? { durationMinutes: input.draft.extra, hostName: input.draft.hostName.trim() }
        : { rooms: input.draft.extra, propertyType: input.draft.propertyType }),
    },
  });

/**
 * The matches a `DUPLICATE_UNDECIDED` refusal came back with.
 *
 * The route refuses *before* writing and hands over what it matched, so the
 * person decides. Reading them off the refusal is the whole reason its body is
 * kept — the alternative is a warning with nothing in it.
 */
export const duplicatesFromRefusal = (cause: unknown): DuplicateMatch[] | null => {
  if (refusalCode(cause) !== 'DUPLICATE_UNDECIDED') {
    return null;
  }

  const rows = (cause as RouteRefusal).body.duplicates;

  if (!Array.isArray(rows)) {
    // The refusal is real even when the list is missing, so the caller still
    // has to offer the decision — just without the records behind it.
    return [];
  }

  return rows.map((row) => {
    const node = (row ?? {}) as Record<string, unknown>;
    const code = [node.code, node.propertyCode, node.experienceCode].find((value) => typeof value === 'string');

    return {
      id: typeof node.id === 'string' ? node.id : '',
      name: typeof node.name === 'string' ? node.name : null,
      code: typeof code === 'string' ? code : null,
      status: typeof node.status === 'string' ? node.status : null,
      location: typeof node.location === 'string' ? node.location : null,
      percent: typeof node.percent === 'number' ? node.percent : 0,
      reasons: Array.isArray(node.reasons) ? node.reasons.filter((reason): reason is string => typeof reason === 'string') : undefined,
    };
  });
};

// ---------------------------------------------------------------------------
// Small shared readings
// ---------------------------------------------------------------------------

export const groupReasons = (readiness: Readiness): { area: ReadinessReason['area']; label: string; meaning: string; reasons: ReadinessReason[] }[] =>
  READINESS_AREAS.map((area) => ({ area: area.key, label: area.label, meaning: area.meaning, reasons: readiness.reasons.filter((reason) => reason.area === area.key) })).filter(
    (group) => group.reasons.length > 0,
  );

/**
 * A CURRENCY field, which Twenty stores as `{ amountMicros, currencyCode }`
 * — millionths of a unit, not a number. Read as a plain number it renders as
 * "[object Object]", which is exactly what it did before this existed.
 */
export type Money = { amountMicros?: number | string | null; currencyCode?: string | null } | null;

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export const formatMoney = (money: Money, unit: string | null): string | null => {
  const micros = money?.amountMicros;
  const raw = typeof micros === 'string' ? Number(micros) : micros;

  if (raw === null || raw === undefined || !Number.isFinite(raw)) {
    return null;
  }

  const amount = raw / 1_000_000;
  const code = money?.currencyCode ?? 'INR';
  const rendered = `${SYMBOLS[code] ?? `${code} `}${amount.toLocaleString('en-IN', { maximumFractionDigits: amount % 1 === 0 ? 0 : 2 })}`;

  return unit ? `${rendered} ${unit.toLowerCase().replace(/_/g, ' ')}` : rendered;
};
