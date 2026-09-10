// The universal LV Lead ID: the human-readable business key a coordinator says
// out loud on a call. Format is `LV-` followed by a zero-padded decimal.
//
// Fixed-width padding is not cosmetic. It makes the string sort identically to
// the number it encodes, which is what lets the allocator find the highest
// issued id with an ordinary `orderBy` instead of scanning every lead. That
// property holds up to LV-999999; see `LV_LEAD_ID_LEXICOGRAPHIC_CEILING`.

export const LV_LEAD_ID_PREFIX = 'LV-';
export const LV_LEAD_ID_DIGITS = 6;

// Above this, the encoded number needs a seventh digit and the string ordering
// stops matching the numeric ordering ('LV-1000000' < 'LV-999999'). The
// allocator refuses to guess past it rather than silently issuing a duplicate.
export const LV_LEAD_ID_LEXICOGRAPHIC_CEILING = 999_999;

const PATTERN = /^LV-(\d{6,})$/;

export const formatLeadId = (sequence: number): string => {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(
      `LV Lead ID sequence must be a positive integer, received ${sequence}.`,
    );
  }

  return `${LV_LEAD_ID_PREFIX}${String(sequence).padStart(LV_LEAD_ID_DIGITS, '0')}`;
};

export const parseLeadId = (value: string | null | undefined): number | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = PATTERN.exec(value.trim());

  if (match === null) {
    return null;
  }

  const sequence = Number(match[1]);

  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
};

export const isValidLeadId = (value: string | null | undefined): boolean =>
  parseLeadId(value) !== null;

// A lead counts as already identified only if it holds a well-formed id. A
// blank string is what the database actually contains for the unidentified
// leads, and treating it as "present" is how records stay empty forever.
export const hasLeadId = (value: string | null | undefined): boolean =>
  isValidLeadId(value);

export type NextLeadIdResult =
  | { ok: true; leadId: string; sequence: number }
  | { ok: false; reason: 'CEILING_REACHED' };

// `highestIssued` is the largest existing id, or null when none has been
// issued. Deliberately a pure function of that one input, so the allocator's
// retry loop can call it again with fresher data after a unique-key collision.
export const nextLeadId = (
  highestIssued: string | null | undefined,
): NextLeadIdResult => {
  const current = parseLeadId(highestIssued) ?? 0;

  if (current >= LV_LEAD_ID_LEXICOGRAPHIC_CEILING) {
    return { ok: false, reason: 'CEILING_REACHED' };
  }

  const sequence = current + 1;

  return { ok: true, leadId: formatLeadId(sequence), sequence };
};
