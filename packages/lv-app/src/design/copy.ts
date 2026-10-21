// Small corrections to text the server composed for a different context.
//
// The CRM writes a reason as a standalone sentence — "High-priority lead
// LV-000003 Sunset Villa Lonavala has had no interaction in 7 days" — which is
// right in a notification and wrong underneath a row already headed with that
// name. Read in place it says the same thing twice, and across five rows that
// is what turns a list into a wall of text.
//
// These are display-time corrections only. Nothing here changes what is
// stored, and a sentence that does not contain the repeat is returned exactly
// as it arrived.

/** Escapes a value so it can be matched literally inside a RegExp. */
const literal = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How much readable text has to survive for a strip to be worth keeping. */
const ENOUGH_LEFT = 8;

/**
 * Remove the subject a line is already filed under, along with the
 * preposition left dangling in front of it.
 *
 * Several subjects may be given — a lead's name and its reference are both
 * repeated in practice — and each is removed wherever it appears, quoted or
 * not. If removing them would leave nothing worth reading, the original is
 * returned untouched: a short reason that *is* the name is better than an
 * empty line.
 */
export const withoutSubject = (line: string | null | undefined, ...subjects: (string | null | undefined)[]): string | null => {
  if (!line) {
    return null;
  }

  const wanted = subjects.map((subject) => subject?.trim() ?? '').filter((subject) => subject.length > 1);

  if (wanted.length === 0) {
    return line;
  }

  // Longest first, so "LV-000012 Example Site" is removed before "LV-000012"
  // can strip half of it and leave the remainder stranded.
  const ordered = [...wanted].sort((a, b) => b.length - a.length);
  let out = line;

  for (const subject of ordered) {
    out = out.replace(new RegExp(`\\s*(?:\\b(?:for|on|with|of)\\b)?\\s*"?${literal(subject)}"?`, 'gi'), ' ');
  }

  out = out
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    // An em dash with nothing after it, once the subject it introduced is gone.
    .replace(/\s*[—–-]\s*$/, '')
    .trim();

  if (out.replace(/[^a-z0-9]/gi, '').length < ENOUGH_LEFT) {
    return line;
  }

  return out.charAt(0).toUpperCase() + out.slice(1);
};

/**
 * A secondary line that merely repeats the heading is worse than no line.
 *
 * "The Forest Table · Lonavala" under a row headed "The Forest Table" spends
 * a line to say "Lonavala".
 */
export const contextLine = (parts: (string | null | undefined)[], heading: string | null | undefined): string | null => {
  const head = heading?.trim().toLowerCase() ?? '';
  const kept = parts
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0 && part.toLowerCase() !== head);

  return kept.length === 0 ? null : kept.join(' · ');
};
