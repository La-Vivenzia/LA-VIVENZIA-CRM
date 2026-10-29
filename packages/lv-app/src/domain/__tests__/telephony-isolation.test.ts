import { describe, expect, it, vi } from 'vitest';

import {
  dispatchOutboundContact,
  isSandboxLead,
  resolveOutboundChannels,
} from 'src/domain/telephony-isolation';
import { PUNE_PILOT_SANDBOX_RECORDS } from 'src/fixtures/pune-pilot-sandbox';

describe('Telephony and Outbound Contact Isolation', () => {
  const productionLead = {
    name: 'Koregaon Park Bistro',
    organisationName: 'Koregaon Park Bistro Pvt Ltd',
    emails: { primaryEmail: 'contact@kpbistro.com' },
    phones: { primaryPhoneNumber: '+91 98220 54321' },
    website: { primaryLinkUrl: 'https://kpbistro.com' },
    rawCaptureInput: 'Walk-in referral',
  };

  describe('isSandboxLead detection', () => {
    it('accurately identifies all 12 Pune Pilot Sandbox fixture records as sandbox leads', () => {
      expect(PUNE_PILOT_SANDBOX_RECORDS).toHaveLength(12);

      for (const record of PUNE_PILOT_SANDBOX_RECORDS) {
        const lead = {
          name: record.name,
          organisationName: record.organisationName,
          emails: { primaryEmail: record.email },
          phones: { primaryPhoneNumber: record.phone },
          website: { primaryLinkUrl: record.websiteUrl },
          rawCaptureInput: record.notes,
        };

        expect(isSandboxLead(lead)).toBe(true);
      }
    });

    it('identifies sandbox leads via [Sandbox] label in name or organisationName', () => {
      expect(isSandboxLead({ name: 'The Urban Grind [Sandbox]' })).toBe(true);
      expect(isSandboxLead({ organisationName: 'Verdant Co [Sandbox]' })).toBe(true);
      expect(isSandboxLead({ name: 'Normal Venue' })).toBe(false);
    });

    it('identifies sandbox leads via .sandbox.lavivenzia.internal email domain', () => {
      expect(isSandboxLead({ emails: { primaryEmail: 'hello@venue.sandbox.lavivenzia.internal' } })).toBe(true);
      expect(isSandboxLead({ emails: { primaryEmail: 'hello@venue.com' } })).toBe(false);
    });

    it('identifies sandbox leads via sandbox website URI', () => {
      expect(isSandboxLead({ website: { primaryLinkUrl: 'https://sandbox.lavivenzia.internal/test' } })).toBe(true);
      expect(isSandboxLead({ website: { primaryLinkUrl: 'https://lavivenzia.com' } })).toBe(false);
    });

    it('does not classify a lead as sandbox solely due to phone number matching fixture pattern', () => {
      // Real customer with active Maharashtra 9822 mobile prefix but legitimate production credentials
      const realCustomer = {
        name: 'Patil Real Estate',
        organisationName: 'Patil Properties Pune',
        emails: { primaryEmail: 'contact@patilproperties.com' },
        phones: { primaryPhoneNumber: '+91 98220 00001' },
        website: { primaryLinkUrl: 'https://patilproperties.com' },
      };
      expect(isSandboxLead(realCustomer)).toBe(false);

      const channels = resolveOutboundChannels(realCustomer);
      expect(channels.isSandbox).toBe(false);
      expect(channels.telephonyTransport).toBe('REAL_DIALER');
      expect(channels.phone).toBe('+91 98220 00001');
      expect(channels.whatsapp).toBe('https://wa.me/919822000001');
    });

    it('identifies sandbox leads via explicit isSandbox marker flag', () => {
      expect(isSandboxLead({ name: 'Real Looking Hotel', isSandbox: true })).toBe(true);
      expect(isSandboxLead({ name: 'Real Looking Hotel', isSandbox: false })).toBe(false);
    });

    it('retains sandbox classification if name or email was edited, via durable captureKey', () => {
      // User renamed venue removing [Sandbox] and changed email, but record keeps deterministic captureKey with colon
      const editedRecord = {
        name: 'Neon Byte Gaming Zone',
        organisationName: 'Neon Byte Corp',
        emails: { primaryEmail: 'info@neonbyte.com' },
        phones: { primaryPhoneNumber: '+91 98220 00001' },
        captureKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310:2',
      };
      expect(isSandboxLead(editedRecord)).toBe(true);
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

      // Ordinary random UUID must NOT trigger sandbox classification
      const randomUuidLead = {
        name: 'Random Real Client',
        captureKey: 'c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f',
        emails: { primaryEmail: 'info@randomclient.in' },
        phones: { primaryPhoneNumber: '+91 98220 99999' },
      };
      expect(isSandboxLead(randomUuidLead)).toBe(false);
    });

    it('does not classify generic non-sandbox .internal domain as sandbox lead', () => {
      const corporateLead = {
        name: 'Enterprise Solutions',
        emails: { primaryEmail: 'desk@corp.internal' },
        website: { primaryLinkUrl: 'https://intranet.corp.internal' },
      };
      expect(isSandboxLead(corporateLead)).toBe(false);
    });

    it('returns false for production leads with no sandbox markers', () => {
      expect(isSandboxLead(productionLead)).toBe(false);
      expect(isSandboxLead(null)).toBe(false);
      expect(isSandboxLead(undefined)).toBe(false);
    });
  });

  describe('resolveOutboundChannels', () => {
    it('quarantines sandbox leads by nullifying phone and whatsapp while providing mock URIs', () => {
      const sandboxVenue = PUNE_PILOT_SANDBOX_RECORDS[0]!;
      const channels = resolveOutboundChannels({
        name: sandboxVenue.name,
        emails: { primaryEmail: sandboxVenue.email },
        phones: { primaryPhoneNumber: sandboxVenue.phone },
        website: { primaryLinkUrl: sandboxVenue.websiteUrl },
      });

      expect(channels.isSandbox).toBe(true);
      expect(channels.phone).toBeNull();
      expect(channels.whatsapp).toBeNull();
      expect(channels.telephonyTransport).toBe('MOCK_SANDBOX');
      expect(channels.mockCallUrl).toContain('mock-telephony://noop');
      expect(channels.mockWhatsappUrl).toContain('mock-whatsapp://noop');
      expect(channels.telephonyNotice).toBe('Outbound telephony and WhatsApp are quarantined for sandbox leads.');
    });

    it('leaves legitimate production communications completely intact when not a sandbox lead', () => {
      const channels = resolveOutboundChannels(productionLead);

      expect(channels.isSandbox).toBe(false);
      expect(channels.phone).toBe('+91 98220 54321');
      expect(channels.whatsapp).toBe('https://wa.me/919822054321');
      expect(channels.email).toBe('contact@kpbistro.com');
      expect(channels.telephonyTransport).toBe('REAL_DIALER');
      expect(channels.mockCallUrl).toBeNull();
      expect(channels.mockWhatsappUrl).toBeNull();
    });

    it('fails closed when isolation configuration is missing or invalid', () => {
      // @ts-expect-error testing invalid runtime configuration
      const channels = resolveOutboundChannels(productionLead, null);

      expect(channels.isSandbox).toBe(true);
      expect(channels.phone).toBeNull();
      expect(channels.whatsapp).toBeNull();
      expect(channels.telephonyTransport).toBe('BLOCKED_FAIL_CLOSED');
      expect(channels.telephonyNotice).toContain('invalid isolation configuration');
    });

    it('allows normal production routing when isolation is explicitly disabled for production leads', () => {
      const channels = resolveOutboundChannels(productionLead, { enabled: false });

      expect(channels.isSandbox).toBe(false);
      expect(channels.phone).toBe('+91 98220 54321');
      expect(channels.whatsapp).toBe('https://wa.me/919822054321');
      expect(channels.telephonyTransport).toBe('REAL_DIALER');
    });
  });

  describe('dispatchOutboundContact', () => {
    it('blocks outbound phone call for sandbox lead and never invokes window.open', () => {
      const mockWindow = { open: vi.fn() };
      const sandboxChannels = resolveOutboundChannels({
        name: 'Neon Byte Arcade [Sandbox]',
        phones: { primaryPhoneNumber: '+91 98220 00001' },
      });

      const result = dispatchOutboundContact('phone', sandboxChannels, mockWindow);

      expect(result.dispatched).toBe(false);
      expect(result.transport).toBe('MOCK_SANDBOX');
      expect(mockWindow.open).not.toHaveBeenCalled();
    });

    it('blocks outbound WhatsApp message for sandbox lead and never invokes window.open', () => {
      const mockWindow = { open: vi.fn() };
      const sandboxChannels = resolveOutboundChannels({
        name: 'Neon Byte Arcade [Sandbox]',
        phones: { primaryPhoneNumber: '+91 98220 00001' },
      });

      const result = dispatchOutboundContact('whatsapp', sandboxChannels, mockWindow);

      expect(result.dispatched).toBe(false);
      expect(result.transport).toBe('MOCK_SANDBOX');
      expect(mockWindow.open).not.toHaveBeenCalled();
    });

    it('dispatches outbound phone call via window.open for production lead', () => {
      const mockWindow = { open: vi.fn() };
      const prodChannels = resolveOutboundChannels(productionLead);

      const result = dispatchOutboundContact('phone', prodChannels, mockWindow);

      expect(result.dispatched).toBe(true);
      expect(result.transport).toBe('REAL_DIALER');
      expect(result.url).toBe('tel:+91 98220 54321');
      expect(mockWindow.open).toHaveBeenCalledWith('tel:+91 98220 54321');
    });

    it('dispatches outbound WhatsApp via window.open for production lead', () => {
      const mockWindow = { open: vi.fn() };
      const prodChannels = resolveOutboundChannels(productionLead);

      const result = dispatchOutboundContact('whatsapp', prodChannels, mockWindow);

      expect(result.dispatched).toBe(true);
      expect(result.transport).toBe('REAL_DIALER');
      expect(result.url).toBe('https://wa.me/919822054321');
      expect(mockWindow.open).toHaveBeenCalledWith('https://wa.me/919822054321', '_blank', 'noreferrer');
    });
  });
});
