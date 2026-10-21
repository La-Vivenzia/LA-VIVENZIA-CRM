import { type ReactNode } from 'react';

import { LvIcon } from 'src/design/icons';
import { LvButton, LvCard, Provenance, VisuallyHidden } from 'src/design/kit';
import { type LvTheme } from 'src/design/theme';

// Where the assistant speaks.
//
// Three rules hold across every one of these surfaces, and they are the reason
// they live together rather than being drawn per screen:
//
//   1. Anything the model produced is labelled as such. A person must be able
//      to tell a computed fact from a suggestion without asking.
//   2. A suggestion always carries its reason. An instruction whose reason is
//      cut off cannot be checked, and an unverifiable instruction will not be
//      trusted — so the reason wraps in full at every width and is never
//      truncated to save a line.
//   3. Nothing acts on its own. A proposed action is a button someone presses.

export type LvCitation = { key: string; label: string; onOpen?: () => void };

/** A panel the assistant writes into — a summary, a draft, a briefing. */
export const LvAiPanel = ({
  theme,
  title,
  origin = 'ai',
  actions,
  children,
}: {
  theme: LvTheme;
  title: string;
  origin?: 'rules' | 'ai';
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <LvCard theme={theme} ariaLabel={title}>
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), marginBottom: theme.space(3) }}>
      <span aria-hidden="true" style={{ color: theme.color.accentInk, display: 'inline-flex' }}>
        <LvIcon name="sparkle" size={18} />
      </span>
      <h2 style={{ ...theme.type.heading, color: theme.color.heading, margin: 0, flex: 1 }}>{title}</h2>
      <Provenance theme={theme} source={origin} />
    </div>
    <div style={{ ...theme.type.body, color: theme.color.text }}>{children}</div>
    {actions && <div className="lv-action-row" style={{ display: 'flex', gap: theme.space(2), marginTop: theme.space(4) }}>{actions}</div>}
  </LvCard>
);

/**
 * An answer, split the way the CRM splits knowledge: what it knows from
 * records, what it inferred, and what it suggests you do. Each part is
 * labelled, and the records behind the answer are listed so the claim can be
 * checked rather than believed.
 */
export const LvAiAnswer = ({
  theme,
  known,
  inferred,
  suggested,
  citations = [],
  onAccept,
  onReject,
}: {
  theme: LvTheme;
  known: ReactNode;
  inferred?: ReactNode;
  suggested?: ReactNode;
  citations?: LvCitation[];
  onAccept?: () => void;
  onReject?: () => void;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
    <section>
      <h3 style={{ ...theme.type.label, color: theme.color.textMuted, margin: `0 0 ${theme.space(1)}px` }}>Known</h3>
      <div style={{ ...theme.type.body, color: theme.color.text }}>{known}</div>
    </section>

    {inferred && (
      <section>
        <h3 style={{ ...theme.type.label, color: theme.color.textMuted, margin: `0 0 ${theme.space(1)}px` }}>Inferred</h3>
        <div style={{ ...theme.type.body, color: theme.color.text }}>{inferred}</div>
      </section>
    )}

    {suggested && (
      <section>
        <h3 style={{ ...theme.type.label, color: theme.color.accentInk, margin: `0 0 ${theme.space(1)}px` }}>Suggested</h3>
        <div style={{ ...theme.type.body, color: theme.color.text }}>{suggested}</div>
      </section>
    )}

    {citations.length > 0 && (
      <section>
        <h3 style={{ ...theme.type.label, color: theme.color.textMuted, margin: `0 0 ${theme.space(2)}px` }}>From these records</h3>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
          {citations.map((citation) => (
            <li key={citation.key}>
              {citation.onOpen ? (
                <button
                  type="button"
                  onClick={citation.onOpen}
                  className="lv-chip-control"
                  style={{
                    ...theme.type.bodySmall,
                    padding: `0 ${theme.space(3)}px`,
                    borderRadius: theme.radius.pill,
                    border: `1px solid ${theme.color.border}`,
                    background: theme.color.surfaceSunken,
                    color: theme.color.text,
                    cursor: 'pointer',
                  }}
                >
                  {citation.label}
                </button>
              ) : (
                <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{citation.label}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    )}

    {(onAccept || onReject) && (
      <div className="lv-action-row" style={{ display: 'flex', gap: theme.space(2) }}>
        {onAccept && (
          <LvButton theme={theme} variant="primary" onClick={onAccept}>
            Accept the suggestion
          </LvButton>
        )}
        {onReject && (
          <LvButton theme={theme} variant="ghost" onClick={onReject}>
            Not useful
          </LvButton>
        )}
      </div>
    )}
  </div>
);

/**
 * How sure the extraction is about one field. The number is always spelled out
 * beside the bar — a bar alone is a vibe, not a confidence.
 */
export const LvConfidence = ({ theme, value, label }: { theme: LvTheme; value: number; label?: string }) => {
  const percentage = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const tone = percentage >= 80 ? theme.color.success : percentage >= 50 ? theme.color.warning : theme.color.danger;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.space(2) }}>
      <span aria-hidden="true" style={{ width: 48, height: 4, borderRadius: theme.radius.pill, background: theme.color.surfaceSunken, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${percentage}%`, background: tone }} />
      </span>
      <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>
        {percentage}%<VisuallyHidden> confident{label ? ` about ${label}` : ''}</VisuallyHidden>
      </span>
    </span>
  );
};

/**
 * The honest state when the assistant cannot answer — a quota, an outage, a
 * workspace with no model enabled. It says what is still true without it.
 */
export const LvAiUnavailable = ({ theme, reason, fallback }: { theme: LvTheme; reason: string; fallback?: ReactNode }) => (
  <div
    style={{
      display: 'flex',
      gap: theme.space(3),
      padding: theme.space(4),
      borderRadius: theme.radius.lg,
      background: theme.color.surfaceSunken,
      border: `1px dashed ${theme.color.borderStrong}`,
    }}
  >
    <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', flex: '0 0 auto' }}>
      <LvIcon name="sparkle" size={18} />
    </span>
    <span style={{ minWidth: 0 }}>
      <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, display: 'block' }}>{reason}</span>
      {fallback && <span style={{ ...theme.type.body, color: theme.color.text, display: 'block', marginTop: theme.space(1) }}>{fallback}</span>}
    </span>
  </div>
);
