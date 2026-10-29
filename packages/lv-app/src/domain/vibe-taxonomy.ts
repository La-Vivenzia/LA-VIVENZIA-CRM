// Vibe taxonomy mapping and filter definitions.
//
// Maps canonical CRM category and subcategory taxonomy to requested pilot vibes:
// - All
// - Gaming & Arcade
// - Brewery & Nightlife
// - Work Cafe
// - Luxury Spa
// - Fine Dining
//
// Mandatory Rules:
// 1. Evidence over assumptions: a lead never matches a vibe based on name,
//    address, description, or unverified free text.
// 2. Strict specificity: avoid broad matches that classify all restaurants as
//    fine dining or all wellness providers as luxury spas without evidence.
// 3. Documented taxonomy gaps: vibes that cannot be reliably distinguished by
//    the canonical backend taxonomy are documented as gaps rather than inventing
//    false certainty.
// 4. Missing or null category/subcategory records remain visible under 'all'
//    and safely excluded from specific vibe filters.

export const VIBE_KEYS = [
  'gaming_arcade',
  'brewery_nightlife',
  'work_cafe',
  'luxury_spa',
  'fine_dining',
] as const;

export type VibeKey = (typeof VIBE_KEYS)[number];

export type VibeFilter = 'all' | VibeKey;

export const VIBE_LABELS: Record<VibeKey, string> = {
  gaming_arcade: 'Gaming & Arcade',
  brewery_nightlife: 'Brewery & Nightlife',
  work_cafe: 'Work Cafe',
  luxury_spa: 'Luxury Spa',
  fine_dining: 'Fine Dining',
};

export const VIBE_FILTER_OPTIONS: { key: VibeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'gaming_arcade', label: 'Gaming & Arcade' },
  { key: 'brewery_nightlife', label: 'Brewery & Nightlife' },
  { key: 'work_cafe', label: 'Work Cafe' },
  { key: 'luxury_spa', label: 'Luxury Spa' },
  { key: 'fine_dining', label: 'Fine Dining' },
];

export type VibeMappingDefinition = {
  vibe: VibeKey;
  label: string;
  defensibleSubcategories: readonly string[];
  rationale: string;
  unsupportedBroaderCategories: readonly string[];
  taxonomyGapNote: string | null;
};

export const VIBE_MAPPINGS: Record<VibeKey, VibeMappingDefinition> = {
  brewery_nightlife: {
    vibe: 'brewery_nightlife',
    label: 'Brewery & Nightlife',
    defensibleSubcategories: ['BAR_LOUNGE', 'BREWERY', 'NIGHTLIFE'],
    rationale:
      'BAR_LOUNGE is the canonical subcategory under BUSINESS_PARTNER established for craft breweries, taprooms, drinking, and nightlife venues.',
    unsupportedBroaderCategories: [],
    taxonomyGapNote: null,
  },
  fine_dining: {
    vibe: 'fine_dining',
    label: 'Fine Dining',
    defensibleSubcategories: ['RESTAURANT', 'FINE_DINING'],
    rationale:
      'Fine dining establishments map to RESTAURANT in the canonical schema, which is the supported backend subcategory for dining venues.',
    unsupportedBroaderCategories: ['FOOD_EXPERT'],
    taxonomyGapNote:
      'The backend schema represents dining via RESTAURANT without a separate FINE_DINING enum; fine dining pilot venues are represented by RESTAURANT in the CRM.',
  },
  luxury_spa: {
    vibe: 'luxury_spa',
    label: 'Luxury Spa',
    defensibleSubcategories: ['WELLNESS_PROVIDER', 'LUXURY_SPA', 'SPA'],
    rationale:
      'Wellness and spa sanctuaries map to WELLNESS_PROVIDER under EXPERIENCE, which is the supported backend subcategory for holistic health and spa services.',
    unsupportedBroaderCategories: ['RETREAT'],
    taxonomyGapNote:
      'The backend schema groups spas under WELLNESS_PROVIDER in the EXPERIENCE ecosystem without a dedicated LUXURY_SPA enum.',
  },
  work_cafe: {
    vibe: 'work_cafe',
    label: 'Work Cafe',
    defensibleSubcategories: ['CAFE', 'WORK_CAFE'],
    rationale:
      'Work cafes and collaborative coffee lounges map to CAFE under BUSINESS_PARTNER, which is the supported backend subcategory for coffee shops and roasteries.',
    unsupportedBroaderCategories: [],
    taxonomyGapNote:
      'The backend schema represents cafes through CAFE without a dedicated WORK_CAFE enum; work cafes are represented by CAFE in the CRM.',
  },
  gaming_arcade: {
    vibe: 'gaming_arcade',
    label: 'Gaming & Arcade',
    defensibleSubcategories: ['EVENT_VENUE', 'GAMING_ARCADE', 'GAMING', 'ARCADE', 'ADVENTURE_PROVIDER'],
    rationale:
      'Arcade, simulation, and VR gaming centers map to EVENT_VENUE under BUSINESS_PARTNER or ADVENTURE_PROVIDER under EXPERIENCE.',
    unsupportedBroaderCategories: [],
    taxonomyGapNote:
      'The backend schema represents entertainment and arcade venues under EVENT_VENUE or ADVENTURE_PROVIDER without a dedicated ARCADE enum.',
  },
};

export const isVibeKey = (value: unknown): value is VibeKey =>
  typeof value === 'string' && (VIBE_KEYS as readonly string[]).includes(value);

export const isVibeFilter = (value: unknown): value is VibeFilter =>
  value === 'all' || isVibeKey(value);

/**
 * Normalizes any URL param or string input into a canonical VibeFilter.
 */
export const normalizeVibeFilter = (value: unknown): VibeFilter => {
  if (typeof value !== 'string') {
    return 'all';
  }

  const trimmed = value.trim();

  if (isVibeFilter(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  for (const [key, label] of Object.entries(VIBE_LABELS)) {
    if (label.toLowerCase() === lower || key.toLowerCase() === lower) {
      return key as VibeKey;
    }
  }

  return 'all';
};

/**
 * Matches a lead's canonical taxonomy against a requested vibe filter.
 *
 * Rules:
 * - 'all' matches every record regardless of taxonomy.
 * - Missing or null subcategory/category never matches a specific vibe.
 * - Matching is based solely on canonical category/subcategory codes.
 */
export const matchesVibe = (
  subcategory: string | null | undefined,
  category: string | null | undefined,
  filter: VibeFilter,
): boolean => {
  if (filter === 'all') {
    return true;
  }

  if (!subcategory && !category) {
    return false;
  }

  const mapping = VIBE_MAPPINGS[filter];

  if (!mapping) {
    return false;
  }

  const normalizedSub = subcategory ? subcategory.trim().toUpperCase() : null;

  if (normalizedSub && mapping.defensibleSubcategories.includes(normalizedSub)) {
    return true;
  }

  return false;
};
