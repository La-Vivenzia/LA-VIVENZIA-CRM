import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_CAPTURE_EXTRACT_ID } from 'src/constants/universal-identifiers';
import { describeAiAvailability, readAiConfig } from 'src/modules/lv-ai/config/ai-config';
import { type AiImageInput } from 'src/modules/lv-ai/provider/ai-provider';
import { createAiProvider } from 'src/modules/lv-ai/provider/create-provider';
import { applicationClient } from 'src/modules/lv-ai/runtime/clients';
import { CAPTURE_METHOD_BY_KEY, isCaptureMethodKey } from 'src/modules/lv-capture/constants/capture-methods';
import { isCaptureKey } from 'src/modules/lv-capture/services/capture-request';
import { extractFromImage, extractFromUrl, fetchOwnFile, IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from 'src/modules/lv-capture/services/extraction';
import { normalizeWebsiteUrl, parseInstagramHandle, parseSocialProfile } from 'src/modules/lv-capture/utils/normalize-input';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// POST /capture/extract { captureKey, method, image?: { base64, mimeType }, url?, handle? }
//
// The EXTRACT step of capture. Turns what the employee is holding into
// candidate fields for the review screen — read off a picture by the AI
// provider (OCR) or off a public web page's metadata — or says plainly that
// it cannot. Nothing is created here, and every model call is audited as an
// lvAiRun with the capture key so it can be tied to the lead later.

type Input = { captureKey?: unknown; method?: unknown; image?: unknown; url?: unknown; handle?: unknown };

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can capture leads.' };
  }

  if (!isCaptureKey(input.captureKey)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'captureKey must be a UUID.' };
  }

  if (!isCaptureMethodKey(input.method)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'method must be one of the capture methods.' };
  }

  const method = CAPTURE_METHOD_BY_KEY[input.method];
  const application = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const audit = (outcome: 'APPLIED' | 'FAILED', metadata: Record<string, unknown>) =>
    writeAuditEvent(application, { action: 'CAPTURE_EXTRACTED', outcome, targetObject: 'lvCapture', targetRecordId: input.captureKey as string, targetLabel: method.label, actorWorkspaceMemberId, at: now, reason: null, metadata: { method: method.key, ...metadata } });

  // ---- image ---------------------------------------------------------------
  if (method.input === 'IMAGE') {
    const image = typeof input.image === 'object' && input.image !== null ? (input.image as Record<string, unknown>) : null;
    const mimeType = image && typeof image.mimeType === 'string' ? image.mimeType : null;
    let base64 = image && typeof image.base64 === 'string' ? image.base64.replace(/^data:[^,]+,/, '') : null;

    if (!mimeType || !(IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'image must carry a mimeType of image/jpeg, image/png or image/webp.' };
    }

    // The screen cannot read file bytes inside the sandboxed renderer, so it
    // uploads the photo through the platform first (into the lead's FILES
    // field) and hands over the signed URL; the bytes are fetched from this
    // server's own file endpoint and nowhere else.
    if (base64 === null && image && typeof image.url === 'string') {
      const fetched = await fetchOwnFile(image.url, { maxBytes: MAX_IMAGE_BYTES });

      if (!fetched.ok) {
        return { ok: false, refusal: 'INVALID_INPUT', error: fetched.error };
      }

      base64 = fetched.bytes.toString('base64');
    }

    if (!base64) {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'image must carry base64 data or the URL of a file uploaded through the CRM.' };
    }

    if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'The image is larger than 6 MB. Take a smaller photo or crop it.' };
    }

    const config = readAiConfig();
    const provider = createAiProvider(config);
    const result = await extractFromImage(provider, applicationClient(), { mimeType: mimeType as AiImageInput['mimeType'], base64 }, { actorWorkspaceMemberId, captureKey: input.captureKey, method: method.key });

    await audit(result.status === 'FAILED' ? 'FAILED' : 'APPLIED', { kind: 'OCR', status: result.status, runId: result.runId, fieldCount: result.status === 'EXTRACTED' ? result.fields.filter((field) => field.value !== null).length : 0 });

    // Always a `fields` array, so the screen never has to special-case the
    // unavailable / failed shapes.
    return { ok: true, fields: [], ...result, ai: describeAiAvailability(config) };
  }

  // ---- url -----------------------------------------------------------------
  if (method.input === 'URL') {
    const url = typeof input.url === 'string' ? normalizeWebsiteUrl(input.url) : null;

    if (url === null) {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'That is not a valid website address.' };
    }

    const result = await extractFromUrl(url);

    await audit(result.status === 'FAILED' ? 'FAILED' : 'APPLIED', { kind: 'PAGE_METADATA', status: result.status, fieldCount: result.status === 'EXTRACTED' ? result.fields.filter((field) => field.value !== null).length : 0 });

    return { ok: true, url, fields: [], ...result };
  }

  // ---- handle / profile link ---------------------------------------------
  if (method.input === 'HANDLE') {
    const raw = typeof input.handle === 'string' ? input.handle : typeof input.url === 'string' ? input.url : '';

    if (method.key === 'INSTAGRAM' || method.key === 'INSTAGRAM_POST') {
      const handle = parseInstagramHandle(raw);

      if (handle === null) {
        return { ok: false, refusal: 'INVALID_INPUT', error: method.key === 'INSTAGRAM_POST' ? 'A post or reel link does not identify the account. Paste the profile link or @handle as well.' : 'That is not an Instagram profile link or handle.' };
      }

      await audit('APPLIED', { kind: 'HANDLE', status: 'UNAVAILABLE', platform: 'INSTAGRAM' });

      return { ok: true, status: 'UNAVAILABLE', kind: 'PAGE_METADATA', reason: 'Instagram does not publish profile details to anonymous requests, and we do not scrape it. The handle is kept; add the rest by hand.', runId: null, platform: 'INSTAGRAM', handle, url: `https://instagram.com/${handle}`, fields: [{ field: 'instagramHandle', value: handle, confidence: 1, label: 'HIGH' }, { field: 'name', value: handle, confidence: 0.4, label: 'LOW' }] };
    }

    const profile = parseSocialProfile(raw, method.platform === 'OTHER' ? null : method.platform);

    if (profile === null) {
      return { ok: false, refusal: 'INVALID_INPUT', error: method.key === 'LINKEDIN_PROFILE' ? 'That is not a LinkedIn profile or company page link.' : 'That is not a profile link or handle we recognise.' };
    }

    await audit('APPLIED', { kind: 'HANDLE', status: 'UNAVAILABLE', platform: profile.platform });

    return {
      ok: true,
      status: 'UNAVAILABLE',
      kind: 'PAGE_METADATA',
      reason: `${profile.platform === 'OTHER' ? 'That platform' : profile.platform.charAt(0) + profile.platform.slice(1).toLowerCase()} does not publish profile details to anonymous requests, and we do not scrape it. The link is kept; add the rest by hand.`,
      runId: null,
      platform: profile.platform,
      handle: profile.handle,
      url: profile.url,
      fields: [
        { field: 'socialProfileUrl', value: profile.url, confidence: 1, label: 'HIGH' },
        { field: 'name', value: profile.handle, confidence: 0.4, label: 'LOW' },
      ],
    };
  }

  return { ok: true, status: 'NOT_APPLICABLE', kind: null, fields: [], runId: null };
};

export default defineLogicFunction({
  universalIdentifier: FN_CAPTURE_EXTRACT_ID,
  name: 'lv-capture-extract',
  description: 'Extracts candidate lead fields from an image (AI, when configured), a public web page or a social handle; never creates anything',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: { path: '/capture/extract', httpMethod: 'POST', isAuthRequired: true },
});
