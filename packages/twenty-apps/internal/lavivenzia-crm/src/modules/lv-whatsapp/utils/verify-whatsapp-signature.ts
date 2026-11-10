import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignatureVerificationResult = {
  valid: boolean;
  reason?:
    | 'MISSING_SECRET'
    | 'MISSING_BODY'
    | 'MISSING_SIGNATURE'
    | 'INVALID_SIGNATURE_FORMAT'
    | 'INVALID_SIGNATURE';
};

export const verifyWhatsAppSignature = ({
  rawBody,
  signatureHeader,
  secret,
}: {
  rawBody?: string | null;
  signatureHeader?: string | null;
  secret?: string | null;
}): SignatureVerificationResult => {
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    return { valid: false, reason: 'MISSING_SECRET' };
  }

  if (typeof rawBody !== 'string') {
    return { valid: false, reason: 'MISSING_BODY' };
  }

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'MISSING_SIGNATURE' };
  }

  // Meta sends signature in format: sha256=<hex_digest>
  const prefix = 'sha256=';
  const trimmed = signatureHeader.trim();

  if (!trimmed.toLowerCase().startsWith(prefix)) {
    return { valid: false, reason: 'INVALID_SIGNATURE_FORMAT' };
  }

  const providedHex = trimmed.slice(prefix.length).trim().toLowerCase();
  const trimmedSecret = secret.trim();

  const expectedHex = createHmac('sha256', trimmedSecret)
    .update(rawBody, 'utf8')
    .digest('hex')
    .toLowerCase();

  // Must have equal byte length for timingSafeEqual (64 hex chars = 32 bytes)
  if (providedHex.length !== expectedHex.length) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  // Compare the actual binary byte digests
  const providedBuffer = Buffer.from(providedHex, 'hex');
  const expectedBuffer = Buffer.from(expectedHex, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  const isValid = timingSafeEqual(providedBuffer, expectedBuffer);

  return isValid
    ? { valid: true }
    : { valid: false, reason: 'INVALID_SIGNATURE' };
};
