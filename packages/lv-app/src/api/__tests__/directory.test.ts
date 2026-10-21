import { describe, expect, it } from 'vitest';

import { listingPath, matchesOrganisation, matchesPerson, type DirectoryOrganisation, type DirectoryPerson } from 'src/api/directory';

// The directory computes almost nothing — it is two lists and two records off
// Twenty's own `person` and `company`. What it does decide is what a search
// matches and where a listing opens.

const person: DirectoryPerson = {
  id: 'p1',
  name: 'Rahul Sharma',
  email: 'rahul@wildnest.in',
  phone: '+91 98765 43210',
  jobTitle: 'Adventure Host',
  city: 'Lonavala',
  avatarUrl: null,
  companyId: 'c1',
  companyName: 'The Wild Nest',
  createdAt: '2026-09-01T00:00:00.000Z',
};

const organisation: DirectoryOrganisation = {
  id: 'c1',
  name: 'The Wild Nest',
  website: 'thewildnest.in',
  city: 'Mulshi',
  region: 'Maharashtra, India',
  employees: 12,
  createdAt: '2026-09-01T00:00:00.000Z',
  peopleCount: 2,
  partnerCount: 1,
};

describe('matchesPerson', () => {
  it('passes everything on an empty search', () => {
    expect(matchesPerson(person, '')).toBe(true);
    expect(matchesPerson(person, '   ')).toBe(true);
  });

  it('searches the name, role, city, contact details and organisation', () => {
    expect(matchesPerson(person, 'rahul')).toBe(true);
    expect(matchesPerson(person, 'adventure')).toBe(true);
    expect(matchesPerson(person, 'lonavala')).toBe(true);
    expect(matchesPerson(person, '98765')).toBe(true);
    expect(matchesPerson(person, 'wild nest')).toBe(true);
    expect(matchesPerson(person, 'goa')).toBe(false);
  });

  it('does not fall over on a person with nothing recorded', () => {
    const bare: DirectoryPerson = { ...person, name: 'Unnamed person', email: null, phone: null, jobTitle: null, city: null, companyName: null };

    expect(matchesPerson(bare, '')).toBe(true);
    expect(matchesPerson(bare, 'unnamed')).toBe(true);
    expect(matchesPerson(bare, 'rahul')).toBe(false);
  });
});

describe('matchesOrganisation', () => {
  it('searches the name, website and place', () => {
    expect(matchesOrganisation(organisation, 'wild')).toBe(true);
    expect(matchesOrganisation(organisation, 'thewildnest')).toBe(true);
    expect(matchesOrganisation(organisation, 'mulshi')).toBe(true);
    expect(matchesOrganisation(organisation, 'maharashtra')).toBe(true);
    expect(matchesOrganisation(organisation, 'kerala')).toBe(false);
  });

  it('still matches an unnamed company, because the row is real', () => {
    // Twenty creates a company row before it is named; hiding it would lose
    // the only link to it.
    const unnamed: DirectoryOrganisation = { ...organisation, name: 'Unnamed organisation', website: null, city: null, region: null };

    expect(matchesOrganisation(unnamed, '')).toBe(true);
    expect(matchesOrganisation(unnamed, 'unnamed')).toBe(true);
  });
});

describe('listingPath', () => {
  it('opens each kind on its existing ecosystem screen', () => {
    expect(listingPath({ id: 'e1', name: 'Ridge walk', status: 'LIVE', kind: 'experience' })).toBe('/ecosystem/experiences/e1');
    expect(listingPath({ id: 'r1', name: 'Upper Rooms', status: 'LIVE', kind: 'property' })).toBe('/ecosystem/properties/r1');
  });
});
