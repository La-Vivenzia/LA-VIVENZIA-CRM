import { type CoreApiClient } from 'twenty-client-sdk/core';

import { checkTransition, isListingStatus, isPartnerStatus, LISTING_GOVERNED, LISTING_HUMAN_ONLY, LISTING_READINESS_GATED, LISTING_REASON_REQUIRED, LISTING_TRANSITIONS, type ListingStatus, PARTNER_HUMAN_ONLY, PARTNER_READINESS_GATED, PARTNER_REASON_REQUIRED, PARTNER_TRANSITIONS, type PartnerStatus } from 'src/modules/lv-core/constants/ecosystem-lifecycle';
import { assessListingReadiness, assessPartnerReadiness, expectedListingFor, type Readiness, type ReadinessDocument } from 'src/modules/lv-core/services/activation-readiness';
import { allocateEntityCode, createCoreApiEntityCodePort } from 'src/modules/lv-core/services/entity-code-allocator';
import { type CallerContext } from 'src/modules/lv-dashboard/services/caller-context';
import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { createCoreApiNotificationPort } from 'src/modules/lv-notifications/services/core-api-notification-port';
import { dispatchNotifications } from 'src/modules/lv-notifications/services/notification-service';
import { notificationsForEcosystem } from 'src/modules/lv-notifications/utils/build-notification';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

// The server side of Partner / Experience / Property operations: reading a
// record with its relations, deciding what the caller may do, and applying a
// lifecycle transition with every guard the brief requires — allowed
// transition, permission, no self-approval, readiness for activation, actor
// from the session, audit row. The 360 routes and the transition route both
// build on this so there is exactly one rule set.

export type EcosystemKind = 'partner' | 'experience' | 'property';

export const OBJECT_OF: Record<EcosystemKind, { singular: string; plural: string; update: string; codeField: string; label: string }> = {
  partner: { singular: 'lvPartner', plural: 'lvPartners', update: 'updateLvPartner', codeField: 'partnerCode', label: 'Partner' },
  experience: { singular: 'lvExperience', plural: 'lvExperiences', update: 'updateLvExperience', codeField: 'experienceCode', label: 'Experience' },
  property: { singular: 'lvProperty', plural: 'lvProperties', update: 'updateLvProperty', codeField: 'propertyCode', label: 'Property' },
};

// ---- records -------------------------------------------------------------------

export type MemberRef = { id: string; displayName: string | null; email: string | null };

export type PartnerRecord = {
  id: string;
  name: string | null;
  partnerCode: string | null;
  sourceKey: string | null;
  status: string | null;
  statusReason: string | null;
  partnerType: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  emails: { primaryEmail?: string | null } | null;
  phones: { primaryPhoneNumber?: string | null } | null;
  website: { primaryLinkUrl?: string | null } | null;
  instagram: { primaryLinkUrl?: string | null } | null;
  location: string | null;
  geography: string | null;
  languages: string[] | null;
  pricing: Record<string, unknown> | null;
  availability: Record<string, unknown> | null;
  policies: Record<string, unknown> | null;
  approvedAt: string | null;
  activatedAt: string | null;
  provenance: Record<string, unknown> | null;
  ownerId: string | null;
  contactId: string | null;
  organisationId: string | null;
  leadId: string | null;
  onboardingId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const PARTNER_SELECT = 'id name partnerCode sourceKey status statusReason partnerType category subcategory description emails { primaryEmail } phones { primaryPhoneNumber } website { primaryLinkUrl } instagram { primaryLinkUrl } location geography languages pricing availability policies approvedAt activatedAt provenance ownerId contactId organisationId leadId onboardingId createdAt updatedAt deletedAt';

export type ListingRecord = {
  id: string;
  name: string | null;
  code: string | null;
  sourceKey: string | null;
  status: string | null;
  statusReason: string | null;
  category: string | null;
  subcategory: string | null;
  propertyType: string | null;
  shortDescription: string | null;
  description: string | null;
  hostName: string | null;
  location: string | null;
  destination: string | null;
  address: string | null;
  meetingPoint: string | null;
  durationMinutes: number | null;
  minParticipants: number | null;
  capacity: number | null;
  rooms: number | null;
  basePrice: { amountMicros?: number | string | null; currencyCode?: string | null } | null;
  priceUnit: string | null;
  availability: Record<string, unknown> | null;
  languages: string[] | null;
  ageRequirement: string | null;
  difficulty: string | null;
  accessibility: string | null;
  included: string[] | null;
  excluded: string[] | null;
  amenities: string[] | null;
  requirements: string | null;
  safetyInformation: string | null;
  cancellationPolicy: string | null;
  houseRules: string | null;
  checkIn: string | null;
  checkOut: string | null;
  images: { fileId: string; label?: string | null; url?: string | null }[] | null;
  documents: { fileId: string; label?: string | null; url?: string | null }[] | null;
  submittedAt: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
  partnerId: string | null;
  hostId: string | null;
  managerId: string | null;
  ownerId: string | null;
  reviewerId: string | null;
  onboardingId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const EXPERIENCE_SELECT = 'id name experienceCode sourceKey status statusReason category subcategory shortDescription description hostName location destination meetingPoint durationMinutes minParticipants capacity basePrice { amountMicros currencyCode } priceUnit availability languages ageRequirement difficulty accessibility included excluded requirements safetyInformation cancellationPolicy images documents submittedAt approvedAt activatedAt partnerId hostId ownerId reviewerId onboardingId createdAt updatedAt deletedAt';
const PROPERTY_SELECT = 'id name propertyCode sourceKey status statusReason propertyType description location streetAddress destination capacity rooms amenities basePrice { amountMicros currencyCode } priceUnit availability checkIn checkOut cancellationPolicy houseRules images documents submittedAt approvedAt activatedAt partnerId managerId ownerId reviewerId onboardingId createdAt updatedAt deletedAt';

const normaliseListing = (kind: 'experience' | 'property', row: Record<string, unknown>): ListingRecord => ({
  id: row.id as string,
  name: (row.name as string | null) ?? null,
  code: ((kind === 'experience' ? row.experienceCode : row.propertyCode) as string | null) ?? null,
  sourceKey: (row.sourceKey as string | null) ?? null,
  status: (row.status as string | null) ?? null,
  statusReason: (row.statusReason as string | null) ?? null,
  category: (row.category as string | null) ?? null,
  subcategory: (row.subcategory as string | null) ?? null,
  propertyType: (row.propertyType as string | null) ?? null,
  shortDescription: (row.shortDescription as string | null) ?? null,
  description: (row.description as string | null) ?? null,
  hostName: (row.hostName as string | null) ?? null,
  location: (row.location as string | null) ?? null,
  destination: (row.destination as string | null) ?? null,
  address: (row.streetAddress as string | null) ?? null,
  meetingPoint: (row.meetingPoint as string | null) ?? null,
  durationMinutes: (row.durationMinutes as number | null) ?? null,
  minParticipants: (row.minParticipants as number | null) ?? null,
  capacity: (row.capacity as number | null) ?? null,
  rooms: (row.rooms as number | null) ?? null,
  basePrice: (row.basePrice as ListingRecord['basePrice']) ?? null,
  priceUnit: (row.priceUnit as string | null) ?? null,
  availability: (row.availability as Record<string, unknown> | null) ?? null,
  languages: (row.languages as string[] | null) ?? null,
  ageRequirement: (row.ageRequirement as string | null) ?? null,
  difficulty: (row.difficulty as string | null) ?? null,
  accessibility: (row.accessibility as string | null) ?? null,
  included: (row.included as string[] | null) ?? null,
  excluded: (row.excluded as string[] | null) ?? null,
  amenities: (row.amenities as string[] | null) ?? null,
  requirements: (row.requirements as string | null) ?? null,
  safetyInformation: (row.safetyInformation as string | null) ?? null,
  cancellationPolicy: (row.cancellationPolicy as string | null) ?? null,
  houseRules: (row.houseRules as string | null) ?? null,
  checkIn: (row.checkIn as string | null) ?? null,
  checkOut: (row.checkOut as string | null) ?? null,
  images: (row.images as ListingRecord['images']) ?? null,
  documents: (row.documents as ListingRecord['documents']) ?? null,
  submittedAt: (row.submittedAt as string | null) ?? null,
  approvedAt: (row.approvedAt as string | null) ?? null,
  activatedAt: (row.activatedAt as string | null) ?? null,
  partnerId: (row.partnerId as string | null) ?? null,
  hostId: (row.hostId as string | null) ?? null,
  managerId: (row.managerId as string | null) ?? null,
  ownerId: (row.ownerId as string | null) ?? null,
  reviewerId: (row.reviewerId as string | null) ?? null,
  onboardingId: (row.onboardingId as string | null) ?? null,
  createdAt: row.createdAt as string,
  updatedAt: row.updatedAt as string,
  deletedAt: (row.deletedAt as string | null) ?? null,
});

// Reads under the CALLER's token: object permissions apply (an object the
// role cannot read comes back empty → NOT_FOUND, never a hint that it exists).
export const loadPartner = async (delegated: DelegatedGraphqlClient, id: string): Promise<PartnerRecord | null> => {
  const { data } = await delegated.query<{ lvPartner?: PartnerRecord | null }>(`query($id: UUID!) { lvPartner(filter: { id: { eq: $id } }) { ${PARTNER_SELECT} } }`, { id });

  return data.lvPartner ?? null;
};

export const loadListing = async (delegated: DelegatedGraphqlClient, kind: 'experience' | 'property', id: string): Promise<ListingRecord | null> => {
  const meta = OBJECT_OF[kind];
  const { data } = await delegated.query<Record<string, Record<string, unknown> | null>>(`query($id: UUID!) { ${meta.singular}(filter: { id: { eq: $id } }) { ${kind === 'experience' ? EXPERIENCE_SELECT : PROPERTY_SELECT} } }`, { id });
  const row = data[meta.singular];

  return row ? normaliseListing(kind, row) : null;
};

export const loadListingsForPartner = async (delegated: DelegatedGraphqlClient, kind: 'experience' | 'property', partnerId: string): Promise<ListingRecord[]> => {
  const meta = OBJECT_OF[kind];
  const { data } = await delegated.query<Record<string, { edges: { node: Record<string, unknown> }[] } | undefined>>(`query($partnerId: UUID!) { ${meta.plural}(first: 50, filter: { partnerId: { eq: $partnerId } }, orderBy: [{ createdAt: AscNullsLast }]) { edges { node { ${kind === 'experience' ? EXPERIENCE_SELECT : PROPERTY_SELECT} } } } }`, { partnerId });

  return (data[meta.plural]?.edges ?? []).map((edge) => normaliseListing(kind, edge.node));
};

export type OnboardingRef = { id: string; name: string | null; status: string | null; currentStep: string | null; progressPercentage: number | null; healthScore: number | null; reviewerId: string | null; decisionReason: string | null; submittedAt: string | null; decidedAt: string | null; activatedAt: string | null; answers: Record<string, unknown> | null };

// Onboarding and its documents are CM-004-scoped: read as the caller, so a
// reviewer-scoped role sees them only when it may.
export const loadOnboardingWithDocuments = async (delegated: DelegatedGraphqlClient, onboardingId: string | null): Promise<{ onboarding: OnboardingRef | null; documents: (ReadinessDocument & { rejectionReason: string | null; verifiedAt: string | null })[] }> => {
  if (!onboardingId) {
    return { onboarding: null, documents: [] };
  }

  const { data } = await delegated.query<{ lvOnboarding?: OnboardingRef | null; lvOnboardingDocuments?: { edges: { node: ReadinessDocument & { rejectionReason: string | null; verifiedAt: string | null } }[] } }>(
    `query($id: UUID!) { lvOnboarding(filter: { id: { eq: $id } }) { id name status currentStep progressPercentage healthScore reviewerId decisionReason submittedAt decidedAt activatedAt answers } lvOnboardingDocuments(first: 50, filter: { onboardingId: { eq: $id } }) { edges { node { id name documentType verificationState expiresAt rejectionReason verifiedAt } } } }`,
    { id: onboardingId },
  );

  return { onboarding: data.lvOnboarding ?? null, documents: (data.lvOnboardingDocuments?.edges ?? []).map((edge) => edge.node) };
};

export const loadMembers = async (delegated: DelegatedGraphqlClient): Promise<Map<string, MemberRef>> => {
  const { data } = await delegated.query<{ workspaceMembers?: { edges: { node: { id: string; userEmail: string | null; name: { firstName: string | null; lastName: string | null } | null } }[] } }>(`query { workspaceMembers(first: 100) { edges { node { id userEmail name { firstName lastName } } } } }`);
  const map = new Map<string, MemberRef>();

  for (const { node } of data.workspaceMembers?.edges ?? []) {
    const displayName = [node.name?.firstName, node.name?.lastName].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');

    map.set(node.id, { id: node.id, displayName: displayName.length > 0 ? displayName : null, email: node.userEmail ?? null });
  }

  return map;
};

export type AuditRow = { id: string; action: string; outcome: string | null; at: string | null; reason: string | null; actorId: string | null; targetLabel: string | null; metadata: Record<string, unknown> | null };

export const loadAuditFor = async (application: CoreApiClient, targetRecordIds: string[]): Promise<AuditRow[]> => {
  if (targetRecordIds.length === 0) {
    return [];
  }

  const result = (await application.query({ lvAuditEvents: { __args: { first: 60, filter: { targetRecordId: { in: targetRecordIds } }, orderBy: [{ at: 'DescNullsLast' }] }, edges: { node: { id: true, action: true, outcome: true, at: true, reason: true, actorId: true, targetLabel: true, metadata: true } } } })) as { lvAuditEvents?: { edges?: { node: AuditRow }[] } };

  return (result.lvAuditEvents?.edges ?? []).map((edge) => edge.node);
};

// ---- readiness ---------------------------------------------------------------

export const partnerReadiness = ({ partner, onboarding, documents, experiences, properties, now }: { partner: PartnerRecord; onboarding: OnboardingRef | null; documents: ReadinessDocument[]; experiences: ListingRecord[]; properties: ListingRecord[]; now: string }): Readiness =>
  assessPartnerReadiness({
    partner: { name: partner.name, partnerCode: partner.partnerCode, status: partner.status, category: partner.category, location: partner.location, ownerId: partner.ownerId, hasEmail: Boolean(partner.emails?.primaryEmail), hasPhone: Boolean(partner.phones?.primaryPhoneNumber), policies: partner.policies },
    onboarding: onboarding ? { status: onboarding.status, reviewerId: onboarding.reviewerId, decidedAt: onboarding.decidedAt } : null,
    documents,
    experiences: experiences.map((row) => ({ id: row.id, status: row.status })),
    properties: properties.map((row) => ({ id: row.id, status: row.status })),
    expectsListing: expectedListingFor(partner.category),
    now,
  });

const micros = (value: ListingRecord['basePrice']): number | null => {
  const raw = value?.amountMicros;

  if (raw === null || raw === undefined) {
    return null;
  }

  const parsed = typeof raw === 'number' ? raw : Number(raw);

  return Number.isFinite(parsed) ? parsed : null;
};

export const listingReadiness = ({ kind, listing, partner, now }: { kind: 'experience' | 'property'; listing: ListingRecord; partner: PartnerRecord | null; now: string }): Readiness =>
  assessListingReadiness({
    kind,
    listing: { name: listing.name, code: listing.code, status: listing.status, description: listing.description, location: listing.location, capacity: listing.capacity, basePriceMicros: micros(listing.basePrice), priceUnit: listing.priceUnit, availability: listing.availability, cancellationPolicy: listing.cancellationPolicy, imageCount: listing.images?.length ?? 0, ownerId: listing.ownerId, reviewerId: listing.reviewerId, approvedAt: listing.approvedAt, partnerId: listing.partnerId, durationMinutes: listing.durationMinutes, propertyType: listing.propertyType },
    partner: partner ? { status: partner.status } : null,
    now,
  });

// ---- policy ----------------------------------------------------------------------

export type EcosystemCapabilities = {
  canEdit: boolean;
  canChangeStatus: boolean;
  // Approve / activate / suspend / archive — governance decisions.
  canGovern: boolean;
  canChangeOwner: boolean;
  canClaim: boolean;
  canCreateListing: boolean;
  isOwner: boolean;
};

export const capabilitiesFor = (caller: CallerContext, kind: EcosystemKind, record: { ownerId: string | null; status: string | null }): EcosystemCapabilities => {
  const object = OBJECT_OF[kind].singular;
  const canWrite = caller.isAdmin || caller.objectPermissions[object]?.update === true;
  const isOwner = record.ownerId !== null && record.ownerId === caller.workspaceMemberId;
  const terminal = record.status === 'OFFBOARDED' || record.status === 'RETIRED';

  return {
    canEdit: canWrite,
    canChangeStatus: canWrite && !terminal,
    // The record's own owner may not approve or activate their own work
    // unless they are an administrator.
    canGovern: (caller.isAdmin || (canWrite && !isOwner)) && !terminal,
    canChangeOwner: caller.isAdmin || (canWrite && isOwner),
    canClaim: canWrite && record.ownerId === null && !terminal,
    canCreateListing: kind === 'partner' && (caller.isAdmin || caller.objectPermissions.lvExperience?.update === true || caller.objectPermissions.lvProperty?.update === true),
    isOwner,
  };
};

// ---- transitions -------------------------------------------------------------------

export type TransitionResult = { ok: true; status: string } | { ok: false; refusal: 'NOT_FOUND' | 'NOT_PERMITTED' | 'NOT_ALLOWED' | 'REASON_REQUIRED' | 'NOT_READY' | 'INVALID_INPUT' | 'SAME_STATUS'; error: string; readiness?: Readiness };

export const applyPartnerTransition = async ({ delegated, application, caller, partner, to, reason, readiness, now }: { delegated: DelegatedGraphqlClient; application: CoreApiClient; caller: CallerContext; partner: PartnerRecord; to: string; reason: string | null; readiness: () => Promise<Readiness>; now: string }): Promise<TransitionResult> => {
  if (!isPartnerStatus(to)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: `"${to}" is not a partner status.` };
  }

  const from = isPartnerStatus(partner.status) ? partner.status : 'PROSPECTIVE';
  // Permission first, fail closed: a caller who may not act learns nothing
  // about the transition table.
  const capabilities = capabilitiesFor(caller, 'partner', partner);
  const governed = PARTNER_HUMAN_ONLY.includes(to);

  if (!(governed ? capabilities.canGovern : capabilities.canChangeStatus)) {
    await writeAuditEvent(application, { action: 'PARTNER_STATUS_CHANGE', outcome: 'REFUSED', targetObject: 'lvPartner', targetRecordId: partner.id, targetLabel: partner.name ?? 'Partner', actorWorkspaceMemberId: caller.workspaceMemberId, at: now, reason: 'Not permitted', metadata: { from, to } });

    return { ok: false, refusal: 'NOT_PERMITTED', error: governed ? 'Only an administrator or an operations member who does not own this partner can make that decision.' : 'Your role cannot change partner status.' };
  }

  const check = checkTransition<PartnerStatus>(PARTNER_TRANSITIONS, PARTNER_HUMAN_ONLY, PARTNER_REASON_REQUIRED, { from, to, hasActor: caller.workspaceMemberId !== null, reason });

  if (!check.ok) {
    return { ok: false, refusal: check.refusal === 'REASON_REQUIRED' ? 'REASON_REQUIRED' : check.refusal === 'SAME_STATUS' ? 'SAME_STATUS' : 'NOT_ALLOWED', error: check.message };
  }

  if (PARTNER_READINESS_GATED.includes(to)) {
    const result = await readiness();

    if (result.status !== 'READY') {
      await writeAuditEvent(application, { action: 'ACTIVATION_READINESS', outcome: 'REFUSED', targetObject: 'lvPartner', targetRecordId: partner.id, targetLabel: partner.name ?? 'Partner', actorWorkspaceMemberId: caller.workspaceMemberId, at: now, reason: 'Activation attempted while NOT_READY', metadata: { reasons: result.reasons.map((item) => item.code) } });

      return { ok: false, refusal: 'NOT_READY', error: `Not ready to activate: ${result.reasons.length} requirement${result.reasons.length === 1 ? '' : 's'} missing.`, readiness: result };
    }
  }

  // Written as the caller — the platform re-checks the permission.
  const data: Record<string, unknown> = { status: to, statusReason: reason };

  if (to === 'ACTIVE' && !partner.activatedAt) {
    data.activatedAt = now;
  }

  if (to === 'APPROVED' && !partner.approvedAt) {
    data.approvedAt = now;
  }

  const { errors } = await delegated.query(`mutation($id: UUID!, $data: LvPartnerUpdateInput!) { updateLvPartner(id: $id, data: $data) { id status } }`, { id: partner.id, data });

  if (errors.length > 0) {
    return { ok: false, refusal: 'NOT_PERMITTED', error: errors[0]?.message ?? 'The platform refused the update.' };
  }

  await writeAuditEvent(application, { action: 'PARTNER_STATUS_CHANGE', outcome: 'APPLIED', targetObject: 'lvPartner', targetRecordId: partner.id, targetLabel: partner.name ?? 'Partner', actorWorkspaceMemberId: caller.workspaceMemberId, at: now, reason, metadata: { from, to } });

  // The lead follows the partner going live; the onboarding is marked ACTIVATED.
  if (to === 'ACTIVE') {
    if (partner.leadId) {
      await application.mutation({ updateLvLead: { __args: { id: partner.leadId, data: { status: 'LIVE_ACTIVE' } }, id: true } }).catch(() => null);
    }

    if (partner.onboardingId) {
      const current = (await application.query({ lvOnboarding: { __args: { filter: { id: { eq: partner.onboardingId } } }, status: true } })) as { lvOnboarding?: { status?: string | null } | null };

      if (current.lvOnboarding?.status === 'APPROVED') {
        await application.mutation({ updateLvOnboarding: { __args: { id: partner.onboardingId, data: { status: 'ACTIVATED', activatedAt: now } }, id: true } }).catch(() => null);
      }
    }
  }

  return { ok: true, status: to };
};

export const applyListingTransition = async ({ delegated, application, caller, kind, listing, to, reason, readiness, now }: { delegated: DelegatedGraphqlClient; application: CoreApiClient; caller: CallerContext; kind: 'experience' | 'property'; listing: ListingRecord; to: string; reason: string | null; readiness: () => Promise<Readiness>; now: string }): Promise<TransitionResult> => {
  const meta = OBJECT_OF[kind];
  const action = kind === 'experience' ? 'EXPERIENCE_STATUS_CHANGE' : 'PROPERTY_STATUS_CHANGE';

  if (!isListingStatus(to)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: `"${to}" is not a ${kind} status.` };
  }

  const from = isListingStatus(listing.status) ? listing.status : 'DRAFT';
  const capabilities = capabilitiesFor(caller, kind, listing);
  const governed = LISTING_GOVERNED.includes(to);

  if (!(governed ? capabilities.canGovern : capabilities.canChangeStatus)) {
    await writeAuditEvent(application, { action, outcome: 'REFUSED', targetObject: meta.singular, targetRecordId: listing.id, targetLabel: listing.name ?? meta.label, actorWorkspaceMemberId: caller.workspaceMemberId, at: now, reason: 'Not permitted', metadata: { from, to } });

    return { ok: false, refusal: 'NOT_PERMITTED', error: governed ? `Only an administrator or a team member with ${meta.label.toLowerCase()} rights who does not own this record can make that decision.` : `Your role cannot change ${meta.label.toLowerCase()} status.` };
  }

  const check = checkTransition<ListingStatus>(LISTING_TRANSITIONS, LISTING_HUMAN_ONLY, LISTING_REASON_REQUIRED, { from, to, hasActor: caller.workspaceMemberId !== null, reason });

  if (!check.ok) {
    return { ok: false, refusal: check.refusal === 'REASON_REQUIRED' ? 'REASON_REQUIRED' : check.refusal === 'SAME_STATUS' ? 'SAME_STATUS' : 'NOT_ALLOWED', error: check.message };
  }

  if (LISTING_READINESS_GATED.includes(to)) {
    const result = await readiness();

    if (result.status !== 'READY') {
      await writeAuditEvent(application, { action: 'ACTIVATION_READINESS', outcome: 'REFUSED', targetObject: meta.singular, targetRecordId: listing.id, targetLabel: listing.name ?? meta.label, actorWorkspaceMemberId: caller.workspaceMemberId, at: now, reason: 'Activation attempted while NOT_READY', metadata: { reasons: result.reasons.map((item) => item.code) } });

      return { ok: false, refusal: 'NOT_READY', error: `Not ready to activate: ${result.reasons.length} requirement${result.reasons.length === 1 ? '' : 's'} missing.`, readiness: result };
    }
  }

  const data: Record<string, unknown> = { status: to, statusReason: reason };

  if (to === 'IN_REVIEW') {
    data.submittedAt = now;
  }

  if (to === 'READY') {
    data.approvedAt = now;
    data.reviewerId = caller.workspaceMemberId;
  }

  if (to === 'CHANGES_REQUIRED') {
    data.reviewerId = caller.workspaceMemberId;
  }

  if (to === 'LIVE' && !listing.activatedAt) {
    data.activatedAt = now;
  }

  const { errors } = await delegated.query(`mutation($id: UUID!, $data: ${kind === 'experience' ? 'LvExperienceUpdateInput' : 'LvPropertyUpdateInput'}!) { ${meta.update}(id: $id, data: $data) { id status } }`, { id: listing.id, data });

  if (errors.length > 0) {
    return { ok: false, refusal: 'NOT_PERMITTED', error: errors[0]?.message ?? 'The platform refused the update.' };
  }

  await writeAuditEvent(application, { action, outcome: 'APPLIED', targetObject: meta.singular, targetRecordId: listing.id, targetLabel: listing.name ?? meta.label, actorWorkspaceMemberId: caller.workspaceMemberId, at: now, reason, metadata: { from, to, partnerId: listing.partnerId } });

  // Submitted for review → the people who can decide are told (Day 4
  // dispatcher, deduped on this transition). Never the submitter.
  if (to === 'IN_REVIEW') {
    try {
      const partner = listing.partnerId ? await loadPartner(delegated, listing.partnerId) : null;
      const intents = notificationsForEcosystem({ event: kind === 'experience' ? 'EXPERIENCE_APPROVAL_REQUIRED' : 'PROPERTY_APPROVAL_REQUIRED', recordId: listing.id, recordName: listing.name ?? meta.label, recordCode: listing.code, object: meta.singular as 'lvExperience' | 'lvProperty', partnerId: listing.partnerId, leadId: partner?.leadId ?? null, recipients: [partner?.ownerId ?? null, listing.reviewerId], actorWorkspaceMemberId: caller.workspaceMemberId, changedAt: now });

      await dispatchNotifications({ port: createCoreApiNotificationPort(application), intents, sourceEvent: 'lv-ecosystem-transition', actorWorkspaceMemberId: caller.workspaceMemberId });
    } catch (error) {
      console.warn('[lv-ecosystem] approval notification not sent:', describeError(error));
    }
  }

  return { ok: true, status: to };
};

// ---- owner change ------------------------------------------------------------------

export const applyOwnerChange = async ({ delegated, application, caller, kind, record, newOwnerId, now }: { delegated: DelegatedGraphqlClient; application: CoreApiClient; caller: CallerContext; kind: EcosystemKind; record: { id: string; name: string | null; ownerId: string | null; status: string | null }; newOwnerId: string | null; now: string }): Promise<TransitionResult> => {
  const meta = OBJECT_OF[kind];
  const capabilities = capabilitiesFor(caller, kind, record);
  const isClaim = newOwnerId !== null && newOwnerId === caller.workspaceMemberId && record.ownerId === null;

  if (!(capabilities.canChangeOwner || (isClaim && capabilities.canClaim))) {
    await writeAuditEvent(application, { action: kind === 'partner' ? 'PARTNER_OWNER_CHANGE' : 'ENTITY_OWNER_CHANGE', outcome: 'REFUSED', targetObject: meta.singular, targetRecordId: record.id, targetLabel: record.name ?? meta.label, actorWorkspaceMemberId: caller.workspaceMemberId, at: now, reason: 'Not permitted', metadata: { from: record.ownerId, to: newOwnerId } });

    return { ok: false, refusal: 'NOT_PERMITTED', error: 'Only an administrator, or the current owner, may change who owns this record; anyone with write access may claim an unowned one for themselves.' };
  }

  const { errors } = await delegated.query(`mutation($id: UUID!, $data: ${kind === 'partner' ? 'LvPartnerUpdateInput' : kind === 'experience' ? 'LvExperienceUpdateInput' : 'LvPropertyUpdateInput'}!) { ${meta.update}(id: $id, data: $data) { id } }`, { id: record.id, data: { ownerId: newOwnerId } });

  if (errors.length > 0) {
    return { ok: false, refusal: 'NOT_PERMITTED', error: errors[0]?.message ?? 'The platform refused the update.' };
  }

  await writeAuditEvent(application, { action: kind === 'partner' ? 'PARTNER_OWNER_CHANGE' : 'ENTITY_OWNER_CHANGE', outcome: 'APPLIED', targetObject: meta.singular, targetRecordId: record.id, targetLabel: record.name ?? meta.label, actorWorkspaceMemberId: caller.workspaceMemberId, at: now, reason: isClaim ? 'Claimed' : null, metadata: { from: record.ownerId, to: newOwnerId } });

  return { ok: true, status: newOwnerId ?? 'UNASSIGNED' };
};

// ---- creation (from Partner 360 or by an administrator) -------------------------

export const allocateCodeFor = async (application: CoreApiClient, kind: EcosystemKind, record: { id: string; code: string | null }): Promise<string | null> => {
  const result = await allocateEntityCode({ kind, record, port: createCoreApiEntityCodePort(application, kind) });

  return result.ok ? result.code : null;
};
