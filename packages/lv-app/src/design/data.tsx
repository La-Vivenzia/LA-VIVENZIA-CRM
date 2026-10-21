import { useState, type ReactNode } from 'react';

import { LvIcon } from 'src/design/icons';
import { EmptyState, LvButton, LvCard, CountPill } from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { type LvTheme } from 'src/design/theme';
import { useLvTier } from 'src/design/use-tier';

// Reading many records at once: the table, the filters over it, the trail back
// out of it, and the way through it.
//
// The table is the clearest case of the rule that mobile is not a narrowed
// desktop. A table that scrolls sideways on a phone is a table nobody reads,
// so below 768px the same data renders as one card per record with every field
// on its own labelled line. The markup genuinely differs, which is why this
// module reads the viewport instead of leaving it to the stylesheet.

export type LvColumn<Row> = {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  width?: string;
  align?: 'left' | 'right';
  /** Dropped on a tablet, where the table keeps its shape but not every column. */
  secondary?: boolean;
  /** The card's headline on a phone, instead of one more labelled line. */
  primary?: boolean;
};

export const LvDataTable = <Row,>({
  theme,
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  emptyText = 'Nothing here yet.',
  rowActions,
}: {
  theme: LvTheme;
  columns: LvColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Names the table for screen readers. Never decorative. */
  caption: string;
  onRowClick?: (row: Row) => void;
  emptyText?: string;
  rowActions?: (row: Row) => ReactNode;
}) => {
  const tier = useLvTier();

  if (rows.length === 0) {
    return <EmptyState theme={theme} text={emptyText} />;
  }

  // -------------------------------------------------------------- phone: cards
  if (tier === 'mobile') {
    const headline = columns.find((column) => column.primary) ?? columns[0];
    const rest = columns.filter((column) => column !== headline);

    return (
      <ul aria-label={caption} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
        {rows.map((row) => {
          const body = (
            <>
              <span style={{ ...theme.type.subheading, color: theme.color.heading, display: 'block', overflowWrap: 'anywhere' }}>{headline.render(row)}</span>
              <dl style={{ margin: `${theme.space(2)}px 0 0`, display: 'flex', flexDirection: 'column', gap: theme.space(1) }}>
                {rest.map((column) => (
                  <div key={column.key} style={{ display: 'flex', gap: theme.space(3), alignItems: 'baseline' }}>
                    <dt style={{ ...theme.type.bodySmall, color: theme.color.textMuted, flex: '0 0 40%' }}>{column.label}</dt>
                    <dd style={{ ...theme.type.bodySmall, color: theme.color.text, margin: 0, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                      {column.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          );

          return (
            <li key={rowKey(row)}>
              <LvCard theme={theme} padding={4}>
                {onRowClick ? (
                  <button
                    type="button"
                    onClick={() => onRowClick(row)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: '1px solid transparent', padding: 0, cursor: 'pointer', fontFamily: theme.font.body }}
                  >
                    {body}
                  </button>
                ) : (
                  body
                )}
                {rowActions && <div style={{ display: 'flex', gap: theme.space(2), marginTop: theme.space(3) }}>{rowActions(row)}</div>}
              </LvCard>
            </li>
          );
        })}
      </ul>
    );
  }

  // ------------------------------------------------- tablet and desktop: table
  const visible = tier === 'tablet' ? columns.filter((column) => !column.secondary) : columns;

  return (
    <div style={{ width: '100%' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <caption style={{ ...theme.type.bodySmall, color: theme.color.textMuted, textAlign: 'left', paddingBottom: theme.space(2) }}>{caption}</caption>
        <thead>
          <tr>
            {visible.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{
                  ...theme.type.label,
                  color: theme.color.textMuted,
                  textAlign: column.align ?? 'left',
                  padding: `${theme.space(2)}px ${theme.space(3)}px`,
                  borderBottom: `1px solid ${theme.color.border}`,
                  background: theme.color.surfaceSunken,
                  position: 'sticky',
                  top: 0,
                  width: column.width,
                }}
              >
                {column.label}
              </th>
            ))}
            {rowActions && <th scope="col" style={{ width: 1, padding: `${theme.space(2)}px ${theme.space(3)}px`, borderBottom: `1px solid ${theme.color.border}`, background: theme.color.surfaceSunken }} />}
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
              {visible.map((column) => (
                <td
                  key={column.key}
                  style={{
                    ...theme.type.body,
                    color: theme.color.text,
                    textAlign: column.align ?? 'left',
                    padding: `${theme.space(3)}px ${theme.space(3)}px`,
                    borderBottom: `1px solid ${theme.color.border}`,
                    verticalAlign: 'top',
                  }}
                >
                  {column.render(row)}
                </td>
              ))}
              {rowActions && (
                <td style={{ padding: `${theme.space(2)}px ${theme.space(3)}px`, borderBottom: `1px solid ${theme.color.border}`, whiteSpace: 'nowrap' }}>{rowActions(row)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Filters. Whatever narrows a list is shown as a removable chip above it, at
// every width — a filter you cannot see is a filter you will blame the data
// for.
// ---------------------------------------------------------------------------
export type LvActiveFilter = { key: string; label: string; onRemove: () => void };

export const LvFilterChip = ({ theme, label, onRemove }: { theme: LvTheme; label: string; onRemove: () => void }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.space(1),
      background: theme.color.brandMuted,
      color: theme.color.textOnBrand,
      borderRadius: theme.radius.pill,
      padding: `2px 2px 2px ${theme.space(3)}px`,
      ...theme.type.bodySmall,
    }}
  >
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter ${label}`}
      style={{
        width: 24,
        height: 24,
        borderRadius: theme.radius.pill,
        border: '1px solid transparent',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LvIcon name="plus" size={14} style={{ transform: 'rotate(45deg)' }} />
    </button>
  </span>
);

export const LvFilterBar = ({
  theme,
  label,
  active,
  onClearAll,
  children,
}: {
  theme: LvTheme;
  /** Names the filter set, e.g. "Filter leads". */
  label: string;
  active: LvActiveFilter[];
  onClearAll?: () => void;
  /** The controls themselves. Inline on a wide screen, in a sheet on a phone. */
  children: ReactNode;
}) => {
  const tier = useLvTier();
  const [open, setOpen] = useState(false);

  const chips =
    active.length === 0 ? null : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), alignItems: 'center' }}>
        {active.map((filter) => (
          <LvFilterChip key={filter.key} theme={theme} label={filter.label} onRemove={filter.onRemove} />
        ))}
        {onClearAll && (
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onClearAll}>
            Clear all
          </LvButton>
        )}
      </div>
    );

  if (tier === 'mobile') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
        <LvButton theme={theme} variant="secondary" onClick={() => setOpen(true)} icon={<LvIcon name="filter" size={16} />}>
          Filters
          {active.length > 0 && <CountPill theme={theme} count={active.length} />}
        </LvButton>
        {chips}
        {open && (
          <LvSheet
            theme={theme}
            title={label}
            onClose={() => setOpen(false)}
            footer={
              <>
                {onClearAll && (
                  <LvButton
                    theme={theme}
                    variant="ghost"
                    onClick={() => {
                      onClearAll();
                      setOpen(false);
                    }}
                  >
                    Clear all
                  </LvButton>
                )}
                <LvButton theme={theme} variant="primary" onClick={() => setOpen(false)}>
                  Show results
                </LvButton>
              </>
            }
          >
            {children}
          </LvSheet>
        )}
      </div>
    );
  }

  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(3), alignItems: 'center' }}>{children}</div>
      {chips}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Breadcrumbs. The full trail where there is room; on a phone, one back link
// naming the parent, because a trail that wraps to three lines is noise.
// ---------------------------------------------------------------------------
export type LvCrumb = { key: string; label: string; onNavigate?: () => void };

export const LvBreadcrumbs = ({ theme, trail }: { theme: LvTheme; trail: LvCrumb[] }) => {
  const tier = useLvTier();

  if (trail.length === 0) {
    return null;
  }

  const linkStyle = {
    ...theme.type.bodySmall,
    background: 'transparent',
    border: '1px solid transparent',
    padding: 0,
    cursor: 'pointer',
    color: theme.color.textMuted,
  };

  if (tier === 'mobile') {
    const parent = trail[trail.length - 2];

    if (!parent?.onNavigate) {
      return null;
    }

    return (
      <nav aria-label="Breadcrumb">
        {/* `lv-text-button` rather than an inline minHeight: the floor is
            44px on a phone and lifted at md+, and an inline style would pin
            the phone's value to every width. It is the same class the rest of
            the product's inline text navigation carries. */}
        <button type="button" onClick={parent.onNavigate} className="lv-text-button" style={{ ...linkStyle, display: 'inline-flex', alignItems: 'center', gap: theme.space(1) }}>
          <LvIcon name="chevronLeft" size={16} />
          {parent.label}
        </button>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;

          return (
            <li key={crumb.key} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
              {index > 0 && (
                <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
                  <LvIcon name="chevronRight" size={14} />
                </span>
              )}
              {last || !crumb.onNavigate ? (
                <span aria-current={last ? 'page' : undefined} style={{ ...theme.type.bodySmall, color: last ? theme.color.heading : theme.color.textMuted }}>
                  {crumb.label}
                </span>
              ) : (
                <button type="button" onClick={crumb.onNavigate} className="lv-text-button" style={linkStyle}>
                  {crumb.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// ---------------------------------------------------------------------------
// Pagination. It says where you are before it offers to move you.
// ---------------------------------------------------------------------------
export const LvPagination = ({
  theme,
  from,
  to,
  total,
  onPrevious,
  onNext,
}: {
  theme: LvTheme;
  from: number;
  to: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) => (
  <div className="lv-action-row" style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), paddingTop: theme.space(3) }}>
    <span aria-live="polite" style={{ ...theme.type.bodySmall, color: theme.color.textMuted, flex: 1 }}>
      {total === 0 ? 'Nothing to show' : `${from}–${to} of ${total}`}
    </span>
    <LvButton theme={theme} variant="secondary" size="sm" onClick={onPrevious} disabled={!onPrevious}>
      Previous
    </LvButton>
    <LvButton theme={theme} variant="secondary" size="sm" onClick={onNext} disabled={!onNext}>
      Next
    </LvButton>
  </div>
);
