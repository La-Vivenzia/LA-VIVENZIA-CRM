import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme } from 'twenty-sdk/front-component';

import { FC_MY_DASHBOARD_ID } from 'src/constants/universal-identifiers';
import { layout, themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import {
  Bars,
  EmptyState,
  ErrorState,
  FocusStyles,
  formatWhen,
  KpiTile,
  kpiGrid,
  LoadingState,
  PageHeader,
  RecordRow,
  Section,
  twoColumn,
  type Tone,
} from 'src/modules/lv-dashboard/front-components/dashboard-kit';
import { type DashboardLens } from 'src/modules/lv-dashboard/services/caller-context';
import { type DashboardSummary } from 'src/modules/lv-dashboard/services/dashboard-summary';

// "My Dashboard" — the operational workspace for whoever is signed in.
//
// The server decides the lens from the caller's permissions and computes
// every figure under CM-004; this component only renders what it is given
// and lets the user switch between the lenses the server says they may use.
// Nothing is counted in the browser.

const LENS_TITLE: Record<DashboardLens, { title: string; subtitle: string }> = {
  HUNTER: { title: 'Experience Hunter', subtitle: 'Discover, qualify and progress your leads.' },
  COORDINATOR: { title: 'Lead Coordinator', subtitle: 'Follow-ups, conversations and conversions.' },
  ONBOARDING: { title: 'Onboarding Expert', subtitle: 'Move partners through onboarding and verification.' },
  ADMIN: { title: 'Administration', subtitle: 'Everything, at a glance. The Control Tower has the detail.' },
  OVERSIGHT: { title: 'Oversight', subtitle: 'Read-only view of the pipeline your role can see.' },
};

const LENS_LABEL: Record<DashboardLens, string> = {
  HUNTER: 'Hunter',
  COORDINATOR: 'Coordinator',
  ONBOARDING: 'Onboarding',
  ADMIN: 'Admin',
  OVERSIGHT: 'Oversight',
};

type Summary = DashboardSummary & { ok: true; capabilities: { isAdmin: boolean; controlTower: boolean } };

const toneFor = (status: string | null | undefined): Tone | undefined =>
  status === 'BREACHED' || status === 'ESCALATED' || status === 'CRITICAL'
    ? 'danger'
    : status === 'DUE' || status === 'DUE_SOON' || status === 'HIGH'
      ? 'warning'
      : undefined;

const open = (target: { object: string; recordId: string } | null | undefined) => {
  if (target) {
    void navigate(AppPath.RecordShowPage, { objectNameSingular: target.object, objectRecordId: target.recordId });
  }
};

export const MyDashboard = () => {
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const s = useMemo(() => layout(theme), [theme]);
  const [lens, setLens] = useState<DashboardLens | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const load = useCallback(async (requested: DashboardLens | null) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = (await callRoute('/dashboard/summary', {
        lens: requested ?? undefined,
        timeZoneOffsetMinutes: -new Date().getTimezoneOffset(),
      })) as unknown as Summary;

      setSummary(result);
      setLens(result.lens);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The dashboard could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  const now = summary?.generatedAt ?? new Date().toISOString();
  const heading = LENS_TITLE[lens ?? 'HUNTER'];

  return (
    <div className="lv-dash" style={s.page}>
      <FocusStyles theme={theme} />
      <div style={s.container(1280)}>
        <PageHeader
          theme={theme}
          title={`My Dashboard · ${heading.title}`}
          subtitle={`${heading.subtitle}${summary ? ` Updated ${formatWhen(summary.generatedAt, new Date().toISOString())}.` : ''}`}
          right={
            <>
              {summary && summary.availableLenses.length > 1 && (
                <div role="tablist" aria-label="Dashboard view" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {summary.availableLenses.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="tab"
                      aria-selected={option === lens}
                      onClick={() => void load(option)}
                      style={{
                        ...s.button(option === lens ? 'primary' : 'secondary'),
                        minHeight: 36,
                        padding: `${theme.space(1)}px ${theme.space(3)}px`,
                      }}
                    >
                      {LENS_LABEL[option]}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => void load(lens)} disabled={isLoading} style={{ ...s.button('secondary'), minHeight: 36 }}>
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </>
          }
        />

        {error && <ErrorState theme={theme} text={error} onRetry={() => void load(lens)} />}
        {isLoading && !summary && <LoadingState theme={theme} rows={4} />}

        {summary && (
          <>
            {summary.partial.length > 0 && (
              <p role="status" style={{ ...s.card, border: `1px solid ${theme.color.warning}`, color: theme.color.warning, marginBottom: theme.space(3) }}>
                {summary.partial[0]} Figures shown may be incomplete.
              </p>
            )}

            <div style={kpiGrid(theme)}>
              {summary.kpis.map((kpi) => (
                <KpiTile
                  key={kpi.key}
                  theme={theme}
                  label={kpi.label}
                  value={kpi.value}
                  emptyText={kpi.emptyText}
                  unavailableReason={kpi.unavailableReason}
                  tone={kpi.tone}
                  onClick={kpi.link ? () => void navigate(AppPath.RecordIndexPage, { objectNamePlural: `${kpi.link!.object}s` }) : undefined}
                />
              ))}
            </div>

            <div style={twoColumn(theme)}>
              <div style={s.stack(3)}>
                {summary.actions.map((section) => (
                  <Section key={section.key} theme={theme} title={section.title} count={section.totalCount}>
                    {section.rows.length === 0 ? (
                      <EmptyState theme={theme} text={section.emptyText} />
                    ) : (
                      <ul style={{ margin: 0, padding: 0 }}>
                        {section.rows.map((row) => {
                          const record = row as Record<string, unknown>;
                          const target = (record.target ?? null) as { object: string; recordId: string } | null;
                          const name = String(record.name ?? record.title ?? record.leadName ?? 'Record');
                          const secondary = [record.lvLeadId, record.leadName && record.leadName !== name ? record.leadName : null, record.ruleLabel ?? null, record.channel ?? null, record.verificationState ?? null]
                            .filter(Boolean)
                            .join(' · ');
                          const status = String(record.status ?? record.priority ?? '');
                          const when = (record.dueAt ?? record.nextFollowUpAt ?? record.since ?? record.updatedAt ?? null) as string | null;

                          return (
                            <RecordRow
                              key={String(record.id)}
                              theme={theme}
                              primary={name}
                              secondary={secondary || null}
                              meta={[status || null, when ? formatWhen(when, now) : null].filter(Boolean).join(' · ') || null}
                              tone={toneFor(status)}
                              onClick={target ? () => open(target) : undefined}
                            />
                          );
                        })}
                        {section.totalCount > section.rows.length && (
                          <li style={{ listStyle: 'none', padding: `${theme.space(2)}px 0`, fontSize: theme.font.size.xs, color: theme.color.textMuted }}>
                            Showing {section.rows.length} of {section.totalCount}.
                          </li>
                        )}
                      </ul>
                    )}
                  </Section>
                ))}
              </div>

              <div style={s.stack(3)}>
                {lens !== 'ONBOARDING' && (
                  <Section theme={theme} title="Pipeline" hint="leads by lifecycle status">
                    <Bars theme={theme} rows={summary.pipeline} />
                    {summary.inactive.some((row) => row.count > 0) && (
                      <details style={{ marginTop: theme.space(2) }}>
                        <summary style={{ cursor: 'pointer', fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
                          Inactive states ({summary.inactive.reduce((sum, row) => sum + row.count, 0)})
                        </summary>
                        <div style={{ marginTop: theme.space(2) }}>
                          <Bars theme={theme} rows={summary.inactive.filter((row) => row.count > 0)} />
                        </div>
                      </details>
                    )}
                  </Section>
                )}
                {lens === 'COORDINATOR' && (
                  <>
                    <Section theme={theme} title="Conversion pipeline">
                      <Bars theme={theme} rows={summary.conversion} />
                    </Section>
                    <Section theme={theme} title="Communication activity" hint="last 30 days">
                      <Bars theme={theme} rows={summary.channels.map((row) => ({ key: row.channel, label: row.channel.toLowerCase().replace('_', ' '), count: row.count }))} />
                    </Section>
                  </>
                )}
                {lens === 'ONBOARDING' && summary.health.length > 0 && (
                  <Section theme={theme} title="Onboarding health" hint="derived from documents, SLAs and activity">
                    <Bars theme={theme} rows={summary.health.map((row) => ({ key: row.state, label: row.state.replace('_', ' ').toLowerCase(), count: row.count }))} />
                  </Section>
                )}
                <Section theme={theme} title={lens === 'ONBOARDING' ? 'Document queue' : lens === 'COORDINATOR' ? 'Response / stuck' : 'Lead quality'}>
                  <div style={{ ...kpiGrid(theme), gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 0 }}>
                    {summary.quality.map((kpi) => (
                      <KpiTile key={kpi.key} theme={theme} label={kpi.label} value={kpi.value} emptyText={kpi.emptyText} unavailableReason={kpi.unavailableReason} tone={kpi.tone} />
                    ))}
                  </div>
                </Section>
                <Section theme={theme} title="Recent activity" hint="last 14 days">
                  {summary.activity.length === 0 ? (
                    <EmptyState theme={theme} text="Nothing has happened in the last 14 days on the records you can see." />
                  ) : (
                    <ul style={{ margin: 0, padding: 0 }}>
                      {summary.activity.map((item, index) => (
                        <RecordRow
                          key={`${item.kind}-${index}`}
                          theme={theme}
                          primary={item.title}
                          secondary={[item.kind.toLowerCase().replace('_', ' '), item.detail].filter(Boolean).join(' · ')}
                          meta={formatWhen(item.at, now)}
                          onClick={item.target ? () => open(item.target) : undefined}
                        />
                      ))}
                    </ul>
                  )}
                </Section>
                {summary.notes.length > 0 && (
                  <div>
                    <button type="button" onClick={() => setShowNotes((value) => !value)} style={{ ...s.button('secondary'), minHeight: 36 }} aria-expanded={showNotes}>
                      {showNotes ? 'Hide definitions' : 'How are these calculated?'}
                    </button>
                    {showNotes && (
                      <ul style={{ margin: `${theme.space(2)}px 0 0`, paddingLeft: 18, color: theme.color.textMuted, fontSize: theme.font.size.sm }}>
                        {summary.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_MY_DASHBOARD_ID,
  name: 'lv-my-dashboard',
  description: 'Role-aware operational dashboard for Experience Hunters, Lead Coordinators, Onboarding Experts and administrators',
  component: MyDashboard,
});
