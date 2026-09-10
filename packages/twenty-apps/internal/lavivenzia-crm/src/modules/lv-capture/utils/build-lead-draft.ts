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
  websiteDomain,
} from 'src/modules/lv-capture/utils/normalize-input';
import {
  STATUS_ON_CONFIRMED_CAPTURE,
  STATUS_ON_PRELIMINARY_CAPTURE,
  type LeadPriority,
  type LeadStatus,
} from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  isLeadSource,
  type FieldProvenance,
  type LeadCaptureMode,
  type LeadSource,
} from 'src/modules/lv-core/constants/lead-taxonomy';
import { buildDuplicateKeys } from 'src/modules/lv-core/utils/duplicate-detection';

// Preliminary lead creation: turns any capture mode into one validated draft.
// Deterministic end to end — the only thing this cannot do is read an image,
// and it says so rather than inventing values (see ImageFieldExtractor).

// Modes whose defining input is a machine-read artefact. CAPTURE-OCR.md
// requires "Always show confirmation before creation", so a draft from these
// modes is marked for human review regardless of how complete it looks.
const MODES_REQUIRING_CONFIRMATION = new Set<LeadCaptureMode>([
  'IMAGE',
  'VISITING_CARD',
]);

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
};

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

  if (input.captureMode === 'INSTAGRAM' && instagramHandle === null) {
    instagramHandle = parseInstagramHandle(rawInput);

    if (instagramHandle === null) {
      errors.push(
        'A valid Instagram handle or profile URL is required. Post and reel links do not identify an account.',
      );
    }
  }

  if (websiteUrl !== null) {
    provenance.websiteUrl = input.websiteUrl ? 'USER_ENTERED' : 'DERIVED';
  }

  if (instagramHandle !== null) {
    provenance.instagramHandle = input.instagramHandle
      ? 'USER_ENTERED'
      : 'DERIVED';
  }

  // ---- contact ------------------------------------------------------------

  const email = normalizeEmail(input.email);

  if (input.email && email === null) {
    warnings.push(`Email "${input.email}" was not a valid address and was dropped.`);
  }

  if (email !== null) {
    provenance.email = 'USER_ENTERED';
  }

  const phone = normalizePhone(input.phone);

  if (input.phone && phone === null) {
    warnings.push(`Phone "${input.phone}" could not be parsed and was dropped.`);
  }

  if (phone !== null) {
    provenance.phone = 'USER_ENTERED';
  }

  // ---- name ---------------------------------------------------------------

  const organisationName = nullIfBlank(input.organisationName);
  let name = nullIfBlank(input.name);

  if (name !== null) {
    provenance.name = 'USER_ENTERED';
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
  }

  if (organisationName !== null) {
    provenance.organisationName = 'USER_ENTERED';
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
    provenance.location = 'USER_ENTERED';
  }

  const category = nullIfBlank(input.category);
  const subcategory = nullIfBlank(input.subcategory);

  if (category !== null) {
    provenance.category = 'USER_ENTERED';
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
