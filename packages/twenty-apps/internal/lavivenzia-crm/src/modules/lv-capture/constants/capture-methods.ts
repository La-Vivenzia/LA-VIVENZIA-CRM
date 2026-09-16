import { type LeadCaptureMode, type LeadSource, type SocialPlatform } from 'src/modules/lv-core/constants/lead-taxonomy';

// The universal capture menu: what an employee is holding when they open
// Capture Lead, and what the system does with it. One table, read by the
// capture screen (to build the menu and pick the right input step) and by
// the server (to validate a request and derive source / provenance).
//
// `input` is the kind of first step the method needs:
//   FORM    type the fields
//   IMAGE   take or upload a picture → extraction → review
//   URL     paste a link → extraction where the site allows it → review
//   HANDLE  paste a handle or profile link → review
//   CSV     upload a file → map → validate → import

export type CaptureInputKind = 'FORM' | 'IMAGE' | 'URL' | 'HANDLE' | 'CSV';

export type CaptureMethod = {
  key: LeadCaptureMode;
  label: string;
  hint: string;
  group: 'MANUAL' | 'IMAGE' | 'LINK' | 'PEOPLE' | 'BULK';
  input: CaptureInputKind;
  // The source implied when the employee does not state one.
  defaultSource: LeadSource;
  platform: SocialPlatform | null;
  // Extracted or derived fields must be confirmed by a person first.
  requiresConfirmation: boolean;
};

export const CAPTURE_METHODS: readonly CaptureMethod[] = [
  { key: 'MANUAL', label: 'Manual', hint: 'Type what you know', group: 'MANUAL', input: 'FORM', defaultSource: 'OTHER', platform: null, requiresConfirmation: false },
  { key: 'VISITING_CARD', label: 'Visiting card', hint: 'Photograph the card', group: 'IMAGE', input: 'IMAGE', defaultSource: 'EVENT', platform: null, requiresConfirmation: true },
  { key: 'IMAGE', label: 'Image', hint: 'Any picture with contact details', group: 'IMAGE', input: 'IMAGE', defaultSource: 'OTHER', platform: null, requiresConfirmation: true },
  { key: 'SCREENSHOT', label: 'Screenshot', hint: 'A chat, a profile, a listing', group: 'IMAGE', input: 'IMAGE', defaultSource: 'OTHER', platform: null, requiresConfirmation: true },
  { key: 'BROCHURE', label: 'Brochure', hint: 'Photograph the page with contacts', group: 'IMAGE', input: 'IMAGE', defaultSource: 'EVENT', platform: null, requiresConfirmation: true },
  { key: 'FLYER', label: 'Flyer', hint: 'Photograph the flyer', group: 'IMAGE', input: 'IMAGE', defaultSource: 'EVENT', platform: null, requiresConfirmation: true },
  { key: 'POSTER', label: 'Poster', hint: 'Photograph the poster', group: 'IMAGE', input: 'IMAGE', defaultSource: 'EVENT', platform: null, requiresConfirmation: true },
  { key: 'INSTAGRAM', label: 'Instagram profile', hint: 'Profile link or @handle', group: 'LINK', input: 'HANDLE', defaultSource: 'INSTAGRAM', platform: 'INSTAGRAM', requiresConfirmation: true },
  { key: 'INSTAGRAM_POST', label: 'Instagram post', hint: 'A post or reel link — the account is what we keep', group: 'LINK', input: 'HANDLE', defaultSource: 'INSTAGRAM', platform: 'INSTAGRAM', requiresConfirmation: true },
  { key: 'LINKEDIN_PROFILE', label: 'LinkedIn profile', hint: 'Profile or company page link', group: 'LINK', input: 'HANDLE', defaultSource: 'LINKEDIN', platform: 'LINKEDIN', requiresConfirmation: true },
  { key: 'WEBSITE_URL', label: 'Website', hint: 'Paste the site address', group: 'LINK', input: 'URL', defaultSource: 'WEBSITE', platform: null, requiresConfirmation: true },
  { key: 'SOCIAL_HANDLE', label: 'Social handle', hint: 'Facebook, YouTube, X or another platform', group: 'LINK', input: 'HANDLE', defaultSource: 'OTHER', platform: 'OTHER', requiresConfirmation: true },
  { key: 'REFERRAL', label: 'Referral', hint: 'Someone recommended them', group: 'PEOPLE', input: 'FORM', defaultSource: 'REFERRAL', platform: null, requiresConfirmation: false },
  { key: 'PARTNER_REFERRAL', label: 'Partner referral', hint: 'An existing partner sent them', group: 'PEOPLE', input: 'FORM', defaultSource: 'PARTNER_REFERRAL', platform: null, requiresConfirmation: false },
  { key: 'EVENT', label: 'Event', hint: 'Met at an event', group: 'PEOPLE', input: 'FORM', defaultSource: 'EVENT', platform: null, requiresConfirmation: false },
  { key: 'WALK_IN', label: 'Walk-in', hint: 'They came to us', group: 'PEOPLE', input: 'FORM', defaultSource: 'WALK_IN', platform: null, requiresConfirmation: false },
  { key: 'PHONE', label: 'Phone', hint: 'They called, or you did', group: 'PEOPLE', input: 'FORM', defaultSource: 'PHONE', platform: null, requiresConfirmation: false },
  { key: 'IMPORT', label: 'Import CSV', hint: 'A spreadsheet of leads', group: 'BULK', input: 'CSV', defaultSource: 'IMPORTED', platform: null, requiresConfirmation: true },
  { key: 'OTHER', label: 'Other', hint: 'Anything else', group: 'MANUAL', input: 'FORM', defaultSource: 'OTHER', platform: null, requiresConfirmation: false },
];

// API is a method a machine uses, never a person; it is not in the menu but
// stays a valid mode for leads created through the API.
const API_METHOD: CaptureMethod = { key: 'API', label: 'API', hint: 'Created through the API', group: 'BULK', input: 'FORM', defaultSource: 'WEBSITE', platform: null, requiresConfirmation: false };

export const CAPTURE_METHOD_BY_KEY: Readonly<Record<LeadCaptureMode, CaptureMethod>> = Object.fromEntries(
  [...CAPTURE_METHODS, API_METHOD].map((method) => [method.key, method]),
) as Record<LeadCaptureMode, CaptureMethod>;

export const isCaptureMethodKey = (value: unknown): value is LeadCaptureMode => typeof value === 'string' && value in CAPTURE_METHOD_BY_KEY;

// Where the employee lands when they open Capture Lead: the five primary
// actions of the entry screen, each pointing at one method.
export const PRIMARY_CAPTURE_ACTIONS: readonly { label: string; hint: string; method: LeadCaptureMode }[] = [
  { label: 'Capture manually', hint: 'Under 30 seconds', method: 'MANUAL' },
  { label: 'Upload image', hint: 'Visiting card, screenshot, brochure', method: 'VISITING_CARD' },
  { label: 'Paste URL', hint: 'Website', method: 'WEBSITE_URL' },
  { label: 'Paste social profile', hint: 'Instagram, LinkedIn, handle', method: 'INSTAGRAM' },
  { label: 'Import CSV', hint: 'Many leads at once', method: 'IMPORT' },
];
