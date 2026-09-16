import { type AiImageInput, type AiProvider } from 'src/modules/lv-ai/provider/ai-provider';
import { CAPTURE_EXTRACTION_FIELDS, CAPTURE_EXTRACTION_PROMPT, type CaptureExtractionOutput, type ExtractedField } from 'src/modules/lv-ai/prompts/prompt-registry';
import { runPrompt } from 'src/modules/lv-ai/runtime/ai-runner';
import { type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';
import { normalizeEmail, normalizePhone, normalizeWebsiteUrl, nullIfBlank, parseInstagramHandle, parseSocialProfile } from 'src/modules/lv-capture/utils/normalize-input';

// Extraction: turning what the employee is holding into candidate fields for
// the review screen. Two sources, one output shape:
//
//   IMAGE  the configured AI provider reads the picture (visiting card,
//          screenshot, brochure). With no provider the answer is UNAVAILABLE
//          and the employee types the fields — nothing is invented.
//   URL    the public metadata of a web page (title, description, mailto:,
//          tel:, Instagram link). Ordinary link unfurling of a page the site
//          serves to anyone; no login, no crawling, no social platforms —
//          those serve nothing useful to an anonymous fetch and their terms
//          forbid it, so a pasted profile keeps only the handle and URL.
//
// Every field carries a confidence so the review screen can say HIGH /
// MEDIUM / LOW, and every value is editable there.

export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ExtractedReviewField = { field: string; value: string | null; confidence: number; label: ConfidenceLabel };

export type ExtractionResult =
  | { status: 'EXTRACTED'; kind: 'OCR' | 'PAGE_METADATA'; fields: ExtractedReviewField[]; notes: string | null; runId: string | null; provider: string; model: string | null }
  | { status: 'UNAVAILABLE'; kind: 'OCR' | 'PAGE_METADATA'; reason: string; runId: string | null }
  | { status: 'FAILED'; kind: 'OCR' | 'PAGE_METADATA'; reason: string; runId: string | null };

export const confidenceLabel = (confidence: number): ConfidenceLabel => (confidence >= 0.85 ? 'HIGH' : confidence >= 0.6 ? 'MEDIUM' : 'LOW');

// The model reads what is printed; the CRM's own normalisers decide whether
// it is usable (a phone that does not parse is kept as LOW, not dropped, so
// the reviewer can fix it).
const cleanField = (field: string, extracted: ExtractedField): ExtractedReviewField => {
  const raw = nullIfBlank(extracted.value);

  if (raw === null) {
    return { field, value: null, confidence: 0, label: 'LOW' };
  }

  let value: string | null = raw;
  let confidence = extracted.confidence;

  switch (field) {
    case 'email': {
      const normalised = normalizeEmail(raw);

      if (normalised === null) {
        confidence = Math.min(confidence, 0.3);
      } else {
        value = normalised;
      }

      break;
    }
    case 'phone': {
      const normalised = normalizePhone(raw);

      if (normalised === null) {
        confidence = Math.min(confidence, 0.3);
      } else {
        value = normalised;
      }

      break;
    }
    case 'websiteUrl': {
      const normalised = normalizeWebsiteUrl(raw);

      if (normalised === null) {
        confidence = Math.min(confidence, 0.3);
      } else {
        value = normalised;
      }

      break;
    }
    case 'instagramHandle': {
      const handle = parseInstagramHandle(raw);

      if (handle === null) {
        confidence = Math.min(confidence, 0.3);
      } else {
        value = handle;
      }

      break;
    }
    case 'socialProfileUrl': {
      const profile = parseSocialProfile(raw);

      if (profile?.url) {
        value = profile.url;
      } else {
        confidence = Math.min(confidence, 0.3);
      }

      break;
    }
    default:
      break;
  }

  return { field, value, confidence, label: confidenceLabel(confidence) };
};

// City / state / country are read separately and folded into the CRM's one
// `location` field; the address stays a note for the reviewer.
export const toReviewFields = (output: CaptureExtractionOutput): ExtractedReviewField[] => {
  const fields = CAPTURE_EXTRACTION_FIELDS.filter((field) => !['address', 'city', 'state', 'country'].includes(field)).map((field) => cleanField(field, output[field]));
  const parts = [output.city, output.state, output.country].map((part) => nullIfBlank(part.value)).filter((part): part is string => part !== null);
  const locationConfidence = Math.min(...[output.city, output.state, output.country].filter((part) => nullIfBlank(part.value)).map((part) => part.confidence), 1);

  fields.push({ field: 'location', value: parts.length > 0 ? parts.join(', ') : null, confidence: parts.length > 0 ? locationConfidence : 0, label: parts.length > 0 ? confidenceLabel(locationConfidence) : 'LOW' });
  fields.push({ field: 'address', value: nullIfBlank(output.address.value), confidence: output.address.confidence, label: confidenceLabel(output.address.confidence) });

  return fields;
};

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const extractFromImage = async (
  provider: AiProvider,
  application: GraphqlClient,
  image: AiImageInput,
  context: { actorWorkspaceMemberId: string | null; captureKey: string; method: string },
): Promise<ExtractionResult> => {
  const runContext = {
    operation: 'CAPTURE_EXTRACTION',
    actorWorkspaceMemberId: context.actorWorkspaceMemberId,
    // The capture has no record yet; the key ties this run to the lead once
    // it exists (captureProvenance.extractionRunId).
    targetObject: 'lvCapture',
    targetRecordId: null,
    sourceRecordIds: [],
    metadata: { captureKey: context.captureKey, method: context.method, mimeType: image.mimeType, bytes: Math.floor((image.base64.length * 3) / 4) },
  };

  if (!provider.available) {
    return { status: 'UNAVAILABLE', kind: 'OCR', reason: 'No AI provider is configured, so the image cannot be read automatically. Type the details from the image.', runId: null };
  }

  const { result, runId } = await runPrompt(provider, application, CAPTURE_EXTRACTION_PROMPT, 'Read the contact details printed in this image.', runContext, [image]);

  if (!result.ok) {
    return result.code === 'AI_UNAVAILABLE'
      ? { status: 'UNAVAILABLE', kind: 'OCR', reason: 'The AI provider could not be reached. Type the details from the image.', runId }
      : { status: 'FAILED', kind: 'OCR', reason: `The image could not be read (${result.code}). Type the details from the image.`, runId };
  }

  return { status: 'EXTRACTED', kind: 'OCR', fields: toReviewFields(result.value), notes: nullIfBlank(result.value.notes), runId, provider: result.provider, model: result.model };
};

// ---------------------------------------------------------------------------
// URL: public page metadata
// ---------------------------------------------------------------------------

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\]|::1$|fc|fd)/i;
const PRIVATE_172 = /^172\.(1[6-9]|2\d|3[01])\./;

// Only a public http(s) address may be fetched. Anything that could reach
// the server's own network — loopback, RFC 1918, link-local, IPv6 local —
// is refused before a socket is opened.
export const isFetchableUrl = (url: string): boolean => {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();

  if (host.length === 0 || PRIVATE_HOST.test(host) || PRIVATE_172.test(host) || !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal')) {
    return false;
  }

  return true;
};

const SOCIAL_HOSTS = /(^|\.)(instagram|linkedin|facebook|fb|youtube|twitter|x|tiktok)\.com$/i;

export const isSocialPlatformUrl = (url: string): boolean => {
  try {
    return SOCIAL_HOSTS.test(new URL(url).hostname.toLowerCase().replace(/^www\./, ''));
  } catch {
    return false;
  }
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const metaContent = (html: string, keys: string[]): string | null => {
  for (const key of keys) {
    const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*content=["']([^"']*)["']`, 'i');
    const reversed = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
    const match = html.match(pattern) ?? html.match(reversed);

    if (match?.[1]) {
      return decodeEntities(match[1]);
    }
  }

  return null;
};

// Pure: what we can read from a page's HTML. Exported for tests.
export const parsePageMetadata = (html: string, pageUrl: string): ExtractedReviewField[] => {
  const head = html.slice(0, 300_000);
  const siteName = metaContent(head, ['og:site_name']);
  const title = metaContent(head, ['og:title', 'twitter:title']) ?? (head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decodeEntities(head.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : null);
  const description = metaContent(head, ['description', 'og:description', 'twitter:description']);
  const mailto = head.match(/href=["']mailto:([^"'?]+)/i)?.[1] ?? null;
  const tel = head.match(/href=["']tel:([^"']+)/i)?.[1] ?? null;
  const instagram = head.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?["'\s]/i)?.[1] ?? null;
  const linkedin = head.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[A-Za-z0-9._-]{2,64}/i)?.[0] ?? null;
  const location = metaContent(head, ['og:locality', 'business:contact_data:locality', 'geo.placename']);
  const organisation = siteName ?? (title ? title.split(/\s[|–—-]\s/)[0].trim() : null);
  const fields: ExtractedReviewField[] = [];
  const push = (field: string, value: string | null, confidence: number) => {
    const clean = nullIfBlank(value);

    fields.push(clean === null ? { field, value: null, confidence: 0, label: 'LOW' } : cleanField(field, { value: clean, confidence }));
  };

  push('organisationName', organisation, siteName ? 0.85 : 0.6);
  push('name', organisation, siteName ? 0.6 : 0.45);
  push('websiteUrl', pageUrl, 0.99);
  push('email', mailto ? decodeURIComponent(mailto) : null, mailto ? 0.9 : 0);
  push('phone', tel ? decodeURIComponent(tel) : null, tel ? 0.85 : 0);
  push('instagramHandle', instagram, instagram ? 0.85 : 0);
  push('socialProfileUrl', linkedin, linkedin ? 0.85 : 0);
  push('location', location, location ? 0.7 : 0);
  push('notes', description ? description.slice(0, 240) : null, description ? 0.7 : 0);

  return fields;
};

export const extractFromUrl = async (url: string, fetchImpl: typeof fetch = fetch): Promise<ExtractionResult> => {
  if (!isFetchableUrl(url)) {
    return { status: 'FAILED', kind: 'PAGE_METADATA', reason: 'That address cannot be fetched. Only public http(s) websites are read.', runId: null };
  }

  if (isSocialPlatformUrl(url)) {
    return { status: 'UNAVAILABLE', kind: 'PAGE_METADATA', reason: 'Social platforms do not publish profile details to anonymous requests, and we do not scrape them. The handle and link are kept; add the rest by hand.', runId: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': 'LaVivenziaCRM/1.0 (+lead capture; link preview)', Accept: 'text/html' } });

    if (!response.ok) {
      return { status: 'UNAVAILABLE', kind: 'PAGE_METADATA', reason: `The site answered ${response.status}; nothing could be read. Continue by hand.`, runId: null };
    }

    const type = response.headers.get('content-type') ?? '';

    if (!type.includes('html')) {
      return { status: 'UNAVAILABLE', kind: 'PAGE_METADATA', reason: 'That address is not a web page. Continue by hand.', runId: null };
    }

    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    if (reader) {
      while (received < 512 * 1024) {
        const { done, value } = await reader.read();

        if (done || !value) {
          break;
        }

        chunks.push(value);
        received += value.length;
      }

      await reader.cancel().catch(() => undefined);
    }

    const html = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
    const fields = parsePageMetadata(html, response.url || url);
    const useful = fields.filter((field) => field.value !== null && field.field !== 'websiteUrl');

    if (useful.length === 0) {
      return { status: 'UNAVAILABLE', kind: 'PAGE_METADATA', reason: 'Unable to extract information automatically from that page. Continue by hand.', runId: null };
    }

    return { status: 'EXTRACTED', kind: 'PAGE_METADATA', fields, notes: null, runId: null, provider: 'page-metadata', model: null };
  } catch (error) {
    return { status: 'UNAVAILABLE', kind: 'PAGE_METADATA', reason: controller.signal.aborted ? 'The site did not answer in time. Continue by hand.' : `The site could not be reached${error instanceof Error && error.message ? ` (${error.message.slice(0, 80)})` : ''}. Continue by hand.`, runId: null };
  } finally {
    clearTimeout(timer);
  }
};

// ---- reading back what a person uploaded ------------------------------------

// Fetches a file the person just uploaded through the platform, from THIS
// server's own file endpoint only (same origin as TWENTY_API_URL,
// /file/files-field/<id>, with the platform's signed token). Anything else is
// refused: this is not a general-purpose fetcher, and the SSRF guard for
// public pages (isFetchableUrl) is a different door on purpose.
export const fetchOwnFile = async (rawUrl: string, options: { maxBytes: number; timeoutMs?: number }, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; bytes: Buffer; contentType: string | null } | { ok: false; error: string }> => {
  const apiUrl = process.env.TWENTY_API_URL;
  let url: URL;
  let own: URL;

  try {
    url = new URL(rawUrl);
    own = new URL(apiUrl ?? '');
  } catch {
    return { ok: false, error: 'The uploaded file could not be located.' };
  }

  if (url.origin !== own.origin || !/^\/file\/files-field\/[0-9a-f-]{36}(\.[a-z0-9]+)?$/i.test(url.pathname) || !url.searchParams.get('token')) {
    return { ok: false, error: 'Only a file uploaded through the CRM can be read.' };
  }

  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) });

    if (!response.ok) {
      return { ok: false, error: `The uploaded file could not be read (HTTP ${response.status}).` };
    }

    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.byteLength > options.maxBytes) {
      return { ok: false, error: `The file is larger than ${Math.round(options.maxBytes / (1024 * 1024))} MB.` };
    }

    return { ok: true, bytes, contentType: response.headers.get('content-type') };
  } catch (error) {
    return { ok: false, error: `The uploaded file could not be read (${error instanceof Error ? error.message : 'fetch failed'}).` };
  }
};
