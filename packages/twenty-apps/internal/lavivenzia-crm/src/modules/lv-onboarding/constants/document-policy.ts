// What a partner is allowed to upload, and how big it may be.
//
// Twenty already sniffs magic bytes (`file-type`) rather than trusting the
// extension, so a renamed executable is detected as what it really is. What
// Twenty does not do is restrict the result to a set — it will happily store
// any type it can identify. This policy is that missing allowlist.
//
// Identity papers, registrations and insurance certificates arrive as scans or
// photographs, so the list is deliberately short. Anything outside it is
// refused rather than stored and quietly ignored, because a document nobody
// can open is worse than a document that was never accepted.

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedDocumentMimeType =
  (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

// Extensions are only used for the file picker's `accept` hint and for error
// messages. They are never the basis of an accept/reject decision — the MIME
// type detected from the bytes is.
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
] as const;

// 15 MB. A phone photograph of a passport is 2-6 MB and a multi-page scanned
// PDF rarely exceeds 10 MB, so this accepts real documents while refusing the
// accidental upload of a video.
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export const MIN_DOCUMENT_BYTES = 1;

export const isAllowedDocumentMimeType = (
  mimeType: string | null | undefined,
): mimeType is AllowedDocumentMimeType =>
  typeof mimeType === 'string' &&
  (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(
    mimeType.toLowerCase().trim(),
  );

// Which types a browser can render inline. Everything else is offered as a
// download instead of being embedded in a viewer that would show nothing.
export const BROWSER_PREVIEWABLE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type PreviewMode = 'IMAGE' | 'PDF' | 'DOWNLOAD_ONLY';

export const previewModeFor = (
  mimeType: string | null | undefined,
): PreviewMode => {
  const normalised = (mimeType ?? '').toLowerCase().trim();

  if (normalised === 'application/pdf') {
    return 'PDF';
  }

  if (normalised.startsWith('image/') && isAllowedDocumentMimeType(normalised)) {
    return 'IMAGE';
  }

  return 'DOWNLOAD_ONLY';
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'unknown size';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
