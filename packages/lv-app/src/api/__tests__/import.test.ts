import { describe, expect, it } from 'vitest';

import { autoMapColumns, mappingProblems, SAMPLE_CSV_HEADERS } from 'src/api/import';

// autoMapColumns — deterministic column-header-to-field matching for CSV import.
//
// These tests exercise:
// - Exact synonym matching across standard CRM import targets
// - Sub-word matching for composite column headers
// - Strict single-assignment policy (each target field is used at most once)
// - Preservation and priority of existing initialMapping
// - Punctuation, symbol, and case normalization
// - Unrecognised column handling (assigned null)
// - Empty headers handling
// - Sample CSV header mappings
// - Import validity gating via mappingProblems

describe('autoMapColumns', () => {
  it('maps standard headers by exact synonym', () => {
    const headers = ['Full Name', 'Phone Number', 'Email', 'City', 'Lead Source', 'Notes'];
    const mapping = autoMapColumns(headers);

    expect(mapping[0]).toBe('name');
    expect(mapping[1]).toBe('phone');
    expect(mapping[2]).toBe('email');
    expect(mapping[3]).toBe('location');
    expect(mapping[4]).toBe('source');
    expect(mapping[5]).toBe('notes');
  });

  it('maps organisation and job title synonyms', () => {
    const headers = ['Company', 'Role', 'Website', 'Instagram'];
    const mapping = autoMapColumns(headers);

    expect(mapping[0]).toBe('organisationName');
    expect(mapping[1]).toBe('jobTitle');
    expect(mapping[2]).toBe('websiteUrl');
    expect(mapping[3]).toBe('instagramHandle');
  });

  it('performs sub-word matching for composite headers', () => {
    const headers = ['Customer Name', 'Contact Email', 'Mobile Phone'];
    const mapping = autoMapColumns(headers);

    expect(mapping[0]).toBe('name');
    expect(mapping[1]).toBe('email');
    expect(mapping[2]).toBe('phone');
  });

  it('assigns each target field at most once (no duplicate field mapping)', () => {
    const headers = ['Name', 'Full Name', 'Contact Name'];
    const mapping = autoMapColumns(headers);

    expect(mapping[0]).toBe('name');
    expect(mapping[1]).toBeNull();
    expect(mapping[2]).toBeNull();
  });

  it('assigns each target field at most once for phone columns', () => {
    const headers = ['Phone', 'Mobile Number', 'Contact Number'];
    const mapping = autoMapColumns(headers);

    expect(mapping[0]).toBe('phone');
    expect(mapping[1]).toBeNull();
    expect(mapping[2]).toBeNull();
  });

  it('preserves initial mapping and marks targets as taken', () => {
    // Column 0 is a custom column already manually mapped to 'email'.
    // Column 1 is named 'Email' — it must NOT steal 'email' or produce duplicate targets.
    const headers = ['Custom User Ident', 'Email', 'Full Name'];
    const initialMapping = { 0: 'email' as const };
    const mapping = autoMapColumns(headers, initialMapping);

    expect(mapping[0]).toBe('email');
    expect(mapping[1]).toBeNull();
    expect(mapping[2]).toBe('name');
  });

  it('maps unrecognised columns to null', () => {
    const headers = ['Random Column', 'Internal ID', 'Miscellaneous Info'];
    const mapping = autoMapColumns(headers);

    expect(mapping[0]).toBeNull();
    expect(mapping[1]).toBeNull();
    expect(mapping[2]).toBeNull();
  });

  it('normalises punctuation, symbols and whitespace in column headers', () => {
    const headers = ['E-mail (Personal)', 'PHONE #', 'Notes / Remarks'];
    const mapping = autoMapColumns(headers);

    expect(mapping[0]).toBe('email');
    expect(mapping[1]).toBe('phone');
    expect(mapping[2]).toBe('notes');
  });

  it('returns empty mapping for empty headers array', () => {
    expect(autoMapColumns([])).toEqual({});
  });

  it('correctly maps the shipped SAMPLE_CSV_HEADERS template', () => {
    const mapping = autoMapColumns(SAMPLE_CSV_HEADERS);

    // SAMPLE_CSV_HEADERS = ['Full Name', 'Phone Number', 'Email', 'City', 'Lead Source', 'Estimated Budget', 'Notes']
    expect(mapping[0]).toBe('name');
    expect(mapping[1]).toBe('phone');
    expect(mapping[2]).toBe('email');
    expect(mapping[3]).toBe('location');
    expect(mapping[4]).toBe('source');
    expect(mapping[5]).toBeNull(); // Estimated Budget is not an existing CRM field
    expect(mapping[6]).toBe('notes');
  });
});

describe('mappingProblems', () => {
  it('returns an error when no identifying field is mapped', () => {
    const problems = mappingProblems({ 0: 'location', 1: 'notes' });

    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatch(/at least a Name, Organisation, Website, Instagram or Email/i);
  });

  it('returns no error when name is mapped', () => {
    expect(mappingProblems({ 0: 'name', 1: 'phone' })).toEqual([]);
  });

  it('returns no error when email is mapped', () => {
    expect(mappingProblems({ 0: 'email' })).toEqual([]);
  });

  it('returns no error when organisation is mapped', () => {
    expect(mappingProblems({ 0: 'organisationName' })).toEqual([]);
  });

  it('returns no error when website is mapped', () => {
    expect(mappingProblems({ 0: 'websiteUrl' })).toEqual([]);
  });

  it('returns no error when instagram handle is mapped', () => {
    expect(mappingProblems({ 0: 'instagramHandle' })).toEqual([]);
  });
});
