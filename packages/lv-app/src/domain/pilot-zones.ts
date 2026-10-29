// Pune Pilot Zones vocabulary and helpers.
//
// Defines the canonical operational zones for the Pune Pilot sprint:
// Amanora Mall, Seasons Mall, Magarpatta City, and Hadapsar.
//
// These values mirror the backend LEAD_PILOT_ZONES taxonomy and are reused
// across filtering, lead listing, and capture.

export const PILOT_ZONES = [
  'AMANORA_MALL',
  'SEASONS_MALL',
  'MAGARPATTA_CITY',
  'HADAPSAR',
] as const;

export type PilotZone = (typeof PILOT_ZONES)[number];

export type PilotZoneFilter = 'all' | PilotZone;

export const PILOT_ZONE_LABELS: Record<PilotZone, string> = {
  AMANORA_MALL: 'Amanora Mall',
  SEASONS_MALL: 'Seasons Mall',
  MAGARPATTA_CITY: 'Magarpatta City',
  HADAPSAR: 'Hadapsar',
};

export const PILOT_ZONE_FILTER_OPTIONS: { key: PilotZoneFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'AMANORA_MALL', label: 'Amanora Mall' },
  { key: 'SEASONS_MALL', label: 'Seasons Mall' },
  { key: 'MAGARPATTA_CITY', label: 'Magarpatta City' },
  { key: 'HADAPSAR', label: 'Hadapsar' },
];

export const PILOT_ZONE_SELECT_OPTIONS: { value: PilotZone; label: string }[] = [
  { value: 'AMANORA_MALL', label: 'Amanora Mall' },
  { value: 'SEASONS_MALL', label: 'Seasons Mall' },
  { value: 'MAGARPATTA_CITY', label: 'Magarpatta City' },
  { value: 'HADAPSAR', label: 'Hadapsar' },
];

export const isPilotZone = (value: unknown): value is PilotZone =>
  typeof value === 'string' && (PILOT_ZONES as readonly string[]).includes(value);

export const isPilotZoneFilter = (value: unknown): value is PilotZoneFilter =>
  value === 'all' || isPilotZone(value);

export const normalizePilotZone = (value: unknown): PilotZone | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (isPilotZone(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  for (const [zone, label] of Object.entries(PILOT_ZONE_LABELS)) {
    if (label.toLowerCase() === lower || zone.toLowerCase() === lower) {
      return zone as PilotZone;
    }
  }

  return null;
};

/**
 * Evaluates whether a lead record matches the selected pilot zone filter.
 *
 * Requirements:
 * - 'all' matches every record, including null/unassigned legacy records and records outside Pune.
 * - Selecting a specific zone matches only records whose dedicated pilotZone resolves to that zone.
 * - Missing or null pilotZone values do not match any specific zone filter.
 */
export const matchesPilotZone = (
  recordZone: string | null | undefined,
  filter: PilotZoneFilter,
): boolean => {
  if (filter === 'all') {
    return true;
  }

  const normalized = normalizePilotZone(recordZone);

  return normalized === filter;
};
