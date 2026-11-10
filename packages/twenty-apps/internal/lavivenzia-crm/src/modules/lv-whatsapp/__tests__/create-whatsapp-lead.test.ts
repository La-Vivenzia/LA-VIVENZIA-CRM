import { describe, expect, it, vi } from 'vitest';
import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  createWhatsAppLead,
  formatWhatsAppLeadNotes,
} from '../services/create-whatsapp-lead';
import { type ParsedWhatsAppMessage } from '../utils/parse-whatsapp-message';

describe('createWhatsAppLead', () => {
  const sampleMessage: ParsedWhatsAppMessage = {
    wamid: 'wamid.HBgL1234567890',
    fromPhone: '919876543210',
    senderName: 'Ishaan Verma',
    timestamp: '1730000000',
    rawText: 'Looking for 4 guests in Amanora Mall with budget 10000 for nightlife',
    zone: 'AMANORA_MALL',
    zoneLabel: 'Amanora Mall',
    destination: 'Amanora Mall, Pune',
    destinationCorridor: 'Pune East Pilot Corridor',
    guestCount: 4,
    budget: 10000,
    budgetFormatted: '₹10,000',
    cravings: ['Nightlife'],
  };

  describe('formatWhatsAppLeadNotes', () => {
    it('formats a readable markdown note with parsed fields', () => {
      const notes = formatWhatsAppLeadNotes(sampleMessage);

      expect(notes).toContain('Inbound WhatsApp Inquiry:');
      expect(notes).toContain('• Zone: Amanora Mall');
      expect(notes).toContain('• Guest count: 4');
      expect(notes).toContain('• Budget: ₹10,000');
      expect(notes).toContain('• Cravings: Nightlife');
      expect(notes).toContain(sampleMessage.rawText);
    });
  });

  describe('createWhatsAppLead workflow', () => {
    it('returns existing lead if captureKey already exists (idempotency)', async () => {
      const mockApplicationClient = {
        query: vi.fn().mockResolvedValue({
          lvLeads: {
            edges: [
              {
                node: {
                  id: 'existing-lead-uuid',
                  lvLeadId: 'LV-000042',
                  ownerId: 'member-1',
                },
              },
            ],
          },
        }),
        mutation: vi.fn(),
      } as unknown as CoreApiClient;

      const result = await createWhatsAppLead({
        parsedMessage: sampleMessage,
        applicationClient: mockApplicationClient,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.replayed).toBe(true);
        expect(result.leadId).toBe('existing-lead-uuid');
        expect(result.lvLeadId).toBe('LV-000042');
      }

      expect(mockApplicationClient.mutation).not.toHaveBeenCalled();
    });

    it('creates a new lead when none exists with captureKey', async () => {
      const mockApplicationClient = {
        query: vi.fn().mockResolvedValue({
          lvLeads: {
            edges: [],
          },
        }),
        mutation: vi.fn().mockImplementation((args: Record<string, unknown>) => {
          if ('createLvLead' in args) {
            return Promise.resolve({
              createLvLead: { id: 'new-lead-uuid-123' },
            });
          }
          if ('createNote' in args) {
            return Promise.resolve({
              createNote: { id: 'note-uuid-456' },
            });
          }
          if ('createNoteTarget' in args) {
            return Promise.resolve({
              createNoteTarget: { id: 'target-uuid-789' },
            });
          }
          if ('createAuditEvent' in args) {
            return Promise.resolve({
              createAuditEvent: { id: 'audit-uuid-999' },
            });
          }
          return Promise.resolve({});
        }),
      } as unknown as CoreApiClient;

      const result = await createWhatsAppLead({
        parsedMessage: sampleMessage,
        applicationClient: mockApplicationClient,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.replayed).toBe(false);
        expect(result.leadId).toBe('new-lead-uuid-123');
      }

      // Check mutation was called for createLvLead with correct source and captureKey
      expect(mockApplicationClient.mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          createLvLead: expect.objectContaining({
            __args: expect.objectContaining({
              data: expect.objectContaining({
                source: 'WHATSAPP',
                captureMode: 'API',
                pilotZone: 'AMANORA_MALL',
                captureKey: 'whatsapp:wamid.HBgL1234567890',
              }),
            }),
          }),
        }),
      );
    });

    it('handles lead creation mutation errors gracefully', async () => {
      const mockApplicationClient = {
        query: vi.fn().mockResolvedValue({
          lvLeads: {
            edges: [],
          },
        }),
        mutation: vi.fn().mockRejectedValue(new Error('Internal database error')),
      } as unknown as CoreApiClient;

      const result = await createWhatsAppLead({
        parsedMessage: sampleMessage,
        applicationClient: mockApplicationClient,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Failed to save lead in CRM');
        expect(result.detail).toContain('Internal database error');
      }
    });

    it('creates lead with Viman Nagar pilot zone and links or creates Person record', async () => {
      const vimanMessage: ParsedWhatsAppMessage = {
        wamid: 'wamid.VIMAN_MSG_001',
        fromPhone: '919876543999',
        senderName: 'Tanvi Deshmukh',
        timestamp: '1730005000',
        rawText: 'Looking for rooftop dining in Viman Nagar for 4 guests with budget 8000',
        zone: 'VIMAN_NAGAR',
        zoneLabel: 'Viman Nagar',
        destination: 'Viman Nagar, Pune',
        destinationCorridor: 'Pune East Pilot Corridor',
        guestCount: 4,
        budget: 8000,
        budgetFormatted: '₹8,000',
        cravings: ['Rooftop Dining'],
      };

      const mockApplicationClient = {
        query: vi.fn().mockImplementation((args: Record<string, unknown>) => {
          if ('lvLeads' in args) {
            return Promise.resolve({ lvLeads: { edges: [] } });
          }
          if ('people' in args) {
            return Promise.resolve({ people: { edges: [] } });
          }
          return Promise.resolve({});
        }),
        mutation: vi.fn().mockImplementation((args: Record<string, unknown>) => {
          if ('createLvLead' in args) {
            return Promise.resolve({
              createLvLead: { id: 'viman-lead-101' },
            });
          }
          if ('createPerson' in args) {
            return Promise.resolve({
              createPerson: { id: 'person-tanvi-202' },
            });
          }
          return Promise.resolve({});
        }),
      } as unknown as CoreApiClient;

      const result = await createWhatsAppLead({
        parsedMessage: vimanMessage,
        applicationClient: mockApplicationClient,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.leadId).toBe('viman-lead-101');
        expect(result.personId).toBe('person-tanvi-202');
      }

      expect(mockApplicationClient.mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          createLvLead: expect.objectContaining({
            __args: expect.objectContaining({
              data: expect.objectContaining({
                source: 'WHATSAPP',
                pilotZone: 'VIMAN_NAGAR',
                location: 'Viman Nagar, Pune',
              }),
            }),
          }),
        }),
      );

      expect(mockApplicationClient.mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          createPerson: expect.objectContaining({
            __args: expect.objectContaining({
              data: expect.objectContaining({
                name: { firstName: 'Tanvi', lastName: 'Deshmukh' },
                phones: expect.objectContaining({
                  primaryPhoneNumber: '919876543999',
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('processes curated trip confirmation with high priority and butler notes', async () => {
      const tripMessage: ParsedWhatsAppMessage = {
        wamid: 'wamid.TRIP_CONFIRM_777',
        fromPhone: '919811223344',
        senderName: 'Aditya Roy',
        timestamp: '1730010000',
        rawText: 'Trip: Pune Sunset Trail\nReference: LV-REF-42\nParty Size: 6',
        zone: 'HADAPSAR',
        zoneLabel: 'Hadapsar',
        destination: 'Hadapsar, Pune',
        destinationCorridor: 'Pune East Pilot Corridor',
        guestCount: 6,
        budget: null,
        budgetFormatted: null,
        cravings: ['Beer'],
        isTripConfirmation: true,
        bookingReference: 'LV-REF-42',
        tripTitle: 'Pune Sunset Trail',
        tripRegion: 'Hadapsar',
      };

      const mockApplicationClient = {
        query: vi.fn().mockImplementation((args: Record<string, unknown>) => {
          if ('lvLeads' in args) {
            return Promise.resolve({ lvLeads: { edges: [] } });
          }
          if ('people' in args) {
            return Promise.resolve({
              people: { edges: [{ node: { id: 'existing-person-aditya' } }] },
            });
          }
          return Promise.resolve({});
        }),
        mutation: vi.fn().mockResolvedValue({
          createLvLead: { id: 'trip-lead-555' },
        }),
      } as unknown as CoreApiClient;

      const result = await createWhatsAppLead({
        parsedMessage: tripMessage,
        applicationClient: mockApplicationClient,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.leadId).toBe('trip-lead-555');
        expect(result.personId).toBe('existing-person-aditya');
      }

      expect(mockApplicationClient.mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          createLvLead: expect.objectContaining({
            __args: expect.objectContaining({
              data: expect.objectContaining({
                source: 'WHATSAPP',
                priority: 'HIGH',
                category: 'EXPERIENCE',
                subcategory: 'CURATOR',
                pilotZone: 'HADAPSAR',
              }),
            }),
          }),
        }),
      );
    });
  });
});
