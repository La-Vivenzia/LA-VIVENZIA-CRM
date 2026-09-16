import { type CoreApiClient } from 'twenty-client-sdk/core';

import { expectedListingFor } from 'src/modules/lv-core/services/activation-readiness';
import { allocateEntityCode, createCoreApiEntityCodePort } from 'src/modules/lv-core/services/entity-code-allocator';
import { isUniqueViolation } from 'src/modules/lv-core/services/lead-id-allocator';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { type OnboardingData } from 'src/modules/lv-onboarding/utils/validate-onboarding';

// Onboarding approved → the partner exists.
//
//   APPROVED onboarding ──▶ lvPartner (LVP-…)  ──▶ lvExperience (LVE-…) if the lead is an EXPERIENCE
//                                              └─▶ lvProperty   (LVR-…) if the lead is a STAY
//
// Idempotent by construction: every record created here carries
// `sourceKey = onboarding:<id>`, which is unique. A replayed event finds the
// existing record and links it; two racing workers both try to create, the
// unique index refuses one, and the loser reads the winner. Nothing is ever
// created twice, and nothing is created when a partner already exists for
// the onboarding or for the lead (LINK / REUSE, never a second partner).
//
// Person and organisation are linked to existing records when one matches
// (email for the person, name for the company) and created from the
// onboarding's own answers only when none does — the relationship graph the
// Founder asks for, without duplicating people.
//
// Runs with the application role (the reviewer approving an onboarding does
// not, and should not, hold write permission on partners); the actor recorded
// on every audit row is the session member from the event.

export type OnboardingForActivation = {
  id: string;
  name: string | null;
  status: string | null;
  leadId: string | null;
  reviewerId: string | null;
  decidedAt: string | null;
  answers: OnboardingData | null;
};

export type LeadForActivation = {
  id: string;
  lvLeadId: string | null;
  name: string | null;
  organisationName: string | null;
  category: string | null;
  subcategory: string | null;
  location: string | null;
  ownerId: string | null;
  languages: string[] | null;
  emails: { primaryEmail?: string | null } | null;
  phones: { primaryPhoneNumber?: string | null; primaryPhoneCallingCode?: string | null; primaryPhoneCountryCode?: string | null } | null;
  website: { primaryLinkUrl?: string | null } | null;
  instagram: { primaryLinkUrl?: string | null } | null;
};

export type ActivationOutcome = {
  partner: { id: string; partnerCode: string | null; created: boolean; linked: boolean };
  experience: { id: string; code: string | null; created: boolean } | null;
  property: { id: string; code: string | null; created: boolean } | null;
  contactId: string | null;
  organisationId: string | null;
  warnings: string[];
};

type Files = { fileId: string; label?: string | null; name?: string }[];

const str = (value: unknown): string | null => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []);
const files = (value: unknown): Files => (Array.isArray(value) ? value.filter((item): item is { fileId: string; name?: string } => typeof item === 'object' && item !== null && typeof (item as { fileId?: unknown }).fileId === 'string').map((item) => ({ fileId: item.fileId, label: item.name ?? null })) : []);
const answers = (data: OnboardingData | null, step: keyof OnboardingData): Record<string, unknown> => ((data?.[step] ?? {}) as Record<string, unknown>);

export const sourceKeyFor = (onboardingId: string): string => `onboarding:${onboardingId}`;

// ---- what the entities inherit from the onboarding ---------------------------

export const partnerDataFromOnboarding = (onboarding: OnboardingForActivation, lead: LeadForActivation | null): Record<string, unknown> => {
  const basic = answers(onboarding.answers, 'BASIC_INFORMATION');
  const about = answers(onboarding.answers, 'ABOUT_YOU');
  const location = answers(onboarding.answers, 'LOCATION');
  const pricing = answers(onboarding.answers, 'PRICING');
  const availability = answers(onboarding.answers, 'AVAILABILITY');
  const policies = answers(onboarding.answers, 'POLICIES');
  const email = str(basic.email) ?? lead?.emails?.primaryEmail ?? null;
  const phone = str(basic.phone) ?? lead?.phones?.primaryPhoneNumber ?? null;
  const website = str(about.website) ?? lead?.website?.primaryLinkUrl ?? null;
  const instagram = str(about.instagram) ?? lead?.instagram?.primaryLinkUrl ?? null;
  const city = str(location.city);
  const geography = [str(location.state), str(location.country)].filter(Boolean).join(', ');

  return {
    name: str(basic.displayName) ?? str(basic.legalName) ?? lead?.name ?? onboarding.name ?? 'Partner',
    category: lead?.category ?? null,
    subcategory: lead?.subcategory ?? null,
    partnerType: lead?.category === 'STAY' ? 'HOST' : lead?.category === 'EXPERIENCE' ? 'HOST' : lead?.category === 'BUSINESS_PARTNER' ? 'BUSINESS' : lead?.category === 'PEOPLE_COMMUNITY' ? 'COMMUNITY' : 'OTHER',
    description: str(about.bio),
    location: city ?? lead?.location ?? null,
    geography: geography.length > 0 ? geography : null,
    languages: list(basic.languages).length > 0 ? list(basic.languages) : (lead?.languages ?? null),
    emails: email ? { primaryEmail: email, additionalEmails: null } : null,
    phones: phone ? { primaryPhoneNumber: phone, primaryPhoneCountryCode: '', primaryPhoneCallingCode: '', additionalPhones: null } : null,
    website: website ? { primaryLinkUrl: website, primaryLinkLabel: '', secondaryLinks: null } : null,
    instagram: instagram ? { primaryLinkUrl: instagram, primaryLinkLabel: '', secondaryLinks: null } : null,
    pricing: Object.keys(pricing).length > 0 ? { basePrice: num(pricing.basePrice), priceUnit: str(pricing.priceUnit), minimumGuests: num(pricing.minimumGuests), additionalCharges: str(pricing.additionalCharges), currency: 'INR' } : null,
    availability: Object.keys(availability).length > 0 ? { availableDays: list(availability.availableDays), noticePeriodHours: num(availability.noticePeriodHours), seasonalNotes: str(availability.seasonalNotes) } : null,
    policies: Object.keys(policies).length > 0 ? { cancellationPolicy: str(policies.cancellationPolicy), houseRules: str(policies.houseRules), safetyMeasures: str(policies.safetyMeasures), agreesToTerms: policies.agreesToTerms === true } : null,
  };
};

export const listingDataFromOnboarding = (kind: 'experience' | 'property', onboarding: OnboardingForActivation, lead: LeadForActivation | null): Record<string, unknown> => {
  const experience = answers(onboarding.answers, 'EXPERIENCE');
  const location = answers(onboarding.answers, 'LOCATION');
  const pricing = answers(onboarding.answers, 'PRICING');
  const availability = answers(onboarding.answers, 'AVAILABILITY');
  const images = answers(onboarding.answers, 'IMAGES');
  const policies = answers(onboarding.answers, 'POLICIES');
  const basePrice = num(pricing.basePrice);
  const allImages = [...files(images.coverImage), ...files(images.images)];
  const seen = new Set<string>();
  const imageFiles = allImages.filter((file) => (seen.has(file.fileId) ? false : (seen.add(file.fileId), true))).slice(0, 20);
  const common = {
    name: str(experience.title) ?? lead?.name ?? onboarding.name ?? 'Untitled',
    description: str(experience.description),
    location: str(location.city) ?? lead?.location ?? null,
    destination: [str(location.city), str(location.state)].filter(Boolean).join(', ') || null,
    capacity: num(experience.capacity),
    basePrice: basePrice !== null ? { amountMicros: Math.round(basePrice * 1_000_000), currencyCode: 'INR' } : null,
    priceUnit: str(pricing.priceUnit),
    availability: Object.keys(availability).length > 0 ? { availableDays: list(availability.availableDays), noticePeriodHours: num(availability.noticePeriodHours), seasonalNotes: str(availability.seasonalNotes) } : null,
    cancellationPolicy: str(policies.cancellationPolicy),
    images: imageFiles.length > 0 ? imageFiles.map((file) => ({ fileId: file.fileId, label: file.label ?? 'image' })) : null,
    status: 'DRAFT',
  };

  if (kind === 'experience') {
    return {
      ...common,
      category: lead?.category ?? 'EXPERIENCE',
      subcategory: lead?.subcategory ?? null,
      durationMinutes: num(experience.durationMinutes),
      minParticipants: num(pricing.minimumGuests),
      included: list(experience.inclusions).length > 0 ? list(experience.inclusions) : null,
      languages: list(answers(onboarding.answers, 'BASIC_INFORMATION').languages).length > 0 ? list(answers(onboarding.answers, 'BASIC_INFORMATION').languages) : (lead?.languages ?? null),
      safetyInformation: str(policies.safetyMeasures),
      meetingPoint: str(location.addressLine),
      hostName: str(answers(onboarding.answers, 'BASIC_INFORMATION').displayName),
    };
  }

  return {
    ...common,
    propertyType: propertyTypeFor(lead?.subcategory ?? null),
    streetAddress: [str(location.addressLine), str(location.city), str(location.state), str(location.pincode)].filter(Boolean).join(', ') || null,
    houseRules: str(policies.houseRules),
    amenities: list(experience.inclusions).length > 0 ? list(experience.inclusions) : null,
  };
};

// STAY subcategories → Founder property types; anything unrecognised is OTHER.
const PROPERTY_TYPE_BY_SUBCATEGORY: Record<string, string> = {
  VILLA: 'VILLA',
  HOMESTAY: 'HOMESTAY',
  BOUTIQUE_STAY: 'BOUTIQUE_HOTEL',
  RESORT: 'RESORT',
  HOTEL: 'HOTEL',
  FARM_STAY: 'FARMSTAY',
  FARMSTAY: 'FARMSTAY',
  HERITAGE_PROPERTY: 'HERITAGE_PROPERTY',
  LUXURY_STAY: 'LUXURY_STAY',
  UNIQUE_STAY: 'UNIQUE_STAY',
  GLAMPING: 'CAMP',
  GLAMPING_PROPERTY: 'CAMP',
  HOSTEL: 'HOSTEL',
  RETREAT: 'RETREAT_CENTRE',
  RETREAT_CENTRE: 'RETREAT_CENTRE',
  PROPERTY_MANAGER: 'PROPERTY_MANAGER',
  PROPERTY_OWNER: 'PROPERTY_OWNER',
};

export const propertyTypeFor = (subcategory: string | null): string => (subcategory && PROPERTY_TYPE_BY_SUBCATEGORY[subcategory]) ?? 'OTHER';

// ---- lookups ----------------------------------------------------------------------

type PartnerRow = { id: string; partnerCode: string | null; sourceKey: string | null; leadId: string | null; onboardingId: string | null; status: string | null; contactId: string | null; organisationId: string | null };

const PARTNER_FIELDS = { id: true, partnerCode: true, sourceKey: true, leadId: true, onboardingId: true, status: true, contactId: true, organisationId: true } as const;

export const findPartnerForOnboarding = async (client: CoreApiClient, onboarding: { id: string; leadId: string | null }): Promise<PartnerRow | null> => {
  const byKey = (await client.query({ lvPartners: { __args: { first: 1, filter: { or: [{ sourceKey: { eq: sourceKeyFor(onboarding.id) } }, { onboardingId: { eq: onboarding.id } }] } }, edges: { node: PARTNER_FIELDS } } })) as { lvPartners?: { edges?: { node: PartnerRow }[] } };
  const found = byKey.lvPartners?.edges?.[0]?.node;

  if (found) {
    return found;
  }

  if (!onboarding.leadId) {
    return null;
  }

  // A partner already made from this lead (an earlier onboarding, or by hand):
  // link it rather than create a second one.
  const byLead = (await client.query({ lvPartners: { __args: { first: 1, filter: { leadId: { eq: onboarding.leadId } }, orderBy: [{ createdAt: 'AscNullsLast' }] }, edges: { node: PARTNER_FIELDS } } })) as { lvPartners?: { edges?: { node: PartnerRow }[] } };

  return byLead.lvPartners?.edges?.[0]?.node ?? null;
};

const findOrCreatePerson = async (client: CoreApiClient, input: { name: string | null; email: string | null; phone: string | null; city: string | null }): Promise<{ id: string; created: boolean } | null> => {
  if (!input.email && !input.name) {
    return null;
  }

  if (input.email) {
    const existing = (await client.query({ people: { __args: { first: 1, filter: { emails: { primaryEmail: { ilike: input.email.replace(/[%_]/g, '') } } } }, edges: { node: { id: true } } } })) as { people?: { edges?: { node: { id: string } }[] } };
    const person = existing.people?.edges?.[0]?.node;

    if (person) {
      return { id: person.id, created: false };
    }
  }

  const [firstName, ...rest] = (input.name ?? input.email ?? 'Partner contact').split(/\s+/);
  const created = (await client.mutation({
    createPerson: {
      __args: {
        data: {
          name: { firstName: firstName ?? '', lastName: rest.join(' ') },
          ...(input.email ? { emails: { primaryEmail: input.email, additionalEmails: null } } : {}),
          ...(input.phone ? { phones: { primaryPhoneNumber: input.phone, primaryPhoneCountryCode: '', primaryPhoneCallingCode: '', additionalPhones: null } } : {}),
        },
      },
      id: true,
    },
  })) as { createPerson?: { id: string } };

  return created.createPerson ? { id: created.createPerson.id, created: true } : null;
};

const findOrCreateCompany = async (client: CoreApiClient, input: { name: string | null; website: string | null; city: string | null }): Promise<{ id: string; created: boolean } | null> => {
  if (!input.name) {
    return null;
  }

  const existing = (await client.query({ companies: { __args: { first: 1, filter: { name: { ilike: input.name.replace(/[%_]/g, '') } } }, edges: { node: { id: true } } } })) as { companies?: { edges?: { node: { id: string } }[] } };
  const company = existing.companies?.edges?.[0]?.node;

  if (company) {
    return { id: company.id, created: false };
  }

  const created = (await client.mutation({
    createCompany: {
      __args: { data: { name: input.name, ...(input.website ? { domainName: { primaryLinkUrl: input.website, primaryLinkLabel: '', secondaryLinks: null } } : {}), ...(input.city ? { address: { addressCity: input.city } } : {}) } },
      id: true,
    },
  })) as { createCompany?: { id: string } };

  return created.createCompany ? { id: created.createCompany.id, created: true } : null;
};

// ---- the chain --------------------------------------------------------------------

export const ensurePartnerForOnboarding = async ({ application, onboarding, lead, actorWorkspaceMemberId, now, sourceEvent }: { application: CoreApiClient; onboarding: OnboardingForActivation; lead: LeadForActivation | null; actorWorkspaceMemberId: string | null; now: string; sourceEvent: string }): Promise<ActivationOutcome> => {
  const warnings: string[] = [];
  const data = partnerDataFromOnboarding(onboarding, lead);
  const basic = answers(onboarding.answers, 'BASIC_INFORMATION');
  const location = answers(onboarding.answers, 'LOCATION');

  // Person / organisation: link before create, create only from stated facts.
  let contactId: string | null = null;
  let organisationId: string | null = null;

  try {
    const person = await findOrCreatePerson(application, { name: str(basic.legalName) ?? str(basic.displayName) ?? lead?.name ?? null, email: str(basic.email) ?? lead?.emails?.primaryEmail ?? null, phone: str(basic.phone) ?? lead?.phones?.primaryPhoneNumber ?? null, city: str(location.city) ?? lead?.location ?? null });

    contactId = person?.id ?? null;
  } catch (error) {
    warnings.push(`Contact person not linked: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown error'}`);
  }

  try {
    const company = await findOrCreateCompany(application, { name: str(basic.organisationName) ?? lead?.organisationName ?? null, website: str(answers(onboarding.answers, 'ABOUT_YOU').website) ?? lead?.website?.primaryLinkUrl ?? null, city: str(location.city) ?? lead?.location ?? null });

    organisationId = company?.id ?? null;
  } catch (error) {
    warnings.push(`Organisation not linked: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown error'}`);
  }

  // Partner: find (by source key, onboarding, or lead) → link; else create.
  let partner = await findPartnerForOnboarding(application, { id: onboarding.id, leadId: onboarding.leadId });
  let created = false;
  let linked = false;

  if (partner === null) {
    try {
      const result = (await application.mutation({
        createLvPartner: {
          __args: {
            data: {
              ...data,
              sourceKey: sourceKeyFor(onboarding.id),
              status: 'APPROVED',
              approvedAt: onboarding.decidedAt ?? now,
              leadId: onboarding.leadId,
              onboardingId: onboarding.id,
              ownerId: lead?.ownerId ?? null,
              contactId,
              organisationId,
              provenance: { source: 'ONBOARDING_APPROVED', onboardingId: onboarding.id, leadId: onboarding.leadId, lvLeadId: lead?.lvLeadId ?? null, approvedById: actorWorkspaceMemberId ?? onboarding.reviewerId ?? null, createdAt: now, sourceEvent },
            },
          },
          ...PARTNER_FIELDS,
        },
      })) as { createLvPartner: PartnerRow };

      partner = result.createLvPartner;
      created = true;
    } catch (error) {
      // The unique index on sourceKey fired: another worker got there first.
      if (!isUniqueViolation(error)) {
        throw error;
      }

      partner = await findPartnerForOnboarding(application, { id: onboarding.id, leadId: onboarding.leadId });

      if (partner === null) {
        throw error;
      }
    }
  }

  if (!created) {
    // Reuse: make sure the existing partner points at this onboarding and lead
    // and is at least APPROVED; never downgrade an ACTIVE partner.
    const patch: Record<string, unknown> = {};

    if (partner.onboardingId !== onboarding.id) {
      patch.onboardingId = onboarding.id;
    }

    if (!partner.leadId && onboarding.leadId) {
      patch.leadId = onboarding.leadId;
    }

    if (!partner.contactId && contactId) {
      patch.contactId = contactId;
    }

    if (!partner.organisationId && organisationId) {
      patch.organisationId = organisationId;
    }

    if (partner.status === null || partner.status === 'PROSPECTIVE' || partner.status === 'ONBOARDING') {
      patch.status = 'APPROVED';
      patch.approvedAt = onboarding.decidedAt ?? now;
    }

    if (Object.keys(patch).length > 0) {
      await application.mutation({ updateLvPartner: { __args: { id: partner.id, data: patch }, id: true } });
      linked = true;
    }
  }

  // Code, allocated by the unique index (never recomputed once issued).
  const code = await allocateEntityCode({ kind: 'partner', record: { id: partner.id, code: partner.partnerCode }, port: createCoreApiEntityCodePort(application, 'partner') });

  if (!code.ok) {
    warnings.push(`Partner code not allocated: ${code.reason}`);
  }

  const partnerCode = code.ok ? code.code : partner.partnerCode;

  await writeAuditEvent(application, {
    action: created ? 'PARTNER_CREATED' : 'PARTNER_LINKED',
    outcome: 'APPLIED',
    targetObject: 'lvPartner',
    targetRecordId: partner.id,
    targetLabel: (data.name as string) ?? null,
    actorWorkspaceMemberId,
    at: now,
    reason: created ? 'Onboarding approved' : linked ? 'Onboarding approved — existing partner linked' : 'Onboarding approved — partner already linked (replay)',
    metadata: { onboardingId: onboarding.id, leadId: onboarding.leadId, lvLeadId: lead?.lvLeadId ?? null, partnerCode, contactId, organisationId, sourceEvent },
  });

  // Listing: STAY → property, EXPERIENCE → experience; never forced otherwise.
  const kind = expectedListingFor(lead?.category ?? null);
  let experience: ActivationOutcome['experience'] = null;
  let property: ActivationOutcome['property'] = null;

  if (kind !== null) {
    const listing = await ensureListingForOnboarding({ application, kind: kind === 'EXPERIENCE' ? 'experience' : 'property', onboarding, lead, partnerId: partner.id, ownerId: lead?.ownerId ?? null, actorWorkspaceMemberId, now, sourceEvent, contactId });

    if (kind === 'EXPERIENCE') {
      experience = listing;
    } else {
      property = listing;
    }

    if (listing.warning) {
      warnings.push(listing.warning);
    }
  }

  return { partner: { id: partner.id, partnerCode, created, linked }, experience, property, contactId, organisationId, warnings };
};

type ListingRow = { id: string; code: string | null };

export const ensureListingForOnboarding = async ({ application, kind, onboarding, lead, partnerId, ownerId, actorWorkspaceMemberId, now, sourceEvent, contactId }: { application: CoreApiClient; kind: 'experience' | 'property'; onboarding: OnboardingForActivation; lead: LeadForActivation | null; partnerId: string; ownerId: string | null; actorWorkspaceMemberId: string | null; now: string; sourceEvent: string; contactId: string | null }): Promise<{ id: string; code: string | null; created: boolean; warning?: string }> => {
  const meta = kind === 'experience' ? { plural: 'lvExperiences', create: 'createLvExperience', codeField: 'experienceCode', object: 'lvExperience', action: 'EXPERIENCE_CREATED' as const } : { plural: 'lvProperties', create: 'createLvProperty', codeField: 'propertyCode', object: 'lvProperty', action: 'PROPERTY_CREATED' as const };
  const select = { id: true, [meta.codeField]: true };
  const find = async (): Promise<ListingRow | null> => {
    const result = (await application.query({ [meta.plural]: { __args: { first: 1, filter: { or: [{ sourceKey: { eq: sourceKeyFor(onboarding.id) } }, { onboardingId: { eq: onboarding.id } }] } }, edges: { node: select } } } as never)) as Record<string, { edges?: { node: Record<string, string | null> }[] }>;
    const node = result[meta.plural]?.edges?.[0]?.node;

    return node ? { id: node.id as string, code: node[meta.codeField] ?? null } : null;
  };

  let row = await find();
  let created = false;

  if (row === null) {
    const data = listingDataFromOnboarding(kind, onboarding, lead);

    try {
      const result = (await application.mutation({
        [meta.create]: {
          __args: { data: { ...data, sourceKey: sourceKeyFor(onboarding.id), partnerId, onboardingId: onboarding.id, ownerId, ...(kind === 'experience' ? { hostId: contactId } : { managerId: contactId }) } },
          ...select,
        },
      } as never)) as Record<string, Record<string, string | null>>;
      const node = result[meta.create]!;

      row = { id: node.id as string, code: node[meta.codeField] ?? null };
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      row = await find();

      if (row === null) {
        throw error;
      }
    }
  }

  const code = await allocateEntityCode({ kind, record: { id: row.id, code: row.code }, port: createCoreApiEntityCodePort(application, kind) });

  if (created) {
    await writeAuditEvent(application, {
      action: meta.action,
      outcome: 'APPLIED',
      targetObject: meta.object,
      targetRecordId: row.id,
      targetLabel: (listingDataFromOnboarding(kind, onboarding, lead).name as string) ?? null,
      actorWorkspaceMemberId,
      at: now,
      reason: 'Created from the approved onboarding as a draft for the team to complete and approve',
      metadata: { onboardingId: onboarding.id, partnerId, leadId: onboarding.leadId, code: code.ok ? code.code : null, sourceEvent },
    });
  }

  return { id: row.id, code: code.ok ? code.code : row.code, created, warning: code.ok ? undefined : `${kind} code not allocated: ${code.reason}` };
};
