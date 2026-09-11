import { describe, expect, it } from 'vitest';

import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  previewModeFor,
} from 'src/modules/lv-onboarding/constants/document-policy';
import {
  isSafeStoredPath,
  validateUpload,
} from 'src/modules/lv-onboarding/utils/validate-upload';

const valid = {
  filename: 'passport.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024 * 1024,
};

describe('validateUpload', () => {
  it.each(ALLOWED_DOCUMENT_MIME_TYPES)('accepts %s', (mimeType) => {
    expect(validateUpload({ ...valid, mimeType }).ok).toBe(true);
  });

  it.each([
    'application/x-msdownload',
    'application/x-sh',
    'text/html',
    'application/zip',
    'video/mp4',
    'application/octet-stream',
  ])('refuses %s', (mimeType) => {
    const result = validateUpload({ ...valid, mimeType });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('UNSUPPORTED_TYPE');
    }
  });

  it('refuses an executable even when it is named like a PDF', () => {
    // The detected type is what decides — this is exactly the rename attack.
    const result = validateUpload({
      filename: 'totally-a-passport.pdf',
      mimeType: 'application/x-msdownload',
      sizeBytes: 5000,
    });

    expect(result.ok).toBe(false);
  });

  it('refuses an empty file', () => {
    const result = validateUpload({ ...valid, sizeBytes: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('EMPTY_FILE');
    }
  });

  it('accepts a file exactly at the limit and refuses one byte more', () => {
    expect(validateUpload({ ...valid, sizeBytes: MAX_DOCUMENT_BYTES }).ok).toBe(
      true,
    );

    const tooBig = validateUpload({
      ...valid,
      sizeBytes: MAX_DOCUMENT_BYTES + 1,
    });

    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) {
      expect(tooBig.refusal).toBe('TOO_LARGE');
      expect(tooBig.message).toContain('15.0 MB');
    }
  });

  it.each([null, undefined, '', '   '])('refuses filename %p', (filename) => {
    const result = validateUpload({ ...valid, filename });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toBe('MISSING_FILENAME');
    }
  });

  it('is case-insensitive about the detected type', () => {
    expect(validateUpload({ ...valid, mimeType: 'APPLICATION/PDF' }).ok).toBe(
      true,
    );
  });
});

describe('isSafeStoredPath', () => {
  it('accepts a normal workspace-relative key', () => {
    expect(isSafeStoredPath('b1e288f0/9f0c-doc.pdf')).toBe(true);
  });

  it.each([
    ['climbing out', '../../etc/passwd'],
    ['nested climb', 'docs/../../secret.pdf'],
    ['absolute posix', '/etc/passwd'],
    ['windows drive', 'C:/Windows/system32'],
    ['backslashes', `docs${String.fromCharCode(92)}evil.pdf`],
    ['absolute url', 'https://evil.example.com/x.pdf'],
    ['empty', ''],
    ['null', null],
  ])('refuses %s', (_label, path) => {
    expect(isSafeStoredPath(path as string | null)).toBe(false);
  });

  it('does not refuse a filename that merely contains dots', () => {
    expect(isSafeStoredPath('folder/my.passport.scan.pdf')).toBe(true);
  });
});

describe('previewModeFor', () => {
  it('renders images inline', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(previewModeFor(mime)).toBe('IMAGE');
    }
  });

  it('renders PDFs in a PDF view', () => {
    expect(previewModeFor('application/pdf')).toBe('PDF');
  });

  it('offers download for anything it cannot render', () => {
    expect(previewModeFor('application/zip')).toBe('DOWNLOAD_ONLY');
    expect(previewModeFor(null)).toBe('DOWNLOAD_ONLY');
    // An image type outside the allowlist is not previewed either.
    expect(previewModeFor('image/tiff')).toBe('DOWNLOAD_ONLY');
  });
});
