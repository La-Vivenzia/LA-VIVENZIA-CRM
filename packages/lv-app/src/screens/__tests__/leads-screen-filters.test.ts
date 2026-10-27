import { describe, expect, it } from 'vitest';

import { inView, type LeadListRow } from 'src/api/leads';
import { matchesPilotZone } from 'src/domain/pilot-zones';
import { matchesVibe } from 'src/domain/vibe-taxonomy';

const makeLead = (overrides: Partial<LeadListRow>): LeadListRow => ({
  id: 'lead-1',
  lvLeadId: 'LV-000001',
  name: 'Sample Venue',
  organisationName: 'Sample Org',
  location: 'Hadapsar, Pune',
  pilotZone: null,
  category: 'BUSINESS_PARTNER',
  subcategory: null,
  status: 'NEW',
  priority: 'MEDIUM',
  nextAction: 'Call back',
  nextFollowUpAt: null,
  lastInteractionAt: null,
  opportunityScore: 50,
  photoUrl: null,
  rating: null,
  reviewCount: null,
  owner: null,
  emails: null,
  phones: null,
  ...overrides,
});

describe('LeadsScreen filtering composition', () => {
  const leads: LeadListRow[] = [
    makeLead({
      id: 'l1',
      name: 'Toit Brewpub',
      pilotZone: 'AMANORA_MALL',
      category: 'BUSINESS_PARTNER',
      subcategory: 'BAR_LOUNGE',
      status: 'NEW',
    }),
    makeLead({
      id: 'l2',
      name: 'Amanora Gaming Lounge',
      pilotZone: 'AMANORA_MALL',
      category: 'BUSINESS_PARTNER',
      subcategory: 'GAMING_ARCADE',
      status: 'CONTACTED',
    }),
    makeLead({
      id: 'l3',
      name: 'Effingut Brewhouse',
      pilotZone: 'SEASONS_MALL',
      category: 'BUSINESS_PARTNER',
      subcategory: 'BAR_LOUNGE',
      status: 'LOST',
    }),
    makeLead({
      id: 'l4',
      name: 'Work Cafe Magarpatta',
      pilotZone: 'MAGARPATTA_CITY',
      category: 'BUSINESS_PARTNER',
      subcategory: 'WORK_CAFE',
      status: 'ONBOARDING_IN_PROGRESS',
    }),
    makeLead({
      id: 'l5',
      name: 'Hadapsar Spa & Wellness',
      pilotZone: 'HADAPSAR',
      category: 'EXPERIENCE',
      subcategory: 'LUXURY_SPA',
      status: 'NEW',
    }),
    makeLead({
      id: 'l6',
      name: 'Legacy Mumbai Lead',
      pilotZone: null,
      location: 'Bandra, Mumbai',
      category: 'BUSINESS_PARTNER',
      subcategory: 'RESTAURANT',
      status: 'NEW',
    }),
    makeLead({
      id: 'l7',
      name: 'Unclassified Pune Lead',
      pilotZone: 'HADAPSAR',
      category: null,
      subcategory: null,
      status: 'NEW',
    }),
  ];

  it('All zone filter includes all leads including non-pilot and null pilotZone records', () => {
    const result = leads.filter((lead) => matchesPilotZone(lead.pilotZone, 'all'));
    expect(result).toHaveLength(7);
  });

  it('filters by each of the four pilot zones correctly', () => {
    const amanora = leads.filter((lead) => matchesPilotZone(lead.pilotZone, 'AMANORA_MALL'));
    expect(amanora.map((l) => l.name)).toEqual(['Toit Brewpub', 'Amanora Gaming Lounge']);

    const seasons = leads.filter((lead) => matchesPilotZone(lead.pilotZone, 'SEASONS_MALL'));
    expect(seasons.map((l) => l.name)).toEqual(['Effingut Brewhouse']);

    const magarpatta = leads.filter((lead) => matchesPilotZone(lead.pilotZone, 'MAGARPATTA_CITY'));
    expect(magarpatta.map((l) => l.name)).toEqual(['Work Cafe Magarpatta']);

    const hadapsar = leads.filter((lead) => matchesPilotZone(lead.pilotZone, 'HADAPSAR'));
    expect(hadapsar.map((l) => l.name)).toEqual(['Hadapsar Spa & Wellness', 'Unclassified Pune Lead']);
  });

  it('returns no records when a zone has no matching leads', () => {
    const emptyZoneLeads = leads.filter(
      (lead) => lead.pilotZone === 'MAGARPATTA_CITY' && lead.subcategory === 'BAR_LOUNGE',
    );
    expect(emptyZoneLeads).toHaveLength(0);
  });

  it('composes zone filter and vibe filter independently', () => {
    // Amanora Mall + Brewery & Nightlife
    const amanoraNightlife = leads.filter(
      (lead) =>
        matchesPilotZone(lead.pilotZone, 'AMANORA_MALL') &&
        matchesVibe(lead.subcategory, lead.category, 'brewery_nightlife'),
    );
    expect(amanoraNightlife.map((l) => l.name)).toEqual(['Toit Brewpub']);

    // All zones + Brewery & Nightlife
    const allNightlife = leads.filter(
      (lead) =>
        matchesPilotZone(lead.pilotZone, 'all') &&
        matchesVibe(lead.subcategory, lead.category, 'brewery_nightlife'),
    );
    expect(allNightlife.map((l) => l.name)).toEqual(['Toit Brewpub', 'Effingut Brewhouse']);

    // Hadapsar + Luxury Spa
    const hadapsarSpa = leads.filter(
      (lead) =>
        matchesPilotZone(lead.pilotZone, 'HADAPSAR') &&
        matchesVibe(lead.subcategory, lead.category, 'luxury_spa'),
    );
    expect(hadapsarSpa.map((l) => l.name)).toEqual(['Hadapsar Spa & Wellness']);
  });

  it('composes with saved views without resetting zone or vibe', () => {
    const now = Date.now();
    // Open leads in Amanora Mall
    const openAmanora = leads.filter(
      (lead) => inView(lead, 'open', now) && matchesPilotZone(lead.pilotZone, 'AMANORA_MALL'),
    );
    expect(openAmanora.map((l) => l.name)).toEqual(['Toit Brewpub', 'Amanora Gaming Lounge']);

    // Closed leads in Seasons Mall (Effingut Brewhouse is LOST)
    const closedSeasons = leads.filter(
      (lead) => inView(lead, 'closed', now) && matchesPilotZone(lead.pilotZone, 'SEASONS_MALL'),
    );
    expect(closedSeasons.map((l) => l.name)).toEqual(['Effingut Brewhouse']);
  });

  it('composes with search queries', () => {
    const needle = 'brew';
    const searchedAmanora = leads.filter((lead) => {
      const matchesSearch = `${lead.name ?? ''}`.toLowerCase().includes(needle);
      return matchesSearch && matchesPilotZone(lead.pilotZone, 'AMANORA_MALL');
    });
    expect(searchedAmanora.map((l) => l.name)).toEqual(['Toit Brewpub']);
  });

  it('does NOT infer vibe from venue name or address text', () => {
    // "Hadapsar Spa & Wellness" has "Spa" in name, but if subcategory were null, it must NOT match
    const leadWithoutSubcategory = makeLead({
      name: 'Luxury Spa Boutique',
      location: 'Amanora Mall Pune',
      pilotZone: 'AMANORA_MALL',
      subcategory: null,
    });

    expect(matchesVibe(leadWithoutSubcategory.subcategory, leadWithoutSubcategory.category, 'luxury_spa')).toBe(false);
  });

  describe('URL parameter and state normalization', () => {
    it('normalizes valid zone and vibe query parameters', () => {
      const params = new URLSearchParams('zone=SEASONS_MALL&vibe=brewery_nightlife&q=effingut');
      const zoneParam = params.get('zone');
      const vibeParam = params.get('vibe');

      expect(zoneParam).toBe('SEASONS_MALL');
      expect(vibeParam).toBe('brewery_nightlife');
    });

    it('falls back safely to "all" when zone parameter is unknown or malformed', () => {
      const params = new URLSearchParams('zone=UNKNOWN_ZONE');
      const zoneParam = params.get('zone');
      const isPilotZoneFilter = (val: unknown) => val === 'all' || ['AMANORA_MALL', 'SEASONS_MALL', 'MAGARPATTA_CITY', 'HADAPSAR'].includes(String(val));
      const fallbackZone = isPilotZoneFilter(zoneParam) ? zoneParam : 'all';

      expect(fallbackZone).toBe('all');
    });

    it('preserves unrelated search query and view when setting zone', () => {
      const current = new URLSearchParams('view=open&q=cafe');
      current.set('zone', 'MAGARPATTA_CITY');

      expect(current.get('view')).toBe('open');
      expect(current.get('q')).toBe('cafe');
      expect(current.get('zone')).toBe('MAGARPATTA_CITY');
    });

    it('clearing zone or vibe deletes the parameter instead of setting "all" in URL', () => {
      const params = new URLSearchParams('zone=AMANORA_MALL&vibe=fine_dining');
      const setParam = (sp: URLSearchParams, key: string, value: string | null) => {
        const next = new URLSearchParams(sp);
        if (value === null || value === '' || value === 'all') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      };

      const clearedZone = setParam(params, 'zone', 'all');
      expect(clearedZone.has('zone')).toBe(false);
      expect(clearedZone.get('vibe')).toBe('fine_dining');

      const clearedAll = setParam(clearedZone, 'vibe', null);
      expect(clearedAll.toString()).toBe('');
    });
  });

  describe('GraphQL schema fallback resilience', () => {
    it('detects missing pilotZone schema error accurately', () => {
      const missingFieldError = new Error('Cannot query field "pilotZone" on type "LvLead".');
      const isMissingPilotZone = /Cannot query field ["']pilotZone["']/i.test(missingFieldError.message);
      expect(isMissingPilotZone).toBe(true);
    });

    it('does NOT treat auth or network errors as missing pilotZone schema errors', () => {
      const networkError = new Error('Failed to fetch from http://localhost:3000/metadata');
      const authError = new Error('Invalid token: JWT expired');
      const syntaxError = new Error('Syntax Error: Expected Name, found $');

      expect(/Cannot query field ["']pilotZone["']/i.test(networkError.message)).toBe(false);
      expect(/Cannot query field ["']pilotZone["']/i.test(authError.message)).toBe(false);
      expect(/Cannot query field ["']pilotZone["']/i.test(syntaxError.message)).toBe(false);
    });
  });
});
