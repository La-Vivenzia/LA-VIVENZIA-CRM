import { useState, type ReactNode } from 'react';

import {
  DOCUMENT_FLAGS,
  DOCUMENT_STATE_LABELS,
  DOCUMENT_TRANSITIONS,
  DOCUMENT_DECISION_COPY,
  DOCUMENT_TYPE_LABELS,
  documentRequiresReason,
  formatBytes,
  previewModeFor,
  type DocumentFlag,
  type DocumentVerificationState,
  type OnboardingDocument,
} from 'src/api/onboarding';
import { LvIcon, type LvIconName } from 'src/design/icons';
import {
  EmptyState,
  Field,
  formatWhen,
  InlineNotice,
  LvBadge,
  LvButton,
  LvTextarea,
  VisuallyHidden,
  type Tone,
} from 'src/design/kit';
import { useLvTier } from 'src/design/use-tier';
import { type LvTheme } from 'src/design/theme';

// The onboarding domain, expressed in the La Vivenzia system.
//
// Three things here could not be built from the existing primitives: a real
// document preview, a reviewer's decision (which is a state machine, a set of
// named problems and a sometimes-mandatory reason), and the readiness rail
// that says what is standing in the way. Everything else on these screens is
// an ordinary card, badge, list or stepper.

// ---------------------------------------------------------------------------
// Verification state, said in colour and in words
// ---------------------------------------------------------------------------
export const DOCUMENT_STATE_TONE: Record<DocumentVerificationState, Tone> = {
  PENDING: 'neutral',
  UNDER_REVIEW: 'info',
  VERIFIED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
  NEEDS_REPLACEMENT: 'warning',
};

const STATE_ICON: Record<DocumentVerificationState, LvIconName> = {
  PENDING: 'clock',
  UNDER_REVIEW: 'search',
  VERIFIED: 'check',
  REJECTED: 'warning',
  EXPIRED: 'clock',
  NEEDS_REPLACEMENT: 'upload',
};

export const LvDocumentState = ({ theme, state }: { theme: LvTheme; state: DocumentVerificationState }) => (
  <LvBadge theme={theme} tone={DOCUMENT_STATE_TONE[state]}>
    {DOCUMENT_STATE_LABELS[state]}
  </LvBadge>
);

// ---------------------------------------------------------------------------
// The file itself.
//
// An image is shown as an image, a PDF in an object frame, and anything else
// is offered as a download rather than embedded in a viewer that would show a
// blank rectangle. When the record carries no file URL at all, that is said
// plainly — a placeholder that looks like a document would be a lie about
// evidence, on the one screen where evidence is the whole point.
//
// Desktop gives it a tall panel beside the list. A phone gets it full-bleed,
// because a document squeezed into a third of a 390px screen cannot be read,
// and the decision buttons stay below it rather than under a long scroll.
// ---------------------------------------------------------------------------
export const LvDocumentPreview = ({
  theme,
  document: file,
  height,
  onOpenFull,
}: {
  theme: LvTheme;
  document: OnboardingDocument | null;
  /** Fixed height on desktop; a phone sizes itself. */
  height?: number;
  onOpenFull?: () => void;
}) => {
  const tier = useLvTier();
  const frameHeight = height ?? (tier === 'mobile' ? 320 : 460);

  const frame = (children: ReactNode) => (
    <div
      style={{
        height: frameHeight,
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.color.border}`,
        background: theme.color.surfaceSunken,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );

  if (!file) {
    return frame(<EmptyState theme={theme} text="Choose a document to see it here." icon="document" tint="blue" />);
  }

  const mode = previewModeFor(file.mimeType);
  const label = file.originalFilename ?? file.name ?? 'Document';

  const body =
    file.fileUrl === null ? (
      // Not a failure state: the row exists, the file simply is not reachable
      // from here. Saying which is the difference between "try again" and
      // "ask someone".
      <EmptyState
        theme={theme}
        icon="info"
        tint="peach"
        title="The file is not available to open"
        text="This document is recorded, but no stored file came back with it. It cannot be read on screen, so it should not be judged from this screen either."
      />
    ) : mode === 'IMAGE' ? (
      <img src={file.fileUrl} alt={`${label}, as uploaded`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    ) : mode === 'PDF' ? (
      <object data={file.fileUrl} type="application/pdf" aria-label={`${label}, as uploaded`} style={{ width: '100%', height: '100%' }}>
        <EmptyState
          theme={theme}
          icon="document"
          tint="blue"
          title="This browser will not display the PDF"
          text="Open it in a new tab to read it."
          action={
            <LvButton theme={theme} variant="secondary" size="sm" href={file.fileUrl} target="_blank">
              Open the PDF
            </LvButton>
          }
        />
      </object>
    ) : (
      <EmptyState
        theme={theme}
        icon="document"
        tint="blue"
        title="This type cannot be shown in a browser"
        text={`${file.mimeType ?? 'The file type'} has to be downloaded to be read.`}
        action={
          <LvButton theme={theme} variant="secondary" size="sm" href={file.fileUrl} target="_blank">
            Download it
          </LvButton>
        }
      />
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), minWidth: 0 }}>
      {/* The toolbar carries only what is real: the name, the type, the size,
          and the two things a browser can genuinely do with the file. */}
      <div className="lv-preview-bar" style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
        <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', flex: '0 0 auto' }}>
          <LvIcon name="document" size={16} />
        </span>
        <span style={{ ...theme.type.bodySmall, color: theme.color.heading, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ ...theme.type.caption, color: theme.color.textMuted, flex: '0 0 auto' }}>{formatBytes(file.fileSizeBytes)}</span>
        {file.fileUrl !== null && onOpenFull && (
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onOpenFull}>
            Full screen
          </LvButton>
        )}
        {file.fileUrl !== null && (
          <LvButton theme={theme} variant="ghost" size="sm" href={file.fileUrl} target="_blank" icon={<LvIcon name="download" size={15} />}>
            <VisuallyHidden>Open {label} in a new tab</VisuallyHidden>
          </LvButton>
        )}
      </div>
      {frame(body)}
    </div>
  );
};

// ---------------------------------------------------------------------------
// One document in the collection
// ---------------------------------------------------------------------------
export const LvDocumentCard = ({
  theme,
  document: file,
  selected,
  required,
  onSelect,
  actions,
  now,
}: {
  theme: LvTheme;
  document: OnboardingDocument;
  selected?: boolean;
  required?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
  /** The clock relative times are read against, passed in so a list agrees with itself. */
  now: string;
}) => {
  const tone = DOCUMENT_STATE_TONE[file.verificationState];
  const body = (
    <>
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          flex: '0 0 auto',
          borderRadius: theme.radius.md,
          background: theme.color.surfaceSunken,
          color: theme.color[tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'textSubtle'],
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LvIcon name={STATE_ICON[file.verificationState]} size={19} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' }}>
          <span style={{ ...theme.type.subheading, fontSize: 15, color: theme.color.heading }}>
            {DOCUMENT_TYPE_LABELS[file.documentType ?? ''] ?? file.name ?? 'Document'}
          </span>
          <LvDocumentState theme={theme} state={file.verificationState} />
          {required && <LvBadge theme={theme} tone="info">Required</LvBadge>}
        </span>
        <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>
          {file.originalFilename ?? 'No filename recorded'}
          {file.uploadedAt ? ` · uploaded ${formatWhen(file.uploadedAt, now)}` : ''}
        </span>
        {file.expiresAt && (
          <span style={{ display: 'block', ...theme.type.caption, color: file.verificationState === 'EXPIRED' ? theme.color.warning : theme.color.textMuted }}>
            Expires {formatWhen(file.expiresAt, now)}
          </span>
        )}
        {/* A refusal is never truncated: it is the only thing that tells the
            partner what to do differently. */}
        {file.rejectionReason && (
          <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.danger, marginTop: 4, overflowWrap: 'anywhere' }}>
            {file.rejectionReason}
          </span>
        )}
        {file.verificationFlags.length > 0 && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {file.verificationFlags.map((flag) => (
              <LvBadge key={flag} theme={theme} tone="warning">
                {DOCUMENT_FLAGS.find((entry) => entry.key === flag)?.label ?? flag}
              </LvBadge>
            ))}
          </span>
        )}
      </span>
    </>
  );

  return (
    <li className="lv-doc-card" style={{ listStyle: 'none' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.space(3),
          padding: theme.space(4),
          borderRadius: theme.radius.lg,
          border: `1px solid ${selected ? theme.color.brand : theme.color.border}`,
          background: selected ? theme.tint.mint.wash : theme.color.surface,
        }}
      >
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: theme.space(3),
              width: '100%',
              minHeight: 44,
              background: 'transparent',
              border: '1px solid transparent',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: theme.font.body,
            }}
          >
            {body}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.space(3) }}>{body}</div>
        )}
        {actions && <div className="lv-doc-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>{actions}</div>}
      </div>
    </li>
  );
};

// ---------------------------------------------------------------------------
// The reviewer's decision.
//
// Only the transitions the document's current state actually permits are
// offered — the state machine would refuse the rest, and a button that always
// fails is worse than no button. Choosing an outcome shows what it does before
// it is applied, and a reason box appears only where the server requires one,
// where it is genuinely mandatory rather than decorative.
// ---------------------------------------------------------------------------
export const LvDecisionPanel = ({
  theme,
  document: file,
  busy,
  onDecide,
  error,
}: {
  theme: LvTheme;
  document: OnboardingDocument;
  busy: boolean;
  onDecide: (to: DocumentVerificationState, reason: string | null, flags: DocumentFlag[]) => void;
  error?: string | null;
}) => {
  const [choice, setChoice] = useState<DocumentVerificationState | null>(null);
  const [reason, setReason] = useState('');
  const [flags, setFlags] = useState<DocumentFlag[]>([]);
  const allowed = DOCUMENT_TRANSITIONS[file.verificationState];
  const needsReason = choice !== null && documentRequiresReason(choice);
  const ready = choice !== null && (!needsReason || reason.trim().length > 0);

  const toggleFlag = (flag: DocumentFlag) => setFlags((current) => (current.includes(flag) ? current.filter((entry) => entry !== flag) : [...current, flag]));

  if (allowed.length === 0) {
    return <InlineNotice theme={theme}>This document is {DOCUMENT_STATE_LABELS[file.verificationState].toLowerCase()} and has no further states.</InlineNotice>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
      <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
        <legend style={{ ...theme.type.label, color: theme.color.textMuted, padding: 0, marginBottom: theme.space(2) }}>Your decision</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
          {allowed.map((state) => {
            const active = choice === state;

            return (
              <label
                key={state}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: theme.space(3),
                  minHeight: 44,
                  padding: theme.space(3),
                  borderRadius: theme.radius.md,
                  border: `1px solid ${active ? theme.color.brand : theme.color.border}`,
                  background: active ? theme.tint.mint.wash : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name={`decision-${file.id}`}
                  value={state}
                  checked={active}
                  onChange={() => {
                    setChoice(state);
                    setReason('');
                  }}
                  style={{ marginTop: 3, width: 18, height: 18, flex: '0 0 auto', accentColor: theme.color.brand }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>
                    {DOCUMENT_DECISION_COPY[state].verb}
                  </span>
                  <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{DOCUMENT_DECISION_COPY[state].consequence}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* The named problems the backend records. Optional on every decision,
          so they are offered rather than demanded. */}
      {choice !== null && (
        <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={{ ...theme.type.label, color: theme.color.textMuted, padding: 0, marginBottom: theme.space(2) }}>
            Problems found <span style={{ ...theme.type.caption, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
            {DOCUMENT_FLAGS.map((flag) => {
              const active = flags.includes(flag.key);

              return (
                <label
                  key={flag.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: theme.space(2),
                    minHeight: 40,
                    padding: `0 ${theme.space(3)}px`,
                    borderRadius: theme.radius.pill,
                    border: `1px solid ${active ? theme.color.warning : theme.color.border}`,
                    background: active ? theme.color.surfaceSunken : 'transparent',
                    cursor: 'pointer',
                    ...theme.type.bodySmall,
                    color: theme.color.text,
                  }}
                >
                  <input type="checkbox" checked={active} onChange={() => toggleFlag(flag.key)} style={{ width: 16, height: 16, accentColor: theme.color.warning }} />
                  {flag.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {needsReason && (
        <Field
          theme={theme}
          label="Reason"
          htmlFor={`reason-${file.id}`}
          required
          help="The partner is shown this. Say what is wrong with the document and what would fix it."
        >
          <LvTextarea theme={theme} id={`reason-${file.id}`} value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
        </Field>
      )}

      {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}

      <LvButton
        theme={theme}
        variant={choice === 'REJECTED' || choice === 'NEEDS_REPLACEMENT' ? 'danger' : 'primary'}
        disabled={!ready}
        busy={busy}
        onClick={() => choice !== null && onDecide(choice, reason.trim() === '' ? null : reason.trim(), flags)}
      >
        {choice === null ? 'Choose a decision' : DOCUMENT_DECISION_COPY[choice].verb}
      </LvButton>
    </div>
  );
};
