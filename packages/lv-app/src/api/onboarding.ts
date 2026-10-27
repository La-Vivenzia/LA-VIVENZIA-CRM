import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { callRoute, graphql } from 'src/api/client';

// Partner onboarding.
//
// This is EXTERNAL partner onboarding — a villa owner or a chef completing
// their own profile so La Vivenzia can put them live. It has nothing to do
// with Twenty's own `core-modules/onboarding`, which walks a new workspace
// user through creating a workspace. The two never meet.
//
// Three routes exist and all three are writes:
//   /onboarding/documents/register   records an uploaded file as a document
//   /onboarding/documents/review     a reviewer's decision on one document
//   /onboarding/transition           a change of onboarding status
//
// There is no read route, so everything on screen is read through GraphQL
// against `lvOnboardings` and `lvOnboardingDocuments` with the signed-in
// person's own token — the server applies their permissions, and this file
// never decides what someone may see.

// ---------------------------------------------------------------------------
// Vocabulary, mirrored from the app's own constants. Every list below has a
// named source file; nothing here is invented, and nothing is a superset of
// what the state machine will accept.
// ---------------------------------------------------------------------------

/** `constants/onboarding-status.ts`. */
export const ONBOARDING_STATUSES = [
  'NOT_STARTED',
  'INVITED',
  'INITIATED',
  'IN_PROGRESS',
  'WAITING_FOR_PARTNER',
  'VERIFICATION',
  'INTERNAL_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'ACTIVATED',
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  NOT_STARTED: 'Not started',
  INVITED: 'Invited',
  INITIATED: 'Initiated',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_PARTNER: 'Waiting for partner',
  VERIFICATION: 'Verification',
  INTERNAL_REVIEW: 'Internal review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVATED: 'Activated',
};

/** `ONBOARDING_TRANSITIONS`. Anything not listed here the server refuses. */
export const ONBOARDING_TRANSITIONS: Record<OnboardingStatus, readonly OnboardingStatus[]> = {
  NOT_STARTED: ['INVITED'],
  INVITED: ['INITIATED', 'REJECTED'],
  INITIATED: ['IN_PROGRESS', 'WAITING_FOR_PARTNER', 'REJECTED'],
  IN_PROGRESS: ['WAITING_FOR_PARTNER', 'VERIFICATION', 'REJECTED'],
  WAITING_FOR_PARTNER: ['IN_PROGRESS', 'VERIFICATION', 'REJECTED'],
  VERIFICATION: ['INTERNAL_REVIEW', 'CHANGES_REQUESTED', 'REJECTED'],
  INTERNAL_REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'],
  CHANGES_REQUESTED: ['IN_PROGRESS', 'WAITING_FOR_PARTNER', 'REJECTED'],
  APPROVED: ['ACTIVATED', 'REJECTED'],
  REJECTED: ['IN_PROGRESS'],
  ACTIVATED: [],
};

/** `REASON_REQUIRED_TRANSITIONS`: the server refuses these without a reason. */
export const REASON_REQUIRED_TRANSITIONS: readonly OnboardingStatus[] = ['REJECTED', 'CHANGES_REQUESTED'];

/** `HUMAN_ONLY_TRANSITIONS`: no automation may apply these. */
export const HUMAN_ONLY_TRANSITIONS: readonly OnboardingStatus[] = ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'ACTIVATED'];

export const requiresReason = (target: OnboardingStatus): boolean => REASON_REQUIRED_TRANSITIONS.includes(target);

/**
 * What each transition means in a sentence, and what it does to the partner.
 * A status name alone does not tell a reviewer what pressing it will do.
 */
export const TRANSITION_COPY: Record<OnboardingStatus, { verb: string; consequence: string }> = {
  NOT_STARTED: { verb: 'Reset to not started', consequence: 'The onboarding goes back to having had nothing done to it.' },
  INVITED: { verb: 'Invite the partner', consequence: 'The partner is invited to fill in their profile.' },
  INITIATED: { verb: 'Mark as started', consequence: 'Records that the partner has begun filling the form in.' },
  IN_PROGRESS: { verb: 'Send back to the partner', consequence: 'The partner can edit their submission again, and it leaves your queue until they resubmit.' },
  WAITING_FOR_PARTNER: { verb: 'Mark as waiting for the partner', consequence: 'Records that nothing can move until the partner replies. The submission stays editable by them.' },
  VERIFICATION: { verb: 'Submit for verification', consequence: 'Locks the partner out of editing and puts the submission in the verification queue. Refused if any required answer is missing.' },
  INTERNAL_REVIEW: { verb: 'Move to internal review', consequence: 'Records that the documents have been checked and the decision is now with La Vivenzia.' },
  CHANGES_REQUESTED: { verb: 'Request changes', consequence: 'Sends the submission back with your reason attached. The partner can edit it again.' },
  APPROVED: { verb: 'Approve', consequence: 'Approves the partner. Refused unless every uploaded document is verified and a reviewer is named.' },
  REJECTED: { verb: 'Reject', consequence: 'Rejects this onboarding with your reason on the record. They can reapply later — the history is kept.' },
  ACTIVATED: { verb: 'Activate', consequence: 'Puts the partner live on La Vivenzia. This is the last step and nothing follows it.' },
};

/** `constants/document-verification.ts`. */
export const DOCUMENT_VERIFICATION_STATES = ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'NEEDS_REPLACEMENT'] as const;

export type DocumentVerificationState = (typeof DOCUMENT_VERIFICATION_STATES)[number];

export const DOCUMENT_STATE_LABELS: Record<DocumentVerificationState, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  NEEDS_REPLACEMENT: 'Needs replacement',
};

/** `DOCUMENT_TRANSITIONS`. The decisions offered are exactly these. */
export const DOCUMENT_TRANSITIONS: Record<DocumentVerificationState, readonly DocumentVerificationState[]> = {
  PENDING: ['UNDER_REVIEW', 'REJECTED', 'NEEDS_REPLACEMENT'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED', 'NEEDS_REPLACEMENT', 'PENDING'],
  VERIFIED: ['EXPIRED', 'NEEDS_REPLACEMENT', 'UNDER_REVIEW'],
  REJECTED: ['PENDING'],
  EXPIRED: ['PENDING', 'NEEDS_REPLACEMENT'],
  NEEDS_REPLACEMENT: ['PENDING'],
};

/** `DOCUMENT_REASON_REQUIRED_STATES`. */
export const DOCUMENT_REASON_REQUIRED: readonly DocumentVerificationState[] = ['REJECTED', 'NEEDS_REPLACEMENT'];

export const documentRequiresReason = (target: DocumentVerificationState): boolean => DOCUMENT_REASON_REQUIRED.includes(target);

/** What each document decision does, in the reviewer's terms. */
export const DOCUMENT_DECISION_COPY: Record<DocumentVerificationState, { verb: string; consequence: string }> = {
  PENDING: { verb: 'Put back to pending', consequence: 'Clears the decision. The document waits to be looked at again.' },
  UNDER_REVIEW: { verb: 'Start reviewing', consequence: 'Marks that you are looking at it. Nothing is decided yet.' },
  VERIFIED: { verb: 'Verify', consequence: 'Accepts the document. Only verified documents count towards approving the partner.' },
  REJECTED: { verb: 'Reject', consequence: 'Refuses the document with your reason on the record. It blocks approval until replaced.' },
  EXPIRED: { verb: 'Mark as expired', consequence: 'Records that its validity has run out. An expired document blocks approval.' },
  NEEDS_REPLACEMENT: { verb: 'Ask for a replacement', consequence: 'Tells the partner to send a different file, with your reason. It blocks approval until replaced.' },
};

/** `DOCUMENT_VERIFICATION_FLAGS` — the specific problems a reviewer records. */
export const DOCUMENT_FLAGS = [
  { key: 'UNREADABLE', label: 'Unreadable' },
  { key: 'MISSING_PAGE', label: 'Missing page' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'NAME_MISMATCH', label: 'Name mismatch' },
  { key: 'INCONSISTENT_INFORMATION', label: 'Inconsistent information' },
  { key: 'DUPLICATE', label: 'Duplicate' },
  { key: 'WRONG_DOCUMENT_TYPE', label: 'Wrong document type' },
] as const;

export type DocumentFlag = (typeof DOCUMENT_FLAGS)[number]['key'];

/** `DOCUMENT_TYPE_OPTIONS` in `select-options.generated.ts`. Six, no more. */
export const DOCUMENT_TYPES = [
  { key: 'IDENTITY', label: 'Identity proof' },
  { key: 'ADDRESS_PROOF', label: 'Address proof' },
  { key: 'BUSINESS_REGISTRATION', label: 'Business registration' },
  { key: 'INSURANCE', label: 'Insurance' },
  { key: 'CERTIFICATION', label: 'Certification' },
  { key: 'OTHER', label: 'Other' },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number]['key'];

export const DOCUMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(DOCUMENT_TYPES.map((type) => [type.key, type.label]));

/**
 * Which document types the DOCUMENTS step actually requires. Only the identity
 * proof is `isRequired: true` in `ONBOARDING_STEP_SPECS`; the rest are offered
 * but never demanded. The reference boards show six mandatory Indian documents
 * — that is not what this backend asks for, so it is not what is shown.
 */
export const REQUIRED_DOCUMENT_TYPES: readonly DocumentType[] = ['IDENTITY'];

/** `constants/document-policy.ts`. The server enforces the same values. */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
export const DOCUMENT_ACCEPT = [...ALLOWED_DOCUMENT_EXTENSIONS, ...ALLOWED_DOCUMENT_MIME_TYPES].join(',');

export type PreviewMode = 'IMAGE' | 'PDF' | 'DOWNLOAD_ONLY';

/** `previewModeFor` in `constants/document-policy.ts`. */
export const previewModeFor = (mimeType: string | null | undefined): PreviewMode => {
  const normalised = (mimeType ?? '').toLowerCase().trim();

  if (normalised === 'application/pdf') {
    return 'PDF';
  }

  return normalised.startsWith('image/') && ALLOWED_DOCUMENT_MIME_TYPES.includes(normalised) ? 'IMAGE' : 'DOWNLOAD_ONLY';
};

export const formatBytes = (bytes: number | null): string => {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return 'unknown size';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** `constants/onboarding-steps.ts`. Ten steps; the last carries no fields. */
export const ONBOARDING_STEPS = [
  'BASIC_INFORMATION',
  'ABOUT_YOU',
  'EXPERIENCE',
  'LOCATION',
  'PRICING',
  'AVAILABILITY',
  'IMAGES',
  'DOCUMENTS',
  'POLICIES',
  'FINAL_REVIEW',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingFieldKind = 'TEXT' | 'LONG_TEXT' | 'EMAIL' | 'PHONE' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'LIST' | 'FILES';

export type OnboardingFieldSpec = {
  key: string;
  label: string;
  kind: OnboardingFieldKind;
  isRequired: boolean;
  help?: string;
  minLength?: number;
  minItems?: number;
};

export type OnboardingStepSpec = { step: OnboardingStep; label: string; description: string; fields: readonly OnboardingFieldSpec[] };

/** `ONBOARDING_STEP_SPECS`, field for field. */
export const ONBOARDING_STEP_SPECS: readonly OnboardingStepSpec[] = [
  {
    step: 'BASIC_INFORMATION',
    label: 'Basic information',
    description: 'How we reach you and what to call you.',
    fields: [
      { key: 'legalName', label: 'Full legal name', kind: 'TEXT', isRequired: true },
      { key: 'displayName', label: 'Display name', kind: 'TEXT', isRequired: true, help: 'How guests will see you' },
      { key: 'email', label: 'Email', kind: 'EMAIL', isRequired: true },
      { key: 'phone', label: 'Phone', kind: 'PHONE', isRequired: true },
      { key: 'organisationName', label: 'Business name', kind: 'TEXT', isRequired: false },
      { key: 'languages', label: 'Languages you speak', kind: 'LIST', isRequired: false },
    ],
  },
  {
    step: 'ABOUT_YOU',
    label: 'About you',
    description: 'Your story, in your own words.',
    fields: [
      { key: 'bio', label: 'About you', kind: 'LONG_TEXT', isRequired: true, minLength: 80, help: 'What should a guest know about you?' },
      { key: 'yearsOfExperience', label: 'Years of experience', kind: 'NUMBER', isRequired: false },
      { key: 'website', label: 'Website', kind: 'TEXT', isRequired: false },
      { key: 'instagram', label: 'Instagram', kind: 'TEXT', isRequired: false },
    ],
  },
  {
    step: 'EXPERIENCE',
    label: 'Experience',
    description: 'What you offer.',
    fields: [
      { key: 'title', label: 'Experience or property name', kind: 'TEXT', isRequired: true },
      { key: 'description', label: 'Description', kind: 'LONG_TEXT', isRequired: true, minLength: 120 },
      { key: 'category', label: 'Category', kind: 'TEXT', isRequired: true },
      { key: 'durationMinutes', label: 'Typical duration (minutes)', kind: 'NUMBER', isRequired: false },
      { key: 'capacity', label: 'Maximum guests', kind: 'NUMBER', isRequired: true },
      { key: 'inclusions', label: "What's included", kind: 'LIST', isRequired: false },
    ],
  },
  {
    step: 'LOCATION',
    label: 'Location',
    description: 'Where this happens.',
    fields: [
      { key: 'addressLine', label: 'Address', kind: 'TEXT', isRequired: true },
      { key: 'city', label: 'City', kind: 'TEXT', isRequired: true },
      { key: 'state', label: 'State', kind: 'TEXT', isRequired: true },
      { key: 'country', label: 'Country', kind: 'TEXT', isRequired: true },
      { key: 'pincode', label: 'PIN code', kind: 'TEXT', isRequired: false },
      { key: 'directions', label: 'How to find it', kind: 'LONG_TEXT', isRequired: false },
    ],
  },
  {
    step: 'PRICING',
    label: 'Pricing',
    description: 'What it costs.',
    fields: [
      { key: 'basePrice', label: 'Base price (INR)', kind: 'NUMBER', isRequired: true },
      { key: 'priceUnit', label: 'Priced per', kind: 'TEXT', isRequired: true, help: 'Per person, per night, per group' },
      { key: 'minimumGuests', label: 'Minimum guests', kind: 'NUMBER', isRequired: false },
      { key: 'additionalCharges', label: 'Additional charges', kind: 'LONG_TEXT', isRequired: false },
    ],
  },
  {
    step: 'AVAILABILITY',
    label: 'Availability',
    description: 'When you can host.',
    fields: [
      { key: 'availableDays', label: 'Available days', kind: 'LIST', isRequired: true, minItems: 1 },
      { key: 'noticePeriodHours', label: 'Notice needed (hours)', kind: 'NUMBER', isRequired: true },
      { key: 'seasonalNotes', label: 'Seasonal notes', kind: 'LONG_TEXT', isRequired: false },
    ],
  },
  {
    step: 'IMAGES',
    label: 'Images',
    description: 'Show it. Photographs matter more than words here.',
    fields: [
      { key: 'images', label: 'Photographs', kind: 'FILES', isRequired: true, minItems: 3, help: 'At least three' },
      { key: 'coverImage', label: 'Cover photograph', kind: 'FILES', isRequired: false, minItems: 1 },
    ],
  },
  {
    step: 'DOCUMENTS',
    label: 'Documents',
    description: 'Verification documents. Only a reviewer sees these.',
    fields: [
      { key: 'identityDocument', label: 'Identity proof', kind: 'FILES', isRequired: true, minItems: 1 },
      { key: 'addressProof', label: 'Address proof', kind: 'FILES', isRequired: false, minItems: 1 },
      { key: 'businessRegistration', label: 'Business registration', kind: 'FILES', isRequired: false, minItems: 1 },
      { key: 'insurance', label: 'Insurance', kind: 'FILES', isRequired: false, minItems: 1 },
    ],
  },
  {
    step: 'POLICIES',
    label: 'Policies',
    description: 'The rules guests agree to.',
    fields: [
      { key: 'cancellationPolicy', label: 'Cancellation policy', kind: 'LONG_TEXT', isRequired: true, minLength: 40 },
      { key: 'houseRules', label: 'House rules', kind: 'LONG_TEXT', isRequired: false },
      { key: 'safetyMeasures', label: 'Safety measures', kind: 'LONG_TEXT', isRequired: false },
      { key: 'agreesToTerms', label: 'I accept the La Vivenzia partner terms', kind: 'BOOLEAN', isRequired: true },
    ],
  },
  { step: 'FINAL_REVIEW', label: 'Final review', description: 'Check everything, then submit for review.', fields: [] },
];

export const stepSpec = (step: OnboardingStep): OnboardingStepSpec =>
  ONBOARDING_STEP_SPECS.find((candidate) => candidate.step === step) ?? ONBOARDING_STEP_SPECS[0];

/** `DATA_BEARING_STEPS`: progress is measured against the nine with fields. */
export const DATA_BEARING_STEPS = ONBOARDING_STEPS.filter((step) => step !== 'FINAL_REVIEW');

// ---------------------------------------------------------------------------
// The journey, as the state machine describes it.
//
// The eleven statuses are the truth; these five stages are a reading of them,
// and each one names the statuses it contains so nothing is hidden behind a
// friendlier word. REJECTED sits outside the journey because the machine lets
// a rejected partner reapply rather than ending there.
// ---------------------------------------------------------------------------
export type JourneyStage = { key: string; label: string; statuses: readonly OnboardingStatus[]; meaning: string };

export const ONBOARDING_JOURNEY: readonly JourneyStage[] = [
  {
    key: 'invite',
    label: 'Invited',
    statuses: ['NOT_STARTED', 'INVITED'],
    meaning: 'The partner has been asked to fill in their profile.',
  },
  {
    key: 'partner',
    label: 'With Partner',
    statuses: ['INITIATED', 'IN_PROGRESS', 'WAITING_FOR_PARTNER', 'CHANGES_REQUESTED'],
    meaning: 'The partner is filling the form in, and can still edit it.',
  },
  {
    key: 'review',
    label: 'Under Review',
    statuses: ['VERIFICATION', 'INTERNAL_REVIEW'],
    meaning: 'Submitted and locked. Verification and internal review in progress.',
  },
  {
    key: 'approved',
    label: 'Approved',
    statuses: ['APPROVED'],
    meaning: 'Approved and waiting to go live.',
  },
  {
    key: 'live',
    label: 'Live',
    statuses: ['ACTIVATED'],
    meaning: 'The partner is live on La Vivenzia.',
  },
];

export const stageOf = (status: OnboardingStatus): number => ONBOARDING_JOURNEY.findIndex((stage) => stage.statuses.includes(status));

/** The partner may still edit in these. `PARTNER_EDITABLE_STATUSES`. */
export const PARTNER_EDITABLE: readonly OnboardingStatus[] = ['INITIATED', 'IN_PROGRESS', 'WAITING_FOR_PARTNER', 'CHANGES_REQUESTED'];

/** `UNDER_REVIEW_STATUSES`: La Vivenzia holds it and the partner cannot edit. */
export const UNDER_REVIEW: readonly OnboardingStatus[] = ['VERIFICATION', 'INTERNAL_REVIEW'];

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export type OnboardingDocument = {
  id: string;
  name: string | null;
  documentType: DocumentType | null;
  verificationState: DocumentVerificationState;
  expiresAt: string | null;
  rejectionReason: string | null;
  verificationFlags: DocumentFlag[];
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  /** The signed URL of the stored file, when the FILES field carries one. */
  fileUrl: string | null;
  auditTrail: AuditEntry[];
};

export type AuditEntry = {
  event?: string;
  from?: string | null;
  to?: string | null;
  at?: string | null;
  actorWorkspaceMemberId?: string | null;
  reason?: string | null;
  note?: string | null;
};

export type OnboardingRecord = {
  id: string;
  name: string | null;
  status: OnboardingStatus;
  currentStep: OnboardingStep | null;
  progressPercentage: number | null;
  healthScore: number | null;
  answers: Record<string, Record<string, unknown>>;
  decisionReason: string | null;
  internalNotes: string | null;
  auditTrail: AuditEntry[];
  invitedAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  activatedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  leadId: string | null;
  leadName: string | null;
  leadCategory: string | null;
  leadLocation: string | null;
  documents: OnboardingDocument[];
};

const asAudit = (value: unknown): AuditEntry[] => (Array.isArray(value) ? (value as AuditEntry[]) : []);

const asAnswers = (value: unknown): Record<string, Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, Record<string, unknown>>) : {};

const memberName = (member: { name?: { firstName?: string | null; lastName?: string | null } | null } | null | undefined): string | null => {
  const joined = [member?.name?.firstName, member?.name?.lastName].filter(Boolean).join(' ').trim();

  return joined.length > 0 ? joined : null;
};

type RawDocument = {
  id: string;
  name?: string | null;
  documentType?: string | null;
  verificationState?: string | null;
  expiresAt?: string | null;
  rejectionReason?: string | null;
  verificationFlags?: unknown;
  originalFilename?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  uploadedAt?: string | null;
  verifiedAt?: string | null;
  auditTrail?: unknown;
  file?: unknown;
  reviewer?: { id?: string | null; name?: { firstName?: string | null; lastName?: string | null } | null } | null;
};

const toDocument = (row: RawDocument): OnboardingDocument => {
  const files = Array.isArray(row.file) ? (row.file as { url?: string | null }[]) : [];

  return {
    id: row.id,
    name: row.name ?? null,
    documentType: (row.documentType as DocumentType | null) ?? null,
    // The field is non-nullable on the object, but a record written before it
    // existed would still read as null; PENDING is the state the register
    // route creates, so it is the honest fallback.
    verificationState: (row.verificationState as DocumentVerificationState | null) ?? 'PENDING',
    expiresAt: row.expiresAt ?? null,
    rejectionReason: row.rejectionReason ?? null,
    verificationFlags: Array.isArray(row.verificationFlags) ? (row.verificationFlags as DocumentFlag[]) : [],
    originalFilename: row.originalFilename ?? null,
    mimeType: row.mimeType ?? null,
    fileSizeBytes: typeof row.fileSizeBytes === 'number' ? row.fileSizeBytes : null,
    uploadedAt: row.uploadedAt ?? null,
    verifiedAt: row.verifiedAt ?? null,
    reviewerId: row.reviewer?.id ?? null,
    reviewerName: memberName(row.reviewer),
    fileUrl: files[0]?.url ?? null,
    auditTrail: asAudit(row.auditTrail),
  };
};

const RECORD_QUERY = `query($id: UUID!) {
  lvOnboarding(filter: { id: { eq: $id } }) {
    id name status currentStep progressPercentage healthScore answers
    decisionReason internalNotes auditTrail
    invitedAt submittedAt decidedAt activatedAt createdAt updatedAt
    reviewer { id name { firstName lastName } }
    lead { id name category location }
    documents(orderBy: { uploadedAt: AscNullsLast }) {
      edges { node {
        id name documentType verificationState expiresAt rejectionReason verificationFlags
        originalFilename mimeType fileSizeBytes uploadedAt verifiedAt auditTrail file
        reviewer { id name { firstName lastName } }
      } }
    }
  }
}`;

type RawRecord = {
  id: string;
  name?: string | null;
  status?: string | null;
  currentStep?: string | null;
  progressPercentage?: number | null;
  healthScore?: number | null;
  answers?: unknown;
  decisionReason?: string | null;
  internalNotes?: string | null;
  auditTrail?: unknown;
  invitedAt?: string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  activatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  reviewer?: { id?: string | null; name?: { firstName?: string | null; lastName?: string | null } | null } | null;
  lead?: { id?: string | null; name?: string | null; category?: string | null; location?: string | null } | null;
  documents?: { edges?: { node?: RawDocument }[] } | null;
};

const toRecord = (row: RawRecord): OnboardingRecord => ({
  id: row.id,
  name: row.name ?? null,
  status: (row.status as OnboardingStatus | null) ?? 'NOT_STARTED',
  currentStep: (row.currentStep as OnboardingStep | null) ?? null,
  progressPercentage: typeof row.progressPercentage === 'number' ? row.progressPercentage : null,
  healthScore: typeof row.healthScore === 'number' ? row.healthScore : null,
  answers: asAnswers(row.answers),
  decisionReason: row.decisionReason ?? null,
  internalNotes: row.internalNotes ?? null,
  auditTrail: asAudit(row.auditTrail),
  invitedAt: row.invitedAt ?? null,
  submittedAt: row.submittedAt ?? null,
  decidedAt: row.decidedAt ?? null,
  activatedAt: row.activatedAt ?? null,
  createdAt: row.createdAt ?? null,
  updatedAt: row.updatedAt ?? null,
  reviewerId: row.reviewer?.id ?? null,
  reviewerName: memberName(row.reviewer),
  leadId: row.lead?.id ?? null,
  leadName: row.lead?.name ?? null,
  leadCategory: row.lead?.category ?? null,
  leadLocation: row.lead?.location ?? null,
  documents: (row.documents?.edges ?? []).map((edge) => edge.node).filter((node): node is RawDocument => Boolean(node?.id)).map(toDocument),
});

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type OnboardingSummary = {
  id: string;
  name: string | null;
  status: OnboardingStatus;
  currentStep: OnboardingStep | null;
  progressPercentage: number | null;
  healthScore: number | null;
  submittedAt: string | null;
  updatedAt: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  leadId: string | null;
  leadName: string | null;
  leadLocation: string | null;
  documentCount: number;
  verifiedCount: number;
  blockedCount: number;
};

const LIST_QUERY = `query {
  lvOnboardings(first: 200, orderBy: { updatedAt: DescNullsLast }) {
    edges { node {
      id name status currentStep progressPercentage healthScore submittedAt updatedAt
      reviewer { id name { firstName lastName } }
      lead { id name location }
      documents { edges { node { id verificationState } } }
    } }
  }
}`;

/** A blocked document is anything that is not verified and not merely waiting. */
const BLOCKING_STATES: readonly DocumentVerificationState[] = ['REJECTED', 'EXPIRED', 'NEEDS_REPLACEMENT'];

export const useOnboardingList = () => {
  const [rows, setRows] = useState<OnboardingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await graphql<{ lvOnboardings?: { edges?: { node?: RawRecord }[] } }>(LIST_QUERY);
      const list = (data.lvOnboardings?.edges ?? [])
        .map((edge) => edge.node)
        .filter((node): node is RawRecord => Boolean(node?.id))
        .map((node) => {
          const documents = (node.documents?.edges ?? []).map((edge) => edge.node).filter((doc): doc is RawDocument => Boolean(doc?.id));

          return {
            id: node.id,
            name: node.name ?? null,
            status: (node.status as OnboardingStatus | null) ?? 'NOT_STARTED',
            currentStep: (node.currentStep as OnboardingStep | null) ?? null,
            progressPercentage: typeof node.progressPercentage === 'number' ? node.progressPercentage : null,
            healthScore: typeof node.healthScore === 'number' ? node.healthScore : null,
            submittedAt: node.submittedAt ?? null,
            updatedAt: node.updatedAt ?? null,
            reviewerId: node.reviewer?.id ?? null,
            reviewerName: memberName(node.reviewer),
            leadId: node.lead?.id ?? null,
            leadName: node.lead?.name ?? null,
            leadLocation: node.lead?.location ?? null,
            documentCount: documents.length,
            verifiedCount: documents.filter((doc) => doc.verificationState === 'VERIFIED').length,
            blockedCount: documents.filter((doc) => BLOCKING_STATES.includes((doc.verificationState ?? 'PENDING') as DocumentVerificationState)).length,
          };
        });

      setRows(list);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The onboarding list could not be loaded.');
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, error, loading, reload: load };
};

export const useOnboardingRecord = (onboardingId: string | undefined) => {
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // A refresh must not blank the screen: a dialog open over the record would
  // unmount mid-decision. Only moving to a different record clears it.
  const shown = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!onboardingId) {
      return;
    }

    if (shown.current !== onboardingId) {
      setRecord(null);
      shown.current = onboardingId;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await graphql<{ lvOnboarding?: RawRecord | null }>(RECORD_QUERY, { id: onboardingId });

      if (!data.lvOnboarding?.id) {
        throw new Error('That onboarding does not exist, or your role cannot see it.');
      }

      setRecord(toRecord(data.lvOnboarding));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That onboarding could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [onboardingId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { record, error, loading, reload: load };
};

// ---------------------------------------------------------------------------
// Writing — the three real routes, and nothing else
// ---------------------------------------------------------------------------

export const registerDocument = (input: {
  onboardingId: string;
  documentType: DocumentType;
  fileId: string;
  filePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  expiresAt?: string | null;
  replacesDocumentId?: string | null;
}) => callRoute<{ documentId: string; verificationState: string; uploadedAt: string }>('/onboarding/documents/register', { ...input });

export const reviewDocument = (input: { documentId: string; to: DocumentVerificationState; reason?: string | null; flags?: DocumentFlag[] }) =>
  callRoute<{ documentId: string; from: string; state: string; at: string; flags: string[] }>('/onboarding/documents/review', {
    documentId: input.documentId,
    to: input.to,
    reason: input.reason ?? null,
    flags: input.flags ?? [],
  });

export const transitionOnboarding = (input: { onboardingId: string; to: OnboardingStatus; reason?: string | null; note?: string | null }) =>
  callRoute<{ status: string; audit: AuditEntry }>('/onboarding/transition', {
    onboardingId: input.onboardingId,
    to: input.to,
    reason: input.reason ?? null,
    note: input.note ?? null,
  });

// ---------------------------------------------------------------------------
// What the screens ask of the data
// ---------------------------------------------------------------------------

export type DocumentSummary = { total: number; verified: number; pending: number; underReview: number; rejected: number; expired: number; needsReplacement: number };

export const summariseDocuments = (documents: OnboardingDocument[]): DocumentSummary => ({
  total: documents.length,
  verified: documents.filter((doc) => doc.verificationState === 'VERIFIED').length,
  pending: documents.filter((doc) => doc.verificationState === 'PENDING').length,
  underReview: documents.filter((doc) => doc.verificationState === 'UNDER_REVIEW').length,
  rejected: documents.filter((doc) => doc.verificationState === 'REJECTED').length,
  expired: documents.filter((doc) => doc.verificationState === 'EXPIRED').length,
  needsReplacement: documents.filter((doc) => doc.verificationState === 'NEEDS_REPLACEMENT').length,
});

export type Blocker = { kind: 'DOCUMENT' | 'ANSWER' | 'REVIEWER' | 'PARTNER'; text: string; fix: string };

/**
 * What is actually standing between this onboarding and its next status,
 * derived from the same rules the server applies in `transitionOnboarding`.
 * Every entry corresponds to a refusal the server would give; nothing is
 * guessed, and an empty list means the client knows of nothing — never that
 * the server will certainly agree.
 */
export const blockersFor = (record: OnboardingRecord): Blocker[] => {
  const blockers: Blocker[] = [];
  const next = ONBOARDING_TRANSITIONS[record.status] ?? [];

  if (next.includes('APPROVED')) {
    if (record.reviewerId === null) {
      blockers.push({
        kind: 'REVIEWER',
        text: 'No reviewer is named on this onboarding.',
        fix: 'Approval requires a named reviewer to be accountable for the decision.',
      });
    }

    if (record.documents.length === 0) {
      blockers.push({ kind: 'DOCUMENT', text: 'No documents have been uploaded.', fix: 'Approval requires at least one verified document.' });
    }

    for (const doc of record.documents) {
      if (doc.verificationState !== 'VERIFIED') {
        blockers.push({
          kind: 'DOCUMENT',
          text: `${DOCUMENT_TYPE_LABELS[doc.documentType ?? ''] ?? doc.name ?? 'A document'} is ${DOCUMENT_STATE_LABELS[doc.verificationState].toLowerCase()}.`,
          fix: 'Every uploaded document must be verified before approval.',
        });
      }
    }
  }

  if (next.includes('VERIFICATION')) {
    const missing = missingAnswers(record);

    if (missing.length > 0) {
      blockers.push({
        kind: 'ANSWER',
        text: `${missing.length} required answer${missing.length === 1 ? '' : 's'} still missing, starting with "${missing[0].label}".`,
        fix: 'A submission cannot go for verification while a required answer is empty.',
      });
    }
  }

  if (PARTNER_EDITABLE.includes(record.status)) {
    blockers.push({ kind: 'PARTNER', text: 'The partner can still edit this submission.', fix: 'Nothing is final until they submit it for verification.' });
  }

  return blockers;
};

export type MissingAnswer = { step: OnboardingStep; stepLabel: string; key: string; label: string; reason: 'EMPTY' | 'TOO_SHORT' | 'TOO_FEW' };

/**
 * The required answers that are not yet filled in. The same arithmetic the
 * server runs in `validate-onboarding.ts` — kept here so the screen can name
 * what is missing rather than only relaying a refusal after the fact.
 */
export const missingAnswers = (record: OnboardingRecord): MissingAnswer[] => {
  const missing: MissingAnswer[] = [];

  for (const step of DATA_BEARING_STEPS) {
    const spec = stepSpec(step);
    const answers = record.answers[step] ?? {};

    for (const field of spec.fields) {
      if (!field.isRequired) {
        continue;
      }

      const value = answers[field.key];
      const entry = { step, stepLabel: spec.label, key: field.key, label: field.label };

      if (field.kind === 'BOOLEAN') {
        if (value !== true) {
          missing.push({ ...entry, reason: 'EMPTY' });
        }

        continue;
      }

      if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0) || (Array.isArray(value) && value.length === 0)) {
        missing.push({ ...entry, reason: 'EMPTY' });
        continue;
      }

      if (field.minLength !== undefined && typeof value === 'string' && value.trim().length < field.minLength) {
        missing.push({ ...entry, reason: 'TOO_SHORT' });
        continue;
      }

      if (field.minItems !== undefined && Array.isArray(value) && value.length < field.minItems) {
        missing.push({ ...entry, reason: 'TOO_FEW' });
      }
    }
  }

  return missing;
};

export const useStepProgress = (record: OnboardingRecord | null) =>
  useMemo(() => {
    if (!record) {
      return [];
    }

    const missing = missingAnswers(record);

    return DATA_BEARING_STEPS.map((step) => {
      const spec = stepSpec(step);
      const outstanding = missing.filter((entry) => entry.step === step);
      const answered = Object.keys(record.answers[step] ?? {}).length;

      return {
        step,
        label: spec.label,
        description: spec.description,
        requiredCount: spec.fields.filter((field) => field.isRequired).length,
        missing: outstanding,
        isComplete: outstanding.length === 0,
        isStarted: answered > 0,
      };
    });
  }, [record]);
