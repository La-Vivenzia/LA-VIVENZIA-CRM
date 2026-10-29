import { useEffect, useState } from 'react';

import {
  DOCUMENT_FLAGS,
  DOCUMENT_STATE_LABELS,
  DOCUMENT_TYPE_LABELS,
  reviewDocument,
  summariseDocuments,
  transitionOnboarding,
  type DocumentFlag,
  type DocumentVerificationState,
  type OnboardingDocument,
  type OnboardingRecord,
} from 'src/api/onboarding';
import { LvIcon } from 'src/design/icons';
import { EmptyState, formatWhen, InlineNotice, isForbiddenMessage, LvBadge, LvButton, LvCard, VisuallyHidden } from 'src/design/kit';
import { LvDecisionPanel, LvDocumentPreview, LvDocumentState } from 'src/design/onboarding';
import { LvSheet } from 'src/design/overlay';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';
import { DocumentPreviewDialog } from 'src/screens/onboarding/documents';

// 7.6 — Document review, the A7 anchor.
//
// A reviewer has to answer four questions before deciding: what document is
// this, what does it contain, is it valid, and what decision is required. On
// a desktop all four are in sight at once — the list, the file and the
// decision side by side. On a phone the file cannot share a screen with the
// decision and stay readable, so choosing a document opens a sheet with the
// decision in it and the file one tap away, full screen. The actions are
// never underneath a long document.

const DocumentFacts = ({ theme, document: file, now }: { theme: LvTheme; document: OnboardingDocument; now: string }) => (
  <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.space(3), margin: 0 }}>
    {(
      [
        ['Type', DOCUMENT_TYPE_LABELS[file.documentType ?? ''] ?? '—'],
        ['State', DOCUMENT_STATE_LABELS[file.verificationState]],
        ['File', file.originalFilename ?? '—'],
        ['Format', file.mimeType ?? '—'],
        ['Uploaded', formatWhen(file.uploadedAt, now)],
        ['Expires', file.expiresAt ? formatWhen(file.expiresAt, now) : 'No expiry recorded'],
        ['Verified', file.verifiedAt ? formatWhen(file.verifiedAt, now) : 'Not verified'],
        ['Decided by', file.reviewerName ?? 'Nobody yet'],
      ] as const
    ).map(([label, value]) => (
      <div key={label} style={{ minWidth: 0 }}>
        <dt style={{ ...theme.type.caption, color: theme.color.textMuted }}>{label}</dt>
        <dd style={{ ...theme.type.bodySmall, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
      </div>
    ))}
  </dl>
);

/** Everything the record already knows about this document's history. */
const DocumentHistory = ({ theme, document: file, now }: { theme: LvTheme; document: OnboardingDocument; now: string }) => {
  if (file.auditTrail.length === 0 && file.rejectionReason === null && file.verificationFlags.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
      {file.rejectionReason && (
        <InlineNotice theme={theme} tone="danger">
          <strong style={{ color: theme.color.heading }}>Sent back:</strong> {file.rejectionReason}
        </InlineNotice>
      )}

      {file.verificationFlags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {file.verificationFlags.map((flag) => (
            <LvBadge key={flag} theme={theme} tone="warning">
              {DOCUMENT_FLAGS.find((entry) => entry.key === flag)?.label ?? flag}
            </LvBadge>
          ))}
        </div>
      )}

      {file.auditTrail.length > 0 && (
        <ol style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
          {file.auditTrail
            .slice()
            .reverse()
            .map((entry, index) => (
              <li key={index} style={{ display: 'flex', gap: theme.space(2), ...theme.type.caption, color: theme.color.textMuted }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 auto', marginTop: 1 }}>
                  <LvIcon name="clock" size={13} />
                </span>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {entry.from ? `${entry.from} → ` : ''}
                  {entry.to ?? entry.event ?? 'Change'}
                  {entry.at ? ` · ${formatWhen(entry.at, now)}` : ''}
                  {entry.reason ? ` · ${entry.reason}` : ''}
                </span>
              </li>
            ))}
        </ol>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pune Pilot Corridor Verification Card — 7.10
//
// Four manual checks a reviewer must complete before the fast-track approve
// button becomes available. The checks are client-side only: the backend has
// no persistence for them, so they reset when the page is refreshed. This is
// stated plainly in the UI. Pressing the button uses the same
// `transitionOnboarding` → APPROVED path the transition dialog uses; all
// server-side guards (reviewer assigned, all docs verified, valid transition)
// still apply and can refuse the request.
// ---------------------------------------------------------------------------

const PUNE_CHECKS = [
  {
    key: 'identity_pan',
    label: 'Identity & PAN Check',
    detail: 'Valid government-issued photo ID and PAN card verified.',
  },
  {
    key: 'corridor_location',
    label: 'Corridor Location Verified',
    detail: 'Amanora, Seasons Mall, Magarpatta, Hadapsar',
  },
  {
    key: 'safety_license',
    label: 'Safety & License Audit',
    detail: 'FSSAI, Fire NOC, liquor/entertainment license',
  },
  {
    key: 'bank_payout',
    label: 'Bank Payout Account Setup',
    detail: 'Account number and IFSC verified for Razorpay Route',
  },
] as const;

type PuneCheckKey = (typeof PUNE_CHECKS)[number]['key'];

export const LvPuneVerificationCard = ({
  theme,
  record,
  onReload,
}: {
  theme: LvTheme;
  record: OnboardingRecord;
  onReload: () => void;
}) => {
  const [checked, setChecked] = useState<Set<PuneCheckKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const allChecked = checked.size === PUNE_CHECKS.length;
  const isAlreadyApproved = record.status === 'APPROVED' || record.status === 'ACTIVATED';

  const toggle = (key: PuneCheckKey) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const fastTrackApprove = async () => {
    setBusy(true);
    setError(null);

    try {
      await transitionOnboarding({
        onboardingId: record.id,
        to: 'APPROVED',
        note: 'Fast-tracked via Pune Pilot Corridor checklist (all four checks completed by reviewer).',
      });
      setApplied(true);
      onReload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approval was not applied.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LvSectionCard theme={theme} title="Pune Pilot Corridor Verification" icon="check">
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
          Complete all four checks before fast-track approval. These checks are{' '}
          <strong style={{ color: theme.color.heading }}>not persisted</strong> by the server — they
          reset on page refresh and do not replace the server-side approval guards.
        </p>

        <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
          {PUNE_CHECKS.map((item) => {
            const isChecked = checked.has(item.key);

            return (
              <li key={item.key}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: theme.space(3),
                    minHeight: 44,
                    padding: theme.space(3),
                    borderRadius: theme.radius.md,
                    border: `1px solid ${isChecked ? theme.color.success : theme.color.border}`,
                    background: isChecked ? theme.color.successMuted : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(item.key)}
                    style={{ marginTop: 3, width: 18, height: 18, flex: '0 0 auto', accentColor: theme.color.success }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>
                      {item.label}
                    </span>
                    <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{item.detail}</span>
                  </span>
                  {isChecked && (
                    <span aria-hidden="true" style={{ color: theme.color.success, display: 'inline-flex', flex: '0 0 auto', marginTop: 2 }}>
                      <LvIcon name="check" size={16} />
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>

        {applied && <InlineNotice theme={theme} tone="success">Approved. Refreshing the record…</InlineNotice>}
        {error !== null && (
          <InlineNotice theme={theme} tone="danger">
            {isForbiddenMessage(error)
              ? `${error} Only the reviewer assigned to this onboarding can approve it.`
              : error}
          </InlineNotice>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          <LvButton
            theme={theme}
            variant="primary"
            disabled={!allChecked || busy || isAlreadyApproved}
            busy={busy}
            onClick={() => void fastTrackApprove()}
            style={
              allChecked && !busy && !isAlreadyApproved
                ? {
                    background: theme.color.success,
                    borderColor: theme.color.success,
                    color: theme.color.textInverse,
                  }
                : undefined
            }
          >
            Fast-Track Approve for Launch
          </LvButton>
          {!allChecked && !isAlreadyApproved && (
            <p style={{ ...theme.type.caption, color: theme.color.textMuted, margin: 0 }}>
              {PUNE_CHECKS.length - checked.size} of {PUNE_CHECKS.length} checks still needed.
            </p>
          )}
          {isAlreadyApproved && (
            <p style={{ ...theme.type.caption, color: theme.color.success, margin: 0 }}>
              This partner onboarding is already {record.status.toLowerCase()}.
            </p>
          )}
        </div>
      </div>
    </LvSectionCard>
  );
};

export const ReviewWorkspace = ({
  theme,
  record,
  now,
  selectedId,
  onSelect,
  onReload,
}: {
  theme: LvTheme;
  record: OnboardingRecord;
  now: string;
  selectedId: string | null;
  onSelect: (documentId: string | null) => void;
  onReload: () => void;
}) => {
  const tier = useLvTier();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const documents = record.documents;
  const selected = documents.find((doc) => doc.id === selectedId) ?? null;
  const summary = summariseDocuments(documents);

  // Moving to another document must not carry the last one's error with it.
  useEffect(() => {
    setError(null);
    setApplied(null);
  }, [selectedId]);

  const decide = async (to: DocumentVerificationState, reason: string | null, flags: DocumentFlag[]) => {
    if (!selected) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await reviewDocument({ documentId: selected.id, to, reason, flags });
      setApplied(`${DOCUMENT_TYPE_LABELS[selected.documentType ?? ''] ?? 'Document'} is now ${DOCUMENT_STATE_LABELS[to].toLowerCase()}.`);
      onReload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That decision was not applied.');
    } finally {
      setBusy(false);
    }
  };

  if (documents.length === 0) {
    return (
      <LvSectionCard theme={theme} title="Document review" icon="search">
        <EmptyState
          theme={theme}
          icon="document"
          tint="blue"
          title="There is nothing to review"
          text="No documents have been uploaded against this onboarding yet. A reviewer's decision needs a document to decide about."
        />
      </LvSectionCard>
    );
  }

  const list = (
    <LvSectionCard theme={theme} title={`Documents (${summary.verified} of ${summary.total} verified)`} icon="document">
      <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
        {documents.map((doc) => {
          const active = doc.id === selectedId;

          return (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onSelect(active && tier !== 'mobile' ? null : doc.id)}
                aria-pressed={active}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.space(3),
                  width: '100%',
                  minHeight: 56,
                  padding: theme.space(3),
                  borderRadius: theme.radius.md,
                  border: `1px solid ${active ? theme.color.brand : theme.color.border}`,
                  background: active ? theme.tint.mint.wash : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: theme.font.body,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>
                    {DOCUMENT_TYPE_LABELS[doc.documentType ?? ''] ?? doc.name ?? 'Document'}
                  </span>
                  <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>
                    {doc.originalFilename ?? 'No filename'}
                  </span>
                </span>
                <LvDocumentState theme={theme} state={doc.verificationState} />
              </button>
            </li>
          );
        })}
      </ul>
    </LvSectionCard>
  );

  const decisionBody = selected && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
      <DocumentFacts theme={theme} document={selected} now={now} />
      <DocumentHistory theme={theme} document={selected} now={now} />
      {applied && <InlineNotice theme={theme} tone="success">{applied}</InlineNotice>}
      {/* The file is the evidence. If it cannot be opened, say so where the
          decision is made rather than letting a reviewer decide blind. */}
      {selected.fileUrl === null && (
        <InlineNotice theme={theme} tone="warning">
          No stored file came back with this document, so there is nothing to read. Decide only if you have seen it another way.
        </InlineNotice>
      )}
      <LvDecisionPanel
        theme={theme}
        document={selected}
        busy={busy}
        onDecide={(to, reason, flags) => void decide(to, reason, flags)}
        error={error === null ? null : isForbiddenMessage(error) ? `${error} Only the reviewer assigned to this onboarding can decide on its documents.` : error}
      />
    </div>
  );

  // ------------------------------------------------------------------ phone
  if (tier === 'mobile') {
    return (
      <>
        {list}
        {selected && (
          <LvSheet
            theme={theme}
            title={DOCUMENT_TYPE_LABELS[selected.documentType ?? ''] ?? 'Document'}
            onClose={() => onSelect(null)}
            footer={
              <>
                {selected.fileUrl !== null && (
                  <LvButton theme={theme} variant="secondary" onClick={() => setPreviewing(true)} icon={<LvIcon name="document" size={16} />}>
                    See the file
                  </LvButton>
                )}
                <LvButton theme={theme} variant="ghost" onClick={() => onSelect(null)}>
                  Close
                </LvButton>
              </>
            }
          >
            {decisionBody}
          </LvSheet>
        )}
        {previewing && selected && <DocumentPreviewDialog theme={theme} document={selected} onClose={() => setPreviewing(false)} />}
      </>
    );
  }

  // ------------------------------------------------- tablet and desktop
  return (
    <>
      <div className="lv-review-layout">
        {list}

        {/* The evidence column appears from 768px up; below that the file has
            its own full screen instead of a third of a small one. */}
        <div className="lv-review-evidence">
          <LvCard theme={theme} padding={4}>
            <LvDocumentPreview theme={theme} document={selected} onOpenFull={selected?.fileUrl ? () => setPreviewing(true) : undefined} />
          </LvCard>
        </div>

        <div className="lv-review-decision">
          {selected ? (
            <LvSectionCard theme={theme} title="Your decision" icon="check">
              {decisionBody}
            </LvSectionCard>
          ) : (
            <LvSectionCard theme={theme} title="Your decision" icon="check">
              <EmptyState theme={theme} icon="document" tint="blue" text="Choose a document on the left to see it and decide." />
            </LvSectionCard>
          )}
        </div>
      </div>

      {previewing && selected && <DocumentPreviewDialog theme={theme} document={selected} onClose={() => setPreviewing(false)} />}
      <VisuallyHidden aria-live="polite">{applied ?? ''}</VisuallyHidden>
    </>
  );
};
