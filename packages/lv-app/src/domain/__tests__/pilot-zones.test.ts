import { describe, expect, it } from 'vitest';

import {
  isPilotZone,
  isPilotZoneFilter,
  matchesPilotZone,
  normalizePilotZone,
  PILOT_ZONE_FILTER_OPTIONS,
  PILOT_ZONE_LABELS,
  PILOT_ZONE_SELECT_OPTIONS,
  PILOT_ZONES,
  type PilotZone,
} from 'src/domain/pilot-zones';

describe('pilot-zones domain vocabulary', () => {
  it('defines the exact four required Pune pilot zones', () => {
    expect(PILOT_ZONES).toEqual([
      'AMANORA_MALL',
      'SEASONS_MALL',
      'MAGARPATTA_CITY',
      'HADAPSAR',
    ]);
  });

  it('maps each canonical zone to its human-readable label', () => {
    expect(PILOT_ZONE_LABELS.AMANORA_MALL).toBe('Amanora Mall');
    expect(PILOT_ZONE_LABELS.SEASONS_MALL).toBe('Seasons Mall');
    expect(PILOT_ZONE_LABELS.MAGARPATTA_CITY).toBe('Magarpatta City');
    expect(PILOT_ZONE_LABELS.HADAPSAR).toBe('Hadapsar');
  });

  it('provides filter options starting with All followed by the four zones', () => {
    expect(PILOT_ZONE_FILTER_OPTIONS.map((opt) => opt.label)).toEqual([
      'All',
      'Amanora Mall',
      'Seasons Mall',
      'Magarpatta City',
      'Hadapsar',
    ]);
    expect(PILOT_ZONE_FILTER_OPTIONS.map((opt) => opt.key)).toEqual([
      'all',
      'AMANORA_MALL',
      'SEASONS_MALL',
      'MAGARPATTA_CITY',
      'HADAPSAR',
    ]);
  });

  it('provides select options matching the four zones for CaptureScreen', () => {
    expect(PILOT_ZONE_SELECT_OPTIONS).toHaveLength(4);
    expect(PILOT_ZONE_SELECT_OPTIONS.map((opt) => opt.value)).toEqual([
      'AMANORA_MALL',
      'SEASONS_MALL',
      'MAGARPATTA_CITY',
      'HADAPSAR',
    ]);
  });

  it('validates zones with isPilotZone and isPilotZoneFilter', () => {
    expect(isPilotZone('AMANORA_MALL')).toBe(true);
    expect(isPilotZone('SEASONS_MALL')).toBe(true);
    expect(isPilotZone('MAGARPATTA_CITY')).toBe(true);
    expect(isPilotZone('HADAPSAR')).toBe(true);
    expect(isPilotZone('KOREGAON_PARK')).toBe(false);
    expect(isPilotZone(null)).toBe(false);
    expect(isPilotZone('all')).toBe(false);

    expect(isPilotZoneFilter('all')).toBe(true);
    expect(isPilotZoneFilter('AMANORA_MALL')).toBe(true);
    expect(isPilotZoneFilter('UNKNOWN')).toBe(false);
  });

  it('normalizes zones from codes, labels, and case variations', () => {
    expect(normalizePilotZone('AMANORA_MALL')).toBe('AMANORA_MALL');
    expect(normalizePilotZone('Amanora Mall')).toBe('AMANORA_MALL');
    expect(normalizePilotZone('amanora mall')).toBe('AMANORA_MALL');
    expect(normalizePilotZone('Seasons Mall')).toBe('SEASONS_MALL');
    expect(normalizePilotZone('magarpatta city')).toBe('MAGARPATTA_CITY');
    expect(normalizePilotZone('Hadapsar')).toBe('HADAPSAR');
    expect(normalizePilotZone('Mumbai')).toBeNull();
    expect(normalizePilotZone(null)).toBeNull();
    expect(normalizePilotZone('')).toBeNull();
  });
});

describe('matchesPilotZone', () => {
  it('matches all records when filter is "all"', () => {
    expect(matchesPilotZone('AMANORA_MALL', 'all')).toBe(true);
    expect(matchesPilotZone('HADAPSAR', 'all')).toBe(true);
    expect(matchesPilotZone(null, 'all')).toBe(true);
    expect(matchesPilotZone(undefined, 'all')).toBe(true);
    expect(matchesPilotZone('Mumbai', 'all')).toBe(true);
  });

  it('matches specific zones by canonical code or label', () => {
    const zones: PilotZone[] = ['AMANORA_MALL', 'SEASONS_MALL', 'MAGARPATTA_CITY', 'HADAPSAR'];

    for (const zone of zones) {
      expect(matchesPilotZone(zone, zone)).toBe(true);
      expect(matchesPilotZone(PILOT_ZONE_LABELS[zone], zone)).toBe(true);
    }
  });

  it('does not match a different zone', () => {
    expect(matchesPilotZone('AMANORA_MALL', 'SEASONS_MALL')).toBe(false);
    expect(matchesPilotZone('HADAPSAR', 'MAGARPATTA_CITY')).toBe(false);
  });

  it('safely handles missing or null pilotZone values', () => {
    expect(matchesPilotZone(null, 'AMANORA_MALL')).toBe(false);
    expect(matchesPilotZone(undefined, 'SEASONS_MALL')).toBe(false);
    expect(matchesPilotZone('', 'HADAPSAR')).toBe(false);
  });
});
