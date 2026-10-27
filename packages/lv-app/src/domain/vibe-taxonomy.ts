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
      'BAR_LOUNGE is a canonical subcategory under BUSINESS_PARTNER specifically established for drinking and nightlife venues.',
    unsupportedBroaderCategories: [],
    taxonomyGapNote: null,
  },
  fine_dining: {
    vibe: 'fine_dining',
    label: 'Fine Dining',
    defensibleSubcategories: ['FINE_DINING'],
    rationale:
      'Only explicit FINE_DINING classification indicates a fine dining venue. Broad RESTAURANT encompasses casual, QSR, and family eateries.',
    unsupportedBroaderCategories: ['RESTAURANT', 'FOOD_EXPERT'],
    taxonomyGapNote:
      'The legacy taxonomy provides RESTAURANT but does not differentiate fine dining from casual dining without a subcategory extension.',
  },
  luxury_spa: {
    vibe: 'luxury_spa',
    label: 'Luxury Spa',
    defensibleSubcategories: ['LUXURY_SPA', 'SPA'],
    rationale:
      'Only explicit LUXURY_SPA or SPA classification guarantees a spa venue. Broad WELLNESS_PROVIDER encompasses fitness, yoga, and therapy.',
    unsupportedBroaderCategories: ['WELLNESS_PROVIDER', 'RETREAT'],
    taxonomyGapNote:
      'WELLNESS_PROVIDER covers all wellness practitioners; mapping it entirely to Luxury Spa would cause severe false positives.',
  },
  work_cafe: {
    vibe: 'work_cafe',
    label: 'Work Cafe',
    defensibleSubcategories: ['WORK_CAFE'],
    rationale:
      'Only explicit WORK_CAFE classification denotes workspace amenities. Standard CAFE denotes general coffee shops and bakeries.',
    unsupportedBroaderCategories: ['CAFE'],
    taxonomyGapNote:
      'Standard CAFE includes casual tea stalls and bakeries; work cafe requires dedicated workspace amenities not tracked in legacy taxonomy.',
  },
  gaming_arcade: {
    vibe: 'gaming_arcade',
    label: 'Gaming & Arcade',
    defensibleSubcategories: ['GAMING_ARCADE', 'GAMING', 'ARCADE'],
    rationale:
      'Requires explicit gaming or arcade classification. No existing broad category can defensibly represent arcade venues.',
    unsupportedBroaderCategories: ['EVENT_VENUE', 'ADVENTURE_PROVIDER'],
    taxonomyGapNote:
      'Legacy taxonomy lacks an arcade subcategory; ADVENTURE_PROVIDER and EVENT_VENUE cannot be presumed to be gaming facilities.',
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
