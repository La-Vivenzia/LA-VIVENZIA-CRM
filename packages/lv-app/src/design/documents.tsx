import { useId, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { EmptyState, LvBadge, LvButton } from 'src/design/kit';
import { type BadgeTone } from 'src/design/status';
import { type LvTheme } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';

// Files: the ones a partner has sent, and the act of sending one.
//
// Two rules the CRM does not bend on. A document's verification state is shown
// as a word, not only a colour. And when a reviewer has refused a file, the
// reason travels with it — a refusal without its reason is a dead end for
// whoever has to go back to the partner.

export type LvVerificationState = 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

const STATE_TONE: Record<LvVerificationState, BadgeTone> = {
  PENDING: 'neutral',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'info',
  VERIFIED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

const STATE_LABEL: Record<LvVerificationState, string> = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

export const verificationTone = (state: string | null | undefined): BadgeTone => STATE_TONE[(state ?? 'PENDING') as LvVerificationState] ?? 'neutral';
export const verificationLabel = (state: string | null | undefined): string => STATE_LABEL[(state ?? 'PENDING') as LvVerificationState] ?? 'Pending';

const iconForMime = (mime: string | null | undefined): LvIconName => (mime?.startsWith('image/') ? 'image' : 'document');

export type LvDocument = {
  id: string;
  name: string;
  /** "Identity", "Address proof" — already in words, not an enum. */
  typeLabel: string;
  state: string | null;
  /** Already formatted, e.g. "expires in 12 d". */
  expiry?: string | null;
  rejectionReason?: string | null;
  mimeType?: string | null;
  sizeLabel?: string | null;
};

export const LvDocumentRow = ({ theme, document, actions }: { theme: LvTheme; document: LvDocument; actions?: ReactNode }) => (
  <li
    className="lv-document-row"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: theme.space(3),
      border: `1px solid ${theme.color.border}`,
      borderRadius: theme.radius.md,
      padding: theme.space(3),
      listStyle: 'none',
    }}
  >
    <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', flex: '0 0 auto' }}>
      <LvIcon name={iconForMime(document.mimeType)} size={18} />
    </span>
    <span className="lv-document-body" style={{ minWidth: 0 }}>
      <span style={{ ...theme.type.body, color: theme.color.heading, display: 'block', overflowWrap: 'anywhere' }}>{document.name}</span>
      <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, display: 'block' }}>
        {[document.typeLabel, document.sizeLabel, document.expiry].filter(Boolean).join(' · ')}
      </span>
    </span>
    <span className="lv-document-state">
      <LvBadge theme={theme} tone={verificationTone(document.state)}>
        {verificationLabel(document.state)}
      </LvBadge>
    </span>
    {actions && <span style={{ display: 'flex', gap: theme.space(1), flex: '0 0 auto' }}>{actions}</span>}
    {document.rejectionReason && (
      <p style={{ ...theme.type.bodySmall, color: theme.color.danger, flex: '1 0 100%', margin: 0 }}>{document.rejectionReason}</p>
    )}
  </li>
);

export const LvDocumentList = ({
  theme,
  documents,
  actions,
  emptyText = 'No document has been uploaded.',
}: {
  theme: LvTheme;
  documents: LvDocument[];
  actions?: (document: LvDocument) => ReactNode;
  emptyText?: string;
}) =>
  documents.length === 0 ? (
    <EmptyState theme={theme} text={emptyText} />
  ) : (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
      {documents.map((document) => (
        <LvDocumentRow key={document.id} theme={theme} document={document} actions={actions?.(document)} />
      ))}
    </ul>
  );

/** A file named inline — in a message, on a capture record, beside a field. */
export const LvFileChip = ({ theme, name, onRemove }: { theme: LvTheme; name: string; onRemove?: () => void }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.space(2),
      maxWidth: '100%',
      background: theme.color.surfaceSunken,
      border: `1px solid ${theme.color.border}`,
      borderRadius: theme.radius.pill,
      padding: `2px 2px 2px ${theme.space(3)}px`,
      ...theme.type.bodySmall,
      color: theme.color.text,
    }}
  >
    <LvIcon name="document" size={14} />
    {/* Truncated in the middle keeps the extension visible, which is most of
        what tells you whether this is the right file. */}
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>{name}</span>
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        style={{
          width: 24,
          height: 24,
          borderRadius: theme.radius.pill,
          border: '1px solid transparent',
          background: 'transparent',
          color: theme.color.textMuted,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <LvIcon name="plus" size={12} style={{ transform: 'rotate(45deg)' }} />
      </button>
    )}
  </span>
);

/**
 * Getting a file in.
 *
 * On a wide screen this is a drop zone. On a phone it is full-width buttons —
 * take a photo, or choose a file — because there is nothing to drag on a
 * phone, and a dashed rectangle that only accepts a tap is a lie about what
 * it does.
 *
 * `camera` turns the photograph off for the zones where it would be a dead
 * end: a camera cannot produce a spreadsheet, and offering it as the first,
 * most prominent button on a phone sends people to take a picture of a file
 * they already have.
 */
export const LvUploadZone = ({
  theme,
  label,
  accept,
  multiple,
  onFiles,
  hint,
  disabled,
  camera: allowCamera = true,
}: {
  theme: LvTheme;
  label: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  hint?: string;
  disabled?: boolean;
  /** Offer "Take a photo" on a phone. False for anything a camera cannot make. */
  camera?: boolean;
}) => {
  const tier = useLvTier();
  const inputId = useId();
  const cameraId = useId();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length > 0) {
      onFiles(files);
    }

    event.target.value = '';
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    const files = Array.from(event.dataTransfer?.files ?? []);

    if (files.length > 0 && !disabled) {
      onFiles(files);
    }
  };

  const hiddenInputs = (
    <>
      <input ref={input} id={inputId} type="file" accept={accept} multiple={multiple} onChange={take} disabled={disabled} style={{ display: 'none' }} />
      {allowCamera && <input ref={camera} id={cameraId} type="file" accept="image/*" capture="environment" onChange={take} disabled={disabled} style={{ display: 'none' }} />}
    </>
  );

  if (tier === 'mobile') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
        <span style={{ ...theme.type.label, color: theme.color.textMuted }}>{label}</span>
        {allowCamera && (
          <LvButton theme={theme} variant="primary" onClick={() => camera.current?.click()} disabled={disabled} icon={<LvIcon name="camera" size={16} />}>
            Take a photo
          </LvButton>
        )}
        <LvButton theme={theme} variant={allowCamera ? 'secondary' : 'primary'} onClick={() => input.current?.click()} disabled={disabled} icon={<LvIcon name="upload" size={16} />}>
          Choose a file
        </LvButton>
        {hint && <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{hint}</span>}
        {hiddenInputs}
      </div>
    );
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.space(2),
        padding: theme.space(6),
        borderRadius: theme.radius.lg,
        border: `1.5px dashed ${dragging ? theme.color.brand : theme.color.borderStrong}`,
        background: dragging ? theme.color.brandMuted : theme.color.surfaceSunken,
        textAlign: 'center',
      }}
    >
      <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
        <LvIcon name="upload" size={24} />
      </span>
      <span style={{ ...theme.type.body, color: theme.color.text }}>{label}</span>
      <LvButton theme={theme} variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={disabled}>
        Choose a file
      </LvButton>
      {hint && <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{hint}</span>}
      {hiddenInputs}
    </div>
  );
};

/** One file on its way up, with an honest state rather than a spinning circle. */
export const LvUploadItem = ({
  theme,
  name,
  percentage,
  error,
  onCancel,
}: {
  theme: LvTheme;
  name: string;
  /** 0–100, or null when the server has not started reporting yet. */
  percentage: number | null;
  error?: string | null;
  onCancel?: () => void;
}) => {
  const done = percentage !== null && percentage >= 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(1), padding: theme.space(3), border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
        <span style={{ ...theme.type.bodySmall, color: theme.color.heading, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{name}</span>
        <span style={{ ...theme.type.caption, color: error ? theme.color.danger : theme.color.textMuted }}>
          {error ? 'Failed' : done ? 'Uploaded' : percentage === null ? 'Starting' : `${Math.round(percentage)}%`}
        </span>
        {onCancel && !done && (
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </LvButton>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={percentage ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Uploading ${name}`}
        style={{ height: 4, borderRadius: theme.radius.pill, background: theme.color.surfaceSunken, overflow: 'hidden' }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.min(100, Math.max(0, percentage ?? 0))}%`,
            background: error ? theme.color.danger : theme.color.brand,
            transition: `width ${theme.motion.duration.normal}ms ${theme.motion.easing}`,
          }}
        />
      </div>
      {error && <span style={{ ...theme.type.bodySmall, color: theme.color.danger }}>{error}</span>}
    </div>
  );
};
