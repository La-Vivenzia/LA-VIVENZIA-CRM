export type SendWhatsAppMessageParams = {
  to: string;
  text: string;
  apiUrl?: string;
  phoneNumberId?: string;
  accessToken?: string;
};

export type SendWhatsAppMessageResult =
  | {
      ok: true;
      messageId: string;
    }
  | {
      ok: false;
      error: string;
      status?: number;
    };

export const getWhatsAppConfig = () => {
  return {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
  };
};

export const sendWhatsAppMessage = async ({
  to,
  text,
  apiUrl,
  phoneNumberId,
  accessToken,
}: SendWhatsAppMessageParams): Promise<SendWhatsAppMessageResult> => {
  const config = getWhatsAppConfig();

  const cleanApiUrl = (
    apiUrl ||
    config.apiUrl ||
    'https://graph.facebook.com'
  ).replace(/\/+$/, '');
  const resolvedPhoneNumberId = phoneNumberId || config.phoneNumberId;
  const resolvedAccessToken = accessToken || config.accessToken;

  if (!resolvedPhoneNumberId) {
    return {
      ok: false,
      error: 'WHATSAPP_PHONE_NUMBER_ID is not configured.',
    };
  }

  if (!resolvedAccessToken) {
    return {
      ok: false,
      error: 'WHATSAPP_ACCESS_TOKEN is not configured.',
    };
  }

  // Avoid duplicating API version if WHATSAPP_API_URL already contains it (e.g. /v21.0)
  const endpoint = /\/v\d+(?:\.\d+)?$/i.test(cleanApiUrl)
    ? `${cleanApiUrl}/${resolvedPhoneNumberId}/messages`
    : `${cleanApiUrl}/v21.0/${resolvedPhoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: text,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolvedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string; code?: number };
    };

    if (!response.ok) {
      const errorMessage =
        data?.error?.message ||
        `WhatsApp API returned HTTP ${response.status}: ${response.statusText}`;

      return {
        ok: false,
        error: errorMessage,
        status: response.status,
      };
    }

    const messageId = data?.messages?.[0]?.id || 'unknown';

    return {
      ok: true,
      messageId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown network error';

    return {
      ok: false,
      error: `Failed to communicate with WhatsApp Cloud API: ${errorMessage}`,
    };
  }
};

export const buildAcknowledgmentText = ({
  senderName,
  zoneLabel,
  guestCount,
  cravings,
}: {
  senderName?: string | null;
  zoneLabel?: string | null;
  guestCount?: number | null;
  cravings?: string[];
}): string => {
  const greeting = senderName ? `Hi ${senderName}!` : 'Hello!';
  const details: string[] = [];

  if (zoneLabel) {
    details.push(`in ${zoneLabel}`);
  }

  if (guestCount) {
    details.push(`for ${guestCount} guests`);
  }

  if (cravings && cravings.length > 0) {
    details.push(`(${cravings.join(', ')})`);
  }

  const summary =
    details.length > 0 ? ` for an experience ${details.join(' ')}` : '';

  return `${greeting} Thank you for reaching out to La Vivenzia. We have received your inquiry${summary}. Our Experience team is reviewing your request and will get back to you shortly!`;
};
