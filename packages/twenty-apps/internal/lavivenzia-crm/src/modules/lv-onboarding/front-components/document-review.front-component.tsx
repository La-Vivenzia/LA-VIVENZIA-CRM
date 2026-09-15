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
import { EmptyState, ErrorState, Field, InlineNotice, LoadingState, LvBadge, LvButton, LvCard, LvPage, LvSelect, LvStatusBadge, LvTextarea, PageHeader, Section } from 'src/modules/lv-core/ui/kit';
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
      <LvPage theme={theme} maxWidth={860}>
        <LoadingState theme={theme} rows={3} label="Loading documents" />
      </LvPage>
    );
  }

  const pendingCount = documents.length - verifiedCount;

  return (
    <LvPage theme={theme} maxWidth={860}>
      <div style={s.stack(4)}>
        <PageHeader
          theme={theme}
          eyebrow="Onboarding"
          title="Document review"
          subtitle={documents.length === 0 ? 'Nothing to review yet.' : allVerified ? 'Every uploaded document is verified. The onboarding can be approved.' : `${pendingCount} document${pendingCount === 1 ? '' : 's'} still need${pendingCount === 1 ? 's' : ''} a decision.`}
          right={
            <LvBadge theme={theme} tone={allVerified ? 'success' : documents.length > 0 ? 'warning' : 'neutral'}>
              {verifiedCount}/{documents.length} verified
            </LvBadge>
          }
        />

        <Section theme={theme} title="Reviewer" actions={<LvStatusBadge theme={theme} kind="onboarding" value={onboardingStatus.length > 0 ? onboardingStatus : null} />}>
          <Field theme={theme} label="Assigned reviewer" htmlFor="lv-review-reviewer" help="The reviewer is recorded on every verification decision.">
            <LvSelect theme={theme} id="lv-review-reviewer" value={reviewerId ?? ''} onChange={(event) => void assignReviewer(event.target.value)}>
              <option value="">Not assigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberName(member.id)}
                </option>
              ))}
            </LvSelect>
          </Field>
        </Section>

        {error !== null && <ErrorState theme={theme} text={error} />}
        {notice !== null && (
          <InlineNotice theme={theme} tone="success">
            {notice}
          </InlineNotice>
        )}

        {documents.length === 0 && <EmptyState theme={theme} quiet={false} title="No documents yet" text="Documents appear here as soon as the partner uploads them in the onboarding wizard." />}

        {documents.map((documentRow) => {
          const mode = previewModeFor(documentRow.mimeType);
          const flags = draftFlags[documentRow.id] ?? [];
          const isBusy = busyId === documentRow.id;
          const state = documentRow.verificationState;
          const tone = state === 'VERIFIED' ? 'success' : state === 'REJECTED' || state === 'EXPIRED' ? 'danger' : state === 'NEEDS_REPLACEMENT' ? 'warning' : undefined;

          return (
            <Section key={documentRow.id} theme={theme} title={documentRow.documentType ?? 'Document'} tone={tone} actions={<LvStatusBadge theme={theme} kind="document" value={state} />}>
              <dl style={{ ...theme.type.bodySmall, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: `${theme.space(2)}px ${theme.space(3)}px`, margin: `0 0 ${theme.space(3)}px`, color: theme.color.text }}>
                {[
                  ['File', documentRow.originalFilename ?? 'unnamed file'],
                  ['Type · size', `${documentRow.mimeType ?? 'unknown type'} · ${formatBytes(documentRow.fileSizeBytes ?? 0)}`],
                  ['Uploaded', documentRow.uploadedAt ?? '—'],
                  documentRow.expiresAt !== null ? ['Expires', documentRow.expiresAt] : null,
                  documentRow.verifiedAt !== null ? ['Verified', documentRow.verifiedAt] : null,
                  ['Reviewed by', memberName(documentRow.reviewerId)],
                ]
                  .filter((row): row is [string, string] => row !== null)
                  .map(([label, value]) => (
                    <div key={label} style={{ minWidth: 0 }}>
                      <dt style={{ ...theme.type.label, color: theme.color.textMuted, marginBottom: 2 }}>{label}</dt>
                      <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
                    </div>
                  ))}
              </dl>
              {documentRow.rejectionReason !== null && documentRow.rejectionReason !== '' && (
                <div style={{ marginBottom: theme.space(3) }}>
                  <InlineNotice theme={theme} tone="danger">
                    Reason: {documentRow.rejectionReason}
                  </InlineNotice>
                </div>
              )}

              <LvButton theme={theme} variant="secondary" size="sm" onClick={() => void openPreview(documentRow)}>
                {previewId === documentRow.id ? 'Hide' : 'Open document'}
              </LvButton>

              {previewId === documentRow.id && (
                <div style={{ marginTop: theme.space(3) }}>
                  {previewUrl === null ? (
                    <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>Opening…</span>
                  ) : mode === 'IMAGE' ? (
                    <img src={previewUrl} alt={documentRow.originalFilename ?? 'document'} style={{ maxWidth: '100%', borderRadius: theme.radius.md, border: '1px solid ' + theme.color.border }} />
                  ) : mode === 'PDF' ? (
                    <iframe title={documentRow.originalFilename ?? 'document'} src={previewUrl} style={{ width: '100%', height: 420, border: '1px solid ' + theme.color.border, borderRadius: theme.radius.md }} />
                  ) : (
                    <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: theme.color.brand }}>
                      Download {documentRow.originalFilename ?? 'file'}
                    </a>
                  )}
                </div>
              )}

              <div style={{ marginTop: theme.space(4) }}>
                <div style={{ ...theme.type.label, color: theme.color.textMuted, marginBottom: theme.space(2) }}>Issues you found — your judgement, nothing is checked automatically</div>
                <div style={s.row}>
                  {DOCUMENT_VERIFICATION_FLAGS.map((flag) => {
                    const on = flags.includes(flag);

                    return (
                      <label
                        key={flag}
                        style={{
                          ...theme.type.bodySmall,
                          cursor: 'pointer',
                          minHeight: 36,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: `4px ${theme.space(3)}px`,
                          borderRadius: theme.radius.pill,
                          border: `1px solid ${on ? theme.color.warning : theme.color.borderStrong}`,
                          background: on ? theme.color.warningMuted : theme.color.surfaceRaised,
                          color: on ? theme.color.warning : theme.color.text,
                          fontWeight: on ? theme.font.weight.medium : theme.font.weight.regular,
                        }}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggleFlag(documentRow.id, flag)} />
                        {DOCUMENT_VERIFICATION_FLAG_LABELS[flag]}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: theme.space(3) }}>
                <Field theme={theme} label="Reason" htmlFor={`lv-review-reason-${documentRow.id}`} help="Required to reject or request a replacement; the partner sees it.">
                  <LvTextarea theme={theme} id={`lv-review-reason-${documentRow.id}`} style={{ minHeight: 72 }} placeholder="What needs to change?" value={draftReason[documentRow.id] ?? ''} onChange={(event) => setDraftReason((current) => ({ ...current, [documentRow.id]: event.target.value }))} />
                </Field>
              </div>

              <div style={{ ...s.row, marginTop: theme.space(3) }}>
                {REVIEW_ACTIONS.filter((to) => canTransitionDocument(documentRow.verificationState, to)).map((to) => (
                  <LvButton key={to} theme={theme} disabled={isBusy} busy={isBusy} variant={to === 'REJECTED' ? 'danger' : to === 'VERIFIED' ? 'primary' : 'secondary'} onClick={() => void applyDecision(documentRow, to)}>
                    {DOCUMENT_VERIFICATION_STATE_LABELS[to]}
                  </LvButton>
                ))}
              </div>
            </Section>
          );
        })}

        <LvCard theme={theme} as="section" ariaLabel="Onboarding decision" tone={allVerified ? 'success' : 'warning'}>
          <h2 style={{ ...theme.type.title, margin: 0, color: theme.color.heading }}>Onboarding decision</h2>
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 ${theme.space(3)}px` }}>{allVerified ? 'Every uploaded document is verified.' : 'Approval is refused until every uploaded document is verified.'}</p>
          <Field theme={theme} label="Reason" htmlFor="lv-review-onboarding-reason" help="Required to reject or request changes.">
            <LvTextarea theme={theme} id="lv-review-onboarding-reason" style={{ minHeight: 72 }} placeholder="What should the partner do next?" value={draftReason.onboarding ?? ''} onChange={(event) => setDraftReason((current) => ({ ...current, onboarding: event.target.value }))} />
          </Field>
          <div style={{ ...s.row, marginTop: theme.space(3) }}>
            <LvButton theme={theme} variant="primary" disabled={busyId === 'onboarding' || !allVerified} busy={busyId === 'onboarding'} onClick={() => void decide('APPROVED')} title={allVerified ? undefined : 'Every document must be verified first'}>
              Approve
            </LvButton>
            <LvButton theme={theme} variant="secondary" disabled={busyId === 'onboarding'} onClick={() => void decide('CHANGES_REQUESTED')}>
              Request changes
            </LvButton>
            <LvButton theme={theme} variant="danger" disabled={busyId === 'onboarding'} onClick={() => void decide('REJECTED')}>
              Reject
            </LvButton>
          </div>
        </LvCard>
      </div>
    </LvPage>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_DOCUMENT_REVIEW_ID,
  name: 'lv-document-review',
  description:
    'Reviewer workspace for partner onboarding: document metadata, preview, verification decisions and the approval gate',
  component: DocumentReview,
});
