import { CAPTURE_METHOD_BY_KEY, isCaptureMethodKey } from 'src/modules/lv-capture/constants/capture-methods';
import { type CaptureInput } from 'src/modules/lv-capture/types/capture.types';
import { isLeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { isLeadPilotZone, isLeadSource, LEAD_PILOT_ZONE_LABELS, SOCIAL_PLATFORMS, type LeadCaptureMode, type LeadPilotZone, type SocialPlatform } from 'src/modules/lv-core/constants/lead-taxonomy';

// Reads the fields a capture request carries into the one CaptureInput the
// draft builder understands. Anything not a string is dropped; identity
// fields (owner, actor, reviewer) are never read from here — the routes take
// those from the session or decide them server-side.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A capture key is client-generated (a UUID per capture attempt) so a retry
// of the same attempt is recognised; its shape is the only thing trusted.
export const isCaptureKey = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

const str = (value: unknown, max = 300): string | null => (typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, max) : null);

const list = (value: unknown, max = 20): string[] | null =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim().slice(0, 60)).slice(0, max) : null;

const normalizePilotZoneInput = (raw: unknown): { valid: true; value: LeadPilotZone | null } | { valid: false } => {
  if (raw === undefined || raw === null || raw === '') {
    return { valid: true, value: null };
  }

  if (typeof raw !== 'string') {
    return { valid: false };
  }

  const trimmed = raw.trim();

  if (isLeadPilotZone(trimmed)) {
    return { valid: true, value: trimmed };
  }

  for (const [key, label] of Object.entries(LEAD_PILOT_ZONE_LABELS)) {
    if (label.toLowerCase() === trimmed.toLowerCase()) {
      return { valid: true, value: key as LeadPilotZone };
    }
  }

  return { valid: false };
};

export type CaptureFieldsInput = {
  method?: unknown;
  fields?: unknown;
};

export const readCaptureInput = (body: CaptureFieldsInput): { ok: true; method: LeadCaptureMode; input: CaptureInput } | { ok: false; error: string } => {
  if (!isCaptureMethodKey(body.method)) {
    return { ok: false, error: 'method must be one of the capture methods.' };
  }

  const method = body.method;
  const fields = typeof body.fields === 'object' && body.fields !== null ? (body.fields as Record<string, unknown>) : {};
  const platform = str(fields.socialPlatform, 20);
  const source = str(fields.source, 40);
  const priority = str(fields.priority, 20);

  const parsedPilotZone = normalizePilotZoneInput(fields.pilotZone);

  if (!parsedPilotZone.valid) {
    return { ok: false, error: 'pilotZone must be one of: AMANORA_MALL, SEASONS_MALL, MAGARPATTA_CITY, HADAPSAR.' };
  }

  const input: CaptureInput = {
    captureMode: method,
    rawInput: str(fields.rawInput, 2_000),
    name: str(fields.name, 200),
    organisationName: str(fields.organisationName, 200),
    email: str(fields.email, 200),
    phone: str(fields.phone, 60),
    websiteUrl: str(fields.websiteUrl, 500),
    instagramHandle: str(fields.instagramHandle, 100),
    socialProfileUrl: str(fields.socialProfileUrl, 500),
    socialPlatform: platform && (SOCIAL_PLATFORMS as readonly string[]).includes(platform) ? (platform as SocialPlatform) : (CAPTURE_METHOD_BY_KEY[method].platform ?? null),
    jobTitle: str(fields.jobTitle, 120),
    location: str(fields.location, 200),
    pilotZone: parsedPilotZone.value,
    category: str(fields.category, 60),
    subcategory: str(fields.subcategory, 60),
    languages: list(fields.languages),
    source: source && isLeadSource(source) ? source : CAPTURE_METHOD_BY_KEY[method].defaultSource,
    priority: priority && isLeadPriority(priority) ? priority : null,
    referrerName: str(fields.referrerName, 200),
    // A referrer member id is a reference to a colleague, not an identity claim.
    referrerWorkspaceMemberId: typeof fields.referrerWorkspaceMemberId === 'string' && UUID.test(fields.referrerWorkspaceMemberId) ? fields.referrerWorkspaceMemberId : null,
    attachmentPath: str(fields.attachmentPath, 500),
    isHumanConfirmed: fields.isHumanConfirmed === true,
    extractedFields: list(fields.extractedFields, 30),
    extractionKind: fields.extractionKind === 'OCR' || fields.extractionKind === 'PAGE_METADATA' ? fields.extractionKind : null,
    classificationOrigin: fields.classificationOrigin === 'AI' ? 'AI' : fields.category ? 'USER' : null,
  };

  return { ok: true, method, input };
};
