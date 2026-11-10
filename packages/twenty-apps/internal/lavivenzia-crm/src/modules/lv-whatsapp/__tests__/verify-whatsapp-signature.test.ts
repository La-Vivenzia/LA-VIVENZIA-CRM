import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { verifyWhatsAppSignature } from '../utils/verify-whatsapp-signature';

describe('verifyWhatsAppSignature', () => {
  const secret = 'test-whatsapp-secret-12345';
  const rawBody = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: '123' }],
  });

  const validSignature = `sha256=${createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  it('validates a correct HMAC-SHA256 signature', () => {
    const result = verifyWhatsAppSignature({
      rawBody,
      signatureHeader: validSignature,
      secret,
    });

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects when signature does not match body content', () => {
    const tamperedBody = JSON.stringify({ object: 'tampered' });

    const result = verifyWhatsAppSignature({
      rawBody: tamperedBody,
      signatureHeader: validSignature,
      secret,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('rejects when secret is different', () => {
    const result = verifyWhatsAppSignature({
      rawBody,
      signatureHeader: validSignature,
      secret: 'wrong-secret',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('rejects when signature header format is missing sha256= prefix', () => {
    const rawHex = createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const result = verifyWhatsAppSignature({
      rawBody,
      signatureHeader: rawHex,
      secret,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE_FORMAT');
  });

  it('rejects when rawBody is missing or not a string', () => {
    const result = verifyWhatsAppSignature({
      rawBody: undefined,
      signatureHeader: validSignature,
      secret,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MISSING_BODY');
  });

  it('rejects when signatureHeader is missing', () => {
    const result = verifyWhatsAppSignature({
      rawBody,
      signatureHeader: undefined,
      secret,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MISSING_SIGNATURE');
  });

  it('rejects when secret is missing or empty', () => {
    const result = verifyWhatsAppSignature({
      rawBody,
      signatureHeader: validSignature,
      secret: '',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MISSING_SECRET');
  });
});
