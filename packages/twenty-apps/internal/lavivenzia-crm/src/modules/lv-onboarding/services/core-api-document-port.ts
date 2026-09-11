import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type DocumentVerificationState } from 'src/modules/lv-onboarding/constants/document-verification';
import { type DocumentAuditEntry } from 'src/modules/lv-onboarding/utils/transition-document';

// All workspace I/O for onboarding documents. The decision logic
// (transition-document.ts, validate-upload.ts) stays pure and unit-tested;
// this is the only place that talks to the API.

export type DocumentRow = {
  id: string;
  onboardingId: string | null;
  documentType: string | null;
  verificationState: DocumentVerificationState;
  expiresAt: string | null;
  reviewerId: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  verificationFlags: readonly string[] | null;
  auditTrail: unknown;
  file: unknown;
};

const DOCUMENT_SELECTION = {
  id: true,
  onboardingId: true,
  documentType: true,
  verificationState: true,
  expiresAt: true,
  reviewerId: true,
  originalFilename: true,
  mimeType: true,
  fileSizeBytes: true,
  uploadedAt: true,
  verifiedAt: true,
  rejectionReason: true,
  verificationFlags: true,
  auditTrail: true,
  file: true,
} as const;

// The audit trail is append-only: read what is there, add one entry, write the
// whole array back. Overwriting it would destroy exactly the history
// SECURITY-RBAC.md requires be kept.
export const appendAudit = (
  existing: unknown,
  entry: DocumentAuditEntry | Record<string, unknown>,
): unknown[] => (Array.isArray(existing) ? [...existing, entry] : [entry]);

export type DocumentPort = {
  getDocument(documentId: string): Promise<DocumentRow | null>;
  listDocumentsForOnboarding(onboardingId: string): Promise<DocumentRow[]>;
  listExpiringDocuments(nowIso: string): Promise<DocumentRow[]>;
  createDocument(input: {
    onboardingId: string;
    documentType: string;
    name: string;
    // A FILES field stores a reference to an already-uploaded file, not bytes
    // and not a path: [{ fileId, label }]. The path is kept only for the
    // safety check and the audit entry.
    fileId: string;
    filePath: string;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    expiresAt: string | null;
    uploadedAt: string;
    uploadedByWorkspaceMemberId: string | null;
    replacesDocumentId: string | null;
    audit: Record<string, unknown>;
  }): Promise<{ id: string }>;
  applyDocumentState(input: {
    documentId: string;
    state: DocumentVerificationState;
    reviewerWorkspaceMemberId: string | null;
    rejectionReason: string | null;
    verificationFlags: readonly string[] | null;
    verifiedAt: string | null;
    existingAudit: unknown;
    // The state machine's entry, optionally carrying the platform-authenticated
    // session alongside the claimed actor.
    audit: DocumentAuditEntry & Record<string, unknown>;
  }): Promise<void>;
};

export const createCoreApiDocumentPort = (
  client: CoreApiClient,
): DocumentPort => ({
  getDocument: async (documentId) => {
    // The API throws rather than returning null for a record the caller cannot
    // see — which, under record scoping, is exactly what another reviewer's
    // document looks like. Both cases are "not yours to act on", so both
    // become null and the route refuses cleanly instead of surfacing a 500.
    try {
      const result = await client.query({
        lvOnboardingDocument: {
          __args: { filter: { id: { eq: documentId } } },
          ...DOCUMENT_SELECTION,
        },
      });

      return (
        (result as { lvOnboardingDocument?: DocumentRow }).lvOnboardingDocument ??
        null
      );
    } catch {
      return null;
    }
  },

  listDocumentsForOnboarding: async (onboardingId) => {
    const result = await client.query({
      lvOnboardingDocuments: {
        __args: {
          first: 200,
          filter: { onboardingId: { eq: onboardingId } },
        },
        edges: { node: DOCUMENT_SELECTION },
      },
    });

    return (
      (result as { lvOnboardingDocuments?: { edges?: { node?: DocumentRow }[] } })
        .lvOnboardingDocuments?.edges ?? []
    )
      .map((edge) => edge?.node)
      .filter((node): node is DocumentRow => Boolean(node?.id));
  },

  listExpiringDocuments: async (nowIso) => {
    // Only VERIFIED documents can expire — a rejected or pending one has
    // nothing to lose. Filtering server-side keeps the sweep cheap as the
    // document count grows.
    const result = await client.query({
      lvOnboardingDocuments: {
        __args: {
          first: 500,
          filter: {
            verificationState: { eq: 'VERIFIED' },
            expiresAt: { lte: nowIso },
          },
        },
        edges: { node: DOCUMENT_SELECTION },
      },
    });

    return (
      (result as { lvOnboardingDocuments?: { edges?: { node?: DocumentRow }[] } })
        .lvOnboardingDocuments?.edges ?? []
    )
      .map((edge) => edge?.node)
      .filter((node): node is DocumentRow => Boolean(node?.id));
  },

  createDocument: async (input) => {
    const result = await client.mutation({
      createLvOnboardingDocument: {
        __args: {
          data: {
            name: input.name,
            onboardingId: input.onboardingId,
            documentType: input.documentType,
            file: [{ fileId: input.fileId, label: input.originalFilename }],
            verificationState: 'PENDING',
            originalFilename: input.originalFilename,
            mimeType: input.mimeType,
            fileSizeBytes: input.fileSizeBytes,
            expiresAt: input.expiresAt,
            uploadedAt: input.uploadedAt,
            auditTrail: [input.audit],
            ...(input.replacesDocumentId
              ? { replacesId: input.replacesDocumentId }
              : {}),
          },
        },
        id: true,
      },
    });

    return {
      id:
        (result as { createLvOnboardingDocument?: { id?: string } })
          .createLvOnboardingDocument?.id ?? '',
    };
  },

  applyDocumentState: async (input) => {
    await client.mutation({
      updateLvOnboardingDocument: {
        __args: {
          id: input.documentId,
          data: {
            verificationState: input.state,
            reviewerId: input.reviewerWorkspaceMemberId,
            rejectionReason: input.rejectionReason,
            verificationFlags: input.verificationFlags ?? [],
            verifiedAt: input.verifiedAt,
            auditTrail: appendAudit(input.existingAudit, input.audit),
          },
        },
        id: true,
      },
    });
  },
});
