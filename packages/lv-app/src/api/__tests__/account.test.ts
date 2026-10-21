import { describe, expect, it } from 'vitest';

import { accountPatch, JOB_TITLE_MAX, localeOptions, NAME_MAX, timeZoneOptions, validateAccount, type AccountRecord } from 'src/api/account';
import { fromStoredScheme, schemeFor, toStoredScheme } from 'src/design/use-color-scheme';

// Profile editing.
//
// The platform has two update paths and only one works here:
// `updateWorkspaceMember` is gated on object permissions the La Vivenzia team
// roles do not hold (a coordinator is refused on their own record), while
// `updateWorkspaceMemberSettings` allows a member to edit themselves. The
// tests below cover the parts of that flow which are decidable without a
// server: what counts as valid, and what is actually sent.

const record = (over: Partial<AccountRecord> = {}): AccountRecord => ({
  id: 'member-1',
  firstName: 'Priya',
  lastName: 'Menon',
  jobTitle: 'Partnerships',
  avatarUrl: '',
  userEmail: 'priya@example.com',
  colorScheme: 'System',
  locale: 'en',
  timeZone: 'system',
  dateFormat: 'SYSTEM',
  timeFormat: 'SYSTEM',
  numberFormat: 'SYSTEM',
  ...over,
});

describe('validation', () => {
  it('accepts an ordinary profile', () => {
    expect(validateAccount(record())).toEqual({});
  });

  it('requires a first name', () => {
    expect(validateAccount(record({ firstName: '' })).firstName).toMatch(/first name is needed/i);
    expect(validateAccount(record({ firstName: '   ' })).firstName).toMatch(/first name is needed/i);
  });

  it('does not require a last name', () => {
    // Plenty of people have one name. Demanding two would be a bug, not rigour.
    expect(validateAccount(record({ lastName: '' })).lastName).toBeUndefined();
  });

  it('bounds the lengths it sends', () => {
    expect(validateAccount(record({ firstName: 'a'.repeat(NAME_MAX + 1) })).firstName).toMatch(/under/);
    expect(validateAccount(record({ lastName: 'a'.repeat(NAME_MAX + 1) })).lastName).toMatch(/under/);
    expect(validateAccount(record({ jobTitle: 'a'.repeat(JOB_TITLE_MAX + 1) })).jobTitle).toMatch(/under/);
  });

  it('accepts names that are not ASCII', () => {
    expect(validateAccount(record({ firstName: 'Søren', lastName: '田中' }))).toEqual({});
  });
});

describe('what actually gets sent', () => {
  it('sends nothing when nothing changed', () => {
    const current = record();

    expect(accountPatch(current, { ...current })).toEqual({});
  });

  it('sends only the field that changed', () => {
    const current = record();

    expect(accountPatch(current, { ...current, jobTitle: 'Head of Partnerships' })).toEqual({ jobTitle: 'Head of Partnerships' });
  });

  it('sends the whole name when either half changes, because the server takes it as one object', () => {
    const current = record();

    expect(accountPatch(current, { ...current, lastName: 'Nair' })).toEqual({ name: { firstName: 'Priya', lastName: 'Nair' } });
  });

  it('trims what it sends', () => {
    const current = record();

    expect(accountPatch(current, { ...current, jobTitle: '  Head of Partnerships  ' })).toEqual({ jobTitle: 'Head of Partnerships' });
  });

  it('treats a whitespace-only edit of an unchanged field as no change', () => {
    const current = record({ jobTitle: 'Partnerships' });

    expect(accountPatch(current, { ...current, jobTitle: 'Partnerships   ' })).toEqual({});
  });

  it('carries every preference field', () => {
    const current = record();
    const patch = accountPatch(current, {
      ...current,
      colorScheme: 'Dark',
      locale: 'fr-FR',
      timeZone: 'Asia/Kolkata',
      dateFormat: 'DAY_FIRST',
      timeFormat: 'HOUR_24',
      numberFormat: 'DOTS_AND_COMMA',
    });

    expect(patch).toEqual({ colorScheme: 'Dark', locale: 'fr-FR', timeZone: 'Asia/Kolkata', dateFormat: 'DAY_FIRST', timeFormat: 'HOUR_24', numberFormat: 'DOTS_AND_COMMA' });
  });

  it('never sends a custom LV field, which the server rejects outright', () => {
    // `assertWorkspaceMemberUpdateUsesNonCustomFieldsOnly` throws on any of
    // these, so the patch builder must not be able to produce one.
    const current = record();
    const patch = accountPatch(current, { ...current, jobTitle: 'x' });

    for (const forbidden of ['lvAcceptsLeads', 'lvLeadCapacity', 'lvExpertise', 'lvRegions', 'lvLanguages', 'lvCategories']) {
      expect(Object.keys(patch)).not.toContain(forbidden);
    }
  });
});

describe('option lists keep whatever is already stored', () => {
  it('does not drop an unlisted time zone', () => {
    // Otherwise opening the page would silently offer to move someone from
    // Pacific/Chatham to the nearest thing on a shortlist.
    const options = timeZoneOptions('Pacific/Chatham');

    expect(options.some((option) => option.value === 'Pacific/Chatham')).toBe(true);
    expect(options.some((option) => option.value === 'system')).toBe(true);
  });

  it('does not duplicate a zone that is already listed', () => {
    expect(timeZoneOptions('UTC').filter((option) => option.value === 'UTC')).toHaveLength(1);
  });

  it('does the same for an unlisted locale', () => {
    expect(localeOptions('hi-IN').some((option) => option.value === 'hi-IN')).toBe(true);
    expect(localeOptions('en').filter((option) => option.value === 'en')).toHaveLength(1);
  });
});

describe('the theme preference maps to what the platform stores', () => {
  it('reads the three values the platform uses', () => {
    expect(fromStoredScheme('System')).toBe('system');
    expect(fromStoredScheme('Light')).toBe('light');
    expect(fromStoredScheme('Dark')).toBe('dark');
  });

  it('is forgiving about case, because the server does not validate it', () => {
    // A lowercase "dark" was accepted when probed, so a value written by
    // something else must still be understood.
    expect(fromStoredScheme('dark')).toBe('dark');
    expect(fromStoredScheme('  LIGHT ')).toBe('light');
  });

  it('falls back to following the system for anything else', () => {
    for (const value of [null, undefined, '', 'solarized']) {
      expect(fromStoredScheme(value)).toBe('system');
    }
  });

  it('writes back the platform capitalisation', () => {
    expect(toStoredScheme('system')).toBe('System');
    expect(toStoredScheme('light')).toBe('Light');
    expect(toStoredScheme('dark')).toBe('Dark');
  });

  it('round-trips without drift', () => {
    for (const stored of ['System', 'Light', 'Dark']) {
      expect(toStoredScheme(fromStoredScheme(stored))).toBe(stored);
    }
  });

  it('still resolves to a real scheme for rendering', () => {
    expect(schemeFor(fromStoredScheme('System'), 'dark')).toBe('dark');
    expect(schemeFor(fromStoredScheme('Light'), 'dark')).toBe('light');
  });
});
