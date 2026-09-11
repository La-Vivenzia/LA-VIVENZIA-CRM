import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useColorScheme, useRecordId } from 'twenty-sdk/front-component';

import { FC_DOCUMENT_REVIEW_ID } from 'src/constants/universal-identifiers';
import {
  canTransitionDocument,
  DOCUMENT_VERIFICATION_FLAG_LABELS,
  DOCUMENT_VERIFICATION_FLAGS,
  DOCUMENT_VERIFICATION_STATE_LABELS,
  DOCUMENT_VERIFICATION_STATES,
  type DocumentVerificationFlag,
  type DocumentVerificationState,
} from 'src/modules/lv-onboarding/constants/document-verification';
import {
  formatBytes,
  previewModeFor,
} from 'src/modules/lv-onboarding/constants/document-policy';
import { layout, themeFor } from 'src/modules/lv-core/ui/theme';

// The reviewer's workspace for one partner onboarding.
//
// Every action goes through the server-side routes, never straight to the
// record. The UI only offers transitions the state machine would allow — but
// that is a convenience, not the protection: SECURITY-RBAC.md is explicit that
// UI filtering is never security, and a direct API call meets the same guards.
//
// Verification flags are reviewer judgements, deliberately not automated. No
// OCR runs, nothing is inferred, and nothing is ever pre-ticked.

type DocumentRow = {
  id: string;
  name: string | null;
  documentType: string | null;
  verificationState: DocumentVerificationState;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  reviewerId: string | null;
};

type MemberRow = {
  id: string;
  name?: { firstName?: string; lastName?: string } | null;
};

const STATE_TONE: Record<
  DocumentVerificationState,
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  PENDING: 'neutral',
  UNDER_REVIEW: 'info',
  VERIFIED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
  NEEDS_REPLACEMENT: 'warning',
};

// Outcomes a reviewer may choose. PENDING is not offered — a reviewer does not
// un-review a document, the partner replaces it. EXPIRED is not offered either:
// it is applied by the nightly sweep, because a date passing is a fact rather
// than a judgement.
const REVIEW_ACTIONS: DocumentVerificationState[] =
  DOCUMENT_VERIFICATION_STATES.filter(
    (state) => state !== 'PENDING' && state !== 'EXPIRED',
  );

const callRoute = async (
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const apiBaseUrl = process.env.TWENTY_API_URL;
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (!apiBaseUrl || !token) {
    throw new Error('API configuration missing.');
  }

  const response = await fetch(apiBaseUrl + '/s' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};

  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.slice(0, 200) || 'Request failed.');
  }

  // A refusal from the state machine is a 200 with ok:false. Treating it as
  // success would show the reviewer a change that never happened.
  if (parsed.ok === false) {
    throw new Error(String(parsed.error ?? 'The server refused that action.'));
  }

  if (!response.ok) {
    throw new Error(String(parsed.error ?? 'Request failed.'));
  }

  return parsed;
};

export const DocumentReview = () => {
  const onboardingId = useRecordId();
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const s = useMemo(() => layout(theme), [theme]);
  const client = useMemo(() => new CoreApiClient(), []);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [draftReason, setDraftReason] = useState<Record<string, string>>({});
  const [draftFlags, setDraftFlags] = useState<
    Record<string, DocumentVerificationFlag[]>
  >({});

  const load = useCallback(async () => {
    if (!onboardingId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.query({
        lvOnboarding: {
          __args: { filter: { id: { eq: onboardingId } } },
          id: true,
          status: true,
          reviewerId: true,
        },
        lvOnboardingDocuments: {
          __args: {
            first: 100,
            filter: { onboardingId: { eq: onboardingId } },
          },
          edges: {
            node: {
              id: true,
              name: true,
              documentType: true,
              verificationState: true,
              originalFilename: true,
              mimeType: true,
              fileSizeBytes: true,
              uploadedAt: true,
              verifiedAt: true,
              expiresAt: true,
              rejectionReason: true,
              reviewerId: true,
            },
          },
        },
        workspaceMembers: {
          __args: { first: 100 },
          edges: {
            node: { id: true, name: { firstName: true, lastName: true } },
          },
        },
      });

      const typed = result as {
        lvOnboarding?: { status?: string; reviewerId?: string | null };
        lvOnboardingDocuments?: { edges?: { node?: DocumentRow }[] };
        workspaceMembers?: { edges?: { node?: MemberRow }[] };
      };

      setOnboardingStatus(typed.lvOnboarding?.status ?? '');
      setReviewerId(typed.lvOnboarding?.reviewerId ?? null);
      setDocuments(
        (typed.lvOnboardingDocuments?.edges ?? [])
          .map((edge) => edge?.node)
          .filter((node): node is DocumentRow => Boolean(node?.id)),
      );
      setMembers(
        (typed.workspaceMembers?.edges ?? [])
          .map((edge) => edge?.node)
          .filter((node): node is MemberRow => Boolean(node?.id)),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not load this onboarding.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [client, onboardingId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The signed URL is fetched only when a reviewer actually opens a document,
  // and it is short-lived. Nothing long-lived is embedded in the page and the
  // storage bucket stays private.
  const openPreview = useCallback(
    async (documentRow: DocumentRow) => {
      if (previewId === documentRow.id) {
        setPreviewId(null);
        setPreviewUrl(null);

        return;
      }

      setPreviewId(documentRow.id);
      setPreviewUrl(null);
      setError(null);

      try {
        const result = await client.query({
          lvOnboardingDocument: {
            __args: { filter: { id: { eq: documentRow.id } } },
            file: true,
          },
        });

        const files = (result as { lvOnboardingDocument?: { file?: unknown } })
          .lvOnboardingDocument?.file;

        setPreviewUrl(
          Array.isArray(files)
            ? ((files[0] as { url?: string } | undefined)?.url ?? null)
            : null,
        );
      } catch {
        setError('Could not open that document.');
      }
    },
    [client, previewId],
  );

  const applyDecision = useCallback(
    async (documentRow: DocumentRow, to: DocumentVerificationState) => {
      setBusyId(documentRow.id);
      setError(null);
      setNotice(null);

      try {
        await callRoute('/onboarding/documents/review', {
          documentId: documentRow.id,
          to,
          reason: draftReason[documentRow.id]?.trim() || null,
          flags: draftFlags[documentRow.id] ?? [],
          // The reviewer accountable for the decision. The state machine
          // refuses every human-only outcome without it.
          actorWorkspaceMemberId: reviewerId,
        });

        setNotice(
          (documentRow.documentType ?? 'Document') +
            ' → ' +
            DOCUMENT_VERIFICATION_STATE_LABELS[to],
        );
        await load();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'That action failed.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [draftFlags, draftReason, load, reviewerId],
  );

  const assignReviewer = useCallback(
    async (memberId: string) => {
      setError(null);

      try {
        await client.mutation({
          updateLvOnboarding: {
            __args: {
              id: onboardingId,
              data: { reviewerId: memberId.length > 0 ? memberId : null },
            },
            id: true,
          },
        });

        setReviewerId(memberId.length > 0 ? memberId : null);
        setNotice('Reviewer assigned.');
      } catch {
        setError('Could not assign that reviewer.');
      }
    },
    [client, onboardingId],
  );

  const decide = useCallback(
    async (to: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED') => {
      setBusyId('onboarding');
      setError(null);
      setNotice(null);

      try {
        const result = await callRoute('/onboarding/transition', {
          onboardingId,
          to,
          reason: draftReason.onboarding?.trim() || null,
          actorWorkspaceMemberId: reviewerId,
          reviewerWorkspaceMemberId: reviewerId,
        });

        setNotice('Onboarding ' + String(result.status ?? to).toLowerCase() + '.');
        await load();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'That decision failed.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [draftReason, load, onboardingId, reviewerId],
  );

  const toggleFlag = (documentId: string, flag: DocumentVerificationFlag) =>
    setDraftFlags((current) => {
      const existing = current[documentId] ?? [];

      return {
        ...current,
        [documentId]: existing.includes(flag)
          ? existing.filter((value) => value !== flag)
          : [...existing, flag],
      };
    });

  const memberName = (id: string | null) => {
    const member = members.find((candidate) => candidate.id === id);

    if (!member) {
      return id !== null ? 'Unknown member' : 'Not assigned';
    }

    const full = [member.name?.firstName, member.name?.lastName]
      .filter((part) => typeof part === 'string' && part.length > 0)
      .join(' ');

    return full.length > 0 ? full : member.id;
  };

  const verifiedCount = documents.filter(
    (documentRow) => documentRow.verificationState === 'VERIFIED',
  ).length;
  const allVerified = documents.length > 0 && verifiedCount === documents.length;

  if (isLoading) {
    return (
      <div style={s.page}>
        <div style={{ ...s.container(760), ...s.card }}>Loading documents…</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={{ ...s.container(760), ...s.stack(4) }}>
        <div style={s.card}>
          <div style={{ ...s.row, justifyContent: 'space-between' }}>
            <strong style={{ fontSize: theme.font.size.lg }}>
              Document review
            </strong>
            <span style={s.badge(allVerified ? 'success' : 'neutral')}>
              {verifiedCount}/{documents.length} verified
            </span>
          </div>

          <div style={{ ...s.stack(2), marginTop: theme.space(3) }}>
            <label
              style={{
                color: theme.color.textMuted,
                fontSize: theme.font.size.sm,
              }}
            >
              Reviewer
            </label>
            <select
              style={s.input}
              value={reviewerId ?? ''}
              onChange={(event) => void assignReviewer(event.target.value)}
            >
              <option value="">Not assigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberName(member.id)}
                </option>
              ))}
            </select>
            <span
              style={{
                color: theme.color.textMuted,
                fontSize: theme.font.size.xs,
              }}
            >
              Onboarding status: {onboardingStatus.length > 0 ? onboardingStatus : 'unknown'}
            </span>
          </div>
        </div>

        {error !== null && (
          <div
            style={{
              ...s.card,
              borderColor: theme.color.danger,
              color: theme.color.danger,
            }}
          >
            {error}
          </div>
        )}

        {notice !== null && (
          <div style={{ ...s.card, borderColor: theme.color.success }}>
            {notice}
          </div>
        )}

        {documents.length === 0 && (
          <div style={s.card}>
            No documents have been uploaded for this onboarding yet.
          </div>
        )}

        {documents.map((documentRow) => {
          const mode = previewModeFor(documentRow.mimeType);
          const flags = draftFlags[documentRow.id] ?? [];
          const isBusy = busyId === documentRow.id;

          return (
            <div key={documentRow.id} style={s.card}>
              <div style={{ ...s.row, justifyContent: 'space-between' }}>
                <strong>{documentRow.documentType ?? 'Document'}</strong>
                <span style={s.badge(STATE_TONE[documentRow.verificationState])}>
                  {
                    DOCUMENT_VERIFICATION_STATE_LABELS[
                      documentRow.verificationState
                    ]
                  }
                </span>
              </div>

              <div
                style={{
                  ...s.stack(1),
                  margin: theme.space(3) + 'px 0',
                  color: theme.color.textMuted,
                  fontSize: theme.font.size.sm,
                }}
              >
                <div>{documentRow.originalFilename ?? 'unnamed file'}</div>
                <div>
                  {documentRow.mimeType ?? 'unknown type'} ·{' '}
                  {formatBytes(documentRow.fileSizeBytes ?? 0)}
                </div>
                <div>Uploaded {documentRow.uploadedAt ?? '—'}</div>
                {documentRow.expiresAt !== null && (
                  <div>Expires {documentRow.expiresAt}</div>
                )}
                {documentRow.verifiedAt !== null && (
                  <div>Verified {documentRow.verifiedAt}</div>
                )}
                <div>Reviewed by {memberName(documentRow.reviewerId)}</div>
                {documentRow.rejectionReason !== null &&
                  documentRow.rejectionReason !== '' && (
                    <div style={{ color: theme.color.danger }}>
                      Reason: {documentRow.rejectionReason}
                    </div>
                  )}
              </div>

              <button
                type="button"
                style={s.button('secondary')}
                onClick={() => void openPreview(documentRow)}
              >
                {previewId === documentRow.id ? 'Hide' : 'Open document'}
              </button>

              {previewId === documentRow.id && (
                <div style={{ marginTop: theme.space(3) }}>
                  {previewUrl === null ? (
                    <span style={{ color: theme.color.textMuted }}>
                      Opening…
                    </span>
                  ) : mode === 'IMAGE' ? (
                    <img
                      src={previewUrl}
                      alt={documentRow.originalFilename ?? 'document'}
                      style={{
                        maxWidth: '100%',
                        borderRadius: theme.radius.md,
                        border: '1px solid ' + theme.color.border,
                      }}
                    />
                  ) : mode === 'PDF' ? (
                    <iframe
                      title={documentRow.originalFilename ?? 'document'}
                      src={previewUrl}
                      style={{
                        width: '100%',
                        height: 420,
                        border: '1px solid ' + theme.color.border,
                        borderRadius: theme.radius.md,
                      }}
                    />
                  ) : (
                    <a href={previewUrl} target="_blank" rel="noreferrer">
                      Download {documentRow.originalFilename ?? 'file'}
                    </a>
                  )}
                </div>
              )}

              <div style={{ marginTop: theme.space(4) }}>
                <div
                  style={{
                    color: theme.color.textMuted,
                    fontSize: theme.font.size.sm,
                    marginBottom: theme.space(2),
                  }}
                >
                  Issues you found — your judgement, nothing is checked
                  automatically
                </div>
                <div style={s.row}>
                  {DOCUMENT_VERIFICATION_FLAGS.map((flag) => (
                    <label
                      key={flag}
                      style={{
                        ...s.badge(
                          flags.includes(flag) ? 'warning' : 'neutral',
                        ),
                        cursor: 'pointer',
                        minHeight: 32,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={flags.includes(flag)}
                        onChange={() => toggleFlag(documentRow.id, flag)}
                      />
                      {DOCUMENT_VERIFICATION_FLAG_LABELS[flag]}
                    </label>
                  ))}
                </div>
              </div>

              <textarea
                style={{ ...s.input, marginTop: theme.space(3), minHeight: 72 }}
                placeholder="Reason (required to reject or request a replacement)"
                value={draftReason[documentRow.id] ?? ''}
                onChange={(event) =>
                  setDraftReason((current) => ({
                    ...current,
                    [documentRow.id]: event.target.value,
                  }))
                }
              />

              <div style={{ ...s.row, marginTop: theme.space(3) }}>
                {REVIEW_ACTIONS.filter((to) =>
                  canTransitionDocument(documentRow.verificationState, to),
                ).map((to) => (
                  <button
                    key={to}
                    type="button"
                    disabled={isBusy}
                    style={
                      to === 'REJECTED'
                        ? s.button('danger')
                        : to === 'VERIFIED'
                          ? s.button('primary')
                          : s.button('secondary')
                    }
                    onClick={() => void applyDecision(documentRow, to)}
                  >
                    {DOCUMENT_VERIFICATION_STATE_LABELS[to]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div style={s.card}>
          <strong>Onboarding decision</strong>
          <p
            style={{
              color: theme.color.textMuted,
              fontSize: theme.font.size.sm,
            }}
          >
            {allVerified
              ? 'Every uploaded document is verified.'
              : 'Approval is refused until every uploaded document is verified.'}
          </p>
          <textarea
            style={{ ...s.input, minHeight: 72 }}
            placeholder="Reason (required to reject or request changes)"
            value={draftReason.onboarding ?? ''}
            onChange={(event) =>
              setDraftReason((current) => ({
                ...current,
                onboarding: event.target.value,
              }))
            }
          />
          <div style={{ ...s.row, marginTop: theme.space(3) }}>
            <button
              type="button"
              disabled={busyId === 'onboarding' || !allVerified}
              style={{ ...s.button('primary'), opacity: allVerified ? 1 : 0.5 }}
              onClick={() => void decide('APPROVED')}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busyId === 'onboarding'}
              style={s.button('secondary')}
              onClick={() => void decide('CHANGES_REQUESTED')}
            >
              Request changes
            </button>
            <button
              type="button"
              disabled={busyId === 'onboarding'}
              style={s.button('danger')}
              onClick={() => void decide('REJECTED')}
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_DOCUMENT_REVIEW_ID,
  name: 'lv-document-review',
  description:
    'Reviewer workspace for partner onboarding: document metadata, preview, verification decisions and the approval gate',
  component: DocumentReview,
});
