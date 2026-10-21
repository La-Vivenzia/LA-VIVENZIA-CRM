import { type ReactNode } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { LvAvatar, LvBadge } from 'src/design/kit';
import { type BadgeTone } from 'src/design/status';
import { type LvTheme } from 'src/design/theme';

// How a page announces itself.
//
// The references use two headers and they are not interchangeable:
//
//   'hero'  — a top-level destination. The title is set in the display face
//             directly on the photograph, with a subtitle and, at the right, a
//             single control such as a date range. No breadcrumb: there is
//             nowhere above it to go.
//   'panel' — a flow or a record, inside the rounded surface. A back arrow or
//             a breadcrumb, a plainer title, and the actions for this page.
//
// A record adds a third piece below that: the identity strip — thumbnail,
// name, type, then the facts that matter (partner, owner, status, progress).

export const LvPageHeader = ({
  theme,
  title,
  titleIcon,
  subtitle,
  variant = 'panel',
  eyebrow,
  onBack,
  backLabel = 'Back',
  breadcrumbs,
  actions,
}: {
  theme: LvTheme;
  title: string;
  /** A glyph beside the title. Decorative — the title already says it. */
  titleIcon?: LvIconName;
  subtitle?: string | null;
  variant?: 'hero' | 'panel';
  eyebrow?: string | null;
  onBack?: () => void;
  backLabel?: string;
  /** Rendered instead of a plain back arrow when the page has a trail. */
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
}) => (
  <header className={variant === 'hero' ? 'lv-page-header lv-page-header-hero' : 'lv-page-header'}>
    {(onBack || breadcrumbs) && (
      <div className="lv-page-trail" style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), minWidth: 0 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="lv-icon-button"
            style={{
              width: 36,
              height: 36,
              flex: '0 0 auto',
              borderRadius: theme.radius.pill,
              border: '1px solid transparent',
              background: 'transparent',
              color: theme.color.textMuted,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LvIcon name="chevronLeft" size={19} />
          </button>
        )}
        {breadcrumbs}
      </div>
    )}

    <div className="lv-page-headline" style={{ minWidth: 0 }}>
      {eyebrow && <span style={{ display: 'block', ...theme.type.label, color: theme.color.brand, marginBottom: 4 }}>{eyebrow}</span>}
      <h1
        className="lv-page-title"
        style={
          variant === 'hero'
            ? { ...theme.type.display, color: theme.color.heading, margin: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }
            : { ...theme.type.subheading, fontSize: 24, color: theme.color.heading, margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }
        }
      >
        {title}
        {titleIcon !== undefined && (
          // Sized from the heading rather than fixed, so it keeps its
          // proportion when the hero type scales with the viewport.
          <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', flex: '0 0 auto' }}>
            <LvIcon name={titleIcon} size={variant === 'hero' ? 26 : 20} />
          </span>
        )}
      </h1>
      {subtitle && <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0`, maxWidth: 680 }}>{subtitle}</p>}
    </div>

    {actions && <div className="lv-page-actions">{actions}</div>}
  </header>
);

export type LvFact = { key: string; label: string; value: ReactNode };

/**
 * The identity strip of a record: who this is, then the handful of facts a
 * person checks before doing anything. The facts wrap rather than truncate —
 * a half-shown status is worse than a wrapped one.
 */
export const LvRecordHeader = ({
  theme,
  name,
  typeLabel,
  typeTone = 'info',
  meta,
  imageUrl,
  facts = [],
  actions,
  overflow,
}: {
  theme: LvTheme;
  name: string;
  typeLabel?: string | null;
  typeTone?: BadgeTone;
  /** The small line under the name: a place, a reference, a rating. */
  meta?: { icon: LvIconName; text: string }[];
  imageUrl?: string | null;
  facts?: LvFact[];
  actions?: ReactNode;
  overflow?: ReactNode;
}) => (
  <section className="lv-record-header" style={{ background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.xl }}>
    <div className="lv-record-identity" style={{ display: 'flex', alignItems: 'center', gap: theme.space(4), minWidth: 0 }}>
      <LvAvatar theme={theme} name={name} src={imageUrl} size={64} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
          <h2 style={{ ...theme.type.subheading, fontSize: 22, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>{name}</h2>
          {typeLabel && (
            <LvBadge theme={theme} tone={typeTone}>
              {typeLabel}
            </LvBadge>
          )}
        </div>
        {meta && meta.length > 0 && (
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: `2px ${theme.space(4)}px`, margin: `${theme.space(2)}px 0 0`, padding: 0, listStyle: 'none' }}>
            {meta.map((item) => (
              <li key={item.text} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.textMuted }}>
                <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
                  <LvIcon name={item.icon} size={15} />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>

    {facts.length > 0 && (
      <dl className="lv-record-facts">
        {facts.map((fact) => (
          <div key={fact.key} style={{ minWidth: 0 }}>
            <dt style={{ ...theme.type.caption, color: theme.color.textMuted, marginBottom: 2 }}>{fact.label}</dt>
            <dd style={{ ...theme.type.bodySmall, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    )}

    {(actions || overflow) && (
      <div className="lv-record-actions" style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
        {actions}
        {overflow}
      </div>
    )}
  </section>
);

/**
 * Section navigation — the underline tab row the references use for the
 * sections of a page. It is deliberately not a second sidebar: the product has
 * one navigation, and everything below it is a section of the page you are on.
 */
export const LvSectionNav = ({
  theme,
  label,
  sections,
  value,
  onChange,
}: {
  theme: LvTheme;
  label: string;
  sections: { key: string; label: string; count?: number; disabled?: boolean }[];
  value: string;
  onChange: (key: string) => void;
}) => (
  <nav className="lv-section-nav" aria-label={label}>
    <ul className="lv-tabs" role="tablist" aria-label={label} style={{ display: 'flex', borderBottom: `1px solid ${theme.color.border}`, margin: 0, padding: 0, listStyle: 'none' }}>
      {sections.map((section) => {
        const active = section.key === value;

        return (
          <li key={section.key} style={{ listStyle: 'none' }}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              disabled={section.disabled}
              onClick={() => onChange(section.key)}
              style={{
                appearance: 'none',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? theme.color.brand : 'transparent'}`,
                padding: `${theme.space(2)}px 0`,
                marginBottom: -1,
                minHeight: 44,
                cursor: section.disabled ? 'not-allowed' : 'pointer',
                fontFamily: theme.font.body,
                fontSize: theme.font.size.md,
                fontWeight: active ? theme.font.weight.bold : theme.font.weight.regular,
                color: active ? theme.color.heading : theme.color.textMuted,
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.space(2),
                whiteSpace: 'nowrap',
              }}
            >
              {section.label}
              {typeof section.count === 'number' && (
                <span style={{ ...theme.type.caption, color: theme.color.textSubtle, background: theme.color.surfaceSunken, borderRadius: theme.radius.pill, padding: '1px 7px' }}>
                  {section.count}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

/**
 * The actions for the page you are on.
 *
 * On a wide screen they sit inline in the header. On a phone they become the
 * sticky bar at the foot of the screen that the mobile references show, which
 * is why a record screen there does not need the bottom navigation competing
 * for the same strip — the shell hides it while this is mounted.
 */
export const LvContextualActions = ({
  theme,
  children,
  sticky = true,
}: {
  theme: LvTheme;
  children: ReactNode;
  /** false leaves the actions in the flow rather than pinning them on a phone. */
  sticky?: boolean;
}) => (
  <div
    className={sticky ? 'lv-contextual-actions lv-contextual-sticky' : 'lv-contextual-actions'}
    style={{ background: theme.color.surfaceRaised, borderTop: `1px solid ${theme.color.border}` }}
  >
    <div className="lv-contextual-inner" style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
      {children}
    </div>
  </div>
);

/**
 * The four-up row the mobile references put under a record's identity: the
 * things you actually do, one tap away, before any tab or field.
 */
export const LvQuickActions = ({
  theme,
  actions,
}: {
  theme: LvTheme;
  actions: { key: string; label: string; icon: LvIconName; onSelect?: () => void; disabled?: boolean }[];
}) => (
  <ul className="lv-quick-actions">
    {actions.map((action) => (
      <li key={action.key} style={{ listStyle: 'none' }}>
        <button
          type="button"
          onClick={action.onSelect}
          disabled={action.disabled}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            width: '100%',
            minHeight: 62,
            borderRadius: theme.radius.lg,
            border: '1px solid transparent',
            background: theme.color.surfaceSunken,
            color: theme.color.heading,
            cursor: action.disabled ? 'not-allowed' : 'pointer',
            opacity: action.disabled ? 0.45 : 1,
            ...theme.type.bodySmall,
            fontFamily: theme.font.body,
          }}
        >
          <LvIcon name={action.icon} size={19} />
          {action.label}
        </button>
      </li>
    ))}
  </ul>
);
