import {
  type CaptureInput,
  type CaptureResult,
  type FieldProvenanceMap,
  type LeadDraft,
} from 'src/modules/lv-capture/types/capture.types';
import {
  normalizeEmail,
  normalizeLocation,
  normalizePhone,
  normalizeWebsiteUrl,
  nullIfBlank,
  parseInstagramHandle,
  parseSocialProfile,
  type SocialProfile,
  websiteDomain,
} from 'src/modules/lv-capture/utils/normalize-input';
import {
  STATUS_ON_CONFIRMED_CAPTURE,
  STATUS_ON_PRELIMINARY_CAPTURE,
  type LeadPriority,
  type LeadStatus,
} from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  IMAGE_CAPTURE_MODES,
  isLeadCategory,
  isLeadSource,
  LEAD_SUBCATEGORIES_BY_CATEGORY,
  type FieldProvenance,
  type LeadCaptureMode,
  type LeadCategory,
  type LeadSource,
} from 'src/modules/lv-core/constants/lead-taxonomy';
import { buildDuplicateKeys } from 'src/modules/lv-core/utils/duplicate-detection';

// Preliminary lead creation: turns any capture mode into one validated draft.
// Deterministic end to end — the only thing this cannot do is read an image,
// and it says so rather than inventing values (see ImageFieldExtractor).

// Modes whose defining input is a machine-read artefact. CAPTURE-OCR.md
// requires "Always show confirmation before creation", so a draft from these
// modes is marked for human review regardless of how complete it looks.
const MODES_REQUIRING_CONFIRMATION = new Set<LeadCaptureMode>(IMAGE_CAPTURE_MODES);

// Which source a mode implies when the caller does not state one. A hunter who
// pastes an Instagram link is telling us the source; a hunter photographing a
// card at an event is not, so VISITING_CARD stays OTHER until told.
const DEFAULT_SOURCE_BY_MODE: Record<LeadCaptureMode, LeadSource> = {
  MANUAL: 'OTHER',
  WEBSITE_URL: 'WEBSITE',
  INSTAGRAM: 'INSTAGRAM',
  IMAGE: 'OTHER',
  VISITING_CARD: 'OTHER',
  REFERRAL: 'REFERRAL',
  IMPORT: 'IMPORTED',
  API: 'WEBSITE',
  SCREENSHOT: 'OTHER',
  INSTAGRAM_POST: 'INSTAGRAM',
  LINKEDIN_PROFILE: 'LINKEDIN',
  SOCIAL_HANDLE: 'OTHER',
  BROCHURE: 'EVENT',
  FLYER: 'EVENT',
  POSTER: 'EVENT',
  EVENT: 'EVENT',
  WALK_IN: 'WALK_IN',
  PHONE: 'PHONE',
  PARTNER_REFERRAL: 'PARTNER_REFERRAL',
  OTHER: 'OTHER',
};

// Which fields an extractor (OCR / page metadata) may have filled. Their
// provenance is recorded as extracted rather than typed, so a reviewer knows
// what to trust — unless the person changed the value, which makes it theirs.
const extractedProvenance = (input: CaptureInput, field: string): FieldProvenance =>
  input.extractedFields?.includes(field) ? (input.extractionKind === 'OCR' ? 'OCR_EXTRACTED' : 'DERIVED') : 'USER_ENTERED';

// Fields that make a lead workable. Completeness is the share of these present
// — a plain, explainable number, NOT an "AI score".
const COMPLETENESS_FIELDS = [
  'name',
  'organisationName',
  'email',
  'phone',
  'websiteUrl',
  'instagramHandle',
  'location',
  'category',
] as const;

const titleCaseFromSlug = (value: string): string =>
  value
    .split(/[-_.]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

// A website with no supplied name still needs a human-readable label. The
// registrable part of the domain is the least-surprising choice, and it is
// derived, not guessed — provenance records that.
const nameFromDomain = (domain: string): string => {
  const [first] = domain.split('.');

  return titleCaseFromSlug(first ?? domain);
};

const computeCompleteness = (
  draft: Omit<LeadDraft, 'completeness' | 'duplicateKeys' | 'warnings'>,
): number => {
  const present = COMPLETENESS_FIELDS.filter((field) => {
    const value = draft[field];

    return value !== null && value !== undefined && String(value).length > 0;
  }).length;

  return Math.round((present / COMPLETENESS_FIELDS.length) * 100);
};

export const buildLeadDraft = (input: CaptureInput): CaptureResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const provenance: Record<string, FieldProvenance> = {};

  const rawInput = nullIfBlank(input.rawInput);

  // ---- identity signals ---------------------------------------------------

  let websiteUrl = normalizeWebsiteUrl(input.websiteUrl);
  let instagramHandle = parseInstagramHandle(input.instagramHandle);

  // In URL/handle modes the payload may arrive only in rawInput.
  if (input.captureMode === 'WEBSITE_URL' && websiteUrl === null) {
    websiteUrl = normalizeWebsiteUrl(rawInput);

    if (websiteUrl === null) {
      errors.push('A valid website URL is required for website capture.');
    }
  }

  if ((input.captureMode === 'INSTAGRAM' || input.captureMode === 'INSTAGRAM_POST') && instagramHandle === null) {
    instagramHandle = parseInstagramHandle(rawInput);

    if (instagramHandle === null) {
      errors.push(
        input.captureMode === 'INSTAGRAM_POST'
          ? 'A post or reel link does not identify an account. Add the profile handle (e.g. @name) so the lead can be found again.'
          : 'A valid Instagram handle or profile URL is required. Post and reel links do not identify an account.',
      );
    }
  }

  // Other social platforms: the profile is kept as a link plus handle.
  let socialProfile: SocialProfile | null = parseSocialProfile(input.socialProfileUrl, input.socialPlatform ?? null);

  if ((input.captureMode === 'LINKEDIN_PROFILE' || input.captureMode === 'SOCIAL_HANDLE') && socialProfile === null) {
    socialProfile = parseSocialProfile(rawInput, input.captureMode === 'LINKEDIN_PROFILE' ? 'LINKEDIN' : (input.socialPlatform ?? null));

    if (socialProfile === null) {
      errors.push(input.captureMode === 'LINKEDIN_PROFILE' ? 'A LinkedIn profile or company page link is required.' : 'A profile link or handle is required.');
    }
  }

  if (socialProfile !== null) {
    provenance.socialProfile = input.socialProfileUrl ? extractedProvenance(input, 'socialProfileUrl') : 'DERIVED';
  }

  if (websiteUrl !== null) {
    provenance.websiteUrl = input.websiteUrl ? extractedProvenance(input, 'websiteUrl') : 'DERIVED';
  }

  if (instagramHandle !== null) {
    provenance.instagramHandle = input.instagramHandle ? extractedProvenance(input, 'instagramHandle') : 'DERIVED';
  }

  // ---- contact ------------------------------------------------------------

  const email = normalizeEmail(input.email);

  if (input.email && email === null) {
    warnings.push(`Email "${input.email}" was not a valid address and was dropped.`);
  }

  if (email !== null) {
    provenance.email = extractedProvenance(input, 'email');
  }

  const phone = normalizePhone(input.phone);

  if (input.phone && phone === null) {
    warnings.push(`Phone "${input.phone}" could not be parsed and was dropped.`);
  }

  if (phone !== null) {
    provenance.phone = extractedProvenance(input, 'phone');
  }

  // ---- name ---------------------------------------------------------------

  const organisationName = nullIfBlank(input.organisationName);
  let name = nullIfBlank(input.name);

  if (name !== null) {
    provenance.name = extractedProvenance(input, 'name');
  } else if (organisationName !== null) {
    name = organisationName;
    provenance.name = 'DERIVED';
  } else if (instagramHandle !== null) {
    name = `@${instagramHandle}`;
    provenance.name = 'DERIVED';
  } else if (websiteUrl !== null) {
    const domain = websiteDomain(websiteUrl);
    name = domain === null ? null : nameFromDomain(domain);
    provenance.name = 'DERIVED';
  } else if (socialProfile?.handle) {
    name = socialProfile.handle;
    provenance.name = 'DERIVED';
  }

  if (organisationName !== null) {
    provenance.organisationName = extractedProvenance(input, 'organisationName');
  }

  // A visiting card or image with nothing typed alongside it has no name yet.
  // That is expected, not an error: the record exists so the artefact is not
  // lost, and it is parked for confirmation.
  if (name === null) {
    if (MODES_REQUIRING_CONFIRMATION.has(input.captureMode)) {
      name = 'Unidentified capture';
      provenance.name = 'DERIVED';
      warnings.push(
        'No name could be determined from the capture. A reviewer must identify this lead.',
      );
    } else {
      errors.push('A name, organisation, website or Instagram handle is required.');
    }
  }

  // ---- mode-specific requirements ----------------------------------------

  const attachmentPath = nullIfBlank(input.attachmentPath);

  if (MODES_REQUIRING_CONFIRMATION.has(input.captureMode) && attachmentPath === null) {
    errors.push('An uploaded file is required for image and visiting-card capture.');
  }

  const referrerName = nullIfBlank(input.referrerName);
  const referrerWorkspaceMemberId = nullIfBlank(input.referrerWorkspaceMemberId);

  if (
    input.captureMode === 'REFERRAL' &&
    referrerName === null &&
    referrerWorkspaceMemberId === null
  ) {
    errors.push('A referral capture must record who referred the lead.');
  }

  if (referrerName !== null || referrerWorkspaceMemberId !== null) {
    provenance.referrer = 'USER_ENTERED';
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // ---- source, status, priority ------------------------------------------

  const requestedSource = nullIfBlank(input.source ?? null);
  const source: LeadSource =
    requestedSource !== null && isLeadSource(requestedSource)
      ? requestedSource
      : DEFAULT_SOURCE_BY_MODE[input.captureMode];

  provenance.source = requestedSource !== null ? 'USER_ENTERED' : 'DERIVED';

  const requiresHumanConfirmation =
    MODES_REQUIRING_CONFIRMATION.has(input.captureMode) &&
    input.isHumanConfirmed !== true;

  const status: LeadStatus = requiresHumanConfirmation
    ? STATUS_ON_PRELIMINARY_CAPTURE
    : STATUS_ON_CONFIRMED_CAPTURE;

  const priority: LeadPriority = input.priority ?? 'MEDIUM';

  const location = normalizeLocation(input.location);

  if (location !== null) {
    provenance.location = extractedProvenance(input, 'location');
  }

  // Category and subcategory come from the dynamic taxonomy; anything else
  // (a stale client, a hand-built request) is dropped with a warning rather
  // than failing at the database with a message nobody can act on.
  let category = nullIfBlank(input.category);
  let subcategory = nullIfBlank(input.subcategory);

  if (category !== null && !isLeadCategory(category)) {
    warnings.push(`Category "${category}" is not one of the CRM categories and was dropped.`);
    category = null;
    subcategory = null;
  }

  if (subcategory !== null && (category === null || !(LEAD_SUBCATEGORIES_BY_CATEGORY[category as LeadCategory] as readonly string[]).includes(subcategory))) {
    warnings.push(`Subcategory "${subcategory}" is not under ${category ?? 'a category'} and was dropped.`);
    subcategory = null;
  }

  if (category !== null) {
    provenance.category = input.classificationOrigin === 'AI' ? 'AI_SUGGESTED' : 'USER_ENTERED';
  }

  const jobTitle = nullIfBlank(input.jobTitle);

  if (jobTitle !== null) {
    provenance.jobTitle = extractedProvenance(input, 'jobTitle');
  }

  const languages = (input.languages ?? [])
    .map((language) => nullIfBlank(language))
    .filter((language): language is string => language !== null);

  const base = {
    name: name as string,
    organisationName,
    email,
    phone,
    // Deliberately NOT back-filled from the Instagram profile URL: every
    // Instagram lead would then share a domain:instagram.com duplicate key and
    // collide with every other one.
    websiteUrl,
    instagramHandle,
    socialProfile,
    jobTitle,
    location,
    category,
    subcategory,
    languages,
    source,
    captureMode: input.captureMode,
    status,
    priority,
    referrerName,
    referrerWorkspaceMemberId,
    attachmentPath,
    rawInput,
    provenance: provenance as FieldProvenanceMap,
    requiresHumanConfirmation,
  };

  const draft: LeadDraft = {
    ...base,
    completeness: computeCompleteness(base),
    duplicateKeys: buildDuplicateKeys({
      id: '',
      name: base.name,
      organisationName,
      email,
      phone,
      websiteUrl: base.websiteUrl,
      instagramHandle,
      location,
    }),
    warnings,
  };

  return { ok: true, draft };
};
