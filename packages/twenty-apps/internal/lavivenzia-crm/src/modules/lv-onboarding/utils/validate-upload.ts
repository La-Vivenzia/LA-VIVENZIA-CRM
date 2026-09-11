import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  formatBytes,
  isAllowedDocumentMimeType,
  MAX_DOCUMENT_BYTES,
  MIN_DOCUMENT_BYTES,
} from 'src/modules/lv-onboarding/constants/document-policy';

// The accept/reject decision for one uploaded file.
//
// Pure, so the same rule runs in the browser (fast feedback) and again in the
// logic function (the decision that actually counts). The browser copy is a
// convenience; the server copy is the enforcement, because anything a client
// checks a client can skip.

export type UploadRefusal =
  | 'EMPTY_FILE'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'MISSING_FILENAME';

export type UploadValidation =
  | { ok: true }
  | { ok: false; refusal: UploadRefusal; message: string };

const refuse = (refusal: UploadRefusal, message: string): UploadValidation => ({
  ok: false,
  refusal,
  message,
});

export const validateUpload = ({
  filename,
  mimeType,
  sizeBytes,
}: {
  filename: string | null | undefined;
  // The type detected from the file's bytes, not the one the client claimed.
  mimeType: string | null | undefined;
  sizeBytes: number | null | undefined;
}): UploadValidation => {
  if (typeof filename !== 'string' || filename.trim().length === 0) {
    return refuse('MISSING_FILENAME', 'The file has no name.');
  }

  const size = typeof sizeBytes === 'number' ? sizeBytes : 0;

  if (!Number.isFinite(size) || size < MIN_DOCUMENT_BYTES) {
    return refuse('EMPTY_FILE', 'That file is empty.');
  }

  if (size > MAX_DOCUMENT_BYTES) {
    return refuse(
      'TOO_LARGE',
      `That file is ${formatBytes(size)}. The limit is ${formatBytes(MAX_DOCUMENT_BYTES)}.`,
    );
  }

  if (!isAllowedDocumentMimeType(mimeType)) {
    return refuse(
      'UNSUPPORTED_TYPE',
      `Please upload one of ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}. ` +
        `That file is ${mimeType ?? 'of an unrecognised type'}.`,
    );
  }

  return { ok: true };
};

// A stored path is an identifier, never a filesystem path. It must stay inside
// the workspace prefix the server assigned, so anything that could climb out of
// it is refused before it is written to a record.
export const isSafeStoredPath = (path: string | null | undefined): boolean => {
  if (typeof path !== 'string' || path.trim().length === 0) {
    return false;
  }

  const value = path.trim();

  if (value.includes(String.fromCharCode(92))) {
    return false;
  }

  if (value.startsWith('/') || /^[a-zA-Z]:/.test(value)) {
    return false;
  }

  if (/(^|\/)\.\.(\/|$)/.test(value)) {
    return false;
  }

  // A full URL would mean the record points somewhere the storage driver does
  // not control.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return false;
  }

  return true;
};
