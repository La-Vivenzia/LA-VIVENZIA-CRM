import { type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvAvatar, LvBadge, LvButton, VisuallyHidden } from 'src/design/kit';
import { LvModal } from 'src/design/overlay';
import { type LvTheme } from 'src/design/theme';

// Every lead action is the same four beats, in this order:
//
//   CONTEXT      — which relationship is about to change, shown not assumed
//   CONSEQUENCE  — what this will do, before the button that does it
//   ACTION       — one obvious commit, one safe way out
//   CONFIRMATION — what happened, and the useful next move
//
// This file is those four beats. The six workflows supply the middle: their
// fields, their consequence line, and what they do on submit. None of them
// owns a dialog of its own, so none of them can drift from the others.

export type ActionPhase = 'form' | 'saving' | 'done';

/** The strip at the top of every action: who this is about. */
export const ActionContext = ({
  theme,
  name,
  reference,
  photoUrl,
  status,
}: {
  theme: LvTheme;
  name: string;
  reference?: string | null;
  photoUrl?: string | null;
  status?: string | null;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: theme.space(3),
      padding: theme.space(3),
      borderRadius: theme.radius.lg,
      background: theme.color.surfaceSunken,
    }}
  >
    <LvAvatar theme={theme} name={name} src={photoUrl} size={36} />
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.bold, color: theme.color.heading, overflowWrap: 'anywhere' }}>{name}</span>
      {reference && <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, fontFamily: theme.font.mono }}>{reference}</span>}
    </span>
    {status && <LvBadge theme={theme}>{status}</LvBadge>}
  </div>
);

/** What this action will do, said before the button that does it. */
export const ActionConsequence = ({
  theme,
  tone = 'neutral',
  children,
}: {
  theme: LvTheme;
  tone?: 'neutral' | 'warning' | 'danger';
  children: ReactNode;
}) => {
  const colour = tone === 'danger' ? theme.color.danger : tone === 'warning' ? theme.color.warning : theme.color.textMuted;
  const wash = tone === 'danger' ? theme.color.dangerMuted : tone === 'warning' ? theme.color.warningMuted : theme.color.surfaceSunken;

  return (
    <div style={{ display: 'flex', gap: theme.space(3), padding: theme.space(3), borderRadius: theme.radius.md, background: wash }}>
      <span aria-hidden="true" style={{ color: colour, display: 'inline-flex', flex: '0 0 auto', marginTop: 1 }}>
        <LvIcon name={tone === 'neutral' ? 'info' : 'warning'} size={16} />
      </span>
      <span style={{ ...theme.type.bodySmall, color: tone === 'neutral' ? theme.color.text : colour, minWidth: 0 }}>{children}</span>
    </div>
  );
};

/**
 * A refusal, as the server worded it.
 *
 * Screen 4.6. It is never rephrased and never replaced with "Something went
 * wrong": the server knows why it said no — a reason is required, that
 * transition is not allowed, your role cannot move this lead — and that
 * sentence is the only thing that tells a person what to do next.
 */
export const ActionRefusal = ({ theme, message, onRetry }: { theme: LvTheme; message: string; onRetry?: () => void }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      gap: theme.space(3),
      padding: theme.space(4),
      borderRadius: theme.radius.lg,
      background: theme.color.dangerMuted,
      border: `1px solid ${theme.color.danger}`,
    }}
  >
    <span aria-hidden="true" style={{ color: theme.color.danger, display: 'inline-flex', flex: '0 0 auto', marginTop: 1 }}>
      <LvIcon name="warning" size={18} />
    </span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', ...theme.type.subheading, fontSize: 15, color: theme.color.danger }}>That did not go through</span>
      <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.text, marginTop: 2 }}>{message}</span>
    </span>
    {onRetry && (
      <LvButton theme={theme} variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </LvButton>
    )}
  </div>
);

/** What happened, and the move that follows from it. */
export const ActionSuccess = ({
  theme,
  title,
  detail,
  icon = 'check',
  actions,
}: {
  theme: LvTheme;
  title: string;
  detail?: string;
  icon?: LvIconName;
  actions: ReactNode;
}) => (
  <div style={{ textAlign: 'center', padding: `${theme.space(4)}px 0` }} role="status">
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
        borderRadius: theme.radius.pill,
        background: theme.tint.mint.wash,
        color: theme.tint.mint.ink,
        marginBottom: theme.space(3),
      }}
    >
      <LvIcon name={icon} size={26} />
    </span>
    <p style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: 0 }}>{title}</p>
    {detail && <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>{detail}</p>}
    <div className="lv-action-success-actions" style={{ display: 'flex', gap: theme.space(2), justifyContent: 'center', marginTop: theme.space(5) }}>
      {actions}
    </div>
  </div>
);

/**
 * The surface every lead action is shown on.
 *
 * Compact for a decision or two fields; full for a workflow long enough that a
 * bottom sheet would put the commit button under the on-screen keyboard.
 */
export const LeadActionSurface = ({
  theme,
  title,
  description,
  size = 'compact',
  phase,
  error,
  onClose,
  context,
  consequence,
  submitLabel,
  submitTone = 'primary',
  canSubmit = true,
  onSubmit,
  success,
  children,
}: {
  theme: LvTheme;
  title: string;
  description?: string;
  size?: 'compact' | 'full';
  phase: ActionPhase;
  error: string | null;
  onClose: () => void;
  context: ReactNode;
  consequence?: ReactNode;
  submitLabel: string;
  submitTone?: 'primary' | 'danger';
  canSubmit?: boolean;
  onSubmit: () => void;
  /** Shown once the action has gone through. */
  success?: ReactNode;
  children: ReactNode;
}) => (
  <LvModal
    theme={theme}
    title={title}
    description={phase === 'done' ? undefined : description}
    size={size}
    onClose={onClose}
    footer={
      phase === 'done' ? undefined : (
        <>
          <LvButton theme={theme} variant="ghost" onClick={onClose} disabled={phase === 'saving'}>
            Cancel
          </LvButton>
          <LvButton theme={theme} variant={submitTone} onClick={onSubmit} busy={phase === 'saving'} disabled={!canSubmit || phase === 'saving'}>
            {submitLabel}
          </LvButton>
        </>
      )
    }
  >
    {phase === 'done' ? (
      success
    ) : (
      <>
        {context}
        {error !== null && <ActionRefusal theme={theme} message={error} />}
        {children}
        {consequence}
        {phase === 'saving' && <VisuallyHidden>Saving</VisuallyHidden>}
      </>
    )}
  </LvModal>
);
