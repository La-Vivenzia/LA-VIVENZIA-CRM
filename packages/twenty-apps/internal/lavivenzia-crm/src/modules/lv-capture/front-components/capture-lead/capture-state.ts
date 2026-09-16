import { type LeadCaptureMode } from 'src/modules/lv-core/constants/lead-taxonomy';

// The capture screen's state machine, kept apart from React so the
// transitions are unit-testable and the component only renders.
//
//   CHOOSE ──▶ INPUT ──▶ EXTRACTING ──▶ REVIEW ──▶ CHECKING ──▶ DECIDE ──▶ CREATING ──▶ SUCCESS
//                 └───────────────────────▲            (duplicates / assignment)
//   (manual methods skip EXTRACTING; IMPORT has its own steps in import-state.ts)

export type ReviewField = { value: string; extracted: boolean; confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null };

export type ReviewFields = Record<string, ReviewField>;

export type Extraction = { status: 'EXTRACTED' | 'UNAVAILABLE' | 'FAILED' | 'NOT_APPLICABLE' | 'SKIPPED'; kind: 'OCR' | 'PAGE_METADATA' | null; runId: string | null; reason: string | null; notes: string | null; fieldCount: number };

export type Classification = { status: 'AI_SUGGESTED' | 'REVIEW_REQUIRED' | 'UNAVAILABLE'; category: string | null; subcategory: string | null; confidence: number | null; reasoning: string | null; runId: string | null } | null;

export type ClassificationDecision = 'ACCEPTED' | 'EDITED' | 'REJECTED' | 'MANUAL' | 'NOT_RUN' | 'UNAVAILABLE';

export type DuplicateCandidateView = { leadId: string; lvLeadId: string | null; name: string | null; organisationName: string | null; location: string | null; status: string | null; percent: number; strength: 'STRONG' | 'POSSIBLE'; matchingFields: string[] };

export type DuplicateDecision = 'NONE' | 'CREATE_NEW' | 'IGNORED';

export type Recommendation = { memberId: string | null; displayName: string | null; strategy: string; reasons: string[]; noMatchReason: string | null; candidates: { memberId: string; displayName: string; eligible: boolean; reason: string | null }[] } | null;

export type AssignmentChoice = { mode: 'ENGINE' | 'SELF' | 'MEMBER' | 'NONE'; memberId: string | null };

export type Phase = 'CHOOSE' | 'INPUT' | 'EXTRACTING' | 'REVIEW' | 'CHECKING' | 'DECIDE' | 'CREATING' | 'SUCCESS';

export type CaptureState = {
  phase: Phase;
  captureKey: string;
  method: LeadCaptureMode | null;
  // What the person pasted / typed as the primary input (URL, handle, notes).
  rawInput: string;
  attachment: { fileId: string; label: string; mimeType: string; size: number; previewUrl: string | null } | null;
  fields: ReviewFields;
  extraction: Extraction;
  classification: Classification;
  classificationDecision: ClassificationDecision;
  quality: { code: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; kind: 'MISSING' | 'INVALID' | 'WARNING'; field: string | null; text: string }[];
  duplicates: DuplicateCandidateView[];
  duplicateDecision: DuplicateDecision;
  recommendation: Recommendation;
  assignment: AssignmentChoice;
  error: string | null;
  // Set once the person has looked at the review screen.
  confirmed: boolean;
  result: { leadId: string; lvLeadId: string | null; ownerId: string | null; ownerName: string | null; assignment: { state: string; reason: string | null }; task: { id: string; title: string; dueAt: string | null; priority: string } | null; taskError: string | null; replayed: boolean } | null;
};

export const REVIEW_FIELD_KEYS = ['name', 'organisationName', 'jobTitle', 'phone', 'email', 'websiteUrl', 'instagramHandle', 'socialProfileUrl', 'location', 'category', 'subcategory', 'source', 'priority', 'referrerName', 'notes'] as const;

// The sandboxed renderer does not always expose crypto.randomUUID; the
// fallback still produces a well-formed v4 UUID (the routes validate the shape).
const hex = (count: number): string => Array.from({ length: count }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const newKey = (): string => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${hex(8)}-${hex(4)}-4${hex(3)}-${['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`);

export const emptyFields = (): ReviewFields => Object.fromEntries(REVIEW_FIELD_KEYS.map((key) => [key, { value: '', extracted: false, confidence: null }]));

export const initialCaptureState = (method: LeadCaptureMode | null = null): CaptureState => ({
  phase: method ? 'INPUT' : 'CHOOSE',
  captureKey: newKey(),
  method,
  rawInput: '',
  attachment: null,
  fields: emptyFields(),
  extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, reason: null, notes: null, fieldCount: 0 },
  classification: null,
  classificationDecision: 'NOT_RUN',
  quality: [],
  duplicates: [],
  duplicateDecision: 'NONE',
  recommendation: null,
  assignment: { mode: 'ENGINE', memberId: null },
  error: null,
  confirmed: false,
  result: null,
});

export const chooseMethod = (state: CaptureState, method: LeadCaptureMode): CaptureState => ({ ...initialCaptureState(method), captureKey: state.captureKey });

export const setField = (state: CaptureState, key: string, value: string): CaptureState => {
  const current = state.fields[key] ?? { value: '', extracted: false, confidence: null };
  // Editing an extracted value makes it the person's own.
  const extracted = current.extracted && value === current.value;

  return { ...state, fields: { ...state.fields, [key]: { value, extracted, confidence: extracted ? current.confidence : null } }, error: null };
};

// Apply an extraction result: extracted values land in empty fields (a
// value the person already typed is never overwritten) and are marked so
// the review screen can show confidence and provenance.
export const applyExtraction = (
  state: CaptureState,
  result: { status: Extraction['status']; kind: Extraction['kind']; runId: string | null; reason?: string | null; notes?: string | null; fields?: { field: string; value: string | null; confidence: number; label: 'HIGH' | 'MEDIUM' | 'LOW' }[] },
): CaptureState => {
  const fields = { ...state.fields };
  let fieldCount = 0;

  for (const extracted of result.fields ?? []) {
    if (extracted.value === null || !(extracted.field in fields) || fields[extracted.field]!.value.length > 0) {
      continue;
    }

    fields[extracted.field] = { value: extracted.value, extracted: true, confidence: extracted.label };
    fieldCount += 1;
  }

  return {
    ...state,
    phase: 'REVIEW',
    fields,
    extraction: { status: result.status, kind: result.kind, runId: result.runId, reason: result.reason ?? null, notes: result.notes ?? null, fieldCount },
    error: null,
  };
};

// The request body for preflight / create, from the review fields.
export const toRequestFields = (state: CaptureState): Record<string, unknown> => {
  const fields: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(state.fields)) {
    if (field.value.trim().length > 0) {
      fields[key] = field.value.trim();
    }
  }

  if (state.rawInput.trim().length > 0) {
    fields.rawInput = state.rawInput.trim();
  }

  fields.extractedFields = Object.entries(state.fields).filter(([, field]) => field.extracted && field.value.length > 0).map(([key]) => key);
  fields.extractionKind = state.extraction.kind;
  fields.isHumanConfirmed = state.confirmed;
  fields.classificationOrigin = state.classificationDecision === 'ACCEPTED' ? 'AI' : state.fields.category?.value ? 'USER' : null;
  fields.attachmentPath = state.attachment?.fileId ?? null;

  if (state.method === 'INSTAGRAM' || state.method === 'INSTAGRAM_POST') {
    fields.instagramHandle = fields.instagramHandle ?? state.rawInput.trim();
  }

  if (state.method === 'LINKEDIN_PROFILE' || state.method === 'SOCIAL_HANDLE') {
    fields.socialProfileUrl = fields.socialProfileUrl ?? state.rawInput.trim();
  }

  if (state.method === 'WEBSITE_URL') {
    fields.websiteUrl = fields.websiteUrl ?? state.rawInput.trim();
  }

  return fields;
};

export const applyPreflight = (
  state: CaptureState,
  result: {
    draft: { name: string; category: string | null; subcategory: string | null; source: string; completeness: number };
    quality: CaptureState['quality'];
    duplicates: DuplicateCandidateView[];
    classification: Classification;
    recommendation: Recommendation;
  },
): CaptureState => {
  const fields = { ...state.fields };

  // The builder derived a name (from a domain or handle) — show it so the
  // person can accept or change it before creation.
  // (The builder's "Unidentified capture" placeholder for a bare image is
  // not a name — the field stays empty so the person types the real one.)
  if (fields.name && fields.name.value.length === 0 && result.draft.name && result.draft.name !== 'Unidentified capture') {
    fields.name = { value: result.draft.name, extracted: true, confidence: 'LOW' };
  }

  if (fields.source && fields.source.value.length === 0) {
    fields.source = { value: result.draft.source, extracted: false, confidence: null };
  }

  // A confident classification fills an empty category; below the threshold
  // it stays a suggestion the person must accept.
  let classificationDecision = state.classificationDecision;

  if (result.classification && fields.category && fields.category.value.length === 0) {
    if (result.classification.status === 'AI_SUGGESTED' && result.classification.category) {
      fields.category = { value: result.classification.category, extracted: true, confidence: 'HIGH' };
      fields.subcategory = { value: result.classification.subcategory ?? '', extracted: true, confidence: 'HIGH' };
      classificationDecision = 'ACCEPTED';
    } else if (result.classification.status === 'UNAVAILABLE') {
      classificationDecision = 'UNAVAILABLE';
    }
  } else if (result.classification === null && fields.category?.value) {
    classificationDecision = classificationDecision === 'ACCEPTED' || classificationDecision === 'EDITED' ? classificationDecision : 'MANUAL';
  }

  return {
    ...state,
    phase: result.duplicates.length > 0 || state.phase === 'CHECKING' ? 'DECIDE' : state.phase,
    fields,
    quality: result.quality,
    duplicates: result.duplicates,
    classification: result.classification ?? state.classification,
    classificationDecision,
    recommendation: result.recommendation,
    assignment: state.assignment.mode === 'ENGINE' && result.recommendation && result.recommendation.memberId === null ? { mode: 'SELF', memberId: null } : state.assignment,
    error: null,
  };
};

export const acceptClassification = (state: CaptureState): CaptureState =>
  state.classification?.category ? { ...state, fields: { ...state.fields, category: { value: state.classification.category, extracted: true, confidence: 'HIGH' }, subcategory: { value: state.classification.subcategory ?? '', extracted: true, confidence: 'HIGH' } }, classificationDecision: 'ACCEPTED' } : state;

export const rejectClassification = (state: CaptureState): CaptureState => ({ ...state, fields: { ...state.fields, category: { value: '', extracted: false, confidence: null }, subcategory: { value: '', extracted: false, confidence: null } }, classificationDecision: 'REJECTED' });

export const editClassification = (state: CaptureState, category: string, subcategory: string): CaptureState => ({
  ...state,
  fields: { ...state.fields, category: { value: category, extracted: false, confidence: null }, subcategory: { value: subcategory, extracted: false, confidence: null } },
  classificationDecision: state.classification?.category ? (category === state.classification.category && subcategory === (state.classification.subcategory ?? '') ? 'ACCEPTED' : 'EDITED') : 'MANUAL',
});

export const decideDuplicates = (state: CaptureState, decision: DuplicateDecision): CaptureState => ({ ...state, duplicateDecision: decision });

export const chooseAssignment = (state: CaptureState, assignment: AssignmentChoice): CaptureState => ({ ...state, assignment });

// Whether the CREATE button may be pressed: reviewed, no unresolved
// duplicate, a name (or something a name can be derived from).
export const canCreate = (state: CaptureState): { ok: boolean; reason: string | null } => {
  if (!state.confirmed) {
    return { ok: false, reason: 'Review the details first.' };
  }

  if (state.duplicates.length > 0 && state.duplicateDecision === 'NONE') {
    return { ok: false, reason: 'Decide what to do about the possible duplicate.' };
  }

  const hasIdentity = ['name', 'organisationName', 'websiteUrl', 'instagramHandle', 'socialProfileUrl'].some((key) => (state.fields[key]?.value ?? '').trim().length > 0) || state.rawInput.trim().length > 0;

  if (!hasIdentity) {
    return { ok: false, reason: 'A name, organisation, website or profile is required.' };
  }

  return { ok: true, reason: null };
};
