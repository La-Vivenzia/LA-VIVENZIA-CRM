import { describe, expect, it } from 'vitest';

import { contextLine, withoutSubject } from 'src/design/copy';
import { reasonFor } from 'src/screens/TodayScreen';

// Today's attention rows and the My Leads list both carry a name as their
// heading and a reason underneath, and the server writes the name into both:
//
//   LV-000003 Sunset Villa Lonavala
//   High-priority lead LV-000003 Sunset Villa Lonavala has had no interaction…
//
// Two lines, the same name twice. Across five rows that is what turned each
// list into a wall of text. These pin the display-time correction shared by
// both screens.

describe('a reason drops the subject the row is already filed under', () => {
  it('removes it along with the preposition in front of it', () => {
    expect(withoutSubject('First contact follow-up task is overdue for LV-000014 Phase 5 Manual Verification.', 'LV-000014 Phase 5 Manual Verification')).toBe(
      'First contact follow-up task is overdue.',
    );
  });

  it('removes it from the middle of a sentence', () => {
    expect(withoutSubject('High-priority lead LV-000003 Sunset Villa Lonavala has had no interaction recorded in the last 7 days.', 'LV-000003 Sunset Villa Lonavala')).toBe(
      'High-priority lead has had no interaction recorded in the last 7 days.',
    );
  });

  it('removes a quoted repeat too', () => {
    expect(withoutSubject('Follow-up "Width Check Draft" is overdue.', 'Width Check Draft')).toBe('Follow-up is overdue.');
  });

  it('removes both a name and a reference, longest first', () => {
    // The My Leads case. Taking "LV-000012" first would strip half the name
    // and strand "D8] Example Site mu3zh881[" in the middle of the sentence.
    expect(withoutSubject('Find contact details for LV-000012 D8] Example Site mu3zh881[', 'D8] Example Site mu3zh881[', 'LV-000012')).toBe('Find contact details');
  });

  it('leaves a line that never mentions the subject untouched', () => {
    const why = 'A reason that never mentions the row at all.';

    expect(withoutSubject(why, 'LV-000009 Something Else')).toBe(why);
  });

  it('keeps the original when the line was only the subject', () => {
    expect(withoutSubject('LV-000009 Tiger Valley', 'LV-000009 Tiger Valley')).toBe('LV-000009 Tiger Valley');
  });

  it('leaves no space before punctuation and no dangling dash', () => {
    const out = withoutSubject('Something is overdue for LV-1 A Name.', 'LV-1 A Name') ?? '';

    expect(out).not.toMatch(/\s\./);
    expect(out.endsWith('.')).toBe(true);
    expect(withoutSubject('Find contact details — LV-2 Somewhere', 'LV-2 Somewhere')).toBe('Find contact details');
  });

  it('collapses the whitespace it leaves behind', () => {
    // The first version of this wrote /s{2,}/ — runs of the letter s, not
    // whitespace — so it never collapsed anything.
    const out = withoutSubject('Chase LV-7 Backwater soon, please.', 'LV-7 Backwater') ?? '';

    expect(out).not.toMatch(/ {2}/);
    expect(out).not.toMatch(/Backwater/);
  });

  it('is not confused by a subject containing regex characters', () => {
    const title = 'LV-000001 Café (Old Town) + Co.';

    expect(withoutSubject(`Follow-up is overdue for ${title}.`, title)).toBe('Follow-up is overdue.');
  });

  it('handles the absent cases without throwing', () => {
    expect(withoutSubject(null, 'anything')).toBeNull();
    expect(withoutSubject(undefined, 'anything')).toBeNull();
    expect(withoutSubject('', 'anything')).toBeNull();
    expect(withoutSubject('A reason.', '')).toBe('A reason.');
    expect(withoutSubject('A reason.', null, undefined)).toBe('A reason.');
  });

  it('starts with a capital after trimming', () => {
    expect(withoutSubject('for LV-2 Somewhere the paperwork is late.', 'LV-2 Somewhere')).toMatch(/^[A-Z]/);
  });

  it("is what Today's reasonFor delegates to", () => {
    expect(reasonFor('High-priority lead LV-5 Backwater has had no interaction.', 'LV-5 Backwater')).toBe('High-priority lead has had no interaction.');
    expect(reasonFor(null, 'x')).toBeNull();
  });
});

describe('a context line drops what the heading already says', () => {
  it('keeps only what is new', () => {
    expect(contextLine(['The Forest Table', 'Lonavala'], 'The Forest Table')).toBe('Lonavala');
  });

  it('ignores case when comparing', () => {
    expect(contextLine(['the forest table', 'Pune'], 'The Forest Table')).toBe('Pune');
  });

  it('returns nothing rather than an empty line', () => {
    expect(contextLine(['The Forest Table'], 'The Forest Table')).toBeNull();
    expect(contextLine([null, undefined, ''], 'Anything')).toBeNull();
  });

  it('joins what survives', () => {
    expect(contextLine(['Example Domain', 'Lonavala'], 'Phase 5 Verification Stay')).toBe('Example Domain · Lonavala');
  });
});
