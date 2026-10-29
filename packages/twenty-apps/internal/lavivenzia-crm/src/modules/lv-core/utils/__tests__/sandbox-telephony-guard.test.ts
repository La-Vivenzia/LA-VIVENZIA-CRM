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

    it('does not classify production leads as sandbox solely based on phone prefix', () => {
      // Live Maharashtra subscriber number sharing the 9822 prefix
      const liveCustomer = {
        name: 'Maharashtra Agro Tourism',
        phones: { primaryPhoneNumber: '+91 98220 00001' },
        emails: { primaryEmail: 'contact@agrotourism.in' },
      };
      expect(isSandboxLead(liveCustomer)).toBe(false);
      expect(assertOutboundTelephonyAllowed(liveCustomer, 'PHONE')).toEqual({ allowed: true });
    });

    it('identifies sandbox leads via explicit isSandbox flag', () => {
      expect(isSandboxLead({ isSandbox: true, name: 'Normal Looking Name' })).toBe(true);
      expect(isSandboxLead({ isSandbox: false, name: 'Normal Looking Name' })).toBe(false);
    });

    it('retains sandbox classification if name or email was edited, via durable captureKey', () => {
      const editedRecord = {
        name: 'The Saffron Table',
        organisationName: 'Saffron Hospitality',
        emails: { primaryEmail: 'contact@saffron-dining.com' },
        phones: { primaryPhoneNumber: '+91 98220 00002' },
        captureKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310:3',
      };
      expect(isSandboxLead(editedRecord)).toBe(true);
      expect(assertOutboundTelephonyAllowed(editedRecord, 'PHONE').allowed).toBe(false);
    });

    it('requires the colon delimiter on captureKey prefix so bare UUID or ordinary UUID is not classified as sandbox', () => {
      // Bare UUID without row-colon delimiter must NOT trigger sandbox classification
      const bareUuidLead = {
        name: 'Legitimate Business Enterprise',
        captureKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310',
        emails: { primaryEmail: 'contact@enterprise.com' },
        phones: { primaryPhoneNumber: '+91 98220 12345' },
      };
      expect(isSandboxLead(bareUuidLead)).toBe(false);
      expect(assertOutboundTelephonyAllowed(bareUuidLead, 'PHONE').allowed).toBe(true);

      // Ordinary random UUID must NOT trigger sandbox classification
      const randomUuidLead = {
        name: 'Random Real Client',
        captureKey: 'c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f',
        emails: { primaryEmail: 'info@randomclient.in' },
        phones: { primaryPhoneNumber: '+91 98220 99999' },
      };
      expect(isSandboxLead(randomUuidLead)).toBe(false);
      expect(assertOutboundTelephonyAllowed(randomUuidLead, 'PHONE').allowed).toBe(true);
    });

    it('does not classify generic non-sandbox .internal domain as sandbox lead', () => {
      const corporateLead = {
        name: 'Enterprise Solutions',
        emails: { primaryEmail: 'desk@corp.internal' },
        website: { primaryLinkUrl: 'https://intranet.corp.internal' },
      };
      expect(isSandboxLead(corporateLead)).toBe(false);
      expect(assertOutboundTelephonyAllowed(corporateLead, 'PHONE').allowed).toBe(true);
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
