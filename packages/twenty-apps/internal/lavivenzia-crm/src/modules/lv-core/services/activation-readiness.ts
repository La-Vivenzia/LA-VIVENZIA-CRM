// Activation readiness — deterministic business rules, no model, no score.
//
// Answers one question for a partner, an experience or a property: may this
// go live? READY, or NOT_READY with every requirement that is still missing,
// coded so the screen can point at the exact field, document or decision.
// The ACTIVE / LIVE transitions call this and fail closed; nothing else may
// activate a record.

export type ReadinessReason = {
  code: string;
  text: string;
  // Where the fix is made.
  area: 'PROFILE' | 'DOCUMENTS' | 'COMMERCIAL' | 'APPROVAL' | 'RELATIONS';
};

export type Readiness = { status: 'READY' | 'NOT_READY'; reasons: ReadinessReason[]; checkedAt: string; checks: number };

export type ReadinessDocument = { id: string; name: string | null; documentType: string | null; verificationState: string | null; expiresAt: string | null };

export type PartnerReadinessInput = {
  partner: { name: string | null; partnerCode: string | null; status: string | null; category: string | null; location: string | null; ownerId: string | null; hasEmail: boolean; hasPhone: boolean; policies: Record<string, unknown> | null };
  onboarding: { status: string | null; reviewerId: string | null; decidedAt: string | null } | null;
  documents: ReadinessDocument[];
  experiences: { id: string; status: string | null }[];
  properties: { id: string; status: string | null }[];
  // Whether this partner's category expects a listing (STAY → property,
  // EXPERIENCE → experience). Business partners and community members need none.
  expectsListing: 'EXPERIENCE' | 'PROPERTY' | null;
  now: string;
};

const DOCUMENT_OK = new Set(['VERIFIED', 'APPROVED']);
// The one document every partner must have accepted before going live.
const MANDATORY_DOCUMENT_TYPES = ['IDENTITY'] as const;

const documentChecks = (documents: ReadinessDocument[], now: string): ReadinessReason[] => {
  const reasons: ReadinessReason[] = [];

  for (const type of MANDATORY_DOCUMENT_TYPES) {
    const ofType = documents.filter((document) => document.documentType === type);
    const accepted = ofType.filter((document) => DOCUMENT_OK.has(document.verificationState ?? '') && (!document.expiresAt || document.expiresAt > now));

    if (accepted.length === 0) {
      reasons.push({ code: `DOCUMENT_${type}_MISSING`, text: ofType.length === 0 ? `No ${type.toLowerCase()} document has been provided.` : `The ${type.toLowerCase()} document is not verified.`, area: 'DOCUMENTS' });
    }
  }

  for (const document of documents) {
    if (document.verificationState === 'REJECTED') {
      reasons.push({ code: 'DOCUMENT_REJECTED', text: `Document "${document.name ?? document.documentType ?? 'unnamed'}" was rejected and not replaced.`, area: 'DOCUMENTS' });
    }

    if (document.expiresAt && document.expiresAt <= now && DOCUMENT_OK.has(document.verificationState ?? '')) {
      reasons.push({ code: 'DOCUMENT_EXPIRED', text: `Document "${document.name ?? document.documentType ?? 'unnamed'}" has expired.`, area: 'DOCUMENTS' });
    }

    if (document.verificationState === 'EXPIRED') {
      reasons.push({ code: 'DOCUMENT_EXPIRED', text: `Document "${document.name ?? document.documentType ?? 'unnamed'}" is marked expired.`, area: 'DOCUMENTS' });
    }
  }

  return reasons;
};

export const assessPartnerReadiness = (input: PartnerReadinessInput): Readiness => {
  const reasons: ReadinessReason[] = [];
  const { partner, onboarding } = input;
  let checks = 0;
  const need = (ok: boolean, reason: ReadinessReason) => {
    checks += 1;

    if (!ok) {
      reasons.push(reason);
    }
  };

  need(Boolean(partner.name && partner.name.trim().length > 0), { code: 'PROFILE_NAME', text: 'The partner has no name.', area: 'PROFILE' });
  need(Boolean(partner.partnerCode), { code: 'PROFILE_CODE', text: 'No partner code has been allocated.', area: 'PROFILE' });
  need(Boolean(partner.category), { code: 'PROFILE_CATEGORY', text: 'No category is set.', area: 'PROFILE' });
  need(Boolean(partner.location), { code: 'PROFILE_LOCATION', text: 'No location is set.', area: 'PROFILE' });
  need(partner.hasEmail || partner.hasPhone, { code: 'PROFILE_CONTACT', text: 'Neither an email nor a phone number is on file.', area: 'PROFILE' });
  need(partner.ownerId !== null, { code: 'RELATION_OWNER', text: 'No team member owns this partner.', area: 'RELATIONS' });
  need(onboarding !== null, { code: 'APPROVAL_ONBOARDING', text: 'No onboarding is linked — the partner was never taken through verification.', area: 'APPROVAL' });

  if (onboarding) {
    need(onboarding.status === 'APPROVED' || onboarding.status === 'ACTIVATED', { code: 'APPROVAL_STATUS', text: `Onboarding is ${(onboarding.status ?? 'unknown').toLowerCase().replace(/_/g, ' ')}, not approved.`, area: 'APPROVAL' });
    need(onboarding.reviewerId !== null, { code: 'APPROVAL_REVIEWER', text: 'The approval has no reviewer on record.', area: 'APPROVAL' });
  }

  need(Boolean(partner.policies && typeof partner.policies.cancellationPolicy === 'string' && (partner.policies.cancellationPolicy as string).trim().length > 0), { code: 'COMMERCIAL_CANCELLATION_POLICY', text: 'No cancellation policy is on file.', area: 'COMMERCIAL' });
  need(Boolean(partner.policies && partner.policies.agreesToTerms === true), { code: 'COMMERCIAL_TERMS', text: 'The partner terms have not been accepted.', area: 'COMMERCIAL' });

  const documentReasons = documentChecks(input.documents, input.now);

  checks += MANDATORY_DOCUMENT_TYPES.length;
  reasons.push(...documentReasons);

  if (input.expectsListing === 'EXPERIENCE') {
    need(input.experiences.length > 0, { code: 'RELATION_EXPERIENCE', text: 'An experience partner has no experience record yet.', area: 'RELATIONS' });
  }

  if (input.expectsListing === 'PROPERTY') {
    need(input.properties.length > 0, { code: 'RELATION_PROPERTY', text: 'A stay partner has no property record yet.', area: 'RELATIONS' });
  }

  need(partner.status !== 'OFFBOARDED' && partner.status !== 'SUSPENDED', { code: 'STATUS_BLOCKED', text: `A ${(partner.status ?? '').toLowerCase()} partner cannot be activated without being reinstated first.`, area: 'APPROVAL' });

  return { status: reasons.length === 0 ? 'READY' : 'NOT_READY', reasons: dedupe(reasons), checkedAt: input.now, checks };
};

export type ListingReadinessInput = {
  kind: 'experience' | 'property';
  listing: {
    name: string | null;
    code: string | null;
    status: string | null;
    description: string | null;
    location: string | null;
    capacity: number | null;
    basePriceMicros: number | null;
    priceUnit: string | null;
    availability: Record<string, unknown> | null;
    cancellationPolicy: string | null;
    imageCount: number;
    ownerId: string | null;
    reviewerId: string | null;
    approvedAt: string | null;
    partnerId: string | null;
    // experience only
    durationMinutes?: number | null;
    // property only
    propertyType?: string | null;
  };
  partner: { status: string | null } | null;
  now: string;
};

export const assessListingReadiness = (input: ListingReadinessInput): Readiness => {
  const reasons: ReadinessReason[] = [];
  const { listing } = input;
  const label = input.kind === 'experience' ? 'experience' : 'property';
  let checks = 0;
  const need = (ok: boolean, reason: ReadinessReason) => {
    checks += 1;

    if (!ok) {
      reasons.push(reason);
    }
  };

  need(Boolean(listing.name && listing.name.trim().length > 0), { code: 'PROFILE_NAME', text: `The ${label} has no name.`, area: 'PROFILE' });
  need(Boolean(listing.code), { code: 'PROFILE_CODE', text: `No ${label} code has been allocated.`, area: 'PROFILE' });
  need(Boolean(listing.description && listing.description.trim().length >= 40), { code: 'PROFILE_DESCRIPTION', text: 'The description is missing or shorter than 40 characters.', area: 'PROFILE' });
  need(Boolean(listing.location), { code: 'PROFILE_LOCATION', text: 'No location is set.', area: 'PROFILE' });
  need(typeof listing.capacity === 'number' && listing.capacity > 0, { code: 'PROFILE_CAPACITY', text: input.kind === 'experience' ? 'Maximum participants is not set.' : 'Sleeps (maximum guests) is not set.', area: 'PROFILE' });

  if (input.kind === 'experience') {
    need(typeof listing.durationMinutes === 'number' && listing.durationMinutes > 0, { code: 'PROFILE_DURATION', text: 'Duration is not set.', area: 'PROFILE' });
  } else {
    need(Boolean(listing.propertyType), { code: 'PROFILE_TYPE', text: 'Property type is not set.', area: 'PROFILE' });
  }

  need(typeof listing.basePriceMicros === 'number' && listing.basePriceMicros > 0, { code: 'COMMERCIAL_PRICE', text: 'No base price is set.', area: 'COMMERCIAL' });
  need(Boolean(listing.priceUnit), { code: 'COMMERCIAL_PRICE_UNIT', text: 'Priced-per (unit) is not set.', area: 'COMMERCIAL' });
  need(Boolean(listing.availability && Object.keys(listing.availability).length > 0), { code: 'COMMERCIAL_AVAILABILITY', text: 'No availability is on file.', area: 'COMMERCIAL' });
  need(Boolean(listing.cancellationPolicy && listing.cancellationPolicy.trim().length > 0), { code: 'COMMERCIAL_CANCELLATION_POLICY', text: 'No cancellation policy is on file.', area: 'COMMERCIAL' });
  need(listing.imageCount >= 1, { code: 'PROFILE_IMAGES', text: 'No image is attached.', area: 'PROFILE' });
  need(listing.ownerId !== null, { code: 'RELATION_OWNER', text: `No team member owns this ${label}.`, area: 'RELATIONS' });
  need(listing.partnerId !== null, { code: 'RELATION_PARTNER', text: `The ${label} is not linked to a partner.`, area: 'RELATIONS' });
  need(input.partner === null || input.partner.status === 'APPROVED' || input.partner.status === 'ACTIVE', { code: 'RELATION_PARTNER_STATUS', text: `The partner is ${(input.partner?.status ?? 'unknown').toLowerCase()}; it must be approved or active.`, area: 'RELATIONS' });
  need(listing.status === 'READY' || listing.status === 'PAUSED' || listing.status === 'SUSPENDED' || listing.status === 'LIVE', { code: 'APPROVAL_STATUS', text: `The ${label} is ${(listing.status ?? 'unknown').toLowerCase().replace(/_/g, ' ')}; it must be approved first.`, area: 'APPROVAL' });
  need(listing.reviewerId !== null && listing.approvedAt !== null, { code: 'APPROVAL_REVIEWER', text: 'No reviewer approval is on record.', area: 'APPROVAL' });

  return { status: reasons.length === 0 ? 'READY' : 'NOT_READY', reasons: dedupe(reasons), checkedAt: input.now, checks };
};

const dedupe = (reasons: ReadinessReason[]): ReadinessReason[] => {
  const seen = new Set<string>();

  return reasons.filter((reason) => {
    const key = `${reason.code}:${reason.text}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
};

// Which listing a partner's category calls for.
export const expectedListingFor = (category: string | null | undefined): 'EXPERIENCE' | 'PROPERTY' | null => (category === 'STAY' ? 'PROPERTY' : category === 'EXPERIENCE' ? 'EXPERIENCE' : null);
