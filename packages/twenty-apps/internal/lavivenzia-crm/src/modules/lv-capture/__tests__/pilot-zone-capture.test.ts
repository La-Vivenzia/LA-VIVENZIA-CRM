import { describe, expect, it } from 'vitest';

import { readCaptureInput } from 'src/modules/lv-capture/services/capture-request';
import { leadCreateData } from 'src/modules/lv-capture/services/capture-service';
import { buildLeadDraft } from 'src/modules/lv-capture/utils/build-lead-draft';
import { LEAD_PILOT_ZONES } from 'src/modules/lv-core/constants/lead-taxonomy';

describe('pilotZone backend capture parsing and validation', () => {
  it('accepts every canonical pilot zone in readCaptureInput', () => {
    for (const zone of LEAD_PILOT_ZONES) {
      const parsed = readCaptureInput({
        method: 'MANUAL',
        fields: {
          name: 'Test Venue',
          pilotZone: zone,
        },
      });

      expect(parsed.ok).toBe(true);

      if (parsed.ok) {
        expect(parsed.input.pilotZone).toBe(zone);
      }
    }
  });

  it('accepts and normalizes human-readable zone labels in readCaptureInput', () => {
    const labels = [
      { input: 'Amanora Mall', expected: 'AMANORA_MALL' },
      { input: 'Seasons Mall', expected: 'SEASONS_MALL' },
      { input: 'Magarpatta City', expected: 'MAGARPATTA_CITY' },
      { input: 'Hadapsar', expected: 'HADAPSAR' },
      { input: '  AMANORA_MALL  ', expected: 'AMANORA_MALL' },
      { input: '  hadapsar  ', expected: 'HADAPSAR' },
    ];

    for (const { input, expected } of labels) {
      const parsed = readCaptureInput({
        method: 'MANUAL',
        fields: {
          name: 'Test Venue',
          pilotZone: input,
        },
      });

      expect(parsed.ok).toBe(true);

      if (parsed.ok) {
        expect(parsed.input.pilotZone).toBe(expected);
      }
    }
  });

  it('rejects unsupported pilot zone values with a safe validation error', () => {
    const unsupported = ['Koregaon Park', 'Bandra', 'INVALID_ZONE', 'pune_central'];

    for (const badValue of unsupported) {
      const parsed = readCaptureInput({
        method: 'MANUAL',
        fields: {
          name: 'Test Venue',
          pilotZone: badValue,
        },
      });

      expect(parsed.ok).toBe(false);

      if (!parsed.ok) {
        expect(parsed.error).toContain('pilotZone must be one of: AMANORA_MALL, SEASONS_MALL, MAGARPATTA_CITY, HADAPSAR');
      }
    }
  });

  it('allows null, empty, or absent pilotZone for backward-compatible legacy paths', () => {
    const parsedNull = readCaptureInput({
      method: 'MANUAL',
      fields: {
        name: 'Legacy Lead',
        pilotZone: null,
      },
    });

    expect(parsedNull.ok).toBe(true);

    if (parsedNull.ok) {
      expect(parsedNull.input.pilotZone).toBeNull();
    }

    const parsedOmitted = readCaptureInput({
      method: 'MANUAL',
      fields: {
        name: 'Legacy Lead',
      },
    });

    expect(parsedOmitted.ok).toBe(true);

    if (parsedOmitted.ok) {
      expect(parsedOmitted.input.pilotZone).toBeNull();
    }
  });
});

describe('pilotZone draft building and persistence payload', () => {
  it('buildLeadDraft preserves pilotZone in the returned LeadDraft', () => {
    const built = buildLeadDraft({
      captureMode: 'MANUAL',
      name: 'Effingut Seasons',
      location: 'Magarpatta Road, Hadapsar',
      pilotZone: 'SEASONS_MALL',
    });

    expect(built.ok).toBe(true);

    if (built.ok) {
      expect(built.draft.pilotZone).toBe('SEASONS_MALL');
      expect(built.draft.location).toBe('Magarpatta Road, Hadapsar');
      expect(built.draft.name).toBe('Effingut Seasons');
    }
  });

  it('leadCreateData maps pilotZone to the creation record alongside location', () => {
    const built = buildLeadDraft({
      captureMode: 'MANUAL',
      name: 'Toit Brewpub',
      location: 'Amanora Town Centre',
      pilotZone: 'AMANORA_MALL',
    });

    expect(built.ok).toBe(true);

    if (built.ok) {
      const provenance = {
        method: 'MANUAL',
        platform: null,
        originalUrl: null,
        originalHandle: null,
        capturedAt: new Date().toISOString(),
        capturedById: 'member-1',
        extraction: { status: 'NOT_APPLICABLE' as const, kind: null, runId: null, fieldCount: 0 },
        classification: { status: 'MANUAL' as const, runId: null },
        verification: 'CONFIRMED_BY_PERSON' as const,
        duplicateDecision: { decision: 'NONE' as const, candidateLeadIds: [] },
        captureKey: 'test-capture-key',
      };

      const data = leadCreateData(built.draft, provenance, { ownerId: 'owner-1', attachment: null });

      expect(data.pilotZone).toBe('AMANORA_MALL');
      expect(data.location).toBe('Amanora Town Centre');
      expect(data.name).toBe('Toit Brewpub');
    }
  });

  it('leadCreateData handles null pilotZone safely without overwriting or failing', () => {
    const built = buildLeadDraft({
      captureMode: 'MANUAL',
      name: 'Non-pilot Record',
      location: 'Lonavala',
      pilotZone: null,
    });

    expect(built.ok).toBe(true);

    if (built.ok) {
      const provenance = {
        method: 'MANUAL',
        platform: null,
        originalUrl: null,
        originalHandle: null,
        capturedAt: new Date().toISOString(),
        capturedById: null,
        extraction: { status: 'NOT_APPLICABLE' as const, kind: null, runId: null, fieldCount: 0 },
        classification: { status: 'MANUAL' as const, runId: null },
        verification: 'CONFIRMED_BY_PERSON' as const,
        duplicateDecision: { decision: 'NONE' as const, candidateLeadIds: [] },
        captureKey: 'test-capture-key',
      };

      const data = leadCreateData(built.draft, provenance, { ownerId: null, attachment: null });

      expect(data.pilotZone).toBeUndefined();
      expect(data.location).toBe('Lonavala');
    }
  });

  it('leadCreateData preserves all related contact and profile fields alongside pilotZone', () => {
    const built = buildLeadDraft({
      captureMode: 'MANUAL',
      name: 'Full Venue Profile',
      organisationName: 'Hospitality Group',
      jobTitle: 'General Manager',
      location: 'Magarpatta City, Tower 5',
      pilotZone: 'MAGARPATTA_CITY',
      category: 'BUSINESS_PARTNER',
      subcategory: 'BAR_LOUNGE',
      phone: '+91 98765 00000',
      email: 'gm@fullvenue.com',
      websiteUrl: 'https://fullvenue.com',
      instagramHandle: 'fullvenue_pune',
    });

    expect(built.ok).toBe(true);

    if (built.ok) {
      const provenance = {
        method: 'MANUAL',
        platform: null,
        originalUrl: null,
        originalHandle: null,
        capturedAt: new Date().toISOString(),
        capturedById: 'member-admin',
        extraction: { status: 'NOT_APPLICABLE' as const, kind: null, runId: null, fieldCount: 0 },
        classification: { status: 'MANUAL' as const, runId: null },
        verification: 'CONFIRMED_BY_PERSON' as const,
        duplicateDecision: { decision: 'NONE' as const, candidateLeadIds: [] },
        captureKey: 'test-key-full',
      };

      const data = leadCreateData(built.draft, provenance, { ownerId: 'owner-1', attachment: null });

      expect(data.pilotZone).toBe('MAGARPATTA_CITY');
      expect(data.location).toBe('Magarpatta City, Tower 5');
      expect(data.name).toBe('Full Venue Profile');
      expect(data.organisationName).toBe('Hospitality Group');
      expect(data.jobTitle).toBe('General Manager');
      expect(data.category).toBe('BUSINESS_PARTNER');
      expect(data.subcategory).toBe('BAR_LOUNGE');
      expect(data.phones.primaryPhoneNumber).toBe('+919876500000');
      expect(data.emails.primaryEmail).toBe('gm@fullvenue.com');
      expect(data.website.primaryLinkUrl).toBe('https://fullvenue.com');
      expect(data.instagram.primaryLinkUrl).toBe('fullvenue_pune');
    }
  });
});
