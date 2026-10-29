/**
 * Server-side guard for Pune Pilot sandbox leads and outbound telephony/messaging isolation.
 *
 * Guarantees that sandbox leads cannot trigger real outbound calls, SMS, WhatsApp, or external dispatch.
 *
 * Architectural Boundary Note:
 * Twenty CRM does not run native background telephony or SMS daemons. Supported outbound
 * communications consist of:
 * 1. Client-side browser protocols (tel:, https://wa.me/, mailto:) guarded in telephony-isolation.ts
 * 2. Logic function AI draft generation (lead-generate.logic-function.ts) guarded via isSandboxLead
 * 3. Transactional notification emails (deliver-notification-email.ts) guarded via sandbox email domain quarantine
 * This guard provides the server-side boundary validation for logic functions and automated integrations.
 */

export type OutboundChannel = 'PHONE' | 'WHATSAPP' | 'SMS' | 'EMAIL';

export type LeadSandboxCandidate = {
  name?: string | null;
  organisationName?: string | null;
  emails?: { primaryEmail?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  website?: { primaryLinkUrl?: string | null } | null;
  rawCaptureInput?: string | null;
  isSandbox?: boolean | null;
  captureKey?: string | null;
  captureProvenance?: Record<string, unknown> | null;
};

export type SandboxTelephonyConfig = {
  enabled: boolean;
  failClosed?: boolean;
};

/**
 * Identifies whether a lead record represents a Pune Pilot sandbox venue.
 *
 * Uses explicit markers (persisted isSandbox flag, [Sandbox] tag, internal sandbox
 * domain/URIs) rather than phone numbers to avoid accidental quarantine of
 * legitimate production customers.
 */
export const isSandboxLead = (lead: LeadSandboxCandidate | null | undefined): boolean => {
  if (!lead) return false;

  // 1. Explicit persisted or computed isSandbox boolean
  if (lead.isSandbox === true) {
    return true;
  }

  // 2. Explicit [Sandbox] label in title or business identity
  if (typeof lead.name === 'string' && /\[sandbox\]/i.test(lead.name)) {
    return true;
  }
  if (typeof lead.organisationName === 'string' && /\[sandbox\]/i.test(lead.organisationName)) {
    return true;
  }

  // 3. Reserved private TLD (.sandbox.lavivenzia.internal)
  const email = lead.emails?.primaryEmail;
  if (typeof email === 'string' && email.toLowerCase().includes('sandbox.lavivenzia.internal')) {
    return true;
  }

  // 4. Website URI is in sandbox domain
  const website = lead.website?.primaryLinkUrl;
  if (typeof website === 'string' && website.toLowerCase().includes('sandbox.lavivenzia.internal')) {
    return true;
  }

  // 5. Raw capture input indicates sandbox provenance
  if (typeof lead.rawCaptureInput === 'string' && /sandbox\.lavivenzia\.internal|\[sandbox\]/i.test(lead.rawCaptureInput)) {
    return true;
  }

  // 6. Capture key or provenance indicates deterministic sandbox fixture (must be followed by row colon)
  if (typeof lead.captureKey === 'string' && lead.captureKey.startsWith('7f9c2d18-3a81-4b72-9b04-8e1c64df3310:')) {
    return true;
  }

  // Phone numbers are never used for classification: 9822 is a live Maharashtra prefix.
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
