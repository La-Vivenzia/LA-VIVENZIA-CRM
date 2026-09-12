import { type CSSProperties, type ReactNode } from 'react';

import { layout, type LvTheme } from 'src/modules/lv-core/ui/theme';

// The building blocks of every LV dashboard: KPI tiles, sections, record
// rows, and the loading / empty / error states. One place, so the Hunter,
// Coordinator, Onboarding Expert and Control Tower pages read as one product.
//
// Accessibility: real <button>s for anything clickable, visible focus rings,
// status conveyed by text as well as colour, headings for sections, and
// tables with header cells.

export type Tone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

export const toneColour = (theme: LvTheme, tone: Tone | undefined): string =>
  tone === 'danger'
    ? theme.color.danger
    : tone === 'warning'
      ? theme.color.warning
      : tone === 'success'
        ? theme.color.success
        : tone === 'info'
          ? theme.color.info
          : theme.color.brandMuted;

export const focusRing = (theme: LvTheme): CSSProperties => ({
  outline: `2px solid ${theme.color.accent}`,
  outlineOffset: 2,
});

export const formatWhen = (iso: string | null | undefined, now: string): string => {
  if (!iso) {
    return '—';
  }

  const diff = Date.parse(now) - Date.parse(iso);

  if (Number.isNaN(diff)) {
    return '—';
  }

  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const word = minutes < 60 ? `${minutes} min` : hours < 48 ? `${hours} h` : `${days} d`;

  return diff >= 0 ? `${word} ago` : `in ${word}`;
};

export const PageHeader = ({
  theme,
  title,
  subtitle,
  right,
}: {
  theme: LvTheme;
  title: string;
  subtitle: string;
  right?: ReactNode;
}) => (
  <header
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: theme.space(3),
      marginBottom: theme.space(4),
      borderBottom: `2px solid ${theme.color.accent}`,
      paddingBottom: theme.space(3),
    }}
  >
    <div style={{ minWidth: 0 }}>
      <h1
        style={{
          margin: 0,
          fontFamily: theme.font.display,
          fontWeight: theme.font.weight.bold,
          fontSize: 'clamp(22px, 4vw, 30px)',
          letterSpacing: '0.02em',
          color: theme.color.brand,
        }}
      >
        {title}
      </h1>
      <p style={{ margin: `${theme.space(1)}px 0 0`, color: theme.color.textMuted, fontSize: theme.font.size.sm }}>
        {subtitle}
      </p>
    </div>
    {right && <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>{right}</div>}
  </header>
);

export const KpiTile = ({
  theme,
  label,
  value,
  emptyText,
  unavailableReason,
  tone,
  onClick,
}: {
  theme: LvTheme;
  label: string;
  value: number | null;
  emptyText: string;
  unavailableReason?: string;
  tone?: Tone;
  onClick?: () => void;
}) => {
  const s = layout(theme);
  const colour = toneColour(theme, tone);
  const unavailable = value === null;
  const zero = value === 0;
  const content = (
    <>
      <span style={{ display: 'block', fontSize: theme.font.size.xs, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.color.textMuted }}>
        {label}
      </span>
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          fontFamily: theme.font.display,
          fontSize: unavailable ? theme.font.size.lg : 'clamp(26px, 4vw, 34px)',
          fontWeight: theme.font.weight.bold,
          lineHeight: 1.1,
          margin: `${theme.space(1)}px 0`,
          color: unavailable ? theme.color.textMuted : zero ? theme.color.textMuted : colour,
        }}
      >
        {unavailable ? 'n/a' : value}
      </span>
      <span style={{ display: 'block', fontSize: theme.font.size.xs, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>
        {unavailable ? emptyText : zero ? emptyText : tone === 'danger' ? 'Needs action' : tone === 'warning' ? 'Needs attention' : ' '}
      </span>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {unavailable ? `${label}: unavailable. ${unavailableReason ?? emptyText}` : `${label}: ${value}. ${zero ? emptyText : ''}`}
      </span>
    </>
  );
  // Longhands only — mixing the card's `border` shorthand with a `borderTop`
  // override makes React warn about conflicting style properties.
  const { border: _cardBorder, ...cardWithoutBorder } = s.card as CSSProperties & { border?: string };
  const base: CSSProperties = {
    ...cardWithoutBorder,
    position: 'relative',
    borderStyle: 'solid',
    borderWidth: '3px 1px 1px',
    borderColor: `${unavailable ? theme.color.border : colour} ${theme.color.border} ${theme.color.border}`,
    padding: theme.space(3),
    minWidth: 0,
    textAlign: 'left',
    fontFamily: theme.font.body,
    color: theme.color.text,
    width: '100%',
    boxSizing: 'border-box',
  };

  return onClick && !unavailable ? (
    <button type="button" onClick={onClick} title={unavailableReason} style={{ ...base, cursor: 'pointer' }}>
      {content}
    </button>
  ) : (
    <div title={unavailableReason} style={base}>
      {content}
    </div>
  );
};

export const Section = ({
  theme,
  title,
  count,
  children,
  hint,
}: {
  theme: LvTheme;
  title: string;
  count?: number;
  children: ReactNode;
  hint?: string;
}) => {
  const s = layout(theme);

  return (
    <section style={{ ...s.card, padding: theme.space(3), minWidth: 0 }} aria-label={title}>
      <h2
        style={{
          margin: `0 0 ${theme.space(2)}px`,
          fontFamily: theme.font.display,
          fontSize: theme.font.size.md,
          letterSpacing: '0.03em',
          color: theme.color.brand,
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.space(2),
          flexWrap: 'wrap',
        }}
      >
        <span>{title}</span>
        {typeof count === 'number' && (
          <span style={{ ...s.badge(count > 0 ? 'info' : 'neutral'), fontFamily: theme.font.body }}>{count}</span>
        )}
        {hint && <span style={{ fontFamily: theme.font.body, fontSize: theme.font.size.xs, color: theme.color.textMuted, fontWeight: theme.font.weight.regular }}>{hint}</span>}
      </h2>
      {children}
    </section>
  );
};

export const EmptyState = ({ theme, text }: { theme: LvTheme; text: string }) => (
  <p role="status" style={{ margin: 0, padding: `${theme.space(3)}px 0`, color: theme.color.textMuted, fontSize: theme.font.size.sm }}>
    <span aria-hidden="true" style={{ color: theme.color.success, marginRight: 6 }}>
      ✓
    </span>
    {text}
  </p>
);

export const ErrorState = ({ theme, text, onRetry }: { theme: LvTheme; text: string; onRetry?: () => void }) => {
  const s = layout(theme);

  return (
    <div role="alert" style={{ ...s.card, border: `1px solid ${theme.color.danger}`, color: theme.color.danger, display: 'flex', gap: theme.space(3), alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 200 }}>{text}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} style={s.button('secondary')}>
          Retry
        </button>
      )}
    </div>
  );
};

export const LoadingState = ({ theme, rows = 3 }: { theme: LvTheme; rows?: number }) => {
  const s = layout(theme);

  return (
    <div aria-busy="true" role="status" aria-label="Loading" style={s.stack(2)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} style={{ ...s.card, height: 64, background: theme.color.surfaceRaised, opacity: 0.75 - index * 0.15 }} />
      ))}
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Loading dashboard</span>
    </div>
  );
};

// A clickable record row. Renders as a button so it is keyboard reachable;
// the columns wrap on narrow screens instead of overflowing.
export const RecordRow = ({
  theme,
  primary,
  secondary,
  meta,
  tone,
  onClick,
  actions,
}: {
  theme: LvTheme;
  primary: string;
  secondary?: string | null;
  meta?: string | null;
  tone?: Tone;
  onClick?: () => void;
  actions?: ReactNode;
}) => {
  const colour = toneColour(theme, tone);
  const inner = (
    <>
      <span aria-hidden="true" style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: tone ? colour : theme.color.border, flex: '0 0 4px' }} />
      <span style={{ flex: '1 1 160px', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: theme.font.weight.medium, overflowWrap: 'anywhere' }}>{primary}</span>
        {secondary && <span style={{ display: 'block', fontSize: theme.font.size.sm, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{secondary}</span>}
      </span>
      {meta && <span style={{ flex: '0 1 auto', fontSize: theme.font.size.xs, color: tone ? colour : theme.color.textMuted, whiteSpace: 'nowrap' }}>{meta}</span>}
    </>
  );
  const style: CSSProperties = {
    display: 'flex',
    gap: theme.space(2),
    alignItems: 'center',
    width: '100%',
    padding: `${theme.space(2)}px ${theme.space(1)}px`,
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    textAlign: 'left',
    fontFamily: theme.font.body,
    fontSize: theme.font.size.md,
    color: theme.color.text,
    cursor: onClick ? 'pointer' : 'default',
    minHeight: 44,
  };

  return (
    <li style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: theme.space(2), borderBottom: `1px solid ${theme.color.border}` }}>
      {onClick ? (
        <button type="button" onClick={onClick} style={style}>
          {inner}
        </button>
      ) : (
        <div style={style}>{inner}</div>
      )}
      {actions}
    </li>
  );
};

export const Bars = ({ theme, rows, onSelect }: { theme: LvTheme; rows: { key: string; label: string; count: number }[]; onSelect?: (key: string) => void }) => {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
      {rows.map((row) => {
        const width = `${Math.max(2, Math.round((row.count / max) * 100))}%`;
        const body = (
          <>
            <span style={{ flex: '0 0 44%', minWidth: 0, fontSize: theme.font.size.sm, overflowWrap: 'anywhere' }}>{row.label}</span>
            <span aria-hidden="true" style={{ flex: 1, height: 10, background: theme.color.surfaceRaised, borderRadius: 999, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width, background: row.count > 0 ? theme.color.brand : 'transparent' }} />
            </span>
            <span style={{ flex: '0 0 32px', textAlign: 'right', fontFamily: theme.font.mono, fontSize: theme.font.size.sm }}>{row.count}</span>
          </>
        );

        return (
          <li key={row.key} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(row.key)} aria-label={`${row.label}: ${row.count}`} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), width: '100%', background: 'transparent', border: 'none', padding: '4px 0', color: theme.color.text, fontFamily: theme.font.body, cursor: 'pointer', textAlign: 'left' }}>
                {body}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), width: '100%' }} aria-label={`${row.label}: ${row.count}`}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export const kpiGrid = (theme: LvTheme): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: theme.space(3),
  marginBottom: theme.space(4),
});

export const twoColumn = (theme: LvTheme): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: theme.space(3),
  alignItems: 'start',
});

// Global focus-visible styling for the sandboxed component (inline styles
// cannot express :focus-visible, so a tiny stylesheet is injected once).
export const FocusStyles = ({ theme }: { theme: LvTheme }) => (
  <style>{`
    .lv-dash button:focus-visible, .lv-dash select:focus-visible, .lv-dash input:focus-visible { outline: 2px solid ${theme.color.accent}; outline-offset: 2px; }
    .lv-dash button:hover:not(:disabled) { filter: brightness(0.97); }
    .lv-dash * { box-sizing: border-box; }
  `}</style>
);
