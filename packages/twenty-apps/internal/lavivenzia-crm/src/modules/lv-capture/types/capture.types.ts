import { type SocialProfile } from 'src/modules/lv-capture/utils/normalize-input';
import {
  type FieldProvenance,
  type LeadCaptureMode,
  type LeadSource,
  type SocialPlatform,
} from 'src/modules/lv-core/constants/lead-taxonomy';
import {
  type LeadPriority,
  type LeadStatus,
} from 'src/modules/lv-core/constants/lead-lifecycle';

// What the capture surface hands to the engine. Every mode funnels through this
// one shape so there is a single code path from "Experience Hunter tapped
// something" to "a Lead row exists".
export type CaptureInput = {
  captureMode: LeadCaptureMode;
  // Free-form text the user typed or pasted: a URL, a handle, a name, notes.
  rawInput?: string | null;
  name?: string | null;
  organisationName?: string | null;
  email?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  instagramHandle?: string | null;
  // Day 8: any other social profile (LinkedIn, Facebook, YouTube, X …) as a
  // pasted link or handle, with the platform when the link does not say.
  socialProfileUrl?: string | null;
  socialPlatform?: SocialPlatform | null;
  jobTitle?: string | null;
  location?: string | null;
  category?: string | null;
  subcategory?: string | null;
  languages?: readonly string[] | null;
  source?: LeadSource | null;
  priority?: LeadPriority | null;
  // REFERRAL mode: who sent them.
  referrerName?: string | null;
  referrerWorkspaceMemberId?: string | null;
  // IMAGE / VISITING_CARD mode: the uploaded file, already stored by Twenty.
  attachmentPath?: string | null;
  // Set when a human has eyeballed the values. CAPTURE-OCR.md requires a
  // confirmation step before an extracted lead becomes a real lead.
  isHumanConfirmed?: boolean;
  // Day 8: which fields an extractor filled and were left unchanged by the
  // person, so their provenance is recorded as extracted rather than typed.
  extractedFields?: readonly string[] | null;
  extractionKind?: 'OCR' | 'PAGE_METADATA' | null;
  // Set when the category came from the classifier and was accepted as-is.
  classificationOrigin?: 'AI' | 'USER' | null;
};

export type FieldProvenanceMap = Readonly<Record<string, FieldProvenance>>;

// The normalised, validated result. This is what gets written to the Lead
// object — the writer does no further interpretation.
export type LeadDraft = {
  name: string;
  organisationName: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  socialProfile: SocialProfile | null;
  jobTitle: string | null;
  location: string | null;
  category: string | null;
  subcategory: string | null;
  languages: readonly string[];
  source: LeadSource;
  captureMode: LeadCaptureMode;
  status: LeadStatus;
  priority: LeadPriority;
  referrerName: string | null;
  referrerWorkspaceMemberId: string | null;
  attachmentPath: string | null;
  rawInput: string | null;
  provenance: FieldProvenanceMap;
  // 0-100, deterministic: share of the fields that matter for qualification.
  completeness: number;
  // Stable keys other leads are compared against for duplicate detection.
  duplicateKeys: readonly string[];
  // Non-blocking notes for the reviewer ("phone could not be parsed").
  warnings: readonly string[];
  // True when the draft still needs a human to confirm extracted values.
  requiresHumanConfirmation: boolean;
};

export type CaptureResult =
  | { ok: true; draft: LeadDraft }
  | { ok: false; errors: readonly string[] };

// ---------------------------------------------------------------------------
// Extension points
// ---------------------------------------------------------------------------
// AI-INTELLIGENCE.md places classification, scoring and OCR in Phase 2. Nothing
// in this module fabricates those. Instead each is a named seam with a
// deterministic default, so Phase 2 replaces an implementation rather than
// rewriting the capture path.

// Reads structured fields off an image (visiting card, screenshot, brochure).
// Phase 1 ships NO implementation — an IMAGE/VISITING_CARD capture is stored
// with its attachment and parked for a human. Wiring a vision model here later
// changes nothing else.
export type ImageFieldExtractor = {
  readonly name: string;
  extract(input: {
    attachmentPath: string;
  }): Promise<Partial<CaptureInput> & { confidence: number }>;
};

// Assigns category/subcategory from the captured signals. The Phase 1
// implementation is keyword rules over the text the user supplied; it never
// invents a category it cannot justify and returns null instead.
export type LeadClassifier = {
  readonly name: string;
  classify(input: {
    text: string;
  }): { category: string | null; subcategory: string | null };
};

// Scores opportunity 0-100. Phase 1 uses data completeness only, and the field
// is left null rather than guessed when there is nothing to score. Deliberately
// NOT called "AI score" until an actual model backs it.
export type OpportunityScorer = {
  readonly name: string;
  score(draft: LeadDraft): { value: number; explanation: readonly string[] };
};
