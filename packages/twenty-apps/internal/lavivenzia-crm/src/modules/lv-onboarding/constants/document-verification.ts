// Document verification vocabulary and state machine.
//
// Storage note: binaries never touch PostgreSQL. Twenty's FILES field stores a
// resource path; the bytes go to the configured file-storage driver. For
// production that driver is S3-compatible pointed at Cloudflare R2 — see
// docs/STORAGE-R2.md. No new driver is written here, because Twenty's existing
// s3.driver.ts already accepts a custom endpoint, which is all R2 needs.

export const DOCUMENT_VERIFICATION_STATES = [
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
  'NEEDS_REPLACEMENT',
] as const;

export type DocumentVerificationState =
  (typeof DOCUMENT_VERIFICATION_STATES)[number];

export const DOCUMENT_VERIFICATION_STATE_LABELS: Record<
  DocumentVerificationState,
  string
> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  NEEDS_REPLACEMENT: 'Needs replacement',
};

// The specific problems a reviewer can record. ONBOARDING.md lists these as the
// things AI document verification would eventually check; today a human sets
// them, and a Phase 2 extractor would raise the same flags as SUGGESTIONS for a
// person to confirm — never as a decision.
export const DOCUMENT_VERIFICATION_FLAGS = [
  'UNREADABLE',
  'MISSING_PAGE',
  'EXPIRED',
  'NAME_MISMATCH',
  'INCONSISTENT_INFORMATION',
  'DUPLICATE',
  'WRONG_DOCUMENT_TYPE',
] as const;

export type DocumentVerificationFlag =
  (typeof DOCUMENT_VERIFICATION_FLAGS)[number];

export const DOCUMENT_VERIFICATION_FLAG_LABELS: Record<
  DocumentVerificationFlag,
  string
> = {
  UNREADABLE: 'Unreadable',
  MISSING_PAGE: 'Missing page',
  EXPIRED: 'Expired',
  NAME_MISMATCH: 'Name mismatch',
  INCONSISTENT_INFORMATION: 'Inconsistent information',
  DUPLICATE: 'Duplicate',
  WRONG_DOCUMENT_TYPE: 'Wrong document type',
};

// Flags that mean the partner must send a different file, as opposed to flags a
// reviewer might resolve by asking a question. These drive the default outcome
// when a reviewer records problems.
const REPLACEMENT_FLAGS = new Set<DocumentVerificationFlag>([
  'UNREADABLE',
  'MISSING_PAGE',
  'EXPIRED',
  'WRONG_DOCUMENT_TYPE',
]);

export const flagRequiresReplacement = (
  flag: DocumentVerificationFlag,
): boolean => REPLACEMENT_FLAGS.has(flag);

// Allowed state transitions. Anything not listed is refused.
//
//   PENDING -> UNDER_REVIEW -> VERIFIED | REJECTED | NEEDS_REPLACEMENT
//   VERIFIED -> EXPIRED                   (its expiry date passed)
//   VERIFIED -> NEEDS_REPLACEMENT         (superseded, or a later problem found)
//   EXPIRED / REJECTED / NEEDS_REPLACEMENT -> PENDING   (partner re-uploads)
export const DOCUMENT_TRANSITIONS: Record<
  DocumentVerificationState,
  readonly DocumentVerificationState[]
> = {
  PENDING: ['UNDER_REVIEW', 'REJECTED', 'NEEDS_REPLACEMENT'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED', 'NEEDS_REPLACEMENT', 'PENDING'],
  VERIFIED: ['EXPIRED', 'NEEDS_REPLACEMENT', 'UNDER_REVIEW'],
  REJECTED: ['PENDING'],
  EXPIRED: ['PENDING', 'NEEDS_REPLACEMENT'],
  NEEDS_REPLACEMENT: ['PENDING'],
};

// A reviewer must own these outcomes; they are never applied automatically.
// EXPIRED is the deliberate exception: a date passing is a fact, not a
// judgement, so the system may set it without a human.
export const HUMAN_ONLY_DOCUMENT_STATES: readonly DocumentVerificationState[] = [
  'VERIFIED',
  'REJECTED',
  'NEEDS_REPLACEMENT',
];

export const DOCUMENT_REASON_REQUIRED_STATES: readonly DocumentVerificationState[] =
  ['REJECTED', 'NEEDS_REPLACEMENT'];

// Only a verified document counts towards approving a partner. Everything else
// — including a document that was verified but has since expired — blocks it.
export const isDocumentAcceptable = (
  state: DocumentVerificationState,
): boolean => state === 'VERIFIED';

export const canTransitionDocument = (
  from: DocumentVerificationState,
  to: DocumentVerificationState,
): boolean => DOCUMENT_TRANSITIONS[from].includes(to);

export const isDocumentVerificationState = (
  value: string,
): value is DocumentVerificationState =>
  (DOCUMENT_VERIFICATION_STATES as readonly string[]).includes(value);

export const isDocumentVerificationFlag = (
  value: string,
): value is DocumentVerificationFlag =>
  (DOCUMENT_VERIFICATION_FLAGS as readonly string[]).includes(value);
