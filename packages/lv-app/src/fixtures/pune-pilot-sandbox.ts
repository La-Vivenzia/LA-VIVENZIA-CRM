import { type PilotZone } from 'src/domain/pilot-zones';

// Deterministic, clearly fictional Pune Pilot Sandbox fixture dataset.
//
// Created for Task 3 to populate the CRM with 12 representative venues across
// the 4 canonical Pune pilot zones and 5 vibe categories.
//
// Safety Guarantees:
// 1. All records carry "[Sandbox]" in their title and business identity.
// 2. All email domains use non-deliverable "*.sandbox.lavivenzia.internal".
// 3. All websites use internal sandbox URIs.
// 4. All phone numbers use reserved non-allocated test sequences.
// 5. Uses a fixed deterministic importKey for safe idempotency.

export const PUNE_PILOT_SANDBOX_IMPORT_KEY = '7f9c2d18-3a81-4b72-9b04-8e1c64df3310';

export type SandboxLeadRecord = {
  rowNumber: number;
  name: string;
  organisationName: string;
  jobTitle: string;
  email: string;
  phone: string;
  websiteUrl: string;
  instagramHandle: string;
  location: string;
  pilotZone: PilotZone;
  category: 'BUSINESS_PARTNER' | 'EXPERIENCE' | 'STAY' | 'PEOPLE_COMMUNITY';
  subcategory: string;
  source: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  languages: string;
  notes: string;
};

export const PUNE_PILOT_SANDBOX_RECORDS: readonly SandboxLeadRecord[] = [
  // -------------------------------------------------------------------------
  // Zone 1: AMANORA MALL (3 venues)
  // -------------------------------------------------------------------------
  {
    rowNumber: 2,
    name: 'Neon Byte Arcade [Sandbox]',
    organisationName: 'Neon Byte Entertainment LLP',
    jobTitle: 'Operations Lead',
    email: 'contact@neonbyte.sandbox.lavivenzia.internal',
    phone: '+91 98220 00001',
    websiteUrl: 'https://sandbox.lavivenzia.internal/neon-byte',
    instagramHandle: 'neonbyte_pune',
    location: 'Amanora Mall, Hadapsar, Pune',
    pilotZone: 'AMANORA_MALL',
    category: 'BUSINESS_PARTNER',
    subcategory: 'ARCADE',
    source: 'IMPORTED',
    priority: 'HIGH',
    languages: 'English, Hindi, Marathi',
    notes: 'Fictional Pune pilot sandbox lead: 40-seat modern arcade & VR zone in Amanora Mall.',
  },
  {
    rowNumber: 3,
    name: 'The Saffron Table Fine Dining [Sandbox]',
    organisationName: 'Saffron Culinary Ventures',
    jobTitle: 'Head Chef & Partner',
    email: 'reservations@saffrontable.sandbox.lavivenzia.internal',
    phone: '+91 98220 00002',
    websiteUrl: 'https://sandbox.lavivenzia.internal/saffron-table',
    instagramHandle: 'saffrontable_pune',
    location: 'Amanora Town Centre, Pune',
    pilotZone: 'AMANORA_MALL',
    category: 'BUSINESS_PARTNER',
    subcategory: 'FINE_DINING',
    source: 'IMPORTED',
    priority: 'CRITICAL',
    languages: 'English, Hindi, Marathi',
    notes: 'Fictional Pune pilot sandbox lead: Premium Indian royal fine dining at Amanora.',
  },
  {
    rowNumber: 4,
    name: 'Desk & Drip Co-Working Cafe [Sandbox]',
    organisationName: 'Desk & Drip Hospitality Pvt Ltd',
    jobTitle: 'General Manager',
    email: 'hello@deskanddrip.sandbox.lavivenzia.internal',
    phone: '+91 98220 00003',
    websiteUrl: 'https://sandbox.lavivenzia.internal/desk-drip',
    instagramHandle: 'deskanddrip_pune',
    location: 'East Block, Amanora Mall, Pune',
    pilotZone: 'AMANORA_MALL',
    category: 'BUSINESS_PARTNER',
    subcategory: 'WORK_CAFE',
    source: 'IMPORTED',
    priority: 'MEDIUM',
    languages: 'English, Hindi',
    notes: 'Fictional Pune pilot sandbox lead: High-speed fiber work cafe with artisanal espresso.',
  },

  // -------------------------------------------------------------------------
  // Zone 2: SEASONS MALL (3 venues)
  // -------------------------------------------------------------------------
  {
    rowNumber: 5,
    name: 'Velocity VR Arena [Sandbox]',
    organisationName: 'Velocity Gaming India',
    jobTitle: 'Venue Director',
    email: 'play@velocityvr.sandbox.lavivenzia.internal',
    phone: '+91 98220 00004',
    websiteUrl: 'https://sandbox.lavivenzia.internal/velocity-vr',
    instagramHandle: 'velocityvr_pune',
    location: 'Seasons Mall, Magarpatta Road, Pune',
    pilotZone: 'SEASONS_MALL',
    category: 'BUSINESS_PARTNER',
    subcategory: 'ARCADE',
    source: 'IMPORTED',
    priority: 'HIGH',
    languages: 'English, Hindi',
    notes: 'Fictional Pune pilot sandbox lead: Immersive multiplayer virtual reality sim center.',
  },
  {
    rowNumber: 6,
    name: 'Nirvana Ananda Luxury Spa [Sandbox]',
    organisationName: 'Nirvana Wellness Collective',
    jobTitle: 'Spa Director',
    email: 'concierge@nirvanaananda.sandbox.lavivenzia.internal',
    phone: '+91 98220 00005',
    websiteUrl: 'https://sandbox.lavivenzia.internal/nirvana-ananda',
    instagramHandle: 'nirvanaananda_spa',
    location: 'Seasons Mall Level 3, Pune',
    pilotZone: 'SEASONS_MALL',
    category: 'BUSINESS_PARTNER',
    subcategory: 'LUXURY_SPA',
    source: 'IMPORTED',
    priority: 'CRITICAL',
    languages: 'English, Hindi, Marathi',
    notes: 'Fictional Pune pilot sandbox lead: Holistic wellness treatments & hydrotherapy suites.',
  },
  {
    rowNumber: 7,
    name: 'The Seasons Executive Suites [Sandbox]',
    organisationName: 'Seasons Hospitality Group',
    jobTitle: 'Property Host',
    email: 'stay@seasonssuites.sandbox.lavivenzia.internal',
    phone: '+91 98220 00006',
    websiteUrl: 'https://sandbox.lavivenzia.internal/seasons-suites',
    instagramHandle: 'seasons_suites_pune',
    location: 'Seasons Mall Complex, Pune',
    pilotZone: 'SEASONS_MALL',
    category: 'STAY',
    subcategory: 'BOUTIQUE_STAY',
    source: 'IMPORTED',
    priority: 'HIGH',
    languages: 'English, Hindi',
    notes: 'Fictional Pune pilot sandbox lead: Curated boutique apartment stay for traveling founders.',
  },

  // -------------------------------------------------------------------------
  // Zone 3: MAGARPATTA CITY (3 venues)
  // -------------------------------------------------------------------------
  {
    rowNumber: 8,
    name: 'The Hoppy Fox Craft Brewery [Sandbox]',
    organisationName: 'Hoppy Fox Brewing Co',
    jobTitle: 'Master Brewer',
    email: 'taproom@hoppyfox.sandbox.lavivenzia.internal',
    phone: '+91 98220 00007',
    websiteUrl: 'https://sandbox.lavivenzia.internal/hoppy-fox',
    instagramHandle: 'hoppyfox_brewery',
    location: 'Cybercity, Magarpatta City, Pune',
    pilotZone: 'MAGARPATTA_CITY',
    category: 'BUSINESS_PARTNER',
    subcategory: 'BREWERY',
    source: 'IMPORTED',
    priority: 'CRITICAL',
    languages: 'English, Hindi, Marathi',
    notes: 'Fictional Pune pilot sandbox lead: Microbrewery featuring 8 seasonal craft beers on tap.',
  },
  {
    rowNumber: 9,
    name: 'Roasted Bean Work Cafe [Sandbox]',
    organisationName: 'Roasted Bean Roasters',
    jobTitle: 'Cafe Manager',
    email: 'brew@roastedbean.sandbox.lavivenzia.internal',
    phone: '+91 98220 00008',
    websiteUrl: 'https://sandbox.lavivenzia.internal/roasted-bean',
    instagramHandle: 'roastedbean_magarpatta',
    location: 'Tower 7 Commercial Plaza, Magarpatta City, Pune',
    pilotZone: 'MAGARPATTA_CITY',
    category: 'BUSINESS_PARTNER',
    subcategory: 'WORK_CAFE',
    source: 'IMPORTED',
    priority: 'MEDIUM',
    languages: 'English, Hindi',
    notes: 'Fictional Pune pilot sandbox lead: Specialty pour-overs with ergonomic collaborative desks.',
  },
  {
    rowNumber: 10,
    name: 'Château Pune Heritage Dining [Sandbox]',
    organisationName: 'Château Hospitality Pvt Ltd',
    jobTitle: "Maitre d'Hotel",
    email: 'curator@chateaupune.sandbox.lavivenzia.internal',
    phone: '+91 98220 00009',
    websiteUrl: 'https://sandbox.lavivenzia.internal/chateau-pune',
    instagramHandle: 'chateau_pune',
    location: 'Heritage Enclave, Magarpatta City, Pune',
    pilotZone: 'MAGARPATTA_CITY',
    category: 'BUSINESS_PARTNER',
    subcategory: 'FINE_DINING',
    source: 'IMPORTED',
    priority: 'HIGH',
    languages: 'English, Hindi, French',
    notes: 'Fictional Pune pilot sandbox lead: Indo-French fusion tasting menu and sommelier cellar.',
  },

  // -------------------------------------------------------------------------
  // Zone 4: HADAPSAR (3 venues)
  // -------------------------------------------------------------------------
  {
    rowNumber: 11,
    name: 'Hadapsar Taproom & Social [Sandbox]',
    organisationName: 'Eastern Pune Nightlife Ventures',
    jobTitle: 'Operations Partner',
    email: 'social@hadapsartaproom.sandbox.lavivenzia.internal',
    phone: '+91 98220 00010',
    websiteUrl: 'https://sandbox.lavivenzia.internal/hadapsar-taproom',
    instagramHandle: 'hadapsar_taproom',
    location: 'Hadapsar Main Road, Pune',
    pilotZone: 'HADAPSAR',
    category: 'BUSINESS_PARTNER',
    subcategory: 'BAR_LOUNGE',
    source: 'IMPORTED',
    priority: 'HIGH',
    languages: 'English, Hindi, Marathi',
    notes: 'Fictional Pune pilot sandbox lead: Rooftop craft cocktail and live acoustic music lounge.',
  },
  {
    rowNumber: 12,
    name: 'Aura Wellness & Spa Sanctuary [Sandbox]',
    organisationName: 'Aura Sanctuaries India',
    jobTitle: 'Lead Therapist',
    email: 'care@aurasanctuary.sandbox.lavivenzia.internal',
    phone: '+91 98220 00011',
    websiteUrl: 'https://sandbox.lavivenzia.internal/aura-sanctuary',
    instagramHandle: 'aurasanctuary_pune',
    location: 'Near Gadital, Hadapsar, Pune',
    pilotZone: 'HADAPSAR',
    category: 'BUSINESS_PARTNER',
    subcategory: 'LUXURY_SPA',
    source: 'IMPORTED',
    priority: 'MEDIUM',
    languages: 'English, Hindi, Marathi',
    notes: 'Fictional Pune pilot sandbox lead: Ayurvedic stress relief and sound healing sanctuary.',
  },
  {
    rowNumber: 13,
    name: 'Hadapsar Heritage Courtyard [Sandbox]',
    organisationName: 'Courtyard Stays & Living',
    jobTitle: 'Proprietor',
    email: 'booking@hadapsarcourtyard.sandbox.lavivenzia.internal',
    phone: '+91 98220 00012',
    websiteUrl: 'https://sandbox.lavivenzia.internal/hadapsar-courtyard',
    instagramHandle: 'hadapsar_courtyard',
    location: 'Old Hadapsar Village, Pune',
    pilotZone: 'HADAPSAR',
    category: 'STAY',
    subcategory: 'HERITAGE_PROPERTY',
    source: 'IMPORTED',
    priority: 'LOW',
    languages: 'English, Hindi, Marathi',
    notes: 'Fictional Pune pilot sandbox lead: Restored Peshwa-era wada style residence.',
  },
] as const;

/**
 * Returns the 12 sandbox leads structured for the `/capture/import/commit` or
 * `/capture/import/validate` endpoints.
 */
export const punePilotSandboxRows = (): { rowNumber: number; fields: Record<string, string> }[] =>
  PUNE_PILOT_SANDBOX_RECORDS.map((record) => ({
    rowNumber: record.rowNumber,
    fields: {
      name: record.name,
      organisationName: record.organisationName,
      jobTitle: record.jobTitle,
      email: record.email,
      phone: record.phone,
      websiteUrl: record.websiteUrl,
      instagramHandle: record.instagramHandle,
      location: record.location,
      category: record.category,
      subcategory: record.subcategory,
      source: record.source,
      priority: record.priority,
      languages: record.languages,
      notes: record.notes,
    },
  }));

/**
 * Generates valid CSV text conforming to `IMPORT_TARGETS` headers.
 */
export const punePilotSandboxCsv = (): string => {
  const headers = [
    'Name',
    'Organisation',
    'Role',
    'Email',
    'Phone',
    'Website',
    'Instagram',
    'Location',
    'Category',
    'Subcategory',
    'Source',
    'Priority',
    'Languages',
    'Notes',
  ];

  const escapeCsv = (value: string): string =>
    value.includes(',') || value.includes('"') || value.includes('\n')
      ? `"${value.replace(/"/g, '""')}"`
      : value;

  const rows = PUNE_PILOT_SANDBOX_RECORDS.map((rec) =>
    [
      rec.name,
      rec.organisationName,
      rec.jobTitle,
      rec.email,
      rec.phone,
      rec.websiteUrl,
      rec.instagramHandle,
      rec.location,
      rec.category,
      rec.subcategory,
      rec.source,
      rec.priority,
      rec.languages,
      rec.notes,
    ]
      .map(escapeCsv)
      .join(','),
  );

  return `${headers.join(',')}\n${rows.join('\n')}\n`;
};
