import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type RoutePayload } from 'twenty-sdk/define';

import { whatsappWebhookHandler } from '../whatsapp-webhook.logic-function';
import * as createLeadService from '../services/create-whatsapp-lead';
import * as whatsAppClientService from '../services/whatsapp-client';
import { type MetaWhatsAppWebhookPayload } from '../utils/parse-whatsapp-message';

const buildWhatsAppRoutePayload = (
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    queryStringParameters?: Record<string, string>;
    rawBody?: string;
    body?: MetaWhatsAppWebhookPayload;
  } = {},
): RoutePayload<MetaWhatsAppWebhookPayload> => ({
  headers: options.headers ?? {},
  queryStringParameters: options.queryStringParameters ?? {},
  pathParameters: {},
  body: options.body ?? null,
  rawBody: options.rawBody,
  isBase64Encoded: false,
  requestContext: {
    http: {
      method: options.method ?? 'GET',
      path: options.path ?? '/webhooks/server/e3e5b3c2-19e4-4d87-8bc1-12c82305a411',
    },
  },
  userWorkspaceId: null,
  workspaceMemberId: null,
});

describe('whatsapp-webhook.logic-function', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('GET verification (Meta subscription handshake)', () => {
    it('returns challenge with HTTP 200 when verify token matches', async () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'my_secure_verify_token_123';

      const payload = buildWhatsAppRoutePayload({
        method: 'GET',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'my_secure_verify_token_123',
          'hub.challenge': 'CHALLENGE_CODE_98765',
        },
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(200);
      expect(response.body).toBe('CHALLENGE_CODE_98765');
      expect(response.headers?.['content-type']).toBe('text/plain');
    });

    it('returns HTTP 403 when verify token does not match', async () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'my_secure_verify_token_123';

      const payload = buildWhatsAppRoutePayload({
        method: 'GET',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'WRONG_TOKEN',
          'hub.challenge': 'CHALLENGE_CODE_98765',
        },
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(403);
      expect(response.body).toBe('Forbidden');
    });

    it('returns HTTP 403 when hub.mode is not subscribe', async () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'my_secure_verify_token_123';

      const payload = buildWhatsAppRoutePayload({
        method: 'GET',
        queryStringParameters: {
          'hub.mode': 'other_mode',
          'hub.verify_token': 'my_secure_verify_token_123',
          'hub.challenge': 'CHALLENGE_CODE_98765',
        },
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(403);
    });

    it('returns HTTP 500 when WHATSAPP_VERIFY_TOKEN is not configured', async () => {
      delete process.env.WHATSAPP_VERIFY_TOKEN;

      const payload = buildWhatsAppRoutePayload({
        method: 'GET',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test',
          'hub.challenge': '1234',
        },
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(500);
      expect(response.body).toContain('WHATSAPP_VERIFY_TOKEN is not configured');
    });
  });

  describe('POST webhook event processing', () => {
    const secret = 'app_secret_abc123';

    it('returns HTTP 500 when WHATSAPP_APP_SECRET is not configured', async () => {
      delete process.env.WHATSAPP_APP_SECRET;

      const payload = buildWhatsAppRoutePayload({
        method: 'POST',
        rawBody: '{}',
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(500);
      const parsedBody = JSON.parse(response.body as string);

      expect(parsedBody.error).toContain('WHATSAPP_APP_SECRET is not configured');
    });

    it('returns HTTP 401 when signature is invalid or missing', async () => {
      process.env.WHATSAPP_APP_SECRET = secret;

      const payload = buildWhatsAppRoutePayload({
        method: 'POST',
        rawBody: '{"hello":"world"}',
        headers: {
          'x-hub-signature-256': 'sha256=invalidhex',
        },
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(401);
      const parsedBody = JSON.parse(response.body as string);

      expect(parsedBody.error).toBe('Invalid signature');
    });

    it('verifies signature, creates CRM lead and sends acknowledgment', async () => {
      process.env.WHATSAPP_APP_SECRET = secret;

      const webhookData: MetaWhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BIZ_ACCOUNT_1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  contacts: [
                    {
                      profile: { name: 'Pooja Nair' },
                      wa_id: '919876543210',
                    },
                  ],
                  messages: [
                    {
                      id: 'wamid.TESTMESSAGE123',
                      from: '919876543210',
                      timestamp: '1730000000',
                      type: 'text',
                      text: {
                        body: 'Looking for dining in Seasons Mall for 2 pax, budget 3000',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(webhookData);
      const signature = `sha256=${createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex')}`;

      const createLeadSpy = vi
        .spyOn(createLeadService, 'createWhatsAppLead')
        .mockResolvedValueOnce({
          ok: true,
          leadId: 'new-lead-id-123',
          lvLeadId: 'LV-000099',
          replayed: false,
        });

      const sendMessageSpy = vi
        .spyOn(whatsAppClientService, 'sendWhatsAppMessage')
        .mockResolvedValueOnce({
          ok: true,
          messageId: 'wamid.ACK123',
        });

      const payload = buildWhatsAppRoutePayload({
        method: 'POST',
        headers: {
          'x-hub-signature-256': signature,
        },
        rawBody,
        body: webhookData,
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);

      expect(body.success).toBe(true);
      expect(body.processedCount).toBe(1);
      expect(body.results[0]).toMatchObject({
        wamid: 'wamid.TESTMESSAGE123',
        leadId: 'new-lead-id-123',
        leadOk: true,
        ackSent: true,
      });

      expect(createLeadSpy).toHaveBeenCalledTimes(1);
      expect(createLeadSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          parsedMessage: expect.objectContaining({
            wamid: 'wamid.TESTMESSAGE123',
            fromPhone: '919876543210',
            senderName: 'Pooja Nair',
            zone: 'SEASONS_MALL',
            guestCount: 2,
            budget: 3000,
            cravings: ['Dining'],
          }),
        }),
      );

      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '919876543210',
          text: expect.stringContaining('Pooja Nair'),
        }),
      );
    });

    it('handles empty entries or status-only events without errors', async () => {
      process.env.WHATSAPP_APP_SECRET = secret;

      const emptyData = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BIZ_ACCOUNT_1',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [{ id: 'wamid.STATUS123', status: 'delivered' }],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(emptyData);
      const signature = `sha256=${createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex')}`;

      const payload = buildWhatsAppRoutePayload({
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        rawBody,
        body: emptyData,
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);

      expect(body.success).toBe(true);
      expect(body.processedCount).toBe(0);
      expect(body.results).toEqual([]);
    });

    it('handles malformed JSON rawBody safely', async () => {
      process.env.WHATSAPP_APP_SECRET = secret;

      const malformedRawBody = '{"not-valid-json';
      const signature = `sha256=${createHmac('sha256', secret)
        .update(malformedRawBody, 'utf8')
        .digest('hex')}`;

      const payload = buildWhatsAppRoutePayload({
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        rawBody: malformedRawBody,
        body: null as unknown as MetaWhatsAppWebhookPayload,
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);

      expect(body.success).toBe(true);
      expect(body.processedCount).toBe(0);
      expect(body.results).toEqual([]);
    });

    it('handles duplicate / replayed messages idempotently', async () => {
      process.env.WHATSAPP_APP_SECRET = secret;

      const webhookData: MetaWhatsAppWebhookPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.DUPLICATE123',
                      from: '919876543210',
                      type: 'text',
                      text: { body: 'Inquiry again' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(webhookData);
      const signature = `sha256=${createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex')}`;

      vi.spyOn(createLeadService, 'createWhatsAppLead').mockResolvedValueOnce({
        ok: true,
        leadId: 'existing-lead-id',
        lvLeadId: 'LV-000042',
        replayed: true,
      });

      vi.spyOn(whatsAppClientService, 'sendWhatsAppMessage').mockResolvedValueOnce({
        ok: true,
        messageId: 'wamid.ACK_REPLAY',
      });

      const payload = buildWhatsAppRoutePayload({
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        rawBody,
        body: webhookData,
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);

      expect(body.success).toBe(true);
      expect(body.results[0]).toMatchObject({
        wamid: 'wamid.DUPLICATE123',
        leadId: 'existing-lead-id',
        leadOk: true,
        replayed: true,
        ackSent: true,
      });
    });

    it('records CRM failure without falsely claiming lead persistence succeeded', async () => {
      process.env.WHATSAPP_APP_SECRET = secret;

      const webhookData: MetaWhatsAppWebhookPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.CRMFAIL123',
                      from: '919876543210',
                      type: 'text',
                      text: { body: 'Hi' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(webhookData);
      const signature = `sha256=${createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex')}`;

      vi.spyOn(createLeadService, 'createWhatsAppLead').mockResolvedValueOnce({
        ok: false,
        error: 'Database connection failed',
      });

      vi.spyOn(whatsAppClientService, 'sendWhatsAppMessage').mockResolvedValueOnce({
        ok: true,
        messageId: 'wamid.ACK123',
      });

      const payload = buildWhatsAppRoutePayload({
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        rawBody,
        body: webhookData,
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);

      expect(body.success).toBe(true);
      expect(body.results[0].leadId).toBeUndefined();
      expect(body.results[0].leadOk).toBe(false);
      expect(body.results[0].error).toBe('Database connection failed');
      expect(body.results[0].wamid).toBe('wamid.CRMFAIL123');
    });

    it('handles acknowledgment failure safely while preserving successful lead creation', async () => {
      process.env.WHATSAPP_APP_SECRET = secret;

      const webhookData: MetaWhatsAppWebhookPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid.ACKFAIL123',
                      from: '919876543210',
                      type: 'text',
                      text: { body: 'Party in Amanora' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(webhookData);
      const signature = `sha256=${createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex')}`;

      vi.spyOn(createLeadService, 'createWhatsAppLead').mockResolvedValueOnce({
        ok: true,
        leadId: 'lead-persisted-456',
        lvLeadId: 'LV-000088',
        replayed: false,
      });

      vi.spyOn(whatsAppClientService, 'sendWhatsAppMessage').mockResolvedValueOnce({
        ok: false,
        error: 'Rate limit exceeded on WhatsApp Cloud API',
      });

      const payload = buildWhatsAppRoutePayload({
        method: 'POST',
        headers: { 'x-hub-signature-256': signature },
        rawBody,
        body: webhookData,
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(200);
      const body = JSON.parse(response.body as string);

      expect(body.success).toBe(true);
      expect(body.results[0]).toMatchObject({
        wamid: 'wamid.ACKFAIL123',
        leadId: 'lead-persisted-456',
        leadOk: true,
        ackSent: false,
        error: 'Rate limit exceeded on WhatsApp Cloud API',
      });
    });
  });

  describe('unsupported HTTP method', () => {
    it('returns HTTP 405 Method Not Allowed', async () => {
      const payload = buildWhatsAppRoutePayload({
        method: 'DELETE',
      });

      const response = await whatsappWebhookHandler(payload);

      expect(response.status).toBe(405);
    });
  });
});
