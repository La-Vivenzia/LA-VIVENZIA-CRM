import { describe, expect, it } from 'vitest';

import { checkTransition, LISTING_HUMAN_ONLY, LISTING_REASON_REQUIRED, LISTING_TRANSITIONS, type ListingStatus, PARTNER_HUMAN_ONLY, PARTNER_REASON_REQUIRED, PARTNER_TRANSITIONS, type PartnerStatus } from 'src/modules/lv-core/constants/ecosystem-lifecycle';
import { assessListingReadiness, assessPartnerReadiness, expectedListingFor } from 'src/modules/lv-core/services/activation-readiness';
import { ensurePartnerForOnboarding, listingDataFromOnboarding, partnerDataFromOnboarding, propertyTypeFor, sourceKeyFor } from 'src/modules/lv-core/services/ecosystem-activation';
import { allocateEntityCode, type EntityCodePort } from 'src/modules/lv-core/services/entity-code-allocator';
import { formatEntityCode, nextEntityCode, parseEntityCode } from 'src/modules/lv-core/utils/entity-code';

const NOW = '2026-09-16T10:00:00.000Z';

describe('entity codes (LVP- / LVE- / LVR-)', () => {
  it('formats, parses and advances in the LV Lead ID convention', () => {
    expect(formatEntityCode('partner', 42)).toBe('LVP-000042');
    expect(formatEntityCode('experience', 1)).toBe('LVE-000001');
    expect(formatEntityCode('property', 999999)).toBe('LVR-999999');
    expect(parseEntityCode('partner', 'LVP-000042')).toBe(42);
    expect(parseEntityCode('partner', 'LVE-000042')).toBeNull();
    expect(parseEntityCode('property', ' lvr-000007 ')).toBeNull();
    expect(nextEntityCode('partner', null)).toEqual({ ok: true, code: 'LVP-000001', sequence: 1 });
    expect(nextEntityCode('partner', 'LVP-000041')).toEqual({ ok: true, code: 'LVP-000042', sequence: 42 });
    expect(nextEntityCode('partner', 'LVP-999999')).toEqual({ ok: false, reason: 'CEILING_REACHED' });
    expect(() => formatEntityCode('partner', 0)).toThrow();
  });

  const port = (issued: string[], collideOnce = false): EntityCodePort & { claims: string[] } => {
    let collided = false;
    const claims: string[] = [];

    return {
      claims,
      findHighestIssuedCode: async () => issued[issued.length - 1] ?? null,
      claimCode: async ({ code }) => {
        if (collideOnce && !collided) {
          collided = true;
          issued.push(code);
          throw new Error('duplicate key value violates unique constraint');
        }

        claims.push(code);
        issued.push(code);
      },
    };
  };

  it('allocates the next code, never renumbers, and retries past a collision', async () => {
    const p = port(['LVP-000003']);

    expect(await allocateEntityCode({ kind: 'partner', record: { id: 'p1', code: null }, port: p })).toEqual({ ok: true, code: 'LVP-000004', allocated: true });
    expect(await allocateEntityCode({ kind: 'partner', record: { id: 'p1', code: 'LVP-000004' }, port: p })).toEqual({ ok: true, code: 'LVP-000004', allocated: false });
    expect(p.claims).toEqual(['LVP-000004']);

    const racing = port(['LVE-000010'], true);
    const result = await allocateEntityCode({ kind: 'experience', record: { id: 'e1', code: null }, port: racing });

    // First attempt LVE-000011 lost the race; the winner is re-read and LVE-000012 issued.
    expect(result).toEqual({ ok: true, code: 'LVE-000012', allocated: true });
  });

  it('gives up honestly on contention or ceiling', async () => {
    const always: EntityCodePort = { findHighestIssuedCode: async () => 'LVR-000001', claimCode: async () => { throw new Error('unique constraint'); } };

    expect(await allocateEntityCode({ kind: 'property', record: { id: 'r', code: null }, port: always, maxAttempts: 3 })).toEqual({ ok: false, reason: 'CONTENTION' });
    expect(await allocateEntityCode({ kind: 'property', record: { id: 'r', code: null }, port: { findHighestIssuedCode: async () => 'LVR-999999', claimCode: async () => undefined } })).toEqual({ ok: false, reason: 'CEILING_REACHED' });
    await expect(allocateEntityCode({ kind: 'property', record: { id: 'r', code: null }, port: { findHighestIssuedCode: async () => null, claimCode: async () => { throw new Error('network down'); } } })).rejects.toThrow('network down');
  });
});

describe('ecosystem lifecycles', () => {
  const partner = (from: PartnerStatus, to: PartnerStatus, hasActor = true, reason: string | null = 'because') => checkTransition(PARTNER_TRANSITIONS, PARTNER_HUMAN_ONLY, PARTNER_REASON_REQUIRED, { from, to, hasActor, reason });
  const listing = (from: ListingStatus, to: ListingStatus, hasActor = true, reason: string | null = 'because') => checkTransition(LISTING_TRANSITIONS, LISTING_HUMAN_ONLY, LISTING_REASON_REQUIRED, { from, to, hasActor, reason });

  it('partner: only listed transitions, human-only for activation / suspension / offboarding, reasons where required', () => {
    expect(partner('APPROVED', 'ACTIVE')).toEqual({ ok: true });
    expect(partner('ACTIVE', 'PAUSED', true, null).ok).toBe(false);
    expect(partner('ACTIVE', 'PAUSED', true, 'Season closed')).toEqual({ ok: true });
    expect(partner('PROSPECTIVE', 'ACTIVE')).toMatchObject({ ok: false, refusal: 'NOT_ALLOWED' });
    expect(partner('APPROVED', 'ACTIVE', false)).toMatchObject({ ok: false, refusal: 'HUMAN_REQUIRED' });
    expect(partner('OFFBOARDED', 'ACTIVE')).toMatchObject({ ok: false, refusal: 'NOT_ALLOWED' });
    expect(partner('ACTIVE', 'ACTIVE')).toMatchObject({ ok: false, refusal: 'SAME_STATUS' });
    expect(partner('SUSPENDED', 'ACTIVE')).toEqual({ ok: true });
  });

  it('experience / property: draft → review → approved → live, with changes-required loop and no bypass of approval', () => {
    expect(listing('DRAFT', 'IN_REVIEW', false)).toEqual({ ok: true });
    expect(listing('DRAFT', 'LIVE')).toMatchObject({ ok: false, refusal: 'NOT_ALLOWED' });
    expect(listing('DRAFT', 'READY')).toMatchObject({ ok: false, refusal: 'NOT_ALLOWED' });
    expect(listing('IN_REVIEW', 'READY', false)).toMatchObject({ ok: false, refusal: 'HUMAN_REQUIRED' });
    expect(listing('IN_REVIEW', 'READY')).toEqual({ ok: true });
    expect(listing('IN_REVIEW', 'CHANGES_REQUIRED', true, null)).toMatchObject({ ok: false, refusal: 'REASON_REQUIRED' });
    expect(listing('IN_REVIEW', 'CHANGES_REQUIRED', true, 'Add photographs')).toEqual({ ok: true });
    expect(listing('CHANGES_REQUIRED', 'IN_REVIEW', false)).toEqual({ ok: true });
    expect(listing('READY', 'LIVE')).toEqual({ ok: true });
    expect(listing('LIVE', 'SUSPENDED', true, 'Safety complaint')).toEqual({ ok: true });
    expect(listing('RETIRED', 'LIVE')).toMatchObject({ ok: false, refusal: 'NOT_ALLOWED' });
  });
});

describe('activation readiness (deterministic)', () => {
  const readyPartner = {
    partner: { name: 'Chain Villa', partnerCode: 'LVP-000001', status: 'APPROVED', category: 'STAY', location: 'Anjuna', ownerId: 'm1', hasEmail: true, hasPhone: false, policies: { cancellationPolicy: 'Free cancellation up to 7 days', agreesToTerms: true } },
    onboarding: { status: 'APPROVED', reviewerId: 'm2', decidedAt: NOW },
    documents: [{ id: 'd1', name: 'ID', documentType: 'IDENTITY', verificationState: 'VERIFIED', expiresAt: null }],
    experiences: [],
    properties: [{ id: 'r1', status: 'DRAFT' }],
    expectsListing: 'PROPERTY' as const,
    now: NOW,
  };

  it('a complete stay partner is READY; every missing requirement is a coded reason', () => {
    expect(assessPartnerReadiness(readyPartner)).toMatchObject({ status: 'READY', reasons: [] });

    const broken = assessPartnerReadiness({
      ...readyPartner,
      partner: { ...readyPartner.partner, partnerCode: null, ownerId: null, hasEmail: false, policies: { agreesToTerms: false } },
      onboarding: { status: 'INTERNAL_REVIEW', reviewerId: null, decidedAt: null },
      documents: [{ id: 'd1', name: 'ID', documentType: 'IDENTITY', verificationState: 'REJECTED', expiresAt: null }, { id: 'd2', name: 'Licence', documentType: 'BUSINESS', verificationState: 'VERIFIED', expiresAt: '2020-01-01T00:00:00.000Z' }],
      properties: [],
    });
    const codes = broken.reasons.map((reason) => reason.code);

    expect(broken.status).toBe('NOT_READY');
    expect(codes).toEqual(expect.arrayContaining(['PROFILE_CODE', 'PROFILE_CONTACT', 'RELATION_OWNER', 'APPROVAL_STATUS', 'APPROVAL_REVIEWER', 'COMMERCIAL_CANCELLATION_POLICY', 'COMMERCIAL_TERMS', 'DOCUMENT_IDENTITY_MISSING', 'DOCUMENT_REJECTED', 'DOCUMENT_EXPIRED', 'RELATION_PROPERTY']));
    expect(codes).not.toContain('PROFILE_NAME');
  });

  it('a business partner needs no listing; a suspended partner cannot be activated without reinstatement', () => {
    expect(expectedListingFor('BUSINESS_PARTNER')).toBeNull();
    expect(expectedListingFor('STAY')).toBe('PROPERTY');
    expect(expectedListingFor('EXPERIENCE')).toBe('EXPERIENCE');
    expect(assessPartnerReadiness({ ...readyPartner, partner: { ...readyPartner.partner, category: 'BUSINESS_PARTNER' }, properties: [], expectsListing: null }).status).toBe('READY');
    expect(assessPartnerReadiness({ ...readyPartner, partner: { ...readyPartner.partner, status: 'SUSPENDED' } }).reasons.map((reason) => reason.code)).toContain('STATUS_BLOCKED');
  });

  const readyListing = {
    kind: 'property' as const,
    listing: { name: 'Chain Villa', code: 'LVR-000001', status: 'READY', description: 'D'.repeat(60), location: 'Anjuna', capacity: 8, basePriceMicros: 12000_000000, priceUnit: 'Per night', availability: { availableDays: ['Fri'] }, cancellationPolicy: 'Free cancellation', imageCount: 3, ownerId: 'm1', reviewerId: 'm2', approvedAt: NOW, partnerId: 'p1', propertyType: 'VILLA' },
    partner: { status: 'APPROVED' },
    now: NOW,
  };

  it('a listing is READY only when approved by a reviewer, priced, available, imaged, owned and under an approved partner', () => {
    expect(assessListingReadiness(readyListing)).toMatchObject({ status: 'READY' });

    const draft = assessListingReadiness({ ...readyListing, listing: { ...readyListing.listing, status: 'DRAFT', reviewerId: null, approvedAt: null, imageCount: 0, basePriceMicros: null, availability: null }, partner: { status: 'SUSPENDED' } });
    const codes = draft.reasons.map((reason) => reason.code);

    expect(draft.status).toBe('NOT_READY');
    expect(codes).toEqual(expect.arrayContaining(['APPROVAL_STATUS', 'APPROVAL_REVIEWER', 'PROFILE_IMAGES', 'COMMERCIAL_PRICE', 'COMMERCIAL_AVAILABILITY', 'RELATION_PARTNER_STATUS']));

    const experience = assessListingReadiness({ ...readyListing, kind: 'experience', listing: { ...readyListing.listing, durationMinutes: null, propertyType: null } });

    expect(experience.reasons.map((reason) => reason.code)).toEqual(['PROFILE_DURATION']);
  });
});

describe('approval → partner / listing data', () => {
  const onboarding = {
    id: 'onb-1',
    name: 'Chain onboarding',
    status: 'APPROVED',
    leadId: 'lead-1',
    reviewerId: 'm2',
    decidedAt: NOW,
    answers: {
      BASIC_INFORMATION: { legalName: 'Meera Chain', displayName: 'Chain Villa', email: 'meera@example.com', phone: '+91 90000 00099', organisationName: 'Chain Org', languages: ['English'] },
      ABOUT_YOU: { bio: 'About me', website: 'https://chain.example.com' },
      EXPERIENCE: { title: 'Chain Villa', description: 'Sea-facing villa', category: 'Villa', capacity: 8, durationMinutes: 120, inclusions: ['Breakfast'] },
      LOCATION: { addressLine: '12 Beach Road', city: 'Anjuna', state: 'Goa', country: 'India' },
      PRICING: { basePrice: 12000, priceUnit: 'Per night', minimumGuests: 2 },
      AVAILABILITY: { availableDays: ['Fri', 'Sat'], noticePeriodHours: 24 },
      IMAGES: { images: [{ fileId: 'f1', name: 'pool.jpg' }, { fileId: 'f1', name: 'dup.jpg' }, { fileId: 'f2', name: 'room.jpg' }] },
      POLICIES: { cancellationPolicy: 'Free cancellation', houseRules: 'No parties', agreesToTerms: true },
    },
  } as const;
  const lead = { id: 'lead-1', lvLeadId: 'LV-000010', name: 'Chain', organisationName: 'Chain Org', category: 'STAY', subcategory: 'VILLA', location: 'Goa', ownerId: 'm1', languages: null, emails: { primaryEmail: 'lead@example.com' }, phones: null, website: null, instagram: null };

  it('maps onboarding answers onto the partner without inventing anything', () => {
    const data = partnerDataFromOnboarding(onboarding as never, lead);

    expect(data).toMatchObject({ name: 'Chain Villa', category: 'STAY', subcategory: 'VILLA', partnerType: 'HOST', location: 'Anjuna', geography: 'Goa, India', languages: ['English'], emails: { primaryEmail: 'meera@example.com' }, website: { primaryLinkUrl: 'https://chain.example.com' }, pricing: { basePrice: 12000, priceUnit: 'Per night', minimumGuests: 2, currency: 'INR' }, availability: { availableDays: ['Fri', 'Sat'], noticePeriodHours: 24 }, policies: { cancellationPolicy: 'Free cancellation', houseRules: 'No parties', agreesToTerms: true } });
    expect(partnerDataFromOnboarding({ ...onboarding, answers: null } as never, null)).toMatchObject({ name: 'Chain onboarding', pricing: null, policies: null, emails: null });
  });

  it('maps onto a property (STAY) or an experience (EXPERIENCE) as a DRAFT with the onboarding images, de-duplicated', () => {
    const property = listingDataFromOnboarding('property', onboarding as never, lead);

    expect(property).toMatchObject({ name: 'Chain Villa', status: 'DRAFT', propertyType: 'VILLA', capacity: 8, basePrice: { amountMicros: 12_000_000_000, currencyCode: 'INR' }, priceUnit: 'Per night', streetAddress: '12 Beach Road, Anjuna, Goa', houseRules: 'No parties', amenities: ['Breakfast'] });
    expect((property.images as unknown[]).length).toBe(2);

    const experience = listingDataFromOnboarding('experience', onboarding as never, { ...lead, category: 'EXPERIENCE', subcategory: 'HOST' });

    expect(experience).toMatchObject({ category: 'EXPERIENCE', durationMinutes: 120, minParticipants: 2, included: ['Breakfast'], meetingPoint: '12 Beach Road', hostName: 'Chain Villa' });
    expect(propertyTypeFor('FARM_STAY')).toBe('FARMSTAY');
    expect(propertyTypeFor('GLAMPING')).toBe('CAMP');
    expect(propertyTypeFor('RETREAT')).toBe('RETREAT_CENTRE');
    expect(propertyTypeFor('UNKNOWN')).toBe('OTHER');
    expect(sourceKeyFor('onb-1')).toBe('onboarding:onb-1');
  });

  // A small in-memory stand-in for the application client: enough of the
  // query / mutation surface for ensurePartnerForOnboarding.
  const fakeClient = (options: { existingPartner?: Record<string, unknown> | null; raceOnCreate?: boolean } = {}) => {
    const partners: Record<string, unknown>[] = options.existingPartner ? [options.existingPartner] : [];
    const properties: Record<string, unknown>[] = [];
    const audit: Record<string, unknown>[] = [];
    let raced = false;
    const client = {
      query: async (document: Record<string, unknown>) => {
        const key = Object.keys(document)[0]!;
        const args = (document[key] as { __args?: Record<string, unknown> }).__args ?? {};

        if (key === 'lvPartners') {
          const filter = JSON.stringify(args.filter ?? {});
          const found = partners.filter((row) => filter.includes(String(row.sourceKey)) || filter.includes(String(row.onboardingId)) || (row.leadId && filter.includes(String(row.leadId)) && !filter.includes('sourceKey')));

          return { lvPartners: { edges: found.map((node) => ({ node })) } };
        }

        if (key === 'lvProperties') {
          return { lvProperties: { edges: properties.filter((row) => JSON.stringify(args.filter).includes(String(row.sourceKey))).map((node) => ({ node })) } };
        }

        if (key === 'people') {
          return { people: { edges: [] } };
        }

        if (key === 'companies') {
          return { companies: { edges: [{ node: { id: 'company-existing' } }] } };
        }

        return {};
      },
      mutation: async (document: Record<string, unknown>) => {
        const key = Object.keys(document)[0]!;
        const args = (document[key] as { __args: Record<string, unknown> }).__args;

        if (key === 'createLvPartner') {
          if (options.raceOnCreate && !raced) {
            raced = true;
            partners.push({ id: 'partner-winner', partnerCode: 'LVP-000007', ...(args.data as Record<string, unknown>) });
            throw new Error('duplicate key value violates unique constraint "lvPartner_sourceKey"');
          }

          const row = { id: `partner-${partners.length + 1}`, partnerCode: null, ...(args.data as Record<string, unknown>) };

          partners.push(row);

          return { createLvPartner: row };
        }

        if (key === 'updateLvPartner') {
          const row = partners.find((candidate) => candidate.id === args.id)!;

          Object.assign(row, args.data as Record<string, unknown>);

          return { updateLvPartner: row };
        }

        if (key === 'createLvProperty') {
          const row = { id: `property-${properties.length + 1}`, propertyCode: null, ...(args.data as Record<string, unknown>) };

          properties.push(row);

          return { createLvProperty: row };
        }

        if (key === 'updateLvProperty') {
          Object.assign(properties.find((candidate) => candidate.id === args.id)!, args.data as Record<string, unknown>);

          return { updateLvProperty: { id: args.id } };
        }

        if (key === 'createPerson') {
          return { createPerson: { id: 'person-new' } };
        }

        if (key === 'createLvAuditEvent') {
          audit.push(args.data as Record<string, unknown>);

          return { createLvAuditEvent: { id: `audit-${audit.length}` } };
        }

        return {};
      },
    };

    return { client: client as never, partners, properties, audit };
  };

  it('creates the partner + property once, links person/organisation, audits; a replay links instead of creating', async () => {
    const fake = fakeClient();
    const first = await ensurePartnerForOnboarding({ application: fake.client, onboarding: onboarding as never, lead, actorWorkspaceMemberId: 'm2', now: NOW, sourceEvent: 'lvOnboarding.updated' });

    expect(first.partner).toMatchObject({ created: true, partnerCode: 'LVP-000001' });
    expect(first.property).toMatchObject({ created: true, code: 'LVR-000001' });
    expect(first.experience).toBeNull();
    expect(first.contactId).toBe('person-new');
    expect(first.organisationId).toBe('company-existing');
    expect(fake.partners).toHaveLength(1);
    expect(fake.partners[0]).toMatchObject({ status: 'APPROVED', sourceKey: 'onboarding:onb-1', leadId: 'lead-1', onboardingId: 'onb-1', ownerId: 'm1' });
    expect(fake.audit.map((row) => row.action)).toEqual(['PARTNER_CREATED', 'PROPERTY_CREATED']);

    const replay = await ensurePartnerForOnboarding({ application: fake.client, onboarding: onboarding as never, lead, actorWorkspaceMemberId: 'm2', now: NOW, sourceEvent: 'lvOnboarding.updated' });

    expect(replay.partner).toMatchObject({ id: first.partner.id, created: false, linked: false, partnerCode: 'LVP-000001' });
    expect(replay.property).toMatchObject({ id: first.property!.id, created: false });
    expect(fake.partners).toHaveLength(1);
    expect(fake.properties).toHaveLength(1);
    expect(fake.audit.filter((row) => row.action === 'PARTNER_LINKED')).toHaveLength(1);
  });

  it('reuses a partner already made from the same lead (LINK, not CREATE) and never downgrades an ACTIVE one', async () => {
    const fake = fakeClient({ existingPartner: { id: 'partner-old', partnerCode: 'LVP-000003', sourceKey: 'manual:x', leadId: 'lead-1', onboardingId: null, status: 'ACTIVE', contactId: null, organisationId: null } });
    const result = await ensurePartnerForOnboarding({ application: fake.client, onboarding: onboarding as never, lead, actorWorkspaceMemberId: 'm2', now: NOW, sourceEvent: 'lvOnboarding.updated' });

    expect(result.partner).toMatchObject({ id: 'partner-old', created: false, linked: true, partnerCode: 'LVP-000003' });
    expect(fake.partners).toHaveLength(1);
    expect(fake.partners[0]).toMatchObject({ status: 'ACTIVE', onboardingId: 'onb-1', organisationId: 'company-existing' });
  });

  it('when two workers race, the loser of the unique index reads the winner', async () => {
    const fake = fakeClient({ raceOnCreate: true });
    const result = await ensurePartnerForOnboarding({ application: fake.client, onboarding: onboarding as never, lead, actorWorkspaceMemberId: null, now: NOW, sourceEvent: 'lvOnboarding.updated' });

    expect(result.partner).toMatchObject({ id: 'partner-winner', created: false, partnerCode: 'LVP-000007' });
    expect(fake.partners).toHaveLength(1);
  });
});
