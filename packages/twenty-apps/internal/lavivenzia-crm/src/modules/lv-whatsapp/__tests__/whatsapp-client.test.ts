import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAcknowledgmentText,
  buildConversationalIntakePrompt,
  sendWhatsAppMessage,
} from '../services/whatsapp-client';

describe('whatsapp-client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('buildAcknowledgmentText', () => {
    it('creates a personalized acknowledgment with full details', () => {
      const text = buildAcknowledgmentText({
        senderName: 'Rohan',
        zoneLabel: 'Amanora Mall',
        guestCount: 4,
        cravings: ['Dining', 'Nightlife'],
      });

      expect(text).toContain('Hi Rohan!');
      expect(text).toContain('in Amanora Mall');
      expect(text).toContain('for 4 guests');
      expect(text).toContain('(Dining, Nightlife)');
      expect(text).toContain('La Vivenzia');
    });

    it('creates a generic acknowledgment when sender details are minimal', () => {
      const text = buildAcknowledgmentText({});

      expect(text).toContain('Hello!');
      expect(text).toContain('Thank you for reaching out to La Vivenzia');
      expect(text).toContain('Our Experience team is reviewing your request');
    });

    it('creates a Curated Trip Butler activation acknowledgment for trip confirmations', () => {
      const text = buildAcknowledgmentText({
        senderName: 'Ananya',
        isTripConfirmation: true,
        tripTitle: 'East Pune Heritage & Craft Beer Trail',
        bookingReference: 'LV-CONFIRM-8821',
        guestCount: 6,
        tripRegion: 'Hadapsar, Pune',
      });

      expect(text).toContain('La Vivenzia Trip Concierge Activated!');
      expect(text).toContain('Hi Ananya!');
      expect(text).toContain('East Pune Heritage & Craft Beer Trail');
      expect(text).toContain('LV-CONFIRM-8821');
      expect(text).toContain('for your party of 6');
      expect(text).toContain('Hadapsar, Pune');
    });

    it('generates live location-aware recommendation alerts for inquiries in a zone', () => {
      const text = buildAcknowledgmentText({
        senderName: 'Karan',
        zoneLabel: 'Viman Nagar',
        isLocationInquiry: true,
        cravings: ['Rooftop Dining', 'Beer'],
      });

      expect(text).toContain('Live Location Recommendations — Viman Nagar');
      expect(text).toContain('Hi Karan!');
      expect(text).toContain('Rooftop Dining, Beer');
      expect(text).toContain('Route Butler: Seamless transit and priority reservations active');
    });

    it('generates conversational intake prompt when requested', () => {
      const text = buildAcknowledgmentText({
        senderName: 'Suresh',
        conversationalPrompt: true,
      });

      expect(text).toContain('Hi Suresh!');
      expect(text).toContain('feel free to share your preferred vibe');
      expect(text).toContain('Craft Beer, Rooftop Dining, Gaming, Spa');

      const standalone = buildConversationalIntakePrompt({ senderName: 'Priya' });
      expect(standalone).toContain('Hi Priya!');
      expect(standalone).toContain('Amanora Mall, Seasons Mall, Magarpatta City, Hadapsar, or Viman Nagar');
    });
  });

  describe('sendWhatsAppMessage', () => {
    it('returns error when phone number ID is missing', async () => {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';

      const result = await sendWhatsAppMessage({
        to: '919876543210',
        text: 'Hello',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('WHATSAPP_PHONE_NUMBER_ID is not configured');
      }
    });

    it('returns error when access token is missing', async () => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
      delete process.env.WHATSAPP_ACCESS_TOKEN;

      const result = await sendWhatsAppMessage({
        to: '919876543210',
        text: 'Hello',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('WHATSAPP_ACCESS_TOKEN is not configured');
      }
    });

    it('sends POST request to Meta Cloud API endpoint with valid headers and payload', async () => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'PHONE_123';
      process.env.WHATSAPP_ACCESS_TOKEN = 'ACCESS_TOKEN_XYZ';
      process.env.WHATSAPP_API_URL = 'https://graph.facebook.com';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messaging_product: 'whatsapp',
            contacts: [{ input: '919876543210', wa_id: '919876543210' }],
            messages: [{ id: 'wamid.HBgLTEST123' }],
          }),
          { status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const result = await sendWhatsAppMessage({
        to: '919876543210',
        text: 'Thank you for contacting us!',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, requestInit] = fetchSpy.mock.calls[0];

      expect(url).toBe('https://graph.facebook.com/v21.0/PHONE_123/messages');
      expect(requestInit?.method).toBe('POST');
      expect((requestInit?.headers as Record<string, string>)?.Authorization).toBe(
        'Bearer ACCESS_TOKEN_XYZ',
      );

      const body = JSON.parse(requestInit?.body as string);

      expect(body.messaging_product).toBe('whatsapp');
      expect(body.to).toBe('919876543210');
      expect(body.text.body).toBe('Thank you for contacting us!');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.messageId).toBe('wamid.HBgLTEST123');
      }
    });

    it('handles Meta API error response', async () => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'PHONE_123';
      process.env.WHATSAPP_ACCESS_TOKEN = 'BAD_TOKEN';

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'Invalid OAuth access token.',
              type: 'OAuthException',
              code: 190,
            },
          }),
          { status: 401, statusText: 'Unauthorized' },
        ),
      );

      const result = await sendWhatsAppMessage({
        to: '919876543210',
        text: 'Test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Invalid OAuth access token.');
        expect(result.status).toBe(401);
      }
    });

    it('handles network / fetch failure gracefully', async () => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'PHONE_123';
      process.env.WHATSAPP_ACCESS_TOKEN = 'TOKEN_123';

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network connection timeout'),
      );

      const result = await sendWhatsAppMessage({
        to: '919876543210',
        text: 'Test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Failed to communicate with WhatsApp Cloud API');
        expect(result.error).toContain('Network connection timeout');
      }
    });

    it('avoids duplicating /v21.0 when apiUrl already specifies a version or has trailing slashes', async () => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'PHONE_123';
      process.env.WHATSAPP_ACCESS_TOKEN = 'TOKEN_123';

      const mockResponse = new Response(
        JSON.stringify({ messages: [{ id: 'wamid.HBgLTEST999' }] }),
        { status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json' } },
      );

      const testCases = [
        {
          inputUrl: 'https://graph.facebook.com',
          expectedUrl: 'https://graph.facebook.com/v21.0/PHONE_123/messages',
        },
        {
          inputUrl: 'https://graph.facebook.com/',
          expectedUrl: 'https://graph.facebook.com/v21.0/PHONE_123/messages',
        },
        {
          inputUrl: 'https://graph.facebook.com/v21.0',
          expectedUrl: 'https://graph.facebook.com/v21.0/PHONE_123/messages',
        },
        {
          inputUrl: 'https://graph.facebook.com/v21.0/',
          expectedUrl: 'https://graph.facebook.com/v21.0/PHONE_123/messages',
        },
        {
          inputUrl: 'https://custom-gateway.corp/v1',
          expectedUrl: 'https://custom-gateway.corp/v1/PHONE_123/messages',
        },
      ];

      for (const { inputUrl, expectedUrl } of testCases) {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse.clone());

        await sendWhatsAppMessage({
          to: '919876543210',
          text: 'Testing URL',
          apiUrl: inputUrl,
        });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [calledUrl] = fetchSpy.mock.calls[0];

        expect(calledUrl).toBe(expectedUrl);
        vi.restoreAllMocks();
      }
    });
  });
});
