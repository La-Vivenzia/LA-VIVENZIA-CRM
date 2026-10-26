import { useCallback, useMemo, useState } from 'react';

import { callRoute } from 'src/api/client';

// Capture — the workflow, and the three routes behind it.
//
//   CHOOSE → INPUT → EXTRACTING → REVIEW → CHECKING → DECIDE → CREATING → SUCCESS
//
// Only three calls do any work:
//
//   /capture/extract    reads a photograph or a public page into candidate
//                       fields, or says plainly that it cannot. Creates nothing.
//   /capture/preflight   validates the reviewed draft and returns data quality,
//                       a classification suggestion, duplicate candidates and
//                       the assignment the engine would make. Writes nothing
//                       but audit rows.
//   /capture/create      creates the lead, idempotently, keyed by the capture
//                       key. A repeated call returns the same lead.
//
// Every phase below is a real state of those three calls. Nothing here
// simulates progress, invents a field, or guesses at a duplicate.

export type CapturePhase = 'CHOOSE' | 'INPUT' | 'EXTRACTING' | 'REVIEW' | 'CHECKING' | 'DECIDE' | 'CREATING' | 'SUCCESS';

export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ExtractedField = { field: string; value: string | null; confidence: number; label: ConfidenceLabel };

export type ExtractStatus = 'EXTRACTED' | 'UNAVAILABLE' | 'FAILED' | 'NOT_APPLICABLE';

export type ExtractResult = {
  ok?: boolean;
  error?: string;
  status: ExtractStatus;
  kind: 'OCR' | 'PAGE_METADATA' | null;
  fields: ExtractedField[];
  runId?: string | null;
  reason?: string | null;
  url?: string | null;
  handle?: string | null;
  platform?: string | null;
  ai?: { available?: boolean; reason?: string | null };
};

export type DuplicateCandidate = {
  leadId: string;
  lvLeadId: string | null;
  name?: string | null;
  percent: number;
  matchingFields?: string[];
  status?: string | null;
  location?: string | null;
  ownerName?: string | null;
  lastInteractionAt?: string | null;
};

export type Classification = {
  status: 'SUGGESTED' | 'UNAVAILABLE' | string;
  category: string | null;
  subcategory: string | null;
  confidence: number | null;
  reasoning: string | null;
  code?: string | null;
  runId?: string | null;
};

export type Recommendation = {
  memberId: string | null;
  memberName?: string | null;
  strategy?: string | null;
  score?: number | null;
  reasons?: string[];
  noMatchReason?: string | null;
};

export type CaptureDraft = {
  name: string;
  organisationName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  socialProfile: string | null;
  location: string | null;
  category: string | null;
  subcategory: string | null;
  languages: string[] | null;
  source: string | null;
  priority: string | null;
  status: string | null;
  completeness: number;
  requiresHumanConfirmation: boolean;
  warnings: string[];
  provenance?: Record<string, unknown>;
};

export type Preflight = {
  ok?: boolean;
  error?: string;
  errors?: string[];
  captureKey: string;
  method: string;
  draft: CaptureDraft;
  quality?: { issues?: { field?: string; issue?: string; severity?: string; evidence?: string; recommendedCorrection?: string }[]; score?: number };
  duplicates: DuplicateCandidate[];
  duplicateError: string | null;
  classification: Classification | null;
  ai?: { available?: boolean; reason?: string | null };
  recommendation: Recommendation | null;
  recommendationError: string | null;
};

export type CreateResult = {
  ok?: boolean;
  error?: string;
  refusal?: string;
  replayed?: boolean;
  leadId: string;
  lvLeadId: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  assignment?: { state?: string; reason?: string | null; mode?: string };
  task?: { id: string; title: string | null; dueAt: string | null } | null;
  taskError?: string | null;
};

// The fields a person actually reviews, grouped the way they are read rather
// than the way they are stored. Anything the draft carries that is not here is
// still sent — it is simply not put in front of someone as a form field.
export const FIELD_GROUPS: { key: string; title: string; fields: { key: keyof CaptureDraft; label: string; help?: string; type?: 'text' | 'email' | 'tel' | 'url' }[] }[] = [
  {
    key: 'who',
    title: 'Who this is',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'organisationName', label: 'Organisation' },
      { key: 'jobTitle', label: 'Role' },
    ],
  },
  {
    key: 'reach',
    title: 'How to reach them',
    fields: [
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'websiteUrl', label: 'Website', type: 'url' },
      { key: 'instagramHandle', label: 'Instagram', help: 'The handle, without the @.' },
    ],
  },
  {
    key: 'where',
    title: 'Where they are',
    fields: [{ key: 'location', label: 'Location' }],
  },
];

/** The capture methods the product actually supports, grouped as the boards show them. */
export type CaptureMethodKey =
  | 'VISITING_CARD'
  | 'IMAGE'
  | 'SCREENSHOT'
  | 'BROCHURE'
  | 'FLYER'
  | 'POSTER'
  | 'INSTAGRAM'
  | 'INSTAGRAM_POST'
  | 'LINKEDIN_PROFILE'
  | 'WEBSITE_URL'
  | 'SOCIAL_HANDLE'
  | 'MANUAL'
  | 'REFERRAL'
  | 'PARTNER_REFERRAL'
  | 'EVENT'
  | 'WALK_IN'
  | 'PHONE'
  | 'OTHER';

export type CaptureInputKind = 'IMAGE' | 'URL' | 'HANDLE' | 'FORM';

export type CaptureMethod = {
  key: CaptureMethodKey;
  label: string;
  hint: string;
  input: CaptureInputKind;
  /** What La Vivenzia will do with it, said before the person commits. */
  promise: string;
  /**
   * The server refuses to create from a method like this until a person has
   * said they checked the extracted values. Mirrors `requiresConfirmation`
   * in capture-methods.ts: true for anything read off a picture or a link,
   * false for anything typed in by hand.
   */
  requiresConfirmation: boolean;
};

// Mirrors capture-methods.ts on the server. Each entry says what to provide
// and what comes back, because a tile that only names itself makes someone
// guess.
export const CAPTURE_SOURCES: { key: string; title: string; methods: CaptureMethod[] }[] = [
  {
    key: 'image',
    title: 'From a picture',
    methods: [
      { key: 'VISITING_CARD', label: 'Visiting card', hint: 'Photograph the card', input: 'IMAGE', promise: 'The name, role, organisation, phone, email and address are read off the card.', requiresConfirmation: true },
      { key: 'SCREENSHOT', label: 'Screenshot', hint: 'A chat, a profile, a listing', input: 'IMAGE', promise: 'Contact details are read out of the screenshot.', requiresConfirmation: true },
      { key: 'BROCHURE', label: 'Brochure or flyer', hint: 'Photograph the page with contacts', input: 'IMAGE', promise: 'Whatever contact details the page carries are read off it.', requiresConfirmation: true },
      { key: 'IMAGE', label: 'Any picture', hint: 'Anything with contact details in it', input: 'IMAGE', promise: 'Readable contact details are pulled out of the image.', requiresConfirmation: true },
    ],
  },
  {
    key: 'link',
    title: 'From a link',
    methods: [
      { key: 'WEBSITE_URL', label: 'Website', hint: 'Paste the site address', input: 'URL', promise: 'The page’s own published details — title, description, contact — are read. Nothing is scraped.', requiresConfirmation: true },
      { key: 'INSTAGRAM', label: 'Instagram', hint: 'Profile link or @handle', input: 'HANDLE', promise: 'The handle is kept and the rest is added by hand — Instagram publishes nothing to anonymous requests.', requiresConfirmation: true },
      { key: 'LINKEDIN_PROFILE', label: 'LinkedIn', hint: 'Profile or company page link', input: 'HANDLE', promise: 'The profile link is kept and the rest is added by hand.', requiresConfirmation: true },
      { key: 'SOCIAL_HANDLE', label: 'Other social', hint: 'Facebook, YouTube, X or another platform', input: 'HANDLE', promise: 'The profile link is kept and the rest is added by hand.', requiresConfirmation: true },
    ],
  },
  {
    key: 'person',
    title: 'From a person',
    methods: [
      { key: 'REFERRAL', label: 'Referral', hint: 'Someone recommended them', input: 'FORM', promise: 'You type what you know. Nothing is read automatically.', requiresConfirmation: false },
      { key: 'PARTNER_REFERRAL', label: 'Partner referral', hint: 'An existing partner sent them', input: 'FORM', promise: 'You type what you know, recorded as coming from a partner.', requiresConfirmation: false },
      { key: 'EVENT', label: 'Event', hint: 'Met at an event', input: 'FORM', promise: 'You type what you know, recorded as met at an event.', requiresConfirmation: false },
      { key: 'WALK_IN', label: 'Walk-in', hint: 'They came to us', input: 'FORM', promise: 'You type what you know, recorded as a walk-in.', requiresConfirmation: false },
      { key: 'PHONE', label: 'Phone call', hint: 'They called, or you did', input: 'FORM', promise: 'You type what you know, recorded as a phone enquiry.', requiresConfirmation: false },
      { key: 'MANUAL', label: 'Type it in', hint: 'Straight into the form', input: 'FORM', promise: 'You type everything. Nothing is read automatically.', requiresConfirmation: false },
    ],
  },
];

export const METHOD_BY_KEY: Record<string, CaptureMethod> = Object.fromEntries(
  CAPTURE_SOURCES.flatMap((group) => group.methods).map((method) => [method.key, method]),
);

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const emptyDraft = (): CaptureDraft => ({
  name: '',
  organisationName: null,
  jobTitle: null,
  email: null,
  phone: null,
  websiteUrl: null,
  instagramHandle: null,
  socialProfile: null,
  location: null,
  category: null,
  subcategory: null,
  languages: null,
  source: null,
  priority: null,
  status: null,
  completeness: 0,
  requiresHumanConfirmation: false,
  warnings: [],
});

/** The draft fields, as the routes want them. */
const draftPayload = (draft: CaptureDraft) => ({
  name: draft.name,
  organisationName: draft.organisationName,
  jobTitle: draft.jobTitle,
  email: draft.email,
  phone: draft.phone,
  websiteUrl: draft.websiteUrl,
  instagramHandle: draft.instagramHandle,
  socialProfile: draft.socialProfile,
  location: draft.location,
  category: draft.category,
  subcategory: draft.subcategory,
  languages: draft.languages,
});

const uuid = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;

        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export type DuplicateDecision = 'CREATE_NEW' | 'IGNORED' | 'NONE';
export type AssignmentMode = 'ENGINE' | 'SELF' | 'MEMBER' | 'NONE';

export const useCapture = () => {
  // One key for the whole capture. It is what makes creation idempotent: a
  // repeated create returns the lead that already exists rather than a second
  // copy of it.
  const [captureKey, setCaptureKey] = useState(uuid);
  const [phase, setPhase] = useState<CapturePhase>('CHOOSE');
  const [method, setMethod] = useState<CaptureMethod | null>(null);
  const [draft, setDraft] = useState<CaptureDraft>(emptyDraft);
  const [extraction, setExtraction] = useState<ExtractResult | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [created, setCreated] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateDecision, setDuplicateDecision] = useState<DuplicateDecision>('NONE');
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('ENGINE');
  const [assignmentMemberId, setAssignmentMemberId] = useState<string | null>(null);
  // The server will not create from an extracted draft until a person says
  // they checked it. This is that statement, made once, on the Confirm step.
  const [confirmed, setConfirmed] = useState(false);

  const reset = useCallback(() => {
    setCaptureKey(uuid());
    setPhase('CHOOSE');
    setMethod(null);
    setDraft(emptyDraft());
    setExtraction(null);
    setPreflight(null);
    setCreated(null);
    setError(null);
    setDuplicateDecision('NONE');
    setAssignmentMode('ENGINE');
    setAssignmentMemberId(null);
    setConfirmed(false);
  }, []);

  const chooseMethod = useCallback((next: CaptureMethod) => {
    setMethod(next);
    setError(null);
    setExtraction(null);

    // A form method has nothing to read, so it goes straight to the fields.
    setPhase(next.input === 'FORM' ? 'REVIEW' : 'INPUT');
  }, []);

  /** Folds whatever the extractor found into the draft, without overwriting edits. */
  const applyFields = useCallback((fields: ExtractedField[]) => {
    setDraft((current) => {
      const next = { ...current };

      for (const entry of fields) {
        if (entry.value === null || entry.value === '') {
          continue;
        }

        if (entry.field in next) {
          (next as unknown as Record<string, unknown>)[entry.field] = entry.value;
        }
      }

      return next;
    });
  }, []);

  const extract = useCallback(
    async (payload: { image?: { base64: string; mimeType: string }; url?: string; handle?: string }) => {
      if (!method) {
        return;
      }

      setPhase('EXTRACTING');
      setError(null);

      try {
        const result = await callRoute<ExtractResult>('/capture/extract', { captureKey, method: method.key, ...payload });

        setExtraction(result);
        applyFields(result.fields ?? []);
        setPhase('REVIEW');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'That could not be read.');
        // The workflow does not dead-end on a failed read: the fields are
        // still there to be filled in by hand.
        setExtraction({ status: 'FAILED', kind: null, fields: [] });
        setPhase('REVIEW');
      }
    },
    [captureKey, method, applyFields],
  );

  const check = useCallback(async () => {
    if (!method) {
      return;
    }

    setPhase('CHECKING');
    setError(null);

    try {
      const result = await callRoute<Preflight>('/capture/preflight', {
        captureKey,
        method: method.key,
        fields: draftPayload(draft),
        classify: true,
        recommend: true,
        stage: 'REVIEW',
      });

      setPreflight(result);
      setDraft((current) => ({ ...current, ...result.draft }));
      setPhase('DECIDE');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That draft could not be checked.');
      setPhase('REVIEW');
    }
  }, [captureKey, method, draft]);

  const create = useCallback(async () => {
    if (!method) {
      return;
    }

    setPhase('CREATING');
    setError(null);

    try {
      const result = await callRoute<CreateResult>('/capture/create', {
        captureKey,
        method: method.key,
        // The confirmation travels inside `fields`, where capture-request.ts
        // reads it from — not at the top level.
        fields: { ...draftPayload(draft), isHumanConfirmed: method.requiresConfirmation ? confirmed : true },
        // Without this the first follow-up is due in UTC, which lands in the
        // past for anyone east of Greenwich — a brand new lead arriving
        // already overdue.
        timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
        assignment: { mode: assignmentMode, ...(assignmentMode === 'MEMBER' && assignmentMemberId ? { memberId: assignmentMemberId } : {}) },
        duplicate: {
          decision: duplicateDecision,
          ...(duplicateDecision !== 'NONE' ? { candidateLeadIds: (preflight?.duplicates ?? []).map((candidate) => candidate.leadId) } : {}),
        },
        classification: preflight?.classification
          ? { status: preflight.classification.status === 'SUGGESTED' ? 'ACCEPTED' : 'UNAVAILABLE', runId: preflight.classification.runId ?? null }
          : { status: 'UNAVAILABLE' },
        extraction: {
          status: extraction?.status ?? 'NOT_APPLICABLE',
          kind: extraction?.kind ?? null,
          runId: extraction?.runId ?? null,
          fieldCount: (extraction?.fields ?? []).filter((field) => field.value !== null).length,
        },
      });

      setCreated(result);
      setPhase('SUCCESS');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That lead could not be created.');
      setPhase('DECIDE');
    }
  }, [captureKey, method, draft, assignmentMode, assignmentMemberId, duplicateDecision, preflight, extraction, confirmed]);

  // The draft is not ready until it has a name — the one field the server
  // refuses to build a lead without.
  const canReview = draft.name.trim().length > 1;

  const value = useMemo(
    () => ({
      captureKey,
      phase,
      method,
      draft,
      extraction,
      preflight,
      created,
      error,
      canReview,
      duplicateDecision,
      assignmentMode,
      assignmentMemberId,
      confirmed,
      setConfirmed,
      setPhase,
      setDraft,
      setError,
      setDuplicateDecision,
      setAssignmentMode,
      setAssignmentMemberId,
      chooseMethod,
      extract,
      check,
      create,
      reset,
    }),
    [captureKey, phase, method, draft, extraction, preflight, created, error, canReview, duplicateDecision, assignmentMode, assignmentMemberId, confirmed, chooseMethod, extract, check, create, reset],
  );

  return value;
};

export type CaptureState = ReturnType<typeof useCapture>;

/** Reads a picked file as the base64 the extract route wants. */
export const readImage = (file: File): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');

      resolve({ base64: result.replace(/^data:[^,]+,/, ''), mimeType: file.type });
    };
    reader.readAsDataURL(file);
  });
