import { describe, expect, it } from 'vitest';

import {
  parseBudget,
  parseCravings,
  parseDestinationCorridor,
  parseGuestCount,
  parseLocationInquiry,
  parseTripConfirmation,
  parseWhatsAppMessage,
  parseZone,
  type MetaWhatsAppWebhookPayload,
} from '../utils/parse-whatsapp-message';

describe('parseWhatsAppMessage & extractors', () => {
  describe('parseZone', () => {
    it('detects Amanora Mall', () => {
      expect(parseZone('Looking for an experience in Amanora Mall')).toEqual({
        zone: 'AMANORA_MALL',
        label: 'Amanora Mall',
      });
      expect(parseZone('Somewhere in amanora please')).toEqual({
        zone: 'AMANORA_MALL',
        label: 'Amanora Mall',
      });
    });

    it('detects Seasons Mall', () => {
      expect(parseZone('We want to visit Seasons Mall Pune')).toEqual({
        zone: 'SEASONS_MALL',
        label: 'Seasons Mall',
      });
      expect(parseZone('seasons area')).toEqual({
        zone: 'SEASONS_MALL',
        label: 'Seasons Mall',
      });
    });

    it('detects Magarpatta City', () => {
      expect(parseZone('Any spots in Magarpatta City?')).toEqual({
        zone: 'MAGARPATTA_CITY',
        label: 'Magarpatta City',
      });
      expect(parseZone('Magarpatta near cybercity')).toEqual({
        zone: 'MAGARPATTA_CITY',
        label: 'Magarpatta City',
      });
    });

    it('detects Hadapsar', () => {
      expect(parseZone('Any recommendations in Hadapsar?')).toEqual({
        zone: 'HADAPSAR',
        label: 'Hadapsar',
      });
      expect(parseZone('Hadapsar Pune')).toEqual({
        zone: 'HADAPSAR',
        label: 'Hadapsar',
      });
    });

    it('detects Viman Nagar', () => {
      expect(parseZone('Looking for venues in Viman Nagar')).toEqual({
        zone: 'VIMAN_NAGAR',
        label: 'Viman Nagar',
      });
      expect(parseZone('viman area spots')).toEqual({
        zone: 'VIMAN_NAGAR',
        label: 'Viman Nagar',
      });
    });

    it('returns null for unknown zones', () => {
      expect(parseZone('Looking for something in Koregaon Park')).toEqual({
        zone: null,
        label: null,
      });
    });
  });

  describe('parseGuestCount', () => {
    it('detects "N guests"', () => {
      expect(parseGuestCount('Booking for 4 guests this Saturday')).toBe(4);
    });

    it('detects "N pax"', () => {
      expect(parseGuestCount('Table for 2 pax')).toBe(2);
    });

    it('detects "party of N"', () => {
      expect(parseGuestCount('We are a party of 8')).toBe(8);
    });

    it('detects "for N people"', () => {
      expect(parseGuestCount('Need reservation for 10 people')).toBe(10);
    });

    it('detects "for N"', () => {
      expect(parseGuestCount('Looking for dinner for 6')).toBe(6);
    });

    it('returns null when no guest count is mentioned', () => {
      expect(parseGuestCount('What are the best places to visit?')).toBeNull();
    });
  });

  describe('parseBudget', () => {
    it('detects budget with ₹ symbol', () => {
      expect(parseBudget('Our budget is ₹15,000')).toEqual({
        amount: 15000,
        formatted: '₹15,000',
      });
    });

    it('detects budget with INR / Rs', () => {
      expect(parseBudget('Approx 5000 inr')).toEqual({
        amount: 5000,
        formatted: '₹5,000',
      });
      expect(parseBudget('Rs. 2500 max')).toEqual({
        amount: 2500,
        formatted: '₹2,500',
      });
    });

    it('detects shorthand "k"', () => {
      expect(parseBudget('Budget around 10k')).toEqual({
        amount: 10000,
        formatted: '₹10,000',
      });
      expect(parseBudget('₹20k for the party')).toEqual({
        amount: 20000,
        formatted: '₹20,000',
      });
    });

    it('detects shorthand "lakh" / "lac"', () => {
      expect(parseBudget('Budget is 1 lakh')).toEqual({
        amount: 100000,
        formatted: '₹1,00,000',
      });
    });

    it('returns null when no budget is mentioned', () => {
      expect(parseBudget('Looking for recommendations')).toEqual({
        amount: null,
        formatted: null,
      });
    });
  });

  describe('parseCravings', () => {
    it('detects Nightlife', () => {
      expect(parseCravings('Want clubbing and drinks tonight')).toContain(
        'Nightlife',
      );
      expect(parseCravings('best pub in the area')).toContain('Nightlife');
    });

    it('detects Dining', () => {
      expect(parseCravings('Looking for a nice dinner restaurant')).toContain(
        'Dining',
      );
      expect(parseCravings('brunch food places')).toContain('Dining');
    });

    it('detects Gaming', () => {
      expect(parseCravings('Arcade and bowling places')).toContain('Gaming');
      expect(parseCravings('VR games for friends')).toContain('Gaming');
    });

    it('detects Spa', () => {
      expect(parseCravings('Relaxing massage and spa')).toContain('Spa');
      expect(parseCravings('wellness sauna therapy')).toContain('Spa');
    });

    it('detects Beer and Breweries', () => {
      expect(parseCravings('Looking for craft beer and microbrewery')).toContain(
        'Beer',
      );
      expect(parseCravings('draught beers in Hadapsar')).toContain('Beer');
    });

    it('detects Rooftop Dining', () => {
      expect(parseCravings('Best rooftop restaurant in Viman Nagar')).toContain(
        'Rooftop Dining',
      );
      expect(parseCravings('open air sky dining with view')).toContain(
        'Rooftop Dining',
      );
    });

    it('detects multiple cravings in a single message', () => {
      const result = parseCravings(
        'Want to start with gaming and arcade, then dinner and finally a club for nightlife',
      );

      expect(result).toEqual(
        expect.arrayContaining(['Gaming', 'Dining', 'Nightlife']),
      );
    });

    it('returns empty array when none match', () => {
      expect(parseCravings('Hello how are you')).toEqual([]);
    });
  });

  describe('parseWhatsAppMessage (end-to-end)', () => {
    it('extracts all attributes from Meta webhook payload', () => {
      const payload: MetaWhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BIZ_123',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  contacts: [
                    {
                      profile: { name: 'Aarav Sharma' },
                      wa_id: '919876543210',
                    },
                  ],
                  messages: [
                    {
                      id: 'wamid.HBgLMTAwMjM0NTY3OA==',
                      from: '919876543210',
                      timestamp: '1730000000',
                      type: 'text',
                      text: {
                        body: 'Hi! Looking for dinner and nightlife in Amanora Mall for 4 guests with budget ₹10,000.',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const parsed = parseWhatsAppMessage(payload);

      expect(parsed).toHaveLength(1);
      const msg = parsed[0];

      expect(msg.wamid).toBe('wamid.HBgLMTAwMjM0NTY3OA==');
      expect(msg.fromPhone).toBe('919876543210');
      expect(msg.senderName).toBe('Aarav Sharma');
      expect(msg.zone).toBe('AMANORA_MALL');
      expect(msg.zoneLabel).toBe('Amanora Mall');
      expect(msg.guestCount).toBe(4);
      expect(msg.budget).toBe(10000);
      expect(msg.budgetFormatted).toBe('₹10,000');
      expect(msg.cravings).toEqual(
        expect.arrayContaining(['Dining', 'Nightlife']),
      );
    });

    it('handles payload with empty messages gracefully', () => {
      const payload: MetaWhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [],
      };

      expect(parseWhatsAppMessage(payload)).toEqual([]);
    });

    it('skips reaction messages and messages without text content', () => {
      const payload: MetaWhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.REACTION_1',
                      from: '919876543210',
                      type: 'reaction',
                    },
                    {
                      id: 'wamid.EMPTY_1',
                      from: '919876543210',
                      type: 'text',
                      text: { body: '   ' },
                    },
                    {
                      id: 'wamid.STICKER_1',
                      from: '919876543210',
                      type: 'sticker',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      expect(parseWhatsAppMessage(payload)).toEqual([]);
    });

    it('extracts caption from image messages if text body is absent', () => {
      const payload: MetaWhatsAppWebhookPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.IMG_1',
                      from: '919876543210',
                      type: 'image',
                      image: { caption: 'Dinner at Seasons Mall for 3 people' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = parseWhatsAppMessage(payload);

      expect(result).toHaveLength(1);
      expect(result[0].zone).toBe('SEASONS_MALL');
      expect(result[0].guestCount).toBe(3);
    });

    it('parses TripArchitectView trip confirmation deep-link payload', () => {
      const tripMessage = [
        '*La Vivenzia Curated Trip Concierge* 🛎️',
        '',
        'Trip: Pune Sunset & Craft Brewery Trail',
        'Reference: LV-TRIP-9901',
        'Party Size: 5 travellers',
        'Region: Eastern Pune',
        '',
        "Hi Butler! I've confirmed my trip. Please activate live concierge updates, route guidance, and dynamic recommendations for my group.",
      ].join('\n');

      const payload: MetaWhatsAppWebhookPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  contacts: [{ profile: { name: 'Vikram Malhotra' }, wa_id: '919988776655' }],
                  messages: [
                    {
                      id: 'wamid.TRIP_BUTLER_001',
                      from: '919988776655',
                      type: 'text',
                      text: { body: tripMessage },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = parseWhatsAppMessage(payload);

      expect(result).toHaveLength(1);
      const parsed = result[0];
      expect(parsed.isTripConfirmation).toBe(true);
      expect(parsed.tripTitle).toBe('Pune Sunset & Craft Brewery Trail');
      expect(parsed.bookingReference).toBe('LV-TRIP-9901');
      expect(parsed.guestCount).toBe(5);
      expect(parsed.tripRegion).toBe('Eastern Pune');
      expect(parsed.isLocationInquiry).toBe(true);
    });
  });

  describe('parseDestinationCorridor', () => {
    it('derives destination and pilot corridor from zone', () => {
      const { destination, corridor } = parseDestinationCorridor(
        'Planning an outing in Hadapsar',
        'HADAPSAR',
      );

      expect(destination).toBe('Hadapsar, Pune');
      expect(corridor).toBe('Pune East Pilot Corridor');
    });

    it('identifies Pune East corridor when explicitly mentioned in text', () => {
      const { corridor } = parseDestinationCorridor(
        'We are touring Eastern Pune',
        null,
      );

      expect(corridor).toBe('Pune East Pilot Corridor');
    });
  });

  describe('parseTripConfirmation', () => {
    it('extracts trip title, booking reference, and party size accurately', () => {
      const text = [
        '*La Vivenzia Curated Trip Concierge* 🛎️',
        'Trip: Viman Nagar Rooftop & Luxury Spa Escape',
        'Reference: LV-BOOK-2026-X',
        'Party Size: 4 travellers',
        'Region: Viman Nagar, Pune',
        "Hi Butler! I've confirmed my trip.",
      ].join('\n');

      const details = parseTripConfirmation(text);

      expect(details.isTripConfirmation).toBe(true);
      expect(details.tripTitle).toBe('Viman Nagar Rooftop & Luxury Spa Escape');
      expect(details.bookingReference).toBe('LV-BOOK-2026-X');
      expect(details.partySize).toBe(4);
      expect(details.region).toBe('Viman Nagar, Pune');
    });

    it('returns isTripConfirmation false for standard non-trip inquiries', () => {
      const text = 'Hi, what are the best clubs in Amanora for 2 people?';
      const details = parseTripConfirmation(text);

      expect(details.isTripConfirmation).toBe(false);
      expect(details.tripTitle).toBeNull();
      expect(details.bookingReference).toBeNull();
    });
  });

  describe('parseLocationInquiry', () => {
    it('detects recommendation and route guidance inquiries', () => {
      expect(parseLocationInquiry('Can you recommend places nearby?')).toBe(true);
      expect(parseLocationInquiry('Where to go near Amanora?')).toBe(true);
      expect(parseLocationInquiry('Send route guidance and live updates')).toBe(true);
      expect(parseLocationInquiry('Just checking in, hello!')).toBe(false);
    });
  });
});
