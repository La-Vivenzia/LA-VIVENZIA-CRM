import { type ChangeEvent, type CSSProperties, type ReactNode, useId, useState } from 'react';

import { describeStatus, badgeToneOf, type BadgeTone, type StatusKind, type StatusTone } from 'src/modules/lv-core/ui/status';
import { layout, type LvTheme } from 'src/modules/lv-core/ui/theme';

// The La Vivenzia component kit — every primitive an LV surface is built
// from. One place, so the dashboard, the Lead 360, onboarding, the Control
// Tower and the Copilot read as one product rather than six.
//
// The components run inside Twenty's sandboxed renderer, which mirrors the
// DOM (including <style> elements) into the host page, so inline styles carry
// the tokens and a small injected stylesheet (LvStyles) supplies what inline
// styles cannot: :focus-visible, :hover, media queries and reduced motion.
//
// Accessibility: real <button>s for anything clickable, visible focus rings,
// status conveyed by text as well as colour, headings for sections, labels
// bound to inputs, live regions for loading and errors.

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

export const toneWash = (theme: LvTheme, tone: Tone | undefined): string =>
  tone === 'danger'
    ? theme.color.dangerMuted
    : tone === 'warning'
      ? theme.color.warningMuted
      : tone === 'success'
        ? theme.color.successMuted
        : tone === 'info'
          ? theme.color.infoMuted
          : theme.color.surfaceSunken;

export const focusRing = (theme: LvTheme): CSSProperties => ({
  outline: `2px solid ${theme.color.ring}`,
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

const SR_ONLY: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

export const VisuallyHidden = ({ children }: { children: ReactNode }) => <span style={SR_ONLY}>{children}</span>;

// ---------------------------------------------------------------------------
// Global styles for one LV surface. Scoped to `.lv-root` so nothing leaks into
// the Twenty shell. Injected once per component.
// ---------------------------------------------------------------------------
export const LvStyles = ({ theme }: { theme: LvTheme }) => (
  <style>{`
    .lv-root, .lv-root * { box-sizing: border-box; }
    .lv-root { font-family: ${theme.font.body}; -webkit-font-smoothing: antialiased; }
    .lv-root button:focus-visible, .lv-root select:focus-visible, .lv-root input:focus-visible, .lv-root textarea:focus-visible, .lv-root a:focus-visible, .lv-root [tabindex]:focus-visible { outline: 2px solid ${theme.color.ring}; outline-offset: 2px; }
    .lv-root button:hover:not(:disabled) { filter: brightness(${theme.scheme === 'dark' ? 1.08 : 0.96}); }
    .lv-root button:active:not(:disabled) { filter: brightness(${theme.scheme === 'dark' ? 1.14 : 0.92}); }
    .lv-root button:disabled { cursor: not-allowed; opacity: 0.5; }
    .lv-root input::placeholder, .lv-root textarea::placeholder { color: ${theme.color.textSubtle}; }
    .lv-root .lv-row-hover:hover { background: ${theme.color.surfaceSunken}; }
    .lv-root .lv-kpi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${theme.space(2)}px; }
    .lv-root .lv-two-col { display: grid; grid-template-columns: 1fr; gap: ${theme.space(3)}px; align-items: start; }
    .lv-root .lv-three-col { display: grid; grid-template-columns: 1fr; gap: ${theme.space(3)}px; align-items: start; }
    .lv-root .lv-sidebar-layout { display: grid; grid-template-columns: 1fr; gap: ${theme.space(4)}px; align-items: start; }
    .lv-root .lv-field-grid { display: grid; grid-template-columns: 1fr; gap: ${theme.space(3)}px; }
    .lv-root .lv-hide-mobile { display: none; }
    .lv-root .lv-skeleton { background: linear-gradient(90deg, ${theme.color.surfaceSunken} 25%, ${theme.color.surface} 50%, ${theme.color.surfaceSunken} 75%); background-size: 200% 100%; animation: lv-shimmer 1.4s ease-in-out infinite; border-radius: ${theme.radius.md}px; }
    .lv-root .lv-fade-in { animation: lv-fade ${theme.motion.duration.normal}ms ${theme.motion.easing}; }
    .lv-root table { border-collapse: collapse; width: 100%; }
    .lv-root th { text-align: left; }
    @keyframes lv-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes lv-fade { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: none; } }
    @media (min-width: ${theme.breakpoint.md}px) {
      .lv-root .lv-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: ${theme.space(3)}px; }
      .lv-root .lv-two-col { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-root .lv-field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-root .lv-hide-mobile { display: initial; }
      .lv-root .lv-hide-desktop { display: none; }
    }
    @media (min-width: ${theme.breakpoint.lg}px) {
      .lv-root .lv-three-col { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .lv-root .lv-sidebar-layout { grid-template-columns: minmax(0, 1fr) minmax(280px, 360px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .lv-root * { animation: none !important; transition: none !important; }
    }
  `}</style>
);

// Kept for the surfaces written before the kit was generalised.
export const FocusStyles = LvStyles;

// The outermost element of every LV surface. The ground is the host page's
// (themed by lv-theme.css), so a short page does not end in a visible seam.
export const LvPage = ({ theme, children, maxWidth = 1280, className = '' }: { theme: LvTheme; children: ReactNode; maxWidth?: number; className?: string }) => {
  const s = layout(theme);

  return (
    <div className={`lv-root ${className}`.trim()} style={{ ...s.page, background: 'transparent', padding: 'clamp(12px, 2.5vw, 24px)' }}>
      <LvStyles theme={theme} />
      <div style={s.container(maxWidth)}>{children}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
export const Eyebrow = ({ theme, children, tone }: { theme: LvTheme; children: ReactNode; tone?: Tone }) => (
  <span style={{ ...theme.type.label, display: 'block', color: tone ? toneColour(theme, tone) : theme.color.textMuted }}>{children}</span>
);

export const PageHeader = ({
  theme,
  title,
  subtitle,
  eyebrow,
  right,
}: {
  theme: LvTheme;
  title: string;
  subtitle?: string;
  eyebrow?: string;
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
      paddingBottom: theme.space(3),
      borderBottom: `1px solid ${theme.color.border}`,
      position: 'relative',
    }}
  >
    <span aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: -1, width: 56, height: 2, background: theme.color.accent }} />
    <div style={{ minWidth: 0 }}>
      {eyebrow && <Eyebrow theme={theme}>{eyebrow}</Eyebrow>}
      <h1 style={{ ...theme.type.display, margin: 0, color: theme.color.heading }}>{title}</h1>
      {subtitle && <p style={{ ...theme.type.bodySmall, margin: `${theme.space(1)}px 0 0`, color: theme.color.textMuted }}>{subtitle}</p>}
    </div>
    {right && <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>{right}</div>}
  </header>
);

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
export type LvButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

export const LvButton = ({
  theme,
  children,
  variant = 'secondary',
  size = 'md',
  onClick,
  type = 'button',
  disabled,
  busy,
  title,
  ariaLabel,
  ariaPressed,
  style,
  icon,
}: {
  theme: LvTheme;
  children: ReactNode;
  variant?: LvButtonVariant;
  size?: 'sm' | 'md';
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  // A real loading state: the button keeps its width and announces itself.
  busy?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  style?: CSSProperties;
  icon?: ReactNode;
}) => {
  const s = layout(theme);
  const base = s.button(variant);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
      style={{
        ...base,
        ...(size === 'sm' ? { minHeight: 36, padding: `${theme.space(1)}px ${theme.space(3)}px`, fontSize: theme.font.size.sm } : {}),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space(2),
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>}
      <span>{busy ? 'Working…' : children}</span>
    </button>
  );
};

// A row of actions that wraps on a phone. The first is the primary.
export const ActionBar = ({ theme, children, align = 'start' }: { theme: LvTheme; children: ReactNode; align?: 'start' | 'end' }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), alignItems: 'center', justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }}>{children}</div>
);

// ---------------------------------------------------------------------------
// Badges and status
// ---------------------------------------------------------------------------
export const LvBadge = ({ theme, tone = 'neutral', children, title }: { theme: LvTheme; tone?: BadgeTone; children: ReactNode; title?: string }) => {
  const s = layout(theme);

  return (
    <span title={title} style={s.badge(tone)}>
      {children}
    </span>
  );
};

// The one status badge. Label and tone come from the unified status map.
export const LvStatusBadge = ({ theme, kind, value, title }: { theme: LvTheme; kind: StatusKind; value: string | null | undefined; title?: string }) => {
  const status = describeStatus(kind, value);

  return (
    <LvBadge theme={theme} tone={badgeToneOf(status.tone)} title={title}>
      {status.label}
    </LvBadge>
  );
};

export const statusToneToTone = (tone: StatusTone): Tone => badgeToneOf(tone);

// A small count pill for section headings.
export const CountPill = ({ theme, count, tone }: { theme: LvTheme; count: number; tone?: BadgeTone }) => (
  <LvBadge theme={theme} tone={tone ?? (count > 0 ? 'info' : 'neutral')}>
    {count}
  </LvBadge>
);

// Where a value came from. AI output is always labelled as such; nothing
// sparkles.
export const Provenance = ({ theme, source, detail, label: customLabel, inverse = false }: { theme: LvTheme; source: 'rules' | 'ai' | 'user' | 'system'; detail?: string; label?: string; inverse?: boolean }) => {
  const label = customLabel ?? (source === 'ai' ? 'AI GENERATED' : source === 'rules' ? 'COMPUTED · rules' : source === 'user' ? 'RECORDED' : 'SYSTEM');
  const colour = inverse ? (source === 'ai' ? theme.color.accent : 'rgba(243,239,231,0.85)') : source === 'ai' ? theme.color.accentInk : theme.color.textMuted;
  const border = inverse ? (source === 'ai' ? theme.color.accent : 'rgba(243,239,231,0.4)') : source === 'ai' ? theme.color.accentInk : theme.color.borderStrong;

  return (
    <span
      title={detail}
      style={{
        ...theme.type.caption,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: `1px ${theme.space(2)}px`,
        borderRadius: theme.radius.pill,
        border: `1px dashed ${border}`,
        color: colour,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: source === 'ai' ? theme.color.accent : theme.color.brandMuted }} />
      {label}
      {detail && <VisuallyHidden>: {detail}</VisuallyHidden>}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------
export const LvCard = ({
  theme,
  children,
  tone,
  padding,
  style,
  as: Tag = 'div',
  ariaLabel,
}: {
  theme: LvTheme;
  children: ReactNode;
  // A toned card carries a coloured top rule: the attention signal.
  tone?: Tone;
  padding?: number;
  style?: CSSProperties;
  as?: 'div' | 'section' | 'article' | 'aside';
  ariaLabel?: string;
}) => {
  const s = layout(theme);
  const { border: _border, ...card } = s.card as CSSProperties & { border?: string };

  return (
    <Tag
      aria-label={ariaLabel}
      style={{
        ...card,
        borderStyle: 'solid',
        borderWidth: tone ? '3px 1px 1px' : '1px',
        borderColor: tone ? `${toneColour(theme, tone)} ${theme.color.border} ${theme.color.border}` : theme.color.border,
        padding: padding ?? theme.space(4),
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
};

export const Section = ({
  theme,
  title,
  count,
  countTone,
  children,
  hint,
  actions,
  tone,
  id,
}: {
  theme: LvTheme;
  title: string;
  count?: number;
  countTone?: BadgeTone;
  children: ReactNode;
  hint?: string;
  actions?: ReactNode;
  tone?: Tone;
  id?: string;
}) => (
  <LvCard theme={theme} as="section" ariaLabel={title} tone={tone} padding={theme.space(3)} style={{ scrollMarginTop: 16 }}>
    <div id={id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.space(2), flexWrap: 'wrap', marginBottom: theme.space(2) }}>
      <h2 style={{ ...theme.type.subheading, margin: 0, color: theme.color.heading, display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap' }}>
        <span>{title}</span>
        {typeof count === 'number' && <CountPill theme={theme} count={count} tone={countTone} />}
        {hint && <span style={{ ...theme.type.caption, color: theme.color.textMuted, fontWeight: 400 }}>{hint}</span>}
      </h2>
      {actions && <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>{actions}</div>}
    </div>
    {children}
  </LvCard>
);

// A dark-anchored panel: the hero of a page (Lead 360 identity, briefing).
export const InversePanel = ({ theme, children, style }: { theme: LvTheme; children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      background: theme.color.surfaceInverse,
      color: theme.color.surfaceInverseText,
      borderRadius: theme.radius.lg,
      padding: 'clamp(16px, 3vw, 24px)',
      boxShadow: theme.shadow.md,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}
  >
    <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${theme.color.accent}, transparent 70%)` }} />
    {children}
  </div>
);

// A definition list rendered as a responsive grid of label/value pairs.
export const Facts = ({ theme, items, columns = 2, onInverse }: { theme: LvTheme; items: { label: string; value: ReactNode; tone?: Tone }[]; columns?: 2 | 3; onInverse?: boolean }) => (
  <dl
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${columns === 3 ? 140 : 160}px, 1fr))`,
      gap: `${theme.space(3)}px ${theme.space(4)}px`,
      margin: 0,
    }}
  >
    {items.map((item) => (
      <div key={item.label} style={{ minWidth: 0 }}>
        <dt style={{ ...theme.type.label, color: onInverse ? 'rgba(243,239,231,0.7)' : theme.color.textMuted, marginBottom: 2 }}>{item.label}</dt>
        <dd style={{ ...theme.type.body, margin: 0, color: item.tone ? toneColour(theme, item.tone) : onInverse ? theme.color.surfaceInverseText : theme.color.text, overflowWrap: 'anywhere' }}>{item.value === null || item.value === undefined || item.value === '' ? '—' : item.value}</dd>
      </div>
    ))}
  </dl>
);

// Segmented control (lens switch, filter tabs). Real buttons, aria-pressed.
export const Segmented = ({ theme, options, value, onChange, label }: { theme: LvTheme; options: { key: string; label: string; count?: number }[]; value: string; onChange: (key: string) => void; label: string }) => (
  <div role="group" aria-label={label} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 2, padding: 2, borderRadius: theme.radius.pill, background: theme.color.surfaceSunken, border: `1px solid ${theme.color.border}` }}>
    {options.map((option) => {
      const active = option.key === value;

      return (
        <button
          key={option.key}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.key)}
          style={{
            border: '1px solid transparent',
            borderRadius: theme.radius.pill,
            padding: `${theme.space(1)}px ${theme.space(3)}px`,
            minHeight: 32,
            background: active ? theme.color.surfaceRaised : 'transparent',
            color: active ? (theme.scheme === 'dark' ? theme.color.heading : theme.color.brand) : theme.color.textMuted,
            fontFamily: theme.font.body,
            fontSize: theme.font.size.sm,
            fontWeight: theme.font.weight.medium,
            boxShadow: active ? theme.shadow.sm : 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {option.label}
          {typeof option.count === 'number' && <span style={{ ...theme.type.caption, color: active ? 'inherit' : theme.color.textSubtle }}>{option.count}</span>}
        </button>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------
export const KpiTile = ({
  theme,
  label,
  value,
  emptyText,
  unavailableReason,
  tone,
  onClick,
  hint,
}: {
  theme: LvTheme;
  label: string;
  value: number | null;
  emptyText: string;
  unavailableReason?: string;
  tone?: Tone;
  onClick?: () => void;
  hint?: string;
}) => {
  const colour = toneColour(theme, tone);
  const unavailable = value === null;
  const zero = value === 0;
  const quiet = unavailable || zero;
  const status = unavailable ? emptyText : zero ? emptyText : (hint ?? (tone === 'danger' ? 'Needs action' : tone === 'warning' ? 'Needs attention' : ' '));
  const content = (
    <>
      <span style={{ ...theme.type.label, display: 'block', color: theme.color.textMuted }}>{label}</span>
      <span
        aria-hidden="true"
        style={{
          ...theme.type.figure,
          display: 'block',
          fontSize: unavailable ? theme.font.size.lg : theme.type.figure.fontSize,
          margin: `${theme.space(1)}px 0`,
          color: quiet ? theme.color.textSubtle : tone ? colour : theme.color.heading,
        }}
      >
        {unavailable ? 'n/a' : value}
      </span>
      <span style={{ ...theme.type.caption, display: 'block', color: quiet ? theme.color.textSubtle : tone === 'danger' || tone === 'warning' ? colour : theme.color.textMuted, overflowWrap: 'anywhere' }}>{status}</span>
      <VisuallyHidden>{unavailable ? `${label}: unavailable. ${unavailableReason ?? emptyText}` : `${label}: ${value}. ${zero ? emptyText : status}`}</VisuallyHidden>
    </>
  );
  const base: CSSProperties = {
    background: quiet ? theme.color.surface : theme.color.surfaceRaised,
    borderStyle: 'solid',
    borderWidth: '1px 1px 1px 4px',
    borderColor: `${theme.color.border} ${theme.color.border} ${theme.color.border} ${quiet ? theme.color.border : colour}`,
    borderRadius: theme.radius.md,
    boxShadow: quiet ? 'none' : theme.shadow.sm,
    padding: theme.space(3),
    minWidth: 0,
    textAlign: 'left',
    fontFamily: theme.font.body,
    color: theme.color.text,
    width: '100%',
    position: 'relative',
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

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export const EmptyState = ({ theme, text, title, action, quiet = true }: { theme: LvTheme; text: string; title?: string; action?: ReactNode; quiet?: boolean }) =>
  quiet && !title ? (
    <p role="status" style={{ ...theme.type.bodySmall, margin: 0, padding: `${theme.space(2)}px 0`, color: theme.color.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
      <span aria-hidden="true" style={{ color: theme.color.success }}>
        ✓
      </span>
      {text}
    </p>
  ) : (
    <div role="status" style={{ padding: `${theme.space(6)}px ${theme.space(3)}px`, textAlign: 'center', color: theme.color.textMuted }}>
      <span aria-hidden="true" style={{ display: 'inline-block', width: 36, height: 36, borderRadius: 18, border: `1px solid ${theme.color.borderStrong}`, marginBottom: theme.space(2), background: theme.color.surfaceSunken }} />
      {title && <p style={{ ...theme.type.subheading, margin: `0 0 ${theme.space(1)}px`, color: theme.color.heading }}>{title}</p>}
      <p style={{ ...theme.type.bodySmall, margin: 0 }}>{text}</p>
      {action && <div style={{ marginTop: theme.space(3), display: 'flex', justifyContent: 'center' }}>{action}</div>}
    </div>
  );

export const ErrorState = ({ theme, text, onRetry, title = 'Something went wrong' }: { theme: LvTheme; text: string; onRetry?: () => void; title?: string }) => (
  <div role="alert" style={{ background: theme.color.dangerMuted, border: `1px solid ${theme.color.danger}`, borderRadius: theme.radius.md, padding: theme.space(3), color: theme.color.text, display: 'flex', gap: theme.space(3), alignItems: 'center', flexWrap: 'wrap' }}>
    <span style={{ flex: 1, minWidth: 200 }}>
      <span style={{ ...theme.type.subheading, display: 'block', color: theme.color.danger }}>{title}</span>
      <span style={{ ...theme.type.bodySmall }}>{text}</span>
    </span>
    {onRetry && (
      <LvButton theme={theme} variant="secondary" onClick={onRetry}>
        Retry
      </LvButton>
    )}
  </div>
);

// Shown when the server said no. The text tells the person what they can do,
// never that the button was hidden — the permission lives on the server.
export const ForbiddenState = ({ theme, text = 'Your role does not have access to this. Ask an administrator if you need it.', title = 'Not available for your role' }: { theme: LvTheme; text?: string; title?: string }) => (
  <div role="status" style={{ background: theme.color.surfaceSunken, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(4), color: theme.color.text }}>
    <span style={{ ...theme.type.subheading, display: 'block', color: theme.color.heading }}>{title}</span>
    <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{text}</span>
  </div>
);

// Reads a server message and decides which state to show.
export const isForbiddenMessage = (message: string | null | undefined): boolean => /forbidden|not allowed|permission|not permitted|403/i.test(message ?? '');

export const LoadingState = ({ theme, rows = 3, label = 'Loading' }: { theme: LvTheme; rows?: number; label?: string }) => (
  <div aria-busy="true" role="status" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="lv-skeleton" style={{ height: 56, opacity: 1 - index * 0.18 }} />
    ))}
    <VisuallyHidden>{label}</VisuallyHidden>
  </div>
);

export const InlineNotice = ({ theme, tone = 'info', children }: { theme: LvTheme; tone?: Tone; children: ReactNode }) => (
  <div role={tone === 'danger' ? 'alert' : 'status'} style={{ ...theme.type.bodySmall, background: toneWash(theme, tone), borderLeft: `3px solid ${toneColour(theme, tone)}`, borderRadius: theme.radius.sm, padding: `${theme.space(2)}px ${theme.space(3)}px`, color: theme.color.text }}>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Lists and rows
// ---------------------------------------------------------------------------
export const RecordList = ({ children }: { children: ReactNode }) => <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{children}</ul>;

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
  badge,
}: {
  theme: LvTheme;
  primary: string;
  secondary?: string | null;
  meta?: string | null;
  tone?: Tone;
  onClick?: () => void;
  actions?: ReactNode;
  badge?: ReactNode;
}) => {
  const colour = toneColour(theme, tone);
  const inner = (
    <>
      <span aria-hidden="true" style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: tone ? colour : 'transparent', flex: '0 0 3px' }} />
      <span style={{ flex: '1 1 160px', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>{primary}</span>
        {secondary && <span style={{ ...theme.type.bodySmall, display: 'block', color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{secondary}</span>}
      </span>
      {badge}
      {meta && <span style={{ ...theme.type.caption, flex: '0 1 auto', color: tone ? colour : theme.color.textMuted, whiteSpace: 'nowrap' }}>{meta}</span>}
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
    borderRadius: theme.radius.sm,
    textAlign: 'left',
    fontFamily: theme.font.body,
    fontSize: theme.font.size.md,
    color: theme.color.text,
    cursor: onClick ? 'pointer' : 'default',
    minHeight: 44,
  };

  return (
    <li className={onClick ? 'lv-row-hover' : undefined} style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: theme.space(2), borderBottom: `1px solid ${theme.color.border}` }}>
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

export const Bars = ({ theme, rows, onSelect }: { theme: LvTheme; rows: { key: string; label: string; count: number; tone?: Tone }[]; onSelect?: (key: string) => void }) => {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
      {rows.map((row) => {
        const width = `${Math.max(2, Math.round((row.count / max) * 100))}%`;
        const body = (
          <>
            <span style={{ ...theme.type.bodySmall, flex: '0 0 44%', minWidth: 0, overflowWrap: 'anywhere', color: row.count > 0 ? theme.color.text : theme.color.textMuted }}>{row.label}</span>
            <span aria-hidden="true" style={{ flex: 1, height: 8, background: theme.color.surfaceSunken, borderRadius: 999, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width, background: row.count > 0 ? (row.tone ? toneColour(theme, row.tone) : theme.color.brand) : 'transparent', borderRadius: 999 }} />
            </span>
            <span style={{ ...theme.type.mono, flex: '0 0 32px', textAlign: 'right', color: row.count > 0 ? theme.color.text : theme.color.textSubtle }}>{row.count}</span>
          </>
        );

        return (
          <li key={row.key} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(row.key)} aria-label={`${row.label}: ${row.count}`} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), width: '100%', background: 'transparent', border: 'none', padding: '4px 0', color: theme.color.text, fontFamily: theme.font.body, cursor: 'pointer', textAlign: 'left', borderRadius: theme.radius.sm }}>
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

// A responsive table: real <table> on desktop, and on a phone each row
// becomes a card with label/value pairs (the header is hidden but announced).
export const LvTable = <Row,>({
  theme,
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  emptyText = 'Nothing here yet.',
}: {
  theme: LvTheme;
  columns: { key: string; label: string; render: (row: Row) => ReactNode; width?: string; align?: 'left' | 'right'; hideOnMobile?: boolean }[];
  rows: Row[];
  rowKey: (row: Row) => string;
  caption: string;
  onRowClick?: (row: Row) => void;
  emptyText?: string;
}) => {
  const id = useId();

  if (rows.length === 0) {
    return <EmptyState theme={theme} text={emptyText} />;
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        #${CSS.escape(id)} td::before { display: none; }
        @media (max-width: ${theme.breakpoint.md - 1}px) {
          #${CSS.escape(id)} thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
          #${CSS.escape(id)} tr { display: block; border: 1px solid ${theme.color.border}; border-radius: ${theme.radius.md}px; margin-bottom: ${theme.space(2)}px; background: ${theme.color.surfaceRaised}; }
          #${CSS.escape(id)} td { display: flex; justify-content: space-between; gap: 12px; border: none !important; padding: 6px 12px !important; }
          #${CSS.escape(id)} td::before { display: block; content: attr(data-label); color: ${theme.color.textMuted}; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; }
          #${CSS.escape(id)} td.lv-hide-mobile { display: none; }
        }
      `}</style>
      <table id={id} style={{ ...theme.type.body, color: theme.color.text }}>
        <caption style={SR_ONLY}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" style={{ ...theme.type.label, color: theme.color.textMuted, padding: `${theme.space(2)}px ${theme.space(2)}px`, borderBottom: `1px solid ${theme.color.borderStrong}`, width: column.width, textAlign: column.align ?? 'left', whiteSpace: 'nowrap' }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'lv-row-hover' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((column) => (
                <td key={column.key} data-label={column.label} className={column.hideOnMobile ? 'lv-hide-mobile' : undefined} style={{ padding: `${theme.space(2)}px ${theme.space(2)}px`, borderBottom: `1px solid ${theme.color.border}`, verticalAlign: 'top', textAlign: column.align ?? 'left' }}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
export const Field = ({
  theme,
  label,
  children,
  help,
  error,
  required,
  htmlFor,
  span,
}: {
  theme: LvTheme;
  label: string;
  children: ReactNode;
  help?: string;
  error?: string | null;
  required?: boolean;
  htmlFor: string;
  // Spans both columns of a field grid.
  span?: boolean;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, gridColumn: span ? '1 / -1' : undefined }}>
    <label htmlFor={htmlFor} style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>
      {label}
      {required && (
        <span aria-hidden="true" style={{ color: theme.color.danger, marginLeft: 3 }}>
          *
        </span>
      )}
    </label>
    {children}
    {help && !error && (
      <span id={`${htmlFor}-help`} style={{ ...theme.type.caption, color: theme.color.textMuted }}>
        {help}
      </span>
    )}
    {error && (
      <span id={`${htmlFor}-error`} role="alert" style={{ ...theme.type.caption, color: theme.color.danger }}>
        {error}
      </span>
    )}
  </div>
);

const control = (theme: LvTheme, invalid?: boolean): CSSProperties => ({
  ...layout(theme).input,
  ...(invalid ? { borderColor: theme.color.danger } : {}),
});

// Explicit props rather than a spread: the house lint rule forbids JSX prop
// spreading, and listing them keeps the accessibility wiring visible.
type ControlProps = {
  theme: LvTheme;
  id: string;
  invalid?: boolean;
  style?: CSSProperties;
  value?: string | number | readonly string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
  name?: string;
};

export const LvInput = ({ theme, id, invalid, style, value, placeholder, disabled, required, maxLength, autoComplete, name, type = 'text', min, max, onChange, onBlur }: ControlProps & { type?: string; min?: number | string; max?: number | string; onChange?: (event: ChangeEvent<HTMLInputElement>) => void; onBlur?: () => void }) => (
  <input
    id={id}
    name={name}
    type={type}
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    required={required}
    maxLength={maxLength}
    autoComplete={autoComplete}
    min={min}
    max={max}
    onChange={onChange}
    onBlur={onBlur}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? `${id}-error` : undefined}
    style={{ ...control(theme, invalid), ...style }}
  />
);

export const LvTextarea = ({ theme, id, invalid, style, value, placeholder, disabled, required, maxLength, name, rows, onChange }: ControlProps & { rows?: number; onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void }) => (
  <textarea
    id={id}
    name={name}
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    required={required}
    maxLength={maxLength}
    rows={rows}
    onChange={onChange}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? `${id}-error` : undefined}
    style={{ ...control(theme, invalid), minHeight: 88, resize: 'vertical', ...style }}
  />
);

export const LvSelect = ({ theme, id, invalid, style, value, disabled, required, name, multiple, size, children, onChange }: ControlProps & { multiple?: boolean; size?: number; children: ReactNode; onChange?: (event: ChangeEvent<HTMLSelectElement>) => void }) => (
  <select id={id} name={name} value={value} disabled={disabled} required={required} multiple={multiple} size={size} onChange={onChange} aria-invalid={invalid || undefined} style={{ ...control(theme, invalid), ...style }}>
    {children}
  </select>
);

// Progressive disclosure: the essentials first, the rest behind one toggle.
export const Disclosure = ({ theme, label, children, defaultOpen = false, hint }: { theme: LvTheme; label: string; children: ReactNode; defaultOpen?: boolean; hint?: string }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div style={{ borderTop: `1px solid ${theme.color.border}`, paddingTop: theme.space(2) }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        style={{ ...theme.type.bodySmall, background: 'transparent', border: 'none', padding: `${theme.space(1)}px 0`, color: theme.color.brand, fontWeight: theme.font.weight.medium, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32 }}
      >
        <span aria-hidden="true" style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: `transform ${theme.motion.duration.fast}ms` }}>
          ›
        </span>
        {label}
        {hint && <span style={{ ...theme.type.caption, color: theme.color.textMuted, fontWeight: 400 }}>{hint}</span>}
      </button>
      <div id={id} hidden={!open} style={{ marginTop: theme.space(2) }}>
        {open && children}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Attention items — the dashboard's reason to exist
// ---------------------------------------------------------------------------
export const AttentionItem = ({ theme, tone, title, detail, meta, onClick, action }: { theme: LvTheme; tone: Tone; title: string; detail?: string | null; meta?: string | null; onClick?: () => void; action?: ReactNode }) => (
  <li style={{ listStyle: 'none', display: 'flex', alignItems: 'stretch', gap: theme.space(2), background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, overflow: 'hidden' }}>
    <span aria-hidden="true" style={{ width: 4, background: toneColour(theme, tone), flex: '0 0 4px' }} />
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2), padding: `${theme.space(2)}px ${theme.space(2)}px ${theme.space(2)}px 0`, background: 'transparent', border: 'none', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', fontFamily: theme.font.body, color: theme.color.text, minHeight: 48 }}
    >
      <span style={{ flex: '1 1 180px', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>{title}</span>
        {detail && <span style={{ ...theme.type.bodySmall, display: 'block', color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{detail}</span>}
      </span>
      {meta && <span style={{ ...theme.type.caption, color: toneColour(theme, tone), fontWeight: theme.font.weight.medium, whiteSpace: 'nowrap' }}>{meta}</span>}
    </button>
    {action && <span style={{ display: 'flex', alignItems: 'center', paddingRight: theme.space(2) }}>{action}</span>}
  </li>
);

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

// The wordmark, set in the display face so it inherits colour and stays
// crisp at any size.
export const Wordmark = ({ theme, size = 13, tone = 'inherit' }: { theme: LvTheme; size?: number; tone?: 'inherit' | 'gold' }) => (
  <span style={{ fontFamily: theme.font.display, fontSize: size, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600, color: tone === 'gold' ? theme.color.accent : 'inherit', whiteSpace: 'nowrap' }}>La Vivenzia</span>
);
