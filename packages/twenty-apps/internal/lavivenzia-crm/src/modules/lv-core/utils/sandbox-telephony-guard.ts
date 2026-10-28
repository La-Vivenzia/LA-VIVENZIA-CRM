/**
 * Server-side guard for Pune Pilot sandbox leads and outbound telephony/messaging isolation.
 *
 * Guarantees that sandbox leads cannot trigger real outbound calls, SMS, WhatsApp, or external dispatch.
 *
 * Boundary Notice:
 * This guard technically prevents server-side dispatch, logic function routes, and automated integrations.
 * It cannot prevent human operators from manually reading numbers on screen and dialing external devices.
 */

export type OutboundChannel = 'PHONE' | 'WHATSAPP' | 'SMS' | 'EMAIL';

export type LeadSandboxCandidate = {
  name?: string | null;
  organisationName?: string | null;
  emails?: { primaryEmail?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  website?: { primaryLinkUrl?: string | null } | null;
  rawCaptureInput?: string | null;
};

export type SandboxTelephonyConfig = {
  enabled: boolean;
  failClosed?: boolean;
};

/** Identifies whether a lead record represents a Pune Pilot sandbox venue. */
export const isSandboxLead = (lead: LeadSandboxCandidate | null | undefined): boolean => {
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

  // 3. Website URI is in sandbox domain
  const website = lead.website?.primaryLinkUrl;
  if (typeof website === 'string' && website.toLowerCase().includes('sandbox.lavivenzia.internal')) {
    return true;
  }

  // 4. Raw capture input indicates sandbox provenance
  if (typeof lead.rawCaptureInput === 'string' && /sandbox\.lavivenzia\.internal|\[sandbox\]/i.test(lead.rawCaptureInput)) {
    return true;
  }

  // 5. Fixture phone number match (+91 98220 00001 - 00012 or 11001 - 11012)
  const phone = lead.phones?.primaryPhoneNumber;
  if (typeof phone === 'string') {
    const digits = phone.replace(/\D/g, '');
    if (/^9198220(000|110)\d{2}$/.test(digits)) {
      return true;
    }
  }

  return false;
};

/**
 * Asserts whether outbound telephony or messaging is permitted for a lead.
 * Enforces quarantine for sandbox leads and fails closed on invalid/missing configuration.
 */
export const assertOutboundTelephonyAllowed = (
  lead: LeadSandboxCandidate | null | undefined,
  channel: OutboundChannel,
  config: SandboxTelephonyConfig = { enabled: true, failClosed: true },
): { allowed: boolean; refusal?: string; reason?: string } => {
  // Fail closed if configuration is missing or invalid
  if (!config || typeof config.enabled !== 'boolean') {
    return {
      allowed: false,
      refusal: 'TELEPHONY_ISOLATION_CONFIG_ERROR',
      reason: 'Sandbox telephony isolation configuration is missing or invalid; failing closed.',
    };
  }

  if (!config.enabled) {
    return { allowed: true };
  }

  if (isSandboxLead(lead)) {
    return {
      allowed: false,
      refusal: 'SANDBOX_TELEPHONY_BLOCKED',
      reason: `Outbound ${channel} is quarantined for sandbox lead: real dispatch prevented.`,
    };
  }

  return { allowed: true };
};
