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

export const buildConversationalIntakePrompt = ({
  senderName,
}: {
  senderName?: string | null;
} = {}): string => {
  const greeting = senderName ? `Hi ${senderName}!` : 'Hello!';

  return `${greeting} Welcome to La Vivenzia Experiences. To curate your perfect journey across Pune pilot hubs (Amanora Mall, Seasons Mall, Magarpatta City, Hadapsar, or Viman Nagar), could you share:\n1. Preferred zone or destination\n2. Number of guests\n3. Your vibe/cravings (e.g. Craft Beer, Rooftop Dining, Gaming, Luxury Spa)?`;
};

export const buildAcknowledgmentText = ({
  senderName,
  zoneLabel,
  guestCount,
  cravings,
  isTripConfirmation,
  bookingReference,
  tripTitle,
  tripRegion,
  isLocationInquiry,
  conversationalPrompt,
}: {
  senderName?: string | null;
  zoneLabel?: string | null;
  guestCount?: number | null;
  cravings?: string[];
  isTripConfirmation?: boolean;
  bookingReference?: string | null;
  tripTitle?: string | null;
  tripRegion?: string | null;
  isLocationInquiry?: boolean;
  conversationalPrompt?: boolean;
}): string => {
  const greeting = senderName ? `Hi ${senderName}!` : 'Hello!';

  if (isTripConfirmation) {
    const title = tripTitle || 'Curated Trip';
    const ref = bookingReference ? ` (Booking Ref: ${bookingReference})` : '';
    const party = guestCount ? ` for your party of ${guestCount}` : '';
    const area = tripRegion || zoneLabel || 'Pune';

    return `🛎️ *La Vivenzia Trip Concierge Activated!*\n\n${greeting} Your Trip Butler service for ${title}${ref} is now live. We have activated live journey updates, route guidance, and dynamic recommendations${party} in ${area}.\n\nNeed recommendations for dining, rooftop lounges, craft beer, spas, or gaming along your route? Just reply here anytime!`;
  }

  if (isLocationInquiry && zoneLabel) {
    const cravingStr =
      cravings && cravings.length > 0 ? cravings.join(', ') : 'Dining & Nightlife';

    return `📍 *Live Location Recommendations — ${zoneLabel}*\n\n${greeting} Here are your live curated recommendations in ${zoneLabel} for ${cravingStr}:\n• Top Pick: Premium Experience & Hospitality Hubs\n• Curated Vibe: Rooftop dining, artisanal breweries, and luxury wellness\n• Route Butler: Seamless transit and priority reservations active.\n\nReply with what you'd like to book next!`;
  }

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

  let message = `${greeting} Thank you for reaching out to La Vivenzia. We have received your inquiry${summary}. Our Experience team is reviewing your request and will get back to you shortly!`;

  if (conversationalPrompt) {
    message += `\n\nTo help us tailor your experience across Pune (Amanora Mall, Seasons Mall, Magarpatta City, Hadapsar, or Viman Nagar), feel free to share your preferred vibe (Craft Beer, Rooftop Dining, Gaming, Spa) or party size!`;
  }

  return message;
};
