import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_REGISTER_DOCUMENT_ID } from 'src/constants/universal-identifiers';
import { DOCUMENT_TYPE_OPTIONS } from 'src/modules/lv-core/constants/select-options.generated';
import { createCoreApiDocumentPort } from 'src/modules/lv-onboarding/services/core-api-document-port';
import {
  isSafeStoredPath,
  validateUpload,
} from 'src/modules/lv-onboarding/utils/validate-upload';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';

// Registers an uploaded file as an onboarding document.
//
// The browser uploads the bytes through Twenty's own FILES upload, which
// already sniffs magic bytes rather than trusting the extension. It does not,
// however, restrict the result to anything — so this function is where the La
// Vivenzia policy is actually enforced. The browser runs the same check for
// fast feedback; this one is the check that counts, because a client-side
// check is a courtesy, not a control.
//
// A file whose registration is refused is never linked to an onboarding, so it
// cannot be reviewed, previewed or approved. The bytes may briefly exist in
// storage unreferenced; that is the correct trade against accepting them.

type RegisterInput = {
  onboardingId?: string;
  documentType?: string;
  // Returned by Twenty's own upload mutation. The bytes are already in
  // storage (R2 in production) before this route is called.
  fileId?: string;
  filePath?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  expiresAt?: string | null;
  uploadedByWorkspaceMemberId?: string | null;
  replacesDocumentId?: string | null;
};

export const handler = async (
  event: unknown,
): Promise<Record<string, unknown>> => {
  // isAuthRequired rejects anonymous callers before this runs. A null
  // userWorkspaceId therefore means an authenticated non-human caller (an API
  // key or integration), which is recorded rather than refused — the human-only
  // rule is enforced by the state machine’s actor requirement, not here.
  const { input, userWorkspaceId, actorWorkspaceMemberId } =
    readRouteInput<RegisterInput>(event);

  const {
    onboardingId,
    documentType,
    fileId,
    filePath,
    originalFilename,
    mimeType,
    fileSizeBytes,
  } = input;

  if (!onboardingId) {
    return { ok: false, error: 'onboardingId is required.' };
  }

  const isKnownType = DOCUMENT_TYPE_OPTIONS.some(
    (option) => option.value === documentType,
  );

  if (!documentType || !isKnownType) {
    return {
      ok: false,
      error: `"${documentType}" is not a known document type.`,
    };
  }

  if (typeof fileId !== 'string' || fileId.trim().length === 0) {
    return { ok: false, error: 'fileId is required.' };
  }

  if (!isSafeStoredPath(filePath)) {
    // Either absent, absolute, or able to climb out of the workspace prefix.
    return { ok: false, refusal: 'UNSAFE_PATH', error: 'Invalid file path.' };
  }

  const validation = validateUpload({
    filename: originalFilename,
    mimeType,
    sizeBytes: fileSizeBytes,
  });

  if (!validation.ok) {
    return {
      ok: false,
      refusal: validation.refusal,
      error: validation.message,
    };
  }

  const client = new CoreApiClient();

  // The onboarding must exist. Without this, a caller could attach documents
  // to an id of their choosing.
  // The API throws rather than returning null for an unknown id, so an
  // unknown onboarding has to be caught here or it surfaces as a 500 instead
  // of the refusal it actually is.
  let record: { id?: string } | undefined;

  try {
    const onboarding = await client.query({
      lvOnboarding: {
        __args: { filter: { id: { eq: onboardingId } } },
        id: true,
        name: true,
        status: true,
      },
    });

    record = (onboarding as { lvOnboarding?: { id?: string } }).lvOnboarding;
  } catch {
    record = undefined;
  }

  if (!record?.id) {
    return {
      ok: false,
      refusal: 'ONBOARDING_NOT_FOUND',
      error: 'That onboarding does not exist.',
    };
  }

  const port = createCoreApiDocumentPort(client);
  const at = new Date().toISOString();

  const created = await port.createDocument({
    onboardingId,
    documentType,
    name: `${documentType} — ${originalFilename}`,
    fileId,
    filePath: filePath as string,
    originalFilename: originalFilename as string,
    mimeType: mimeType as string,
    fileSizeBytes: fileSizeBytes as number,
    expiresAt: input.expiresAt ?? null,
    uploadedAt: at,
    // Server-resolved; the body's uploadedByWorkspaceMemberId is ignored.
    uploadedByWorkspaceMemberId: actorWorkspaceMemberId,
    replacesDocumentId: input.replacesDocumentId ?? null,
    audit: {
      event: 'DOCUMENT_UPLOADED',
      at,
      actorWorkspaceMemberId,
      documentType,
      originalFilename,
      mimeType,
      fileSizeBytes,
      to: 'PENDING',
      // The session the platform authenticated, recorded next to the claimed
      // actor so the trail shows who was really signed in.
      authenticatedUserWorkspaceId: userWorkspaceId,
    },
  });

  return {
    ok: true,
    documentId: created.id,
    verificationState: 'PENDING',
    uploadedAt: at,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_REGISTER_DOCUMENT_ID,
  name: 'lv-register-document',
  description:
    'Validates an uploaded onboarding document against the La Vivenzia file policy and records it as PENDING with an audit entry',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/onboarding/documents/register',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
