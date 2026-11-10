import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import { FN_WHATSAPP_WEBHOOK_ID } from 'src/constants/universal-identifiers';
import {
  type MetaWhatsAppWebhookPayload,
  parseWhatsAppMessage,
} from 'src/modules/lv-whatsapp/utils/parse-whatsapp-message';
import { verifyWhatsAppSignature } from 'src/modules/lv-whatsapp/utils/verify-whatsapp-signature';
import {
  buildAcknowledgmentText,
  sendWhatsAppMessage,
} from 'src/modules/lv-whatsapp/services/whatsapp-client';
import { createWhatsAppLead } from 'src/modules/lv-whatsapp/services/create-whatsapp-lead';

export const whatsappWebhookHandler = async (
  routePayload: RoutePayload<MetaWhatsAppWebhookPayload>,
): Promise<Response> => {
  const method = (
    routePayload.requestContext?.http?.method || 'GET'
  ).toUpperCase();

  // ---------------------------------------------------------------------------
  // 1. GET: Webhook verification challenge (Meta subscription handshake)
  // ---------------------------------------------------------------------------
  if (method === 'GET') {
    const query = routePayload.queryStringParameters ?? {};
    const mode = query['hub.mode'];
    const verifyToken = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!expectedToken || expectedToken.trim() === '') {
      return new Response('WHATSAPP_VERIFY_TOKEN is not configured', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
    }

    if (mode === 'subscribe' && verifyToken && verifyToken === expectedToken) {
      return new Response(challenge ?? '', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }

    return new Response('Forbidden', {
      status: 403,
      headers: { 'content-type': 'text/plain' },
    });
  }

  // ---------------------------------------------------------------------------
  // 2. POST: Inbound WhatsApp events (messages, status updates)
  // ---------------------------------------------------------------------------
  if (method === 'POST') {
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    if (!appSecret || appSecret.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'WHATSAPP_APP_SECRET is not configured' }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    // Signature header is passed via forwardedRequestHeaders as x-hub-signature-256
    const signatureHeader =
      routePayload.headers?.['x-hub-signature-256'] ??
      routePayload.headers?.['X-Hub-Signature-256'];

    const signatureCheck = verifyWhatsAppSignature({
      rawBody: routePayload.rawBody,
      signatureHeader,
      secret: appSecret,
    });

    if (!signatureCheck.valid) {
      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
          reason: signatureCheck.reason,
        }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    // Parse the webhook payload
    let payload = routePayload.body;

    if (!payload && routePayload.rawBody) {
      try {
        payload = JSON.parse(routePayload.rawBody) as MetaWhatsAppWebhookPayload;
      } catch {
        payload = {};
      }
    }

    const parsedMessages = parseWhatsAppMessage(payload ?? {});

    const processingResults: Array<{
      wamid: string;
      leadId?: string;
      lvLeadId?: string | null;
      personId?: string | null;
      leadOk: boolean;
      replayed?: boolean;
      ackSent: boolean;
      error?: string;
    }> = [];

    for (const parsedMessage of parsedMessages) {
      // 1. Create or retrieve lead in CRM
      const leadOutcome = await createWhatsAppLead({ parsedMessage });

      if (!leadOutcome.ok) {
        processingResults.push({
          wamid: parsedMessage.wamid,
          leadId: undefined,
          leadOk: false,
          replayed: undefined,
          ackSent: false,
          error: leadOutcome.error,
        });
        continue;
      }

      // If duplicate / replayed message, preserve existing lead and do not send duplicate acknowledgment
      if (leadOutcome.replayed) {
        processingResults.push({
          wamid: parsedMessage.wamid,
          leadId: leadOutcome.leadId,
          lvLeadId: leadOutcome.lvLeadId,
          personId: leadOutcome.personId,
          leadOk: true,
          replayed: true,
          ackSent: false,
        });
        continue;
      }

      // 2. Send acknowledgment back to user via WhatsApp Cloud API
      const ackText = buildAcknowledgmentText({
        senderName: parsedMessage.senderName,
        zoneLabel: parsedMessage.zoneLabel,
        guestCount: parsedMessage.guestCount,
        cravings: parsedMessage.cravings,
        isTripConfirmation: parsedMessage.isTripConfirmation,
        bookingReference: parsedMessage.bookingReference,
        tripTitle: parsedMessage.tripTitle,
        tripRegion: parsedMessage.tripRegion,
        isLocationInquiry: parsedMessage.isLocationInquiry,
      });

      const ackOutcome = await sendWhatsAppMessage({
        to: parsedMessage.fromPhone,
        text: ackText,
      });

      processingResults.push({
        wamid: parsedMessage.wamid,
        leadId: leadOutcome.leadId,
        lvLeadId: leadOutcome.lvLeadId,
        personId: leadOutcome.personId,
        leadOk: true,
        replayed: leadOutcome.replayed,
        ackSent: ackOutcome.ok,
        error: ackOutcome.ok ? undefined : ackOutcome.error,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedCount: parsedMessages.length,
        results: processingResults,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { 'content-type': 'text/plain' },
  });
};

export default defineLogicFunction({
  universalIdentifier: FN_WHATSAPP_WEBHOOK_ID,
  name: 'lv-whatsapp-webhook',
  description:
    'Meta WhatsApp Business Cloud API inbound webhook: handles subscription challenge and inbound messages with HMAC-SHA256 signature verification',
  timeoutSeconds: 30,
  handler: whatsappWebhookHandler,
  serverRouteTriggerSettings: {
    httpMethods: ['GET', 'POST'],
    forwardedRequestHeaders: ['x-hub-signature-256'],
  },
});
