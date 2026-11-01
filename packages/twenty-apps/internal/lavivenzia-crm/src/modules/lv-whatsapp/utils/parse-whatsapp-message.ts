export type WhatsAppCraving = 'Nightlife' | 'Dining' | 'Gaming' | 'Spa';

export type WhatsAppPilotZone =
  | 'AMANORA_MALL'
  | 'SEASONS_MALL'
  | 'MAGARPATTA_CITY';

export type ParsedWhatsAppMessage = {
  wamid: string;
  fromPhone: string;
  senderName: string | null;
  timestamp: string;
  rawText: string;
  zone: WhatsAppPilotZone | null;
  zoneLabel: string | null;
  guestCount: number | null;
  budget: number | null;
  budgetFormatted: string | null;
  cravings: WhatsAppCraving[];
};

export type MetaWhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          profile?: {
            name?: string;
          };
          wa_id?: string;
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: {
            body?: string;
          };
          image?: {
            caption?: string;
          };
          reaction?: {
            message_id?: string;
            emoji?: string;
          };
        }>;
      };
      field?: string;
    }>;
  }>;
};

// Pilot zones supported in Pune
const ZONE_MATCHERS: Array<{
  zone: WhatsAppPilotZone;
  label: string;
  regex: RegExp;
}> = [
  {
    zone: 'AMANORA_MALL',
    label: 'Amanora Mall',
    regex: /\bamanora(?:\s+mall)?\b/i,
  },
  {
    zone: 'SEASONS_MALL',
    label: 'Seasons Mall',
    regex: /\bseasons(?:\s+mall)?\b/i,
  },
  {
    zone: 'MAGARPATTA_CITY',
    label: 'Magarpatta City',
    regex: /\bmagarpatta(?:\s+city)?\b/i,
  },
];

const CRAVING_MATCHERS: Array<{
  craving: WhatsAppCraving;
  regex: RegExp;
}> = [
  {
    craving: 'Nightlife',
    regex: /\b(nightlife|clubs?|clubbing|part(?:y|ies)|drinks?|pubs?|lounges?|bars?)\b/i,
  },
  {
    craving: 'Dining',
    regex: /\b(dining|dinner|lunch|foods?|restaurants?|cuisines?|eats?|eating|brunch)\b/i,
  },
  {
    craving: 'Gaming',
    regex: /\b(gaming|games?|arcades?|bowling|vr|laser\s*tag|playzone)\b/i,
  },
  {
    craving: 'Spa',
    regex: /\b(spas?|massages?|wellness|relax|relaxation|saunas?|therap(?:y|ies))\b/i,
  },
];

export const parseZone = (
  text: string,
): { zone: WhatsAppPilotZone | null; label: string | null } => {
  for (const matcher of ZONE_MATCHERS) {
    if (matcher.regex.test(text)) {
      return { zone: matcher.zone, label: matcher.label };
    }
  }

  return { zone: null, label: null };
};

export const parseGuestCount = (text: string): number | null => {
  // Patterns like: "4 guests", "party of 5", "for 6 people", "2 pax", "table for 3"
  const patterns = [
    /\b(\d{1,3})\s*(?:guests?|people|pax|persons?|adults?|members?)\b/i,
    /\b(?:party\s+of|table\s+for|group\s+of)\s*(\d{1,3})\b/i,
    /\b(?:for)\s+(\d{1,3})\s*(?:guests?|people|pax|persons?)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match && match[1]) {
      const count = parseInt(match[1], 10);

      if (!isNaN(count) && count > 0 && count < 1000) {
        return count;
      }
    }
  }

  return null;
};

export const parseBudget = (
  text: string,
): { amount: number | null; formatted: string | null } => {
  // Match currency prefix (₹, rs, inr) or keyword "budget"
  // Handles values like "₹5,000", "5000 inr", "budget 10k", "approx 2 lakhs"
  const budgetPattern =
    /(?:(?:budget|cost|price|max|approx|around)\s*(?:is|of|:)?\s*)?(?:(?:rs\.?|inr|₹)\s*)?([\d,]+(?:\.\d+)?)\s*(k|lac|lakhs?|l)?\s*(?:rs\.?|inr|₹|rupees)?\b/gi;

  let bestAmount: number | null = null;
  let match: RegExpExecArray | null;

  while ((match = budgetPattern.exec(text)) !== null) {
    const numStr = match[1]?.replace(/,/g, '');
    const multiplierUnit = match[2]?.toLowerCase();

    if (!numStr) {
      continue;
    }

    const baseVal = parseFloat(numStr);

    if (isNaN(baseVal) || baseVal <= 0) {
      continue;
    }

    let multiplier = 1;

    if (multiplierUnit === 'k') {
      multiplier = 1_000;
    } else if (
      multiplierUnit === 'l' ||
      multiplierUnit === 'lac' ||
      multiplierUnit === 'lakh' ||
      multiplierUnit === 'lakhs'
    ) {
      multiplier = 100_000;
    }

    const calculated = baseVal * multiplier;

    // Filter out unlikely small numbers that might have been guest counts or dates
    // If text specifically had currency symbol or "budget", trust lower numbers >= 100
    const matchedSegment = match[0].toLowerCase();
    const hasCurrencyOrBudgetKeyword =
      matchedSegment.includes('rs') ||
      matchedSegment.includes('inr') ||
      matchedSegment.includes('₹') ||
      matchedSegment.includes('budget') ||
      multiplier > 1;

    if (hasCurrencyOrBudgetKeyword && calculated >= 100) {
      bestAmount = calculated;
      break;
    } else if (calculated >= 500 && !bestAmount) {
      // Unlabeled amount >= 500
      bestAmount = calculated;
    }
  }

  if (bestAmount !== null) {
    const formatted = `₹${bestAmount.toLocaleString('en-IN')}`;

    return { amount: bestAmount, formatted };
  }

  return { amount: null, formatted: null };
};

export const parseCravings = (text: string): WhatsAppCraving[] => {
  const result: WhatsAppCraving[] = [];

  for (const matcher of CRAVING_MATCHERS) {
    if (matcher.regex.test(text)) {
      result.push(matcher.craving);
    }
  }

  return result;
};

export const parseWhatsAppMessage = (
  payload: MetaWhatsAppWebhookPayload,
): ParsedWhatsAppMessage[] => {
  const parsedMessages: ParsedWhatsAppMessage[] = [];

  const entries = payload?.entry ?? [];

  for (const entry of entries) {
    const changes = entry?.changes ?? [];

    for (const change of changes) {
      const value = change?.value;

      if (!value) {
        continue;
      }

      const contacts = value.contacts ?? [];
      const messages = value.messages ?? [];

      for (const msg of messages) {
        if (!msg.id || !msg.from) {
          continue;
        }

        // Ignore reaction events or messages without text content
        if (msg.type === 'reaction') {
          continue;
        }

        const rawText = (msg.text?.body ?? msg.image?.caption ?? '').trim();

        if (!rawText) {
          continue;
        }

        const contact = contacts.find((c) => c.wa_id === msg.from) ?? contacts[0];
        const senderName = contact?.profile?.name?.trim() || null;

        const { zone, label: zoneLabel } = parseZone(rawText);
        const guestCount = parseGuestCount(rawText);
        const { amount: budget, formatted: budgetFormatted } = parseBudget(rawText);
        const cravings = parseCravings(rawText);

        parsedMessages.push({
          wamid: msg.id,
          fromPhone: msg.from,
          senderName,
          timestamp: msg.timestamp ?? String(Math.floor(Date.now() / 1000)),
          rawText,
          zone,
          zoneLabel,
          guestCount,
          budget,
          budgetFormatted,
          cravings,
        });
      }
    }
  }

  return parsedMessages;
};
