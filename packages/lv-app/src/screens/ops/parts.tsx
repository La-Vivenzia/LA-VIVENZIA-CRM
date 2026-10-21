import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { opsLinkFor, type CountRow, type Kpi, type ListSection, type OpsTone } from 'src/api/ops';
import { LvIcon } from 'src/design/icons';
import { EmptyState, ErrorState, ForbiddenState, InlineNotice, KpiTile, LoadingState, LvBadge, LvButton, LvCard } from 'src/design/kit';
import { LvPageHeader, LvSectionNav } from 'src/design/page';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// The pieces the six leadership screens share.
//
// None of them computes anything. They lay out figures the backend already
// decided, keep the names the backend uses, and say plainly when a figure
// could not be read rather than drawing a zero.

// ---------------------------------------------------------------------------
// The one surface the six screens sit on
// ---------------------------------------------------------------------------

export const OPS_SECTIONS = [
  { key: 'tower', label: 'Control Tower', path: '/ops/control-tower' },
  { key: 'pipeline', label: 'Pipeline', path: '/ops/pipeline' },
  { key: 'sla', label: 'SLA board', path: '/ops/sla' },
  { key: 'channels', label: 'Channels', path: '/ops/channels' },
  { key: 'documents', label: 'Verification', path: '/ops/documents' },
  { key: 'audit', label: 'Audit trail', path: '/ops/audit' },
] as const;

export type OpsSection = (typeof OPS_SECTIONS)[number]['key'];

export const OpsShell = ({
  theme,
  section,
  title,
  subtitle,
  actions,
  children,
}: {
  theme: LvTheme;
  section: OpsSection;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  const navigate = useNavigate();

  return (
    <>
      <LvPageHeader
        theme={theme}
        variant="panel"
        title={title}
        subtitle={subtitle}
        onBack={() => navigate('/today')}
        backLabel="Back to Today"
        actions={actions}
      />

      <LvSectionNav
        theme={theme}
        label="Leadership and operations"
        value={section}
        sections={OPS_SECTIONS.map((entry) => ({ key: entry.key, label: entry.label }))}
        onChange={(key) => {
          const next = OPS_SECTIONS.find((entry) => entry.key === key);

          if (next) {
            navigate(next.path);
          }
        }}
      />

      {children}
    </>
  );
};

/**
 * Every one of these screens has the same four outcomes, and a role that may
 * not see one is a state rather than an error. The refusal is shown in the
 * server's own words.
 */
export const OpsState = ({
  theme,
  loading,
  error,
  forbidden,
  onRetry,
  label,
}: {
  theme: LvTheme;
  loading: boolean;
  error: string | null;
  forbidden: boolean;
  onRetry: () => void;
  label: string;
}): ReactNode => {
  if (loading) {
    return <LoadingState theme={theme} rows={5} label={`Loading ${label}`} />;
  }

  if (forbidden) {
    return <ForbiddenState theme={theme} title="Not available for your role" text={error ?? 'Your role does not include this view.'} />;
  }

  if (error !== null) {
    return <ErrorState theme={theme} title={`${label} could not be loaded`} text={error} onRetry={onRetry} />;
  }

  return null;
};

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

const TONE_FOR: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'neutral'> = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  success: 'success',
  neutral: 'neutral',
};

/** A row of headline figures. A string value is shown as a fact, not a tile. */
export const KpiRow = ({ theme, kpis }: { theme: LvTheme; kpis: Kpi[] }) => {
  const numeric = kpis.filter((kpi) => typeof kpi.value !== 'string');

  if (numeric.length === 0) {
    return null;
  }

  return (
    <div className="lv-kpi-row" style={{ display: 'grid', gap: theme.space(3) }}>
      {numeric.map((kpi) => (
        <KpiTile
          key={kpi.key}
          theme={theme}
          label={kpi.label}
          value={typeof kpi.value === 'number' ? kpi.value : null}
          emptyText={kpi.emptyText ?? 'Nothing recorded'}
          tone={kpi.tone ? TONE_FOR[kpi.tone] : undefined}
        />
      ))}
    </div>
  );
};

/**
 * A count breakdown. Deliberately a labelled list with a proportion bar rather
 * than a pie: these are small integers, and a reader needs the number.
 */
export const CountBars = ({
  theme,
  rows,
  caption,
  labelFor,
  toneFor,
}: {
  theme: LvTheme;
  rows: CountRow[];
  caption: string;
  labelFor?: (row: CountRow) => string;
  toneFor?: (row: CountRow) => OpsTone;
}) => {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (rows.length === 0) {
    return <EmptyState theme={theme} quiet text={`Nothing recorded for ${caption.toLowerCase()}.`} />;
  }

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
      {rows.map((row) => {
        const tone = toneFor?.(row) ?? 'neutral';
        const colour =
          tone === 'danger' ? theme.color.danger : tone === 'warning' ? theme.color.warning : tone === 'success' ? theme.color.success : theme.color.brand;
        const share = total === 0 ? 0 : Math.round((row.count / total) * 100);

        return (
          <li key={row.key} style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), minWidth: 0 }}>
            <span style={{ ...theme.type.bodySmall, color: theme.color.text, flex: '0 0 42%', minWidth: 0, overflowWrap: 'anywhere' }}>
              {labelFor?.(row) ?? row.label ?? row.key}
            </span>
            <span
              aria-hidden="true"
              style={{ flex: 1, height: 8, minWidth: 40, borderRadius: theme.radius.pill, background: theme.color.surfaceSunken, overflow: 'hidden' }}
            >
              <span style={{ display: 'block', width: `${share}%`, height: '100%', background: colour, borderRadius: theme.radius.pill }} />
            </span>
            <span style={{ ...theme.type.body, color: theme.color.heading, fontWeight: theme.font.weight.medium, flex: '0 0 auto', minWidth: 28, textAlign: 'right' }}>
              {row.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

/** The server's `systemHealth`: a label, a value and the server's own detail. */
export const HealthList = ({ theme, rows }: { theme: LvTheme; rows: { key: string; label: string; value: string | number | null; detail: string }[] }) => (
  <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: theme.space(3), margin: 0 }}>
    {rows.map((row) => (
      <div key={row.key} style={{ minWidth: 0 }}>
        <dt style={{ ...theme.type.label, color: theme.color.textMuted, marginBottom: 2 }}>{row.label}</dt>
        <dd style={{ margin: 0, minWidth: 0 }}>
          <span style={{ display: 'block', ...theme.type.body, color: theme.color.heading, fontWeight: theme.font.weight.medium, overflowWrap: 'anywhere' }}>
            {row.value === null ? 'Not available' : String(row.value)}
          </span>
          <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle, overflowWrap: 'anywhere' }}>{row.detail}</span>
        </dd>
      </div>
    ))}
  </dl>
);

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const rowLabel = (row: Record<string, unknown>): string =>
  String(row.name ?? row.title ?? row.leadName ?? row.targetLabel ?? 'Record');

const rowRef = (row: Record<string, unknown>): string | null => {
  const value = row.lvLeadId ?? row.reference ?? row.lvPartnerId ?? null;

  return typeof value === 'string' ? value : null;
};

/**
 * Every Control Tower row carries `target: { object, recordId }` — the server
 * already knows what the row *is*. Guessing from the row's own `id` sent a
 * task id into /leads and a document id into /leads; this reads the target.
 */
const targetOf = (row: Record<string, unknown>): { object: string; recordId: string } | null => {
  const target = row.target as { object?: unknown; recordId?: unknown } | undefined;

  return typeof target?.object === 'string' && typeof target?.recordId === 'string'
    ? { object: target.object, recordId: target.recordId }
    : null;
};

/**
 * Where a row opens. A document lives inside its onboarding, so it opens there;
 * a task has no screen of its own, so it is named and left alone.
 */
const linkOf = (row: Record<string, unknown>): string | null => {
  const target = targetOf(row);

  if (target === null) {
    return null;
  }

  if (target.object === 'lvOnboardingDocument') {
    return typeof row.onboardingId === 'string' ? `/onboarding/${row.onboardingId}/documents` : null;
  }

  return opsLinkFor(target.object, target.recordId);
};

/**
 * One of the Control Tower's named lists. A row opens only where this
 * application has a screen for that object; anything else is named and left
 * alone rather than linked somewhere that does not exist.
 */
export const SectionList = ({ theme, section, tone }: { theme: LvTheme; section: ListSection; tone: OpsTone }) => {
  const navigate = useNavigate();

  return (
    <LvSectionCard
      theme={theme}
      title={section.title}
      icon="chart"
      action={section.totalCount > 0 ? <LvBadge theme={theme} tone={tone === 'neutral' ? 'neutral' : tone === 'success' ? 'success' : tone}>{String(section.totalCount)}</LvBadge> : undefined}
    >
      {section.rows.length === 0 ? (
        <EmptyState theme={theme} quiet text={section.emptyText} />
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {section.rows.map((row, index) => {
            const id = typeof row.id === 'string' ? row.id : null;
            const link = linkOf(row);
            const label = rowLabel(row);
            const reference = rowRef(row);
            const detail = [row.status, row.priority, row.location].filter((value): value is string => typeof value === 'string' && value.length > 0);

            return (
              <li key={id ?? `${section.key}-${index}`} className="lv-action-row" style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'center', gap: theme.space(3) }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {link ? (
                    <button
                      type="button"
                      onClick={() => navigate(link)}
                      className="lv-text-button"
                      style={{ ...theme.type.body, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: theme.color.heading, fontFamily: theme.font.body, cursor: 'pointer', overflowWrap: 'anywhere' }}
                    >
                      {label}
                    </button>
                  ) : (
                    <span style={{ ...theme.type.body, color: theme.color.heading, overflowWrap: 'anywhere' }}>{label}</span>
                  )}
                  <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle, overflowWrap: 'anywhere' }}>
                    {[reference, ...detail].filter(Boolean).join(' · ') || '—'}
                  </span>
                </span>
                {link && (
                  <span aria-hidden="true" style={{ color: theme.color.textSubtle, flex: '0 0 auto' }}>
                    <LvIcon name="chevronRight" size={18} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {section.totalCount > section.rows.length && (
        <InlineNotice theme={theme}>
          Showing {section.rows.length} of {section.totalCount}.
        </InlineNotice>
      )}
    </LvSectionCard>
  );
};

/**
 * What the route could not read this time. Shown rather than swallowed: a
 * dashboard that quietly drops a metric is worse than one that says so.
 */
export const PartialNotice = ({ theme, partial }: { theme: LvTheme; partial: string[] }) =>
  partial.length === 0 ? null : (
    <InlineNotice theme={theme} tone="warning">
      Some figures could not be read this time: {partial.join(', ')}. The rest of this page is complete.
    </InlineNotice>
  );

/** The server's own definitions, behind a disclosure so they never crowd the figures. */
export const DefinitionsCard = ({ theme, notes, generatedAt }: { theme: LvTheme; notes: string[]; generatedAt: string | null }) =>
  notes.length === 0 ? null : (
    <LvCard theme={theme}>
      <details>
        <summary style={{ ...theme.type.bodySmall, color: theme.color.brand, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
          How these figures are defined
        </summary>
        <ul style={{ margin: `${theme.space(2)}px 0 0`, paddingLeft: theme.space(4), display: 'flex', flexDirection: 'column', gap: 4 }}>
          {notes.map((note) => (
            <li key={note} style={{ ...theme.type.bodySmall, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>
              {note}
            </li>
          ))}
        </ul>
        {generatedAt && (
          <p style={{ ...theme.type.caption, color: theme.color.textSubtle, margin: `${theme.space(2)}px 0 0` }}>Read at {new Date(generatedAt).toLocaleString()}.</p>
        )}
      </details>
    </LvCard>
  );

export const RefreshAction = ({ theme, onRefresh }: { theme: LvTheme; onRefresh: () => void }) => (
  <LvButton theme={theme} variant="secondary" size="sm" onClick={onRefresh} icon={<LvIcon name="clock" size={16} />}>
    Refresh
  </LvButton>
);
