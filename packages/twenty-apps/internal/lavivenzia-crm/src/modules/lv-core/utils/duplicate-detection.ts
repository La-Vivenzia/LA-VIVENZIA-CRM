import {
  locationKey,
  normalizeEmail,
  normalizeNameForMatching,
  normalizePhone,
  normalizeWebsiteUrl,
  parseInstagramHandle,
  websiteDomain,
} from 'src/modules/lv-capture/utils/normalize-input';
import { nameSimilarity, similarityPercent } from 'src/modules/lv-core/utils/similarity';

// PRODUCT-REQUIREMENTS.md: "Show similarity before creation, e.g. 91%. Actions:
// Merge, Create New, Ignore." This module produces the evidence for that
// screen. It never merges or deletes anything — those are permissioned,
// audited actions taken by a human.

export type DuplicateCandidateRecord = {
  id: string;
  name?: string | null;
  organisationName?: string | null;
  email?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  instagramHandle?: string | null;
  location?: string | null;
};

export type DuplicateMatchReason =
  | 'EMAIL_EXACT'
  | 'PHONE_EXACT'
  | 'INSTAGRAM_EXACT'
  | 'WEBSITE_DOMAIN_EXACT'
  | 'NAME_SIMILAR'
  | 'NAME_SIMILAR_SAME_LOCATION';

export type DuplicateMatch = {
  recordId: string;
  score: number;
  percent: number;
  reasons: readonly DuplicateMatchReason[];
};

// An exact hit on a strong identifier is treated as certain. These are the
// values a business cannot share by coincidence.
const EXACT_MATCH_SCORE = 1;

// Below this a pair is not worth showing a reviewer; above it we surface the
// candidate and let the human decide.
export const DUPLICATE_REVIEW_THRESHOLD = 0.7;

// At or above this the UI should default to "likely duplicate" framing. Still a
// human decision — SECURITY-RBAC.md keeps merge permissioned and audited.
export const DUPLICATE_STRONG_THRESHOLD = 0.85;

// Stable keys for a record. Two records sharing any key are near-certainly the
// same entity, which lets a caller pre-filter cheaply in SQL before running
// similarity over the survivors.
export const buildDuplicateKeys = (
  record: DuplicateCandidateRecord,
): readonly string[] => {
  const keys: string[] = [];

  const email = normalizeEmail(record.email);

  if (email !== null) {
    keys.push(`email:${email}`);
  }

  const phone = normalizePhone(record.phone);

  if (phone !== null) {
    keys.push(`phone:${phone}`);
  }

  const instagram = parseInstagramHandle(record.instagramHandle);

  if (instagram !== null) {
    keys.push(`instagram:${instagram}`);
  }

  const domain = websiteDomain(normalizeWebsiteUrl(record.websiteUrl));

  if (domain !== null) {
    keys.push(`domain:${domain}`);
  }

  const name = normalizeNameForMatching(
    record.organisationName ?? record.name ?? null,
  );

  if (name.length > 0) {
    const place = locationKey(record.location);

    keys.push(place.length > 0 ? `name:${name}|${place}` : `name:${name}`);
  }

  return keys;
};

const bestName = (record: DuplicateCandidateRecord): string | null =>
  record.organisationName ?? record.name ?? null;

// Compares one incoming record against one existing record.
export const compareForDuplicate = (
  incoming: DuplicateCandidateRecord,
  existing: DuplicateCandidateRecord,
): DuplicateMatch | null => {
  const reasons: DuplicateMatchReason[] = [];
  let score = 0;

  const incomingEmail = normalizeEmail(incoming.email);
  const existingEmail = normalizeEmail(existing.email);

  if (incomingEmail !== null && incomingEmail === existingEmail) {
    reasons.push('EMAIL_EXACT');
    score = EXACT_MATCH_SCORE;
  }

  const incomingPhone = normalizePhone(incoming.phone);
  const existingPhone = normalizePhone(existing.phone);

  if (incomingPhone !== null && incomingPhone === existingPhone) {
    reasons.push('PHONE_EXACT');
    score = EXACT_MATCH_SCORE;
  }

  const incomingInstagram = parseInstagramHandle(incoming.instagramHandle);
  const existingInstagram = parseInstagramHandle(existing.instagramHandle);

  if (incomingInstagram !== null && incomingInstagram === existingInstagram) {
    reasons.push('INSTAGRAM_EXACT');
    score = EXACT_MATCH_SCORE;
  }

  const incomingDomain = websiteDomain(normalizeWebsiteUrl(incoming.websiteUrl));
  const existingDomain = websiteDomain(normalizeWebsiteUrl(existing.websiteUrl));

  if (incomingDomain !== null && incomingDomain === existingDomain) {
    reasons.push('WEBSITE_DOMAIN_EXACT');
    score = EXACT_MATCH_SCORE;
  }

  const similarity = nameSimilarity(bestName(incoming), bestName(existing));

  if (similarity > 0) {
    const sameLocation =
      locationKey(incoming.location).length > 0 &&
      locationKey(incoming.location) === locationKey(existing.location);

    // Same town materially raises confidence for a similar name; different
    // towns are exactly the "Forest Table" vs "Forest Table Pune" case, which
    // stays a human decision rather than an automatic merge.
    const adjusted = sameLocation ? Math.min(1, similarity + 0.05) : similarity;

    if (adjusted > score) {
      score = adjusted;
      reasons.push(
        sameLocation ? 'NAME_SIMILAR_SAME_LOCATION' : 'NAME_SIMILAR',
      );
    }
  }

  if (score < DUPLICATE_REVIEW_THRESHOLD || reasons.length === 0) {
    return null;
  }

  return {
    recordId: existing.id,
    score,
    percent: similarityPercent(score),
    reasons,
  };
};

// Ranks every candidate. Callers pass a pre-filtered set (by duplicate key or a
// cheap name prefix) — this does not query anything itself.
export const findDuplicates = (
  incoming: DuplicateCandidateRecord,
  candidates: readonly DuplicateCandidateRecord[],
): readonly DuplicateMatch[] =>
  candidates
    .filter((candidate) => candidate.id !== incoming.id)
    .map((candidate) => compareForDuplicate(incoming, candidate))
    .filter((match): match is DuplicateMatch => match !== null)
    .sort((left, right) =>
      right.score === left.score
        ? left.recordId.localeCompare(right.recordId)
        : right.score - left.score,
    );
