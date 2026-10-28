import { describe, expect, it } from 'vitest';

import {
  assertOutboundTelephonyAllowed,
  isSandboxLead,
} from 'src/modules/lv-core/utils/sandbox-telephony-guard';

describe('Server-side Sandbox Telephony Guard', () => {
  const productionLead = {
    name: 'Verdant Table',
    organisationName: 'Verdant Table Hospitality Pvt Ltd',
    emails: { primaryEmail: 'reservations@verdanttable.in' },
    phones: { primaryPhoneNumber: '+91 98220 99999' },
    website: { primaryLinkUrl: 'https://verdanttable.in' },
  };

  const sandboxLead = {
    name: 'Saffron Lounge [Sandbox]',
    organisationName: 'Saffron Hospitality [Sandbox]',
    emails: { primaryEmail: 'contact@saffron.sandbox.lavivenzia.internal' },
    phones: { primaryPhoneNumber: '+91 98220 00002' },
    website: { primaryLinkUrl: 'https://sandbox.lavivenzia.internal/saffron' },
  };

  describe('isSandboxLead', () => {
    it('identifies sandbox leads via [Sandbox] name tag', () => {
      expect(isSandboxLead({ name: 'Oasis Spa [Sandbox]' })).toBe(true);
      expect(isSandboxLead({ organisationName: 'Oasis Wellness [Sandbox]' })).toBe(true);
      expect(isSandboxLead({ name: 'Oasis Spa' })).toBe(false);
    });

    it('identifies sandbox leads via .sandbox.lavivenzia.internal email', () => {
      expect(isSandboxLead({ emails: { primaryEmail: 'test@venue.sandbox.lavivenzia.internal' } })).toBe(true);
      expect(isSandboxLead({ emails: { primaryEmail: 'test@gmail.com' } })).toBe(false);
    });

    it('identifies sandbox leads via synthetic Pune pilot fixture phone numbers', () => {
      expect(isSandboxLead({ phones: { primaryPhoneNumber: '+91 98220 00001' } })).toBe(true);
      expect(isSandboxLead({ phones: { primaryPhoneNumber: '+91 98220 11012' } })).toBe(true);
      expect(isSandboxLead({ phones: { primaryPhoneNumber: '+91 98220 99999' } })).toBe(false);
    });

    it('returns false for production leads with no sandbox markers', () => {
      expect(isSandboxLead(productionLead)).toBe(false);
      expect(isSandboxLead(null)).toBe(false);
      expect(isSandboxLead(undefined)).toBe(false);
    });
  });

  describe('assertOutboundTelephonyAllowed', () => {
    it('blocks outbound phone and whatsapp dispatch for sandbox leads', () => {
      const callCheck = assertOutboundTelephonyAllowed(sandboxLead, 'PHONE');
      expect(callCheck.allowed).toBe(false);
      expect(callCheck.refusal).toBe('SANDBOX_TELEPHONY_BLOCKED');
      expect(callCheck.reason).toContain('quarantined for sandbox lead');

      const whatsappCheck = assertOutboundTelephonyAllowed(sandboxLead, 'WHATSAPP');
      expect(whatsappCheck.allowed).toBe(false);
      expect(whatsappCheck.refusal).toBe('SANDBOX_TELEPHONY_BLOCKED');
    });

    it('permits outbound contact for production leads', () => {
      const callCheck = assertOutboundTelephonyAllowed(productionLead, 'PHONE');
      expect(callCheck.allowed).toBe(true);
      expect(callCheck.refusal).toBeUndefined();

      const whatsappCheck = assertOutboundTelephonyAllowed(productionLead, 'WHATSAPP');
      expect(whatsappCheck.allowed).toBe(true);
    });

    it('fails closed when configuration is missing or invalid', () => {
      // @ts-expect-error testing missing configuration
      const result = assertOutboundTelephonyAllowed(productionLead, 'PHONE', null);
      expect(result.allowed).toBe(false);
      expect(result.refusal).toBe('TELEPHONY_ISOLATION_CONFIG_ERROR');
      expect(result.reason).toContain('failing closed');
    });

    it('permits contact when isolation is explicitly disabled in config', () => {
      const result = assertOutboundTelephonyAllowed(sandboxLead, 'PHONE', { enabled: false });
      expect(result.allowed).toBe(true);
    });
  });
});
