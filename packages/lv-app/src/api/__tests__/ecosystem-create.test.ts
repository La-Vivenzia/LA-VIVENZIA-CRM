import { describe, expect, it } from 'vitest';

import { RouteRefusal, refusalCode } from 'src/api/client';
import {
  duplicatesFromRefusal,
  emptyListingDraft,
  listingDraftReady,
  propertyTypeLabel,
  PROPERTY_TYPES,
  type ListingDraft,
} from 'src/api/ecosystem';
import { parseConsoleUrl } from 'src/screens/SettingsScreen';

// B2 — creating a property or an experience.
//
// `/ecosystem/create` was built, deployed and never called: there was no UI
// anywhere in the product that could add a property or an experience. These
// tests pin down the parts of that flow which are decidable without a server
// — what the form starts as, what counts as submittable, and how a refusal is
// read — because those are the parts that can silently drift.

const draft = (over: Partial<ListingDraft> = {}): ListingDraft => ({ ...emptyListingDraft('property', null), ...over });

describe('the draft a create form starts from', () => {
  it('is priced the way each kind is actually priced', () => {
    expect(emptyListingDraft('experience', null).priceUnit).toBe('Per person');
    expect(emptyListingDraft('property', null).priceUnit).toBe('Per night');
  });

  it('inherits the partner location, because the server falls back to it anyway', () => {
    expect(emptyListingDraft('property', 'Alleppey, Kerala').location).toBe('Alleppey, Kerala');
    // Not the string "null" — a partner with no location leaves the field empty.
    expect(emptyListingDraft('property', null).location).toBe('');
  });

  it('starts with nothing invented in the fields a person must choose', () => {
    const fresh = emptyListingDraft('experience', null);

    expect(fresh.name).toBe('');
    expect(fresh.capacity).toBe('');
    expect(fresh.basePrice).toBe('');
    expect(fresh.description).toBe('');
  });
});

describe('what counts as ready to submit', () => {
  it('needs a real name and nothing else', () => {
    // The route requires `kind` and a name; everything else is optional. The
    // button must not demand more than the server does.
    expect(listingDraftReady(draft({ name: 'Backwater Villa' }))).toBe(true);
    expect(listingDraftReady(draft({ name: '' }))).toBe(false);
    expect(listingDraftReady(draft({ name: 'A' }))).toBe(false);
  });

  it('does not accept whitespace as a name', () => {
    expect(listingDraftReady(draft({ name: '   ' }))).toBe(false);
    expect(listingDraftReady(draft({ name: '  Kumarakom Stay  ' }))).toBe(true);
  });
});

describe('property types', () => {
  it('covers every value the server accepts, in its order', () => {
    // Anything outside the server's PROPERTY_TYPE_OPTIONS is coerced to
    // OTHER, so an option here that the server does not know would silently
    // create the wrong kind of property.
    expect(PROPERTY_TYPES).toHaveLength(16);
    expect(PROPERTY_TYPES[0]).toBe('VILLA');
    expect(PROPERTY_TYPES).toContain('OTHER');
  });

  it('says the three awkward ones the way a person would', () => {
    expect(propertyTypeLabel('BOUTIQUE_HOTEL')).toBe('Boutique stay');
    expect(propertyTypeLabel('CAMP')).toBe('Glamping property');
    expect(propertyTypeLabel('FARMSTAY')).toBe('Farm stay');
  });

  it('humanises the rest rather than shouting the enum', () => {
    expect(propertyTypeLabel('HERITAGE_PROPERTY')).toBe('Heritage property');
    expect(propertyTypeLabel('VILLA')).toBe('Villa');
  });
});

describe('reading a refusal', () => {
  const refusal = (code: string, body: Record<string, unknown> = {}) => new RouteRefusal('A similar property already exists.', code, { ok: false, refusal: code, ...body });

  it('keeps the sentence as the message, so existing callers are unaffected', () => {
    const cause = refusal('DUPLICATE_UNDECIDED');

    expect(cause).toBeInstanceOf(Error);
    expect(cause.message).toBe('A similar property already exists.');
  });

  it('exposes the code only when the failure carried one', () => {
    expect(refusalCode(refusal('NOT_PERMITTED'))).toBe('NOT_PERMITTED');
    expect(refusalCode(new Error('The server could not be reached.'))).toBeNull();
    expect(refusalCode(null)).toBeNull();
  });

  it('returns the matched records for a duplicate refusal', () => {
    const matches = duplicatesFromRefusal(
      refusal('DUPLICATE_UNDECIDED', {
        duplicates: [{ id: 'abc', name: 'Backwater Villa', code: 'LVP-0003', status: 'DRAFT', location: 'Alleppey', percent: 91, reasons: ['same name'] }],
      }),
    );

    expect(matches).toHaveLength(1);
    expect(matches?.[0]).toMatchObject({ id: 'abc', name: 'Backwater Villa', code: 'LVP-0003', percent: 91 });
    expect(matches?.[0].reasons).toEqual(['same name']);
  });

  it('reads a code under whichever name the object uses for it', () => {
    const property = duplicatesFromRefusal(refusal('DUPLICATE_UNDECIDED', { duplicates: [{ id: 'a', propertyCode: 'LVP-0009' }] }));
    const experience = duplicatesFromRefusal(refusal('DUPLICATE_UNDECIDED', { duplicates: [{ id: 'b', experienceCode: 'LVE-0004' }] }));

    expect(property?.[0].code).toBe('LVP-0009');
    expect(experience?.[0].code).toBe('LVE-0004');
  });

  it('still offers the decision when the list is missing or malformed', () => {
    // The refusal is real whether or not the records came with it, so the
    // person must still be able to choose. An empty array means "decide",
    // null means "this was not a duplicate refusal at all".
    expect(duplicatesFromRefusal(refusal('DUPLICATE_UNDECIDED'))).toEqual([]);
    expect(duplicatesFromRefusal(refusal('DUPLICATE_UNDECIDED', { duplicates: 'nonsense' }))).toEqual([]);
  });

  it('is not confused by any other refusal', () => {
    expect(duplicatesFromRefusal(refusal('NOT_PERMITTED'))).toBeNull();
    expect(duplicatesFromRefusal(refusal('NOT_FOUND'))).toBeNull();
    expect(duplicatesFromRefusal(new Error('offline'))).toBeNull();
  });

  it('survives a row that is not an object', () => {
    expect(duplicatesFromRefusal(refusal('DUPLICATE_UNDECIDED', { duplicates: [null, 42] }))).toHaveLength(2);
  });
});

// B3 — Settings.
//
// The screen used to read "Workspace settings are administered in the Twenty
// console. — this screen is being built", which contradicted itself. The
// console address is now read from configuration, and a link is offered only
// when that address is one a browser can actually follow.

describe('the Twenty console link', () => {
  it('is offered for an absolute http(s) address', () => {
    expect(parseConsoleUrl('https://console.example.com')).toBe('https://console.example.com/');
    expect(parseConsoleUrl('  http://localhost:3002  ')).toBe('http://localhost:3002/');
  });

  it('is withheld when nothing is configured', () => {
    expect(parseConsoleUrl(undefined)).toBeNull();
    expect(parseConsoleUrl('')).toBeNull();
    expect(parseConsoleUrl('   ')).toBeNull();
  });

  it('is withheld rather than guessed from something unusable', () => {
    // A relative path would resolve against the CRM's own origin and land
    // nowhere; a javascript: URL must never become a button.
    expect(parseConsoleUrl('/settings')).toBeNull();
    expect(parseConsoleUrl('console.example.com')).toBeNull();
    expect(parseConsoleUrl('javascript:alert(1)')).toBeNull();
  });
});
