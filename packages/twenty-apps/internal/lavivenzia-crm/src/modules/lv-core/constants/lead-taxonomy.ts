// Category, sub-category and source vocabulary from PRODUCT-REQUIREMENTS.md.
//
// These seed the SELECT options so the CRM is usable on day one. They are NOT a
// closed list: PRODUCT-REQUIREMENTS.md "Dynamic categories" requires an admin to
// add a category without a developer, and Twenty SELECT options are editable in
// Settings -> Data Model. Anything added there keeps working, because every
// consumer in this app treats these values as opaque strings.

export const LEAD_CATEGORIES = [
  'EXPERIENCE',
  'STAY',
  'BUSINESS_PARTNER',
  'PEOPLE_COMMUNITY',
] as const;

export type LeadCategory = (typeof LEAD_CATEGORIES)[number];

export const LEAD_CATEGORY_LABELS: Record<LeadCategory, string> = {
  EXPERIENCE: 'Experience ecosystem',
  STAY: 'Stay ecosystem',
  BUSINESS_PARTNER: 'Business partner',
  PEOPLE_COMMUNITY: 'People / Community',
};

export const LEAD_SUBCATEGORIES_BY_CATEGORY: Record<
  LeadCategory,
  readonly string[]
> = {
  EXPERIENCE: [
    'HOST',
    'EXPERT',
    'CREATOR',
    'CURATOR',
    'GUIDE',
    'FACILITATOR',
    'INSTRUCTOR',
    'MENTOR',
    'LOCAL_EXPERT',
    'CULTURAL_EXPERT',
    'ADVENTURE_PROVIDER',
    'WELLNESS_PROVIDER',
    'FOOD_EXPERT',
    'HERITAGE_EXPERT',
    'NATURE_EXPERT',
    'ARTIST',
    'PERFORMER',
    'CHEF',
    'STORYTELLER',
    'PHOTOGRAPHER',
    'TRAVEL_EXPERT',
    'EVENT_ORGANISER',
  ],
  STAY: [
    'VILLA',
    'HOMESTAY',
    'BOUTIQUE_STAY',
    'RESORT',
    'HOTEL',
    'FARM_STAY',
    'HERITAGE_PROPERTY',
    'LUXURY_STAY',
    'UNIQUE_STAY',
    'GLAMPING',
    'HOSTEL',
    'RETREAT',
    'PROPERTY_OWNER',
    'PROPERTY_MANAGER',
  ],
  BUSINESS_PARTNER: [
    'RESTAURANT',
    'CAFE',
    'BAR_LOUNGE',
    'CLOUD_KITCHEN',
    'EVENT_COMPANY',
    'TRAVEL_COMPANY',
    'TOUR_OPERATOR',
    'TRANSPORT',
    'CONCIERGE',
    'EVENT_VENUE',
    'CORPORATE_PARTNER',
    'RETAIL_PARTNER',
    'BRAND_PARTNER',
  ],
  PEOPLE_COMMUNITY: [
    'VOLUNTEER',
    'EXPERIENCE_HUNTER',
    'AMBASSADOR',
    'COMMUNITY_MEMBER',
    'CREATOR_INFLUENCER',
    'PHOTOGRAPHER',
    'CONTENT_CREATOR',
    'AFFILIATE',
    'REFERRAL_PARTNER',
    'INTERN',
    'FREELANCER',
    'CONSULTANT',
    'MENTOR',
    'INVESTOR',
    'ADVISOR',
    'POTENTIAL_EMPLOYEE',
    'ALUMNI',
  ],
};

export const LEAD_SUBCATEGORIES = Object.values(
  LEAD_SUBCATEGORIES_BY_CATEGORY,
).flat();

// PRODUCT-REQUIREMENTS.md "Lead sources".
export const LEAD_SOURCES = [
  'WEBSITE',
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'WHATSAPP',
  'REFERRAL',
  'PHONE',
  'WALK_IN',
  'EVENT',
  'IMPORTED',
  'PARTNER_REFERRAL',
  'OTHER',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: 'Website',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  WHATSAPP: 'WhatsApp',
  REFERRAL: 'Referral',
  PHONE: 'Phone',
  WALK_IN: 'Walk-in',
  EVENT: 'Event',
  IMPORTED: 'Imported',
  PARTNER_REFERRAL: 'Partner referral',
  OTHER: 'Other',
};

// How the record physically entered the CRM. Distinct from LeadSource, which is
// where the *relationship* came from: a visiting card collected at an event is
// captureMode VISITING_CARD with source EVENT.
//
// Day 8 widened the list to the full universal-capture menu. The first eight
// values are the Day 1 set and keep their option ids; the rest are additive.
export const LEAD_CAPTURE_MODES = [
  'MANUAL',
  'WEBSITE_URL',
  'INSTAGRAM',
  'IMAGE',
  'VISITING_CARD',
  'REFERRAL',
  'IMPORT',
  'API',
  'SCREENSHOT',
  'INSTAGRAM_POST',
  'LINKEDIN_PROFILE',
  'SOCIAL_HANDLE',
  'BROCHURE',
  'FLYER',
  'POSTER',
  'EVENT',
  'WALK_IN',
  'PHONE',
  'PARTNER_REFERRAL',
  'OTHER',
] as const;

export type LeadCaptureMode = (typeof LEAD_CAPTURE_MODES)[number];

export const LEAD_CAPTURE_MODE_LABELS: Record<LeadCaptureMode, string> = {
  MANUAL: 'Manual entry',
  WEBSITE_URL: 'Website URL',
  INSTAGRAM: 'Instagram profile',
  IMAGE: 'Image',
  VISITING_CARD: 'Visiting card',
  REFERRAL: 'Referral',
  IMPORT: 'Import',
  API: 'API',
  SCREENSHOT: 'Screenshot',
  INSTAGRAM_POST: 'Instagram post',
  LINKEDIN_PROFILE: 'LinkedIn profile',
  SOCIAL_HANDLE: 'Social handle',
  BROCHURE: 'Brochure',
  FLYER: 'Flyer',
  POSTER: 'Poster',
  EVENT: 'Event',
  WALK_IN: 'Walk-in',
  PHONE: 'Phone',
  PARTNER_REFERRAL: 'Partner referral',
  OTHER: 'Other',
};

// Modes whose defining input is a picture: the fields come off the artefact
// (by a person or by extraction) and must be confirmed before the lead is
// real.
export const IMAGE_CAPTURE_MODES: readonly LeadCaptureMode[] = ['IMAGE', 'VISITING_CARD', 'SCREENSHOT', 'BROCHURE', 'FLYER', 'POSTER'];

// Modes whose defining input is a link or a handle on a social platform.
export const SOCIAL_CAPTURE_MODES: readonly LeadCaptureMode[] = ['INSTAGRAM', 'INSTAGRAM_POST', 'LINKEDIN_PROFILE', 'SOCIAL_HANDLE'];

export const SOCIAL_PLATFORMS = ['INSTAGRAM', 'LINKEDIN', 'FACEBOOK', 'YOUTUBE', 'X', 'OTHER'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  FACEBOOK: 'Facebook',
  YOUTUBE: 'YouTube',
  X: 'X (Twitter)',
  OTHER: 'Other',
};

// CAPTURE-OCR.md "Provenance": every automated extraction must record whether a
// value was typed by a human, read off an image, suggested by a model, imported
// or synced. Stored per-field so a reviewer can see what to trust.
export const FIELD_PROVENANCES = [
  'USER_ENTERED',
  'OCR_EXTRACTED',
  'AI_SUGGESTED',
  'IMPORTED',
  'SYNCED',
  'DERIVED',
] as const;

export type FieldProvenance = (typeof FIELD_PROVENANCES)[number];

export const isLeadCategory = (value: string): value is LeadCategory =>
  (LEAD_CATEGORIES as readonly string[]).includes(value);

export const isLeadSource = (value: string): value is LeadSource =>
  (LEAD_SOURCES as readonly string[]).includes(value);

export const isLeadCaptureMode = (value: string): value is LeadCaptureMode =>
  (LEAD_CAPTURE_MODES as readonly string[]).includes(value);
