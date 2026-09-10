import { describe, expect, it } from 'vitest';

import { type CaptureInput } from 'src/modules/lv-capture/types/capture.types';
import { buildLeadDraft } from 'src/modules/lv-capture/utils/build-lead-draft';

const capture = (input: CaptureInput) => buildLeadDraft(input);

const expectOk = (result: ReturnType<typeof capture>) => {
  if (!result.ok) {
    throw new Error(`expected a draft, got errors: ${result.errors.join('; ')}`);
  }

  return result.draft;
};

describe('buildLeadDraft', () => {
  describe('manual capture', () => {
    it('builds a confirmed lead from typed fields', () => {
      const draft = expectOk(
        capture({
          captureMode: 'MANUAL',
          name: 'Raj Sharma',
          organisationName: 'Forest Table',
          email: 'RAJ@forest.com',
          phone: '9876543210',
          location: 'Lonavala',
          category: 'STAY',
        }),
      );

      expect(draft.name).toBe('Raj Sharma');
      expect(draft.email).toBe('raj@forest.com');
      expect(draft.phone).toBe('+919876543210');
      expect(draft.status).toBe('NEW');
      expect(draft.requiresHumanConfirmation).toBe(false);
      expect(draft.provenance.name).toBe('USER_ENTERED');
    });

    it('rejects a capture with nothing identifying', () => {
      const result = capture({ captureMode: 'MANUAL' });

      expect(result.ok).toBe(false);
    });

    it('warns rather than failing on an unparseable phone', () => {
      const draft = expectOk(
        capture({ captureMode: 'MANUAL', name: 'Raj', phone: 'call me' }),
      );

      expect(draft.phone).toBeNull();
      expect(draft.warnings.join(' ')).toContain('could not be parsed');
    });
  });

  describe('website capture', () => {
    it('derives a name from the domain when none is given', () => {
      const draft = expectOk(
        capture({ captureMode: 'WEBSITE_URL', rawInput: 'https://www.forest-table.com/about' }),
      );

      expect(draft.name).toBe('Forest Table');
      expect(draft.websiteUrl).toBe('https://forest-table.com/about');
      expect(draft.source).toBe('WEBSITE');
      expect(draft.provenance.name).toBe('DERIVED');
    });

    it('rejects input that is not a URL', () => {
      const result = capture({ captureMode: 'WEBSITE_URL', rawInput: 'forest table' });

      expect(result.ok).toBe(false);
    });
  });

  describe('instagram capture', () => {
    it('accepts a handle and derives the display name', () => {
      const draft = expectOk(capture({ captureMode: 'INSTAGRAM', rawInput: '@forest' }));

      expect(draft.instagramHandle).toBe('forest');
      expect(draft.name).toBe('@forest');
      expect(draft.source).toBe('INSTAGRAM');
    });

    it('does not put the profile URL in the website field', () => {
      const draft = expectOk(capture({ captureMode: 'INSTAGRAM', rawInput: '@forest' }));

      // Otherwise every Instagram lead shares a domain:instagram.com duplicate
      // key and collides with every other one.
      expect(draft.websiteUrl).toBeNull();
      expect(draft.duplicateKeys.some((key) => key.startsWith('domain:'))).toBe(false);
    });

    it('rejects a post URL, which identifies no account', () => {
      const result = capture({
        captureMode: 'INSTAGRAM',
        rawInput: 'https://instagram.com/p/Cxyz/',
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('image and visiting-card capture', () => {
    it('parks an image capture for human confirmation', () => {
      const draft = expectOk(
        capture({ captureMode: 'VISITING_CARD', attachmentPath: 'files/card.jpg' }),
      );

      expect(draft.requiresHumanConfirmation).toBe(true);
      expect(draft.status).toBe('DISCOVERED');
      expect(draft.name).toBe('Unidentified capture');
      expect(draft.warnings.join(' ')).toContain('reviewer must identify');
    });

    it('does not invent fields it cannot read', () => {
      const draft = expectOk(
        capture({ captureMode: 'IMAGE', attachmentPath: 'files/poster.jpg' }),
      );

      expect(draft.email).toBeNull();
      expect(draft.phone).toBeNull();
      expect(draft.organisationName).toBeNull();
    });

    it('requires the uploaded file', () => {
      const result = capture({ captureMode: 'VISITING_CARD', name: 'Raj' });

      expect(result.ok).toBe(false);
    });

    it('promotes to NEW once a human confirms', () => {
      const draft = expectOk(
        capture({
          captureMode: 'VISITING_CARD',
          attachmentPath: 'files/card.jpg',
          name: 'Raj Sharma',
          isHumanConfirmed: true,
        }),
      );

      expect(draft.requiresHumanConfirmation).toBe(false);
      expect(draft.status).toBe('NEW');
    });
  });

  describe('referral capture', () => {
    it('records who referred the lead', () => {
      const draft = expectOk(
        capture({
          captureMode: 'REFERRAL',
          name: 'Raj',
          referrerName: 'Saumay',
          referrerWorkspaceMemberId: 'wm-1',
        }),
      );

      expect(draft.referrerName).toBe('Saumay');
      expect(draft.source).toBe('REFERRAL');
    });

    it('requires a referrer', () => {
      const result = capture({ captureMode: 'REFERRAL', name: 'Raj' });

      expect(result.ok).toBe(false);
    });
  });

  describe('source tracking', () => {
    it('defaults the source from the capture mode', () => {
      expect(
        expectOk(capture({ captureMode: 'WEBSITE_URL', rawInput: 'acme.com' })).source,
      ).toBe('WEBSITE');
      expect(
        expectOk(capture({ captureMode: 'IMPORT', name: 'Raj' })).source,
      ).toBe('IMPORTED');
    });

    it('lets an explicit source win, so a card collected at an event says EVENT', () => {
      const draft = expectOk(
        capture({
          captureMode: 'VISITING_CARD',
          attachmentPath: 'files/card.jpg',
          source: 'EVENT',
        }),
      );

      expect(draft.source).toBe('EVENT');
      expect(draft.captureMode).toBe('VISITING_CARD');
      expect(draft.provenance.source).toBe('USER_ENTERED');
    });
  });

  describe('completeness', () => {
    it('scores a bare capture low and a rich one high', () => {
      const sparse = expectOk(capture({ captureMode: 'MANUAL', name: 'Raj' }));
      const rich = expectOk(
        capture({
          captureMode: 'MANUAL',
          name: 'Raj',
          organisationName: 'Forest Table',
          email: 'raj@forest.com',
          phone: '9876543210',
          websiteUrl: 'forest.com',
          instagramHandle: '@forest',
          location: 'Lonavala',
          category: 'STAY',
        }),
      );

      expect(sparse.completeness).toBeLessThan(rich.completeness);
      expect(rich.completeness).toBe(100);
    });
  });

  it('emits duplicate keys for the new lead', () => {
    const draft = expectOk(
      capture({ captureMode: 'MANUAL', name: 'Raj', email: 'raj@forest.com' }),
    );

    expect(draft.duplicateKeys).toContain('email:raj@forest.com');
  });
});
