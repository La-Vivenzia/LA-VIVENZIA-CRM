// Human-readable business keys for the ecosystem entities, in the convention
// the objects have carried since Day 1: a prefix and six digits —
// LVP-000042 (partner), LVE-000042 (experience), LVR-000042 (property).
// Same shape as the LV Lead ID (lead-id.ts), which stays where it is: the
// lead allocator is proven and untouched; this generalises the format for the
// three entities that had a code field but never an allocator.

export const ENTITY_CODE_DIGITS = 6;
export const ENTITY_CODE_CEILING = 999_999;

export const ENTITY_CODE_PREFIX = {
  partner: 'LVP-',
  experience: 'LVE-',
  property: 'LVR-',
} as const;

export type EntityKind = keyof typeof ENTITY_CODE_PREFIX;

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

export const formatEntityCode = (kind: EntityKind, sequence: number): string => {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Entity code sequence must be a positive integer, received ${sequence}.`);
  }

  return `${ENTITY_CODE_PREFIX[kind]}${String(sequence).padStart(ENTITY_CODE_DIGITS, '0')}`;
};

export const parseEntityCode = (kind: EntityKind, value: string | null | undefined): number | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = new RegExp(`^${escape(ENTITY_CODE_PREFIX[kind])}(\\d{${ENTITY_CODE_DIGITS},})$`).exec(value.trim());

  if (match === null) {
    return null;
  }

  const sequence = Number(match[1]);

  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
};

export const hasEntityCode = (kind: EntityKind, value: string | null | undefined): boolean => parseEntityCode(kind, value) !== null;

export type NextEntityCodeResult = { ok: true; code: string; sequence: number } | { ok: false; reason: 'CEILING_REACHED' };

export const nextEntityCode = (kind: EntityKind, highestIssued: string | null | undefined): NextEntityCodeResult => {
  const current = parseEntityCode(kind, highestIssued) ?? 0;

  if (current >= ENTITY_CODE_CEILING) {
    return { ok: false, reason: 'CEILING_REACHED' };
  }

  const sequence = current + 1;

  return { ok: true, code: formatEntityCode(kind, sequence), sequence };
};
