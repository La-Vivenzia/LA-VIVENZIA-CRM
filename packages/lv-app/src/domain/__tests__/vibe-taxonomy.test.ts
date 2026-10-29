import { describe, expect, it } from 'vitest';

import {
  isVibeFilter,
  isVibeKey,
  matchesVibe,
  normalizeVibeFilter,
  VIBE_FILTER_OPTIONS,
  VIBE_KEYS,
  VIBE_LABELS,
  VIBE_MAPPINGS,
} from 'src/domain/vibe-taxonomy';

describe('vibe-taxonomy domain definitions', () => {
  it('covers the five requested pilot vibes in addition to All', () => {
    expect(VIBE_KEYS).toEqual([
      'gaming_arcade',
      'brewery_nightlife',
      'work_cafe',
      'luxury_spa',
      'fine_dining',
    ]);
  });

  it('provides exact required labels for every vibe', () => {
    expect(VIBE_LABELS.gaming_arcade).toBe('Gaming & Arcade');
    expect(VIBE_LABELS.brewery_nightlife).toBe('Brewery & Nightlife');
    expect(VIBE_LABELS.work_cafe).toBe('Work Cafe');
    expect(VIBE_LABELS.luxury_spa).toBe('Luxury Spa');
    expect(VIBE_LABELS.fine_dining).toBe('Fine Dining');
  });

  it('orders filter options with All first, followed by the requested vibes', () => {
    expect(VIBE_FILTER_OPTIONS.map((opt) => opt.label)).toEqual([
      'All',
      'Gaming & Arcade',
      'Brewery & Nightlife',
      'Work Cafe',
      'Luxury Spa',
      'Fine Dining',
    ]);
  });

  it('validates keys and filter values correctly', () => {
    expect(isVibeKey('brewery_nightlife')).toBe(true);
    expect(isVibeKey('fine_dining')).toBe(true);
    expect(isVibeKey('all')).toBe(false);
    expect(isVibeKey('nightlife')).toBe(false);

    expect(isVibeFilter('all')).toBe(true);
    expect(isVibeFilter('brewery_nightlife')).toBe(true);
    expect(isVibeFilter('unknown_vibe')).toBe(false);
  });

  it('normalizes vibe parameters from labels or keys', () => {
    expect(normalizeVibeFilter('brewery_nightlife')).toBe('brewery_nightlife');
    expect(normalizeVibeFilter('Brewery & Nightlife')).toBe('brewery_nightlife');
    expect(normalizeVibeFilter('Fine Dining')).toBe('fine_dining');
    expect(normalizeVibeFilter('all')).toBe('all');
    expect(normalizeVibeFilter('All')).toBe('all');
    expect(normalizeVibeFilter('unknown')).toBe('all');
    expect(normalizeVibeFilter(null)).toBe('all');
  });
});

describe('matchesVibe mapping rules', () => {
  it('matches all records when filter is "all"', () => {
    expect(matchesVibe(null, null, 'all')).toBe(true);
    expect(matchesVibe('BAR_LOUNGE', 'BUSINESS_PARTNER', 'all')).toBe(true);
    expect(matchesVibe('RESTAURANT', 'BUSINESS_PARTNER', 'all')).toBe(true);
    expect(matchesVibe(undefined, undefined, 'all')).toBe(true);
  });

  it('excludes records with null or missing category/subcategory from specific vibes', () => {
    for (const vibe of VIBE_KEYS) {
      expect(matchesVibe(null, null, vibe)).toBe(false);
      expect(matchesVibe(undefined, undefined, vibe)).toBe(false);
      expect(matchesVibe('', '', vibe)).toBe(false);
    }
  });

  it('matches Brewery & Nightlife for BAR_LOUNGE, BREWERY, NIGHTLIFE', () => {
    expect(matchesVibe('BAR_LOUNGE', 'BUSINESS_PARTNER', 'brewery_nightlife')).toBe(true);
    expect(matchesVibe('BREWERY', 'BUSINESS_PARTNER', 'brewery_nightlife')).toBe(true);
    expect(matchesVibe('NIGHTLIFE', 'BUSINESS_PARTNER', 'brewery_nightlife')).toBe(true);
  });

  it('matches Fine Dining for RESTAURANT and explicit FINE_DINING', () => {
    expect(matchesVibe('RESTAURANT', 'BUSINESS_PARTNER', 'fine_dining')).toBe(true);
    expect(matchesVibe('FINE_DINING', 'BUSINESS_PARTNER', 'fine_dining')).toBe(true);
    expect(matchesVibe('CHEF', 'EXPERIENCE', 'fine_dining')).toBe(false);
    expect(matchesVibe('FOOD_EXPERT', 'EXPERIENCE', 'fine_dining')).toBe(false);
  });

  it('matches Luxury Spa for WELLNESS_PROVIDER, LUXURY_SPA and SPA', () => {
    expect(matchesVibe('WELLNESS_PROVIDER', 'EXPERIENCE', 'luxury_spa')).toBe(true);
    expect(matchesVibe('LUXURY_SPA', 'EXPERIENCE', 'luxury_spa')).toBe(true);
    expect(matchesVibe('SPA', 'EXPERIENCE', 'luxury_spa')).toBe(true);
    expect(matchesVibe('RETREAT', 'STAY', 'luxury_spa')).toBe(false);
    expect(matchesVibe('RESORT', 'STAY', 'luxury_spa')).toBe(false);
  });

  it('matches Work Cafe for CAFE and explicit WORK_CAFE', () => {
    expect(matchesVibe('CAFE', 'BUSINESS_PARTNER', 'work_cafe')).toBe(true);
    expect(matchesVibe('WORK_CAFE', 'BUSINESS_PARTNER', 'work_cafe')).toBe(true);
    expect(matchesVibe('RESTAURANT', 'BUSINESS_PARTNER', 'work_cafe')).toBe(false);
  });

  it('matches Gaming & Arcade for EVENT_VENUE, ADVENTURE_PROVIDER, and explicit ARCADE/GAMING', () => {
    expect(matchesVibe('EVENT_VENUE', 'BUSINESS_PARTNER', 'gaming_arcade')).toBe(true);
    expect(matchesVibe('ADVENTURE_PROVIDER', 'EXPERIENCE', 'gaming_arcade')).toBe(true);
    expect(matchesVibe('GAMING_ARCADE', 'EXPERIENCE', 'gaming_arcade')).toBe(true);
    expect(matchesVibe('ARCADE', 'BUSINESS_PARTNER', 'gaming_arcade')).toBe(true);
    expect(matchesVibe('GAMING', 'EXPERIENCE', 'gaming_arcade')).toBe(true);
    expect(matchesVibe('CAFE', 'BUSINESS_PARTNER', 'gaming_arcade')).toBe(false);
  });

  it('documents taxonomy gaps and rationale in VIBE_MAPPINGS', () => {
    expect(VIBE_MAPPINGS.fine_dining.taxonomyGapNote).toContain('RESTAURANT');
    expect(VIBE_MAPPINGS.luxury_spa.taxonomyGapNote).toContain('WELLNESS_PROVIDER');
    expect(VIBE_MAPPINGS.work_cafe.taxonomyGapNote).toContain('CAFE');
    expect(VIBE_MAPPINGS.gaming_arcade.taxonomyGapNote).toContain('EVENT_VENUE');
  });
});
