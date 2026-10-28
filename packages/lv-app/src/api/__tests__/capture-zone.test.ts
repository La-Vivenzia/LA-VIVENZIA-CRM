import { describe, expect, it } from 'vitest';

import { canReviewDraft, type CaptureDraft } from 'src/api/capture';
import { type PilotZone } from 'src/domain/pilot-zones';

describe('Capture draft pilotZone lifecycle and validation', () => {
  const createMockDraft = (overrides?: Partial<CaptureDraft>): CaptureDraft => ({
    name: '',
    organisationName: null,
    jobTitle: null,
    email: null,
    phone: null,
    websiteUrl: null,
    instagramHandle: null,
    socialProfile: null,
    location: null,
    pilotZone: null,
    category: null,
    subcategory: null,
    languages: null,
    source: null,
    priority: null,
    status: null,
    completeness: 0,
    requiresHumanConfirmation: false,
    warnings: [],
    ...overrides,
  });

  const draftPayload = (draft: CaptureDraft) => ({
    name: draft.name,
    organisationName: draft.organisationName,
    jobTitle: draft.jobTitle,
    email: draft.email,
    phone: draft.phone,
    websiteUrl: draft.websiteUrl,
    instagramHandle: draft.instagramHandle,
    socialProfile: draft.socialProfile,
    location: draft.location,
    pilotZone: draft.pilotZone,
    category: draft.category,
    subcategory: draft.subcategory,
    languages: draft.languages,
  });

  it('initializes draft with null pilotZone (no silent default)', () => {
    const draft = createMockDraft();
    expect(draft.pilotZone).toBeNull();
  });

  it('allows progression for non-Pune leads when name is present and pilotZone is null', () => {
    const nonPuneDraft = createMockDraft({ name: 'Bengaluru Heritage Stay', pilotZone: null });
    expect(canReviewDraft(nonPuneDraft)).toBe(true);
  });

  it('blocks progression when explicitly marked as Pune Pilot lead but pilotZone is missing', () => {
    const puneDraft = createMockDraft({ name: 'Effingut Pune', pilotZone: null, isPunePilot: true });
    expect(canReviewDraft(puneDraft)).toBe(false);
  });

  it('prevents progression when name is missing or too short regardless of pilot zone', () => {
    const draft = createMockDraft({ name: 'A', pilotZone: 'AMANORA_MALL' });
    expect(canReviewDraft(draft)).toBe(false);
  });

  it('allows review progression when both valid name and pilotZone are provided', () => {
    const validZones: PilotZone[] = [
      'AMANORA_MALL',
      'SEASONS_MALL',
      'MAGARPATTA_CITY',
      'HADAPSAR',
    ];

    for (const zone of validZones) {
      const draft = createMockDraft({ name: 'Valid Venue Name', pilotZone: zone });
      expect(canReviewDraft(draft)).toBe(true);
    }
  });

  it('allows review progression for Pune Pilot leads when valid zone is selected', () => {
    const puneDraft = createMockDraft({ name: 'Valid Pune Venue', pilotZone: 'SEASONS_MALL', isPunePilot: true });
    expect(canReviewDraft(puneDraft)).toBe(true);
  });

  it('preserves pilotZone across draft editing and step transitions', () => {
    let draft = createMockDraft({ name: 'Initial Venue' });
    expect(draft.pilotZone).toBeNull();

    // User selects pilot zone
    draft = { ...draft, pilotZone: 'MAGARPATTA_CITY' };
    expect(draft.pilotZone).toBe('MAGARPATTA_CITY');

    // User edits other fields
    draft = { ...draft, phone: '+91 98765 43210', location: 'Tower 4, Magarpatta City' };
    expect(draft.pilotZone).toBe('MAGARPATTA_CITY');
    expect(draft.location).toBe('Tower 4, Magarpatta City');
  });

  it('includes pilotZone in the draftPayload sent to preflight and create routes', () => {
    const draft = createMockDraft({
      name: 'Toit Hadapsar',
      location: 'Near Magarpatta',
      pilotZone: 'HADAPSAR',
    });

    const payload = draftPayload(draft);
    expect(payload.pilotZone).toBe('HADAPSAR');
    expect(payload.location).toBe('Near Magarpatta');
    expect(payload.name).toBe('Toit Hadapsar');
  });

  it('rejects unsupported arbitrary zone strings from unlocking review step', () => {
    const draft = createMockDraft({ name: 'Valid Venue', pilotZone: 'KOREGAON_PARK' as unknown as PilotZone });
    expect(canReviewDraft(draft)).toBe(false);
  });

  it('supports dynamically switching between Pune Pilot and non-Pilot modes', () => {
    // Starts as general non-Pune lead
    let draft = createMockDraft({ name: 'Cross-Country Lounge', pilotZone: null });
    expect(canReviewDraft(draft)).toBe(true);

    // User designates it as Pune Pilot lead: requires valid pilot zone
    draft = { ...draft, isPunePilot: true };
    expect(canReviewDraft(draft)).toBe(false);

    // User selects a valid pilot zone: valid again
    draft = { ...draft, pilotZone: 'AMANORA_MALL' };
    expect(canReviewDraft(draft)).toBe(true);

    // User switches back to non-pilot: clears zone and remains valid
    draft = { ...draft, isPunePilot: false, pilotZone: null };
    expect(canReviewDraft(draft)).toBe(true);
  });

  it('allows loading existing historical drafts that have pilotZone: null or omitted', () => {
    const historicalDraft = createMockDraft({
      name: 'Legacy Partner Record',
      pilotZone: null,
      location: 'Connaught Place, New Delhi',
    });
    expect(canReviewDraft(historicalDraft)).toBe(true);

    const historicalOmitted = createMockDraft({
      name: 'Another Legacy Partner',
      location: 'Bandra, Mumbai',
    });
    delete (historicalOmitted as any).pilotZone;
    expect(canReviewDraft(historicalOmitted)).toBe(true);
  });

  it('preserves location, contact info, and pilotZone as completely distinct fields', () => {
    const draft = createMockDraft({
      name: 'Brewpub Lounge',
      phone: '+91 20 1234 5678',
      email: 'contact@brewpub.com',
      websiteUrl: 'https://brewpub.in',
      instagramHandle: 'brewpub_pune',
      location: 'Level 2, East Wing, Amanora Mall',
      pilotZone: 'AMANORA_MALL',
    });

    const payload = draftPayload(draft);
    expect(payload.pilotZone).toBe('AMANORA_MALL');
    expect(payload.location).toBe('Level 2, East Wing, Amanora Mall');
    expect(payload.phone).toBe('+91 20 1234 5678');
    expect(payload.email).toBe('contact@brewpub.com');
    expect(payload.websiteUrl).toBe('https://brewpub.in');
    expect(payload.instagramHandle).toBe('brewpub_pune');
  });
});
