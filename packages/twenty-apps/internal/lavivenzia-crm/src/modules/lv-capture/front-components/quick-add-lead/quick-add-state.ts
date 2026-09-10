import {
  type CaptureInput,
  type LeadDraft,
} from 'src/modules/lv-capture/types/capture.types';
import { buildLeadDraft } from 'src/modules/lv-capture/utils/build-lead-draft';
import {
  DUPLICATE_STRONG_THRESHOLD,
  type DuplicateMatch,
} from 'src/modules/lv-core/utils/duplicate-detection';
import { type LeadCaptureMode } from 'src/modules/lv-core/constants/lead-taxonomy';

// The Quick Add view model, kept out of the React component so every state the
// UI can be in is unit-testable without a DOM.

export type QuickAddPhase =
  | 'IDLE'
  | 'VALIDATING'
  | 'DUPLICATES_FOUND'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'ERROR';

export type QuickAddState = {
  phase: QuickAddPhase;
  mode: LeadCaptureMode;
  draft: LeadDraft | null;
  duplicates: readonly DuplicateMatch[];
  errors: readonly string[];
  warnings: readonly string[];
  createdLeadId: string | null;
};

export const initialQuickAddState = (
  mode: LeadCaptureMode = 'MANUAL',
): QuickAddState => ({
  phase: 'IDLE',
  mode,
  draft: null,
  duplicates: [],
  errors: [],
  warnings: [],
  createdLeadId: null,
});

// What each mode asks the user for. Drives which inputs the form renders, so
// adding a mode never means touching the component's JSX.
export const CAPTURE_MODE_FIELDS: Record<
  LeadCaptureMode,
  {
    label: string;
    hint: string;
    primaryInput: 'text' | 'url' | 'handle' | 'file' | 'none';
    primaryLabel: string;
    showsContactFields: boolean;
    showsReferrer: boolean;
  }
> = {
  MANUAL: {
    label: 'Manual',
    hint: 'Type what you know. Only a name is required.',
    primaryInput: 'text',
    primaryLabel: 'Name',
    showsContactFields: true,
    showsReferrer: false,
  },
  WEBSITE_URL: {
    label: 'Website',
    hint: 'Paste the website. We will read the domain.',
    primaryInput: 'url',
    primaryLabel: 'Website URL',
    showsContactFields: true,
    showsReferrer: false,
  },
  INSTAGRAM: {
    label: 'Instagram',
    hint: 'Paste a handle or profile link. Post links do not identify an account.',
    primaryInput: 'handle',
    primaryLabel: 'Handle or profile URL',
    showsContactFields: true,
    showsReferrer: false,
  },
  IMAGE: {
    label: 'Image',
    hint: 'Upload a poster, brochure or screenshot. A reviewer will identify it.',
    primaryInput: 'file',
    primaryLabel: 'Image',
    showsContactFields: false,
    showsReferrer: false,
  },
  VISITING_CARD: {
    label: 'Visiting card',
    hint: 'Photograph the card. Details stay unconfirmed until someone checks them.',
    primaryInput: 'file',
    primaryLabel: 'Card photo',
    showsContactFields: true,
    showsReferrer: false,
  },
  REFERRAL: {
    label: 'Referral',
    hint: 'Record who sent them.',
    primaryInput: 'text',
    primaryLabel: 'Name',
    showsContactFields: true,
    showsReferrer: true,
  },
  IMPORT: {
    label: 'Import',
    hint: 'Bulk import runs from the Leads list, not Quick Add.',
    primaryInput: 'none',
    primaryLabel: '',
    showsContactFields: false,
    showsReferrer: false,
  },
  API: {
    label: 'API',
    hint: 'Created by an integration.',
    primaryInput: 'none',
    primaryLabel: '',
    showsContactFields: false,
    showsReferrer: false,
  },
};

// Modes a person can pick in Quick Add. IMPORT and API exist as provenance
// values but are not things a hunter chooses in this dialog.
export const QUICK_ADD_MODES: readonly LeadCaptureMode[] = [
  'MANUAL',
  'WEBSITE_URL',
  'INSTAGRAM',
  'VISITING_CARD',
  'IMAGE',
  'REFERRAL',
];

export const validateCapture = (
  state: QuickAddState,
  input: CaptureInput,
): QuickAddState => {
  const result = buildLeadDraft(input);

  if (!result.ok) {
    return {
      ...state,
      phase: 'ERROR',
      draft: null,
      errors: result.errors,
      warnings: [],
    };
  }

  return {
    ...state,
    phase: 'VALIDATING',
    draft: result.draft,
    errors: [],
    warnings: result.draft.warnings,
  };
};

export const withDuplicates = (
  state: QuickAddState,
  duplicates: readonly DuplicateMatch[],
): QuickAddState => ({
  ...state,
  duplicates,
  phase: duplicates.length > 0 ? 'DUPLICATES_FOUND' : 'SUBMITTING',
});

export const withSubmissionError = (
  state: QuickAddState,
  message: string,
): QuickAddState => ({
  ...state,
  phase: 'ERROR',
  errors: [message],
});

export const withCreatedLead = (
  state: QuickAddState,
  leadId: string,
): QuickAddState => ({
  ...state,
  phase: 'SUCCESS',
  createdLeadId: leadId,
  duplicates: [],
});

// Whether the primary button should be disabled. A submit is blocked while work
// is in flight, and while strong duplicates are unresolved — PRODUCT-
// REQUIREMENTS.md wants Merge / Create New / Ignore to be a deliberate choice.
export const isSubmitBlocked = (state: QuickAddState): boolean =>
  state.phase === 'SUBMITTING' ||
  state.phase === 'VALIDATING' ||
  (state.phase === 'DUPLICATES_FOUND' &&
    state.duplicates.some((match) => match.score >= DUPLICATE_STRONG_THRESHOLD));

export const isBusy = (state: QuickAddState): boolean =>
  state.phase === 'SUBMITTING' || state.phase === 'VALIDATING';

// Copy for the empty state — shown before the user has typed anything.
export const emptyStateMessage = (mode: LeadCaptureMode): string =>
  CAPTURE_MODE_FIELDS[mode].hint;

export const duplicateSummary = (
  duplicates: readonly DuplicateMatch[],
): string | null => {
  if (duplicates.length === 0) {
    return null;
  }

  const strongest = duplicates[0];

  if (strongest === undefined) {
    return null;
  }

  const others =
    duplicates.length > 1 ? ` and ${duplicates.length - 1} other match(es)` : '';

  return `${strongest.percent}% similar to an existing lead${others}.`;
};
