// Deterministic normalisers shared by every capture mode. No network, no model,
// no guessing: each returns null when the input cannot be parsed, so a caller
// can record a warning instead of storing something wrong.

const WHITESPACE_RUN = /\s+/g;

export const collapseWhitespace = (value: string): string =>
  value.replace(WHITESPACE_RUN, ' ').trim();

export const nullIfBlank = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = collapseWhitespace(value);

  return trimmed.length === 0 ? null : trimmed;
};

// ---------------------------------------------------------------------------
// Website
// ---------------------------------------------------------------------------

const STRIPPED_QUERY_PREFIXES = ['utm_', 'fbclid', 'gclid', 'mc_cid', 'mc_eid'];

// Normalises anything a hunter might paste ("Acme.com", "https://www.acme.com/
// about?utm_source=ig") to a canonical origin+path so two captures of the same
// site collide on the same duplicate key.
export const normalizeWebsiteUrl = (raw: string | null | undefined): string | null => {
  const value = nullIfBlank(raw);

  if (value === null) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let url: URL;

  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  // A bare word like "villa" parses as a URL with no dot in the host; that is a
  // search term, not a website.
  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  for (const key of [...url.searchParams.keys()]) {
    if (STRIPPED_QUERY_PREFIXES.some((prefix) => key.toLowerCase().startsWith(prefix))) {
      url.searchParams.delete(key);
    }
  }

  const path = url.pathname.replace(/\/+$/, '');
  const query = url.searchParams.toString();

  return `https://${host}${path}${query.length > 0 ? `?${query}` : ''}`;
};

export const websiteDomain = (normalizedUrl: string | null): string | null => {
  if (normalizedUrl === null) {
    return null;
  }

  try {
    return new URL(normalizedUrl).hostname;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------

// Instagram allows letters, digits, underscore and period, max 30 chars.
const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/;

// Reserved first path segments that are never a profile.
const INSTAGRAM_NON_PROFILE_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'directory',
  'about',
]);

// Accepts "@acme", "acme", "instagram.com/acme", "https://www.instagram.com/
// acme/?hl=en" and post URLs (from which no handle can be derived -> null).
export const parseInstagramHandle = (raw: string | null | undefined): string | null => {
  const value = nullIfBlank(raw);

  if (value === null) {
    return null;
  }

  const looksLikeUrl = /instagram\.com/i.test(value) || /^https?:\/\//i.test(value);

  if (!looksLikeUrl) {
    const bare = value.replace(/^@/, '').toLowerCase();

    return INSTAGRAM_HANDLE.test(bare) ? bare : null;
  }

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let url: URL;

  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (!/(^|\.)instagram\.com$/i.test(url.hostname)) {
    return null;
  }

  const [first] = url.pathname.split('/').filter((segment) => segment.length > 0);

  if (first === undefined) {
    return null;
  }

  const candidate = first.toLowerCase();

  if (INSTAGRAM_NON_PROFILE_PATHS.has(candidate)) {
    return null;
  }

  return INSTAGRAM_HANDLE.test(candidate) ? candidate : null;
};

export const instagramProfileUrl = (handle: string | null): string | null =>
  handle === null ? null : `https://instagram.com/${handle}`;

// ---------------------------------------------------------------------------
// Email and phone
// ---------------------------------------------------------------------------

// Intentionally permissive but structural: one @, a dot in the domain, no
// spaces. Full RFC validation belongs to the mail server, not lead capture.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const normalizeEmail = (raw: string | null | undefined): string | null => {
  const value = nullIfBlank(raw);

  if (value === null) {
    return null;
  }

  const lowered = value.toLowerCase();

  return EMAIL.test(lowered) ? lowered : null;
};

// India-first: a bare 10-digit number is assumed +91, which is the overwhelming
// majority of what hunters capture. Anything already carrying a "+" is kept as
// given. Returns E.164-ish digits with a leading "+".
const DEFAULT_COUNTRY_CODE = '91';

export const normalizePhone = (raw: string | null | undefined): string | null => {
  const value = nullIfBlank(raw);

  if (value === null) {
    return null;
  }

  const hadPlus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '');

  if (digits.length === 0) {
    return null;
  }

  if (hadPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  if (digits.length === 10) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  // 0-prefixed national format, e.g. 09876543210.
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  return null;
};

// ---------------------------------------------------------------------------
// Names and locations
// ---------------------------------------------------------------------------

// Lowercased, punctuation-stripped, common business suffixes removed. Used for
// duplicate keys and similarity, never for display.
const BUSINESS_SUFFIXES = [
  'pvt ltd',
  'private limited',
  'ltd',
  'llp',
  'llc',
  'inc',
  'co',
  'company',
  'the',
];

export const normalizeNameForMatching = (raw: string | null | undefined): string => {
  const value = nullIfBlank(raw);

  if (value === null) {
    return '';
  }

  let normalized = value
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining marks so "café" and "cafe" match.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

  normalized = collapseWhitespace(normalized);

  for (const suffix of BUSINESS_SUFFIXES) {
    normalized = collapseWhitespace(
      normalized.replace(new RegExp(`(^|\\s)${suffix}(\\s|$)`, 'g'), ' '),
    );
  }

  return normalized;
};

export const normalizeLocation = (raw: string | null | undefined): string | null => {
  const value = nullIfBlank(raw);

  return value === null ? null : value;
};

// Canonical form used to compare a lead's location against a team member's
// region list. Case- and punctuation-insensitive.
export const locationKey = (raw: string | null | undefined): string =>
  normalizeNameForMatching(raw);
