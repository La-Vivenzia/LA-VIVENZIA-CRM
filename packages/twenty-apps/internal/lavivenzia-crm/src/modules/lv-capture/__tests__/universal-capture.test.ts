import { describe, expect, it } from 'vitest';

import { CAPTURE_METHOD_BY_KEY, CAPTURE_METHODS, PRIMARY_CAPTURE_ACTIONS } from 'src/modules/lv-capture/constants/capture-methods';
import { isCaptureKey, readCaptureInput } from 'src/modules/lv-capture/services/capture-request';
import { assessDraftQuality, draftFor, leadCreateData, methodProvenance } from 'src/modules/lv-capture/services/capture-service';
import { confidenceLabel, extractFromUrl, isFetchableUrl, isSocialPlatformUrl, parsePageMetadata, toReviewFields } from 'src/modules/lv-capture/services/extraction';
import { summarise, toCaptureInput, validateImportRows } from 'src/modules/lv-capture/services/import-service';
import { buildLeadDraft } from 'src/modules/lv-capture/utils/build-lead-draft';
import { detectDelimiter, parseCsv } from 'src/modules/lv-capture/utils/csv';
import { autoMapColumns, rowToFields } from 'src/modules/lv-capture/utils/import-mapping';
import { parseSocialProfile } from 'src/modules/lv-capture/utils/normalize-input';
import { LEAD_CAPTURE_MODES } from 'src/modules/lv-core/constants/lead-taxonomy';

// ---------------------------------------------------------------- methods
describe('capture methods', () => {
  it('covers every capture mode in the taxonomy, and every menu method is a mode', () => {
    for (const mode of LEAD_CAPTURE_MODES) {
      expect(CAPTURE_METHOD_BY_KEY[mode], mode).toBeDefined();
    }

    for (const method of CAPTURE_METHODS) {
      expect(LEAD_CAPTURE_MODES).toContain(method.key);
    }
  });

  it('offers the five primary actions of the brief', () => {
    expect(PRIMARY_CAPTURE_ACTIONS.map((action) => action.label)).toEqual(['Capture manually', 'Upload image', 'Paste URL', 'Paste social profile', 'Import CSV']);
  });

  it('requires confirmation for anything extracted or derived, never for typed input', () => {
    expect(CAPTURE_METHOD_BY_KEY.VISITING_CARD.requiresConfirmation).toBe(true);
    expect(CAPTURE_METHOD_BY_KEY.WEBSITE_URL.requiresConfirmation).toBe(true);
    expect(CAPTURE_METHOD_BY_KEY.INSTAGRAM.requiresConfirmation).toBe(true);
    expect(CAPTURE_METHOD_BY_KEY.MANUAL.requiresConfirmation).toBe(false);
    expect(CAPTURE_METHOD_BY_KEY.PHONE.requiresConfirmation).toBe(false);
  });
});

// ---------------------------------------------------------------- social
describe('parseSocialProfile', () => {
  it('reads LinkedIn people and company pages', () => {
    expect(parseSocialProfile('https://www.linkedin.com/in/rahul-sharma-1a2b/')).toEqual({ platform: 'LINKEDIN', url: 'https://linkedin.com/in/rahul-sharma-1a2b', handle: 'rahul-sharma-1a2b' });
    expect(parseSocialProfile('linkedin.com/company/xyz-experiences')).toEqual({ platform: 'LINKEDIN', url: 'https://linkedin.com/company/xyz-experiences', handle: 'xyz-experiences' });
    expect(parseSocialProfile('https://linkedin.com/feed/')).toBeNull();
  });

  it('reads Instagram, Facebook, YouTube and X links', () => {
    expect(parseSocialProfile('https://instagram.com/Lakeview.Stay/?hl=en')?.handle).toBe('lakeview.stay');
    expect(parseSocialProfile('https://www.facebook.com/LakeviewStay')).toMatchObject({ platform: 'FACEBOOK', handle: 'LakeviewStay' });
    expect(parseSocialProfile('https://youtube.com/@lakeview')).toMatchObject({ platform: 'YOUTUBE', handle: 'lakeview', url: 'https://youtube.com/@lakeview' });
    expect(parseSocialProfile('https://x.com/lakeview')).toMatchObject({ platform: 'X', handle: 'lakeview' });
  });

  it('accepts a bare handle when the platform is known and refuses junk', () => {
    expect(parseSocialProfile('@lakeview', 'FACEBOOK')).toMatchObject({ platform: 'FACEBOOK', handle: 'lakeview' });
    expect(parseSocialProfile('lakeview', 'LINKEDIN')?.url).toBe('https://linkedin.com/in/lakeview');
    expect(parseSocialProfile('not a handle!!', 'FACEBOOK')).toBeNull();
    expect(parseSocialProfile('', null)).toBeNull();
  });
});

// ------------------------------------------------------------- draft modes
describe('buildLeadDraft — Day 8 modes', () => {
  it('needs a profile handle for an Instagram post link', () => {
    const post = buildLeadDraft({ captureMode: 'INSTAGRAM_POST', rawInput: 'https://instagram.com/p/Cxyz123/' });

    expect(post.ok).toBe(false);

    const withHandle = buildLeadDraft({ captureMode: 'INSTAGRAM_POST', rawInput: 'https://instagram.com/p/Cxyz123/', instagramHandle: '@lakeview.stay' });

    expect(withHandle.ok && withHandle.draft.instagramHandle).toBe('lakeview.stay');
    expect(withHandle.ok && withHandle.draft.source).toBe('INSTAGRAM');
  });

  it('keeps a LinkedIn profile as a social profile and names the lead from it when nothing else is known', () => {
    const result = buildLeadDraft({ captureMode: 'LINKEDIN_PROFILE', rawInput: 'https://www.linkedin.com/in/rahul-sharma' });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.draft.socialProfile).toEqual({ platform: 'LINKEDIN', url: 'https://linkedin.com/in/rahul-sharma', handle: 'rahul-sharma' });
      expect(result.draft.name).toBe('rahul-sharma');
      expect(result.draft.source).toBe('LINKEDIN');
      expect(result.draft.provenance.name).toBe('DERIVED');
    }
  });

  it('marks extracted fields as OCR_EXTRACTED and edited ones as USER_ENTERED', () => {
    const result = buildLeadDraft({ captureMode: 'VISITING_CARD', name: 'Rahul Sharma', phone: '+91 98765 43210', email: 'rahul@xyz.in', attachmentPath: 'x', isHumanConfirmed: true, extractedFields: ['name', 'phone'], extractionKind: 'OCR' });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.draft.provenance.name).toBe('OCR_EXTRACTED');
      expect(result.draft.provenance.phone).toBe('OCR_EXTRACTED');
      expect(result.draft.provenance.email).toBe('USER_ENTERED');
      expect(result.draft.requiresHumanConfirmation).toBe(false);
    }
  });

  it('records an AI-accepted category as AI_SUGGESTED and defaults sources per method', () => {
    const ai = buildLeadDraft({ captureMode: 'EVENT', name: 'Sunset Villa', category: 'STAY', classificationOrigin: 'AI' });

    expect(ai.ok && ai.draft.provenance.category).toBe('AI_SUGGESTED');
    expect(ai.ok && ai.draft.source).toBe('EVENT');
    expect(buildLeadDraft({ captureMode: 'WALK_IN', name: 'X' }).ok && (buildLeadDraft({ captureMode: 'WALK_IN', name: 'X' }) as { ok: true; draft: { source: string } }).draft.source).toBe('WALK_IN');
  });
});

// -------------------------------------------------------------- request
describe('readCaptureInput', () => {
  it('reads only known string fields and never an owner or actor', () => {
    const parsed = readCaptureInput({ method: 'MANUAL', fields: { name: ' Rahul ', ownerId: 'x', actorId: 'y', phone: 12345, email: 'a@b.co', socialPlatform: 'FACEBOOK', source: 'NOT_A_SOURCE' } });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.input.name).toBe('Rahul');
      expect(parsed.input.phone).toBeNull();
      expect(parsed.input.email).toBe('a@b.co');
      expect(parsed.input.socialPlatform).toBe('FACEBOOK');
      expect(parsed.input.source).toBe('OTHER');
      expect('ownerId' in parsed.input).toBe(false);
    }
  });

  it('refuses an unknown method and validates the capture key shape', () => {
    expect(readCaptureInput({ method: 'TELEPATHY', fields: {} }).ok).toBe(false);
    expect(isCaptureKey('9b19969e-1c8f-4c9d-8f1e-2a3b4c5d6e7f')).toBe(true);
    expect(isCaptureKey('nope')).toBe(false);
  });
});

// ---------------------------------------------------------------- quality
describe('assessDraftQuality', () => {
  it('names what is missing and what is invalid without blocking', () => {
    const input = { captureMode: 'MANUAL' as const, name: 'Rahul', email: 'not-an-email' };
    const built = draftFor(input);

    expect(built.ok).toBe(true);

    if (built.ok) {
      const hints = assessDraftQuality(built.draft, input);
      const codes = hints.map((hint) => hint.code);

      expect(codes).toContain('MISSING_CONTACT');
      expect(codes).toContain('MALFORMED_EMAIL');
      expect(codes).toContain('MISSING_LOCATION');
      expect(codes).toContain('MISSING_CATEGORY');
    }
  });

  it('writes provenance and the unique capture key into the create payload, never an actor', () => {
    const built = draftFor({ captureMode: 'INSTAGRAM', rawInput: '@lakeview.stay', name: 'Lakeview' });

    expect(built.ok).toBe(true);

    if (built.ok) {
      const provenance = { ...methodProvenance('INSTAGRAM', built.draft), capturedAt: 'now', capturedById: 'm1', extraction: { status: 'NOT_APPLICABLE' as const, kind: null, runId: null, fieldCount: 0 }, classification: { status: 'NOT_RUN' as const, runId: null }, verification: 'CONFIRMED_BY_PERSON' as const, duplicateDecision: { decision: 'NONE' as const, candidateLeadIds: [] }, captureKey: 'k1' };
      const data = leadCreateData(built.draft, provenance, { ownerId: null, attachment: null });

      expect(data.captureKey).toBe('k1');
      expect((data.captureProvenance as { originalUrl: string }).originalUrl).toBe('https://instagram.com/lakeview.stay');
      expect((data.captureProvenance as { platform: string }).platform).toBe('INSTAGRAM');
      expect(data.ownerId).toBeUndefined();
      expect('actorId' in data).toBe(false);
    }
  });
});

// ------------------------------------------------------------ extraction
describe('extraction', () => {
  it('labels confidence and normalises what the model read', () => {
    expect(confidenceLabel(0.9)).toBe('HIGH');
    expect(confidenceLabel(0.7)).toBe('MEDIUM');
    expect(confidenceLabel(0.2)).toBe('LOW');

    const fields = toReviewFields({
      name: { value: 'Rahul Sharma', confidence: 0.95 },
      organisationName: { value: 'XYZ Experiences', confidence: 0.9 },
      jobTitle: { value: 'Founder', confidence: 0.8 },
      phone: { value: '+91 98765 43210', confidence: 0.9 },
      email: { value: 'RAHUL@XYZ.IN', confidence: 0.92 },
      websiteUrl: { value: 'xyz.in', confidence: 0.7 },
      instagramHandle: { value: '@xyz_exp', confidence: 0.6 },
      socialProfileUrl: { value: 'linkedin.com/in/rahul', confidence: 0.6 },
      address: { value: '12 MG Road', confidence: 0.5 },
      city: { value: 'Pune', confidence: 0.9 },
      state: { value: 'Maharashtra', confidence: 0.9 },
      country: { value: null, confidence: 0 },
      notes: 'Visiting card',
    });
    const byField = Object.fromEntries(fields.map((field) => [field.field, field]));

    expect(byField.email!.value).toBe('rahul@xyz.in');
    expect(byField.websiteUrl!.value).toBe('https://xyz.in');
    expect(byField.instagramHandle!.value).toBe('xyz_exp');
    expect(byField.socialProfileUrl!.value).toBe('https://linkedin.com/in/rahul');
    expect(byField.location!.value).toBe('Pune, Maharashtra');
    expect(byField.location!.label).toBe('HIGH');
    expect(byField.phone!.label).toBe('HIGH');
  });

  it('drops confidence to LOW when a value does not parse instead of dropping the value', () => {
    const fields = toReviewFields({ name: { value: null, confidence: 0 }, organisationName: { value: null, confidence: 0 }, jobTitle: { value: null, confidence: 0 }, phone: { value: 'call me', confidence: 0.9 }, email: { value: 'rahul at xyz', confidence: 0.9 }, websiteUrl: { value: null, confidence: 0 }, instagramHandle: { value: null, confidence: 0 }, socialProfileUrl: { value: null, confidence: 0 }, address: { value: null, confidence: 0 }, city: { value: null, confidence: 0 }, state: { value: null, confidence: 0 }, country: { value: null, confidence: 0 }, notes: '' });
    const byField = Object.fromEntries(fields.map((field) => [field.field, field]));

    expect(byField.phone).toMatchObject({ value: 'call me', label: 'LOW' });
    expect(byField.email).toMatchObject({ value: 'rahul at xyz', label: 'LOW' });
  });

  it('reads public page metadata', () => {
    const html = `<html><head><title>Lakeview Homestay | Lonavala</title><meta property="og:site_name" content="Lakeview Homestay"><meta name="description" content="A quiet homestay by the lake &amp; hills"></head><body><a href="mailto:stay@lakeview.example">Email</a><a href="tel:+91 98765 43210">Call</a><a href="https://www.instagram.com/lakeview.stay/">IG</a></body></html>`;
    const fields = Object.fromEntries(parsePageMetadata(html, 'https://lakeview.example').map((field) => [field.field, field]));

    expect(fields.organisationName).toMatchObject({ value: 'Lakeview Homestay', label: 'HIGH' });
    expect(fields.email!.value).toBe('stay@lakeview.example');
    expect(fields.phone!.value).toContain('98765');
    expect(fields.instagramHandle!.value).toBe('lakeview.stay');
    expect(fields.websiteUrl!.value).toBe('https://lakeview.example');
    expect(fields.notes!.value).toContain('quiet homestay');
  });

  it('refuses private, non-http and social addresses before opening a socket', () => {
    for (const bad of ['http://localhost:3000/', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://172.16.4.4/', 'http://169.254.169.254/latest', 'ftp://example.com/', 'http://intranet/', 'http://box.local/']) {
      expect(isFetchableUrl(bad), bad).toBe(false);
    }

    expect(isFetchableUrl('https://example.com/about')).toBe(true);
    expect(isSocialPlatformUrl('https://www.instagram.com/x')).toBe(true);
    expect(isSocialPlatformUrl('https://lakeview.example')).toBe(false);
  });

  it('never invents data when the page cannot be read', async () => {
    const failing = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const result = await extractFromUrl('https://nowhere.example', failing);

    expect(result.status).toBe('UNAVAILABLE');
    expect('fields' in result).toBe(false);

    const social = await extractFromUrl('https://www.linkedin.com/in/someone', failing);

    expect(social.status).toBe('UNAVAILABLE');
  });
});

// ------------------------------------------------------------------- csv
describe('csv parser', () => {
  it('handles quotes, embedded delimiters and newlines, CRLF and BOM', () => {
    const table = parseCsv('﻿Name,Organisation,Notes\r\n"Sharma, Rahul",XYZ,"line one\nline two"\r\n,,\r\nAnita,"Quote ""Q"" Co",\r\n');

    expect(table.headers).toEqual(['Name', 'Organisation', 'Notes']);
    expect(table.rows).toEqual([
      ['Sharma, Rahul', 'XYZ', 'line one\nline two'],
      ['Anita', 'Quote "Q" Co', ''],
    ]);
    expect(table.skippedEmptyRows).toBe(1);
  });

  it('detects semicolon and tab delimiters', () => {
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a\tb')).toBe('\t');
    expect(parseCsv('a;b\n1;2').rows).toEqual([['1', '2']]);
  });
});

// --------------------------------------------------------------- mapping
describe('import mapping', () => {
  it('auto-maps common headers and leaves the rest unmapped', () => {
    const headers = ['Full Name', 'Company', 'Mobile', 'E-mail', 'Website', 'City', 'Type', 'Assigned To', 'Something Else'];
    const mapping = autoMapColumns(headers);

    expect(Object.values(mapping)).toEqual(['name', 'organisationName', 'phone', 'email', 'websiteUrl', 'location', 'category', 'owner', null]);
    expect(rowToFields(headers, ['Rahul', 'XYZ', '98765', 'r@x.in', 'x.in', 'Pune', 'Stay', 'tim', 'zzz'], mapping)).toEqual({ name: 'Rahul', organisationName: 'XYZ', phone: '98765', email: 'r@x.in', websiteUrl: 'x.in', location: 'Pune', category: 'Stay', owner: 'tim' });
  });
});

// ------------------------------------------------------------ validation
describe('import validation', () => {
  const members = [{ id: 'm-tim', name: 'Tim Apple', email: 'tim@apple.dev' }];

  it('reports valid, warning, error and in-file duplicate rows', () => {
    const { results } = validateImportRows(
      [
        { rowNumber: 2, fields: { name: 'Rahul Sharma', email: 'rahul@xyz.in', category: 'stay', subcategory: 'villa', owner: 'tim@apple.dev' } },
        { rowNumber: 3, fields: { name: 'Anita', email: 'not-an-email' } },
        { rowNumber: 4, fields: { organisationName: '', phone: '' } },
        { rowNumber: 5, fields: { name: 'Rahul S', email: 'RAHUL@xyz.in' } },
        { rowNumber: 6, fields: { name: 'Priya', source: 'carrier pigeon', priority: 'urgent', owner: 'nobody' } },
      ],
      members,
    );

    expect(results.map((row) => row.status)).toEqual(['VALID', 'ERROR', 'ERROR', 'DUPLICATE', 'ERROR']);
    expect(results[0]!.ownerId).toBe('m-tim');
    expect(results[0]!.draft?.category).toBe('STAY');
    expect(results[0]!.draft?.subcategory).toBe('VILLA');
    expect(results[3]!.duplicateOfRow).toBe(2);
    expect(results[4]!.errors[0]).toContain('Owner "nobody"');
    expect(results[4]!.warnings.join(' ')).toContain('carrier pigeon');
    expect(summarise(results)).toEqual({ total: 5, valid: 1, warnings: 0, errors: 3, duplicates: 1 });
  });

  it('maps loose taxonomy values and never trusts an owner that is not a member', () => {
    const { input, ownerId, errors } = toCaptureInput({ name: 'X', category: 'Restaurants', source: 'Referral', owner: 'Tim' }, members);

    expect(input.category).toBe('BUSINESS_PARTNER');
    expect(input.subcategory).toBe('RESTAURANT');
    expect(input.source).toBe('REFERRAL');
    expect(ownerId).toBe('m-tim');
    expect(errors).toEqual([]);
  });
});
