/**
 * Telephony and Outbound Contact Isolation for Sandbox / Test Leads.
 *
 * Guarantees that Pune Pilot sandbox leads cannot trigger real outbound calls,
 * SMS, or WhatsApp messages through any supported application path.
 *
 * Boundary Notice:
 * This guard technically prevents in-app dispatch, window.open, protocol handlers
 * (tel:, https://wa.me/), API transports, and automated integrations. It cannot
 * prevent an agent from manually reading digits from the screen and typing them into
 * a separate personal physical device or uncontrolled third-party dialer hardware.
 */

export type OutboundTransportType = 'REAL_DIALER' | 'MOCK_SANDBOX' | 'BLOCKED_FAIL_CLOSED';

export type LeadContactInfo = {
  name?: string | null;
  organisationName?: string | null;
  emails?: { primaryEmail: string | null } | null;
  phones?: { primaryPhoneNumber: string | null } | null;
  website?: { primaryLinkUrl: string | null } | null;
  rawCaptureInput?: string | null;
  source?: string | null;
};

export type TelephonyIsolationConfig = {
  enabled: boolean;
  failClosedOnMissingConfig?: boolean;
};

export type LeadChannelsResult = {
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  isSandbox: boolean;
  telephonyTransport: OutboundTransportType;
  telephonyNotice?: string;
  mockCallUrl?: string | null;
  mockWhatsappUrl?: string | null;
};

export type DispatchResult = {
  dispatched: boolean;
  transport: OutboundTransportType;
  url?: string;
  reason?: string;
};

/** Identifies whether a phone number falls in the synthetic sandbox range. */
export const isSandboxPhone = (phone: string | null | undefined): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  // Matches Maharashtra/Pune sandbox fixture synthetic blocks:
  // +91 98220 00001 - 00012 or +91 98220 11001 - 11012
  return /^9198220(000|110)\d{2}$/.test(digits);
};

/** Identifies whether a lead record represents a Pune Pilot sandbox venue. */
export const isSandboxLead = (lead: LeadContactInfo | null | undefined): boolean => {
  if (!lead) return false;

  // 1. Explicit [Sandbox] label in title or business identity
  if (typeof lead.name === 'string' && /\[sandbox\]/i.test(lead.name)) {
    return true;
  }
  if (typeof lead.organisationName === 'string' && /\[sandbox\]/i.test(lead.organisationName)) {
    return true;
  }

  // 2. Reserved private TLD (.sandbox.lavivenzia.internal)
  const email = lead.emails?.primaryEmail;
  if (typeof email === 'string' && email.toLowerCase().includes('sandbox.lavivenzia.internal')) {
    return true;
  }

  // 3. Sandbox internal URI in website link
  const website = lead.website?.primaryLinkUrl;
  if (typeof website === 'string' && website.toLowerCase().includes('sandbox.lavivenzia.internal')) {
    return true;
  }

  // 4. Sandbox provenance in raw capture input or notes
  if (typeof lead.rawCaptureInput === 'string' && /sandbox\.lavivenzia\.internal|\[sandbox\]/i.test(lead.rawCaptureInput)) {
    return true;
  }

  // 5. Fixture phone number match
  if (isSandboxPhone(lead.phones?.primaryPhoneNumber)) {
    return true;
  }

  return false;
};

/** Resolves the outbound channels available for a lead, enforcing sandbox quarantine. */
export const resolveOutboundChannels = (
  lead: LeadContactInfo | null | undefined,
  config: TelephonyIsolationConfig = { enabled: true, failClosedOnMissingConfig: true },
): LeadChannelsResult => {
  const phone = lead?.phones?.primaryPhoneNumber ?? null;
  const email = lead?.emails?.primaryEmail ?? null;

  // Fail closed if sandbox isolation is required but config is missing or invalid
  if (!config || typeof config.enabled !== 'boolean') {
    return {
      phone: null,
      email,
      whatsapp: null,
      isSandbox: true,
      telephonyTransport: 'BLOCKED_FAIL_CLOSED',
      telephonyNotice: 'Telephony failed closed: invalid isolation configuration.',
      mockCallUrl: null,
      mockWhatsappUrl: null,
    };
  }

  // If isolation is active and this is a sandbox lead: enforce quarantine
  if (config.enabled && isSandboxLead(lead)) {
    const venueName = lead?.name ?? 'Sandbox venue';
    return {
      phone: null,
      email,
      whatsapp: null,
      isSandbox: true,
      telephonyTransport: 'MOCK_SANDBOX',
      telephonyNotice: 'Outbound telephony and WhatsApp are quarantined for sandbox leads.',
      mockCallUrl: `mock-telephony://noop?target=${encodeURIComponent(phone ?? '')}&venue=${encodeURIComponent(venueName)}`,
      mockWhatsappUrl: `mock-whatsapp://noop?target=${encodeURIComponent(phone ?? '')}&venue=${encodeURIComponent(venueName)}`,
    };
  }

  // Production lead or isolation explicitly disabled: normal direct dispatch
  return {
    phone,
    email,
    whatsapp: phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null,
    isSandbox: false,
    telephonyTransport: 'REAL_DIALER',
    mockCallUrl: null,
    mockWhatsappUrl: null,
  };
};

/**
 * Dispatches an outbound contact action.
 * Blocks all external window.open / network protocol actions when sandbox mode is active.
 */
export const dispatchOutboundContact = (
  channel: 'phone' | 'whatsapp' | 'email',
  channels: LeadChannelsResult,
  targetWindow: { open: (url?: string | URL, target?: string, features?: string) => WindowProxy | null } = window,
): DispatchResult => {
  if (channels.isSandbox) {
    return {
      dispatched: false,
      transport: channels.telephonyTransport,
      reason: channels.telephonyNotice ?? 'Sandbox leads cannot reach external telephony or messaging networks.',
    };
  }

  if (channel === 'phone') {
    if (!channels.phone) {
      return { dispatched: false, transport: channels.telephonyTransport, reason: 'No phone number available' };
    }
    const url = `tel:${channels.phone}`;
    targetWindow.open(url);
    return { dispatched: true, transport: 'REAL_DIALER', url };
  }

  if (channel === 'whatsapp') {
    if (!channels.whatsapp) {
      return { dispatched: false, transport: channels.telephonyTransport, reason: 'No WhatsApp number available' };
    }
    targetWindow.open(channels.whatsapp, '_blank', 'noreferrer');
    return { dispatched: true, transport: 'REAL_DIALER', url: channels.whatsapp };
  }

  if (channel === 'email') {
    if (!channels.email) {
      return { dispatched: false, transport: channels.telephonyTransport, reason: 'No email address available' };
    }
    const url = `mailto:${channels.email}`;
    targetWindow.open(url);
    return { dispatched: true, transport: 'REAL_DIALER', url };
  }

  return { dispatched: false, transport: channels.telephonyTransport, reason: 'Unknown channel' };
};
