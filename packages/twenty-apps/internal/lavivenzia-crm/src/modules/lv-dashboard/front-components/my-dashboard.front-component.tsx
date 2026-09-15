import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme } from 'twenty-sdk/front-component';

import { FC_MY_DASHBOARD_ID } from 'src/constants/universal-identifiers';
import {
  AttentionItem,
  Bars,
  EmptyState,
  ErrorState,
  Eyebrow,
  formatWhen,
  InlineNotice,
  KpiTile,
  LvBadge,
  LvButton,
  LvCard,
  LvPage,
  LvStatusBadge,
  LoadingState,
  PageHeader,
  RecordList,
  RecordRow,
  Section,
  Segmented,
  type Tone,
} from 'src/modules/lv-core/ui/kit';
import { badgeToneOf, describeStatus, type StatusKind } from 'src/modules/lv-core/ui/status';
import { themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { type DashboardLens } from 'src/modules/lv-dashboard/services/caller-context';
import { type DashboardSummary } from 'src/modules/lv-dashboard/services/dashboard-summary';

// "My Dashboard" — the operational workspace for whoever is signed in.
//
// The server decides the lens from the caller's permissions and computes
// every figure under CM-004; this component only renders what it is given
// and lets the user switch between the lenses the server says they may use.
// Nothing is counted in the browser.
//
// Layout, top to bottom: what needs attention right now (the reason the page
// exists), the day's figures, then the work lists and the analytics.

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

// Which vocabulary a section's rows speak, so the badge reads the right map.
export const kindForSection = (key: string): StatusKind =>
  /overdue|dueToday|dueSoon|task/i.test(key)
    ? 'task'
    : /sla|firstContact|breached/i.test(key)
      ? 'sla'
      : /document|verification/i.test(key)
        ? 'document'
        : /onboarding|stuck/i.test(key)
          ? 'onboarding'
          : 'lead';

// Sections whose contents are urgent by definition; they feed the attention
// panel at the top of the page.
export const URGENT_SECTION = /overdue|breached|firstContact|dueToday|stuck|rejected|expired/i;

const open = (target: { object: string; recordId: string } | null | undefined) => {
  if (target) {
    void navigate(AppPath.RecordShowPage, { objectNameSingular: target.object, objectRecordId: target.recordId });
  }
};

const rowFacts = (record: Record<string, unknown>) => {
  const name = String(record.name ?? record.title ?? record.leadName ?? 'Record');
  const secondary = [record.lvLeadId, record.leadName && record.leadName !== name ? record.leadName : null, record.ruleLabel ?? null, record.channel ?? null]
    .filter(Boolean)
    .join(' · ');
  const status = (record.status ?? null) as string | null;
  const priority = (record.priority ?? null) as string | null;
  const verification = (record.verificationState ?? null) as string | null;
  const when = (record.dueAt ?? record.nextFollowUpAt ?? record.since ?? record.updatedAt ?? null) as string | null;
  const target = (record.target ?? null) as { object: string; recordId: string } | null;

  return { name, secondary, status, priority, verification, when, target };
};

export const MyDashboard = () => {
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
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

  // The attention panel: urgent sections with something in them.
  const urgent = useMemo(() => (summary ? summary.actions.filter((section) => URGENT_SECTION.test(section.key) && section.totalCount > 0) : []), [summary]);
  const urgentTotal = urgent.reduce((sum, section) => sum + section.totalCount, 0);

  return (
    <LvPage theme={theme} maxWidth={1280}>
      <PageHeader
        theme={theme}
        eyebrow="My Dashboard"
        title={heading.title}
        subtitle={`${heading.subtitle}${summary ? ` Updated ${formatWhen(summary.generatedAt, new Date().toISOString())}.` : ''}`}
        right={
          <>
            {summary && summary.availableLenses.length > 1 && (
              <Segmented theme={theme} label="Dashboard view" value={lens ?? summary.lens} onChange={(key) => void load(key as DashboardLens)} options={summary.availableLenses.map((option) => ({ key: option, label: LENS_LABEL[option] }))} />
            )}
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => void load(lens)} disabled={isLoading} busy={isLoading && summary !== null}>
              Refresh
            </LvButton>
          </>
        }
      />

      {error && <ErrorState theme={theme} text={error} onRetry={() => void load(lens)} />}
      {isLoading && !summary && <LoadingState theme={theme} rows={4} label="Loading dashboard" />}

      {summary && (
        <div className="lv-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
          {summary.partial.length > 0 && (
            <InlineNotice theme={theme} tone="warning">
              {summary.partial[0]} Figures shown may be incomplete.
            </InlineNotice>
          )}

          {/* Needs attention — first, always. */}
          <LvCard theme={theme} as="section" ariaLabel="Needs attention" tone={urgentTotal > 0 ? 'danger' : 'success'} padding={theme.space(3)}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.space(2), marginBottom: urgentTotal > 0 ? theme.space(2) : 0 }}>
              <div>
                <Eyebrow theme={theme} tone={urgentTotal > 0 ? 'danger' : 'success'}>
                  {urgentTotal > 0 ? 'Needs attention now' : 'All clear'}
                </Eyebrow>
                <h2 style={{ ...theme.type.title, margin: `${theme.space(1)}px 0 0`, color: theme.color.heading }}>
                  {urgentTotal > 0 ? `${urgentTotal} ${urgentTotal === 1 ? 'item needs' : 'items need'} action` : 'Nothing is overdue or breached'}
                </h2>
              </div>
              {urgentTotal > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {urgent.map((section) => (
                    <LvBadge key={section.key} theme={theme} tone="danger">
                      {section.totalCount} {section.title.toLowerCase()}
                    </LvBadge>
                  ))}
                </div>
              )}
            </div>
            {urgentTotal > 0 && (
              <ul style={{ margin: 0, padding: 0, display: 'grid', gap: theme.space(2) }}>
                {urgent
                  .flatMap((section) => section.rows.slice(0, 2).map((row) => ({ section, row: row as Record<string, unknown> })))
                  .slice(0, 5)
                  .map(({ section, row }) => {
                    const facts = rowFacts(row);
                    const tone = badgeToneOf(describeStatus(kindForSection(section.key), facts.status).tone);

                    return (
                      <AttentionItem
                        key={`${section.key}-${String(row.id)}`}
                        theme={theme}
                        tone={tone === 'neutral' || tone === 'info' ? 'warning' : tone}
                        title={facts.name}
                        detail={[section.title, facts.secondary].filter(Boolean).join(' · ')}
                        meta={facts.when ? formatWhen(facts.when, now) : null}
                        onClick={facts.target ? () => open(facts.target) : undefined}
                      />
                    );
                  })}
              </ul>
            )}
          </LvCard>

          <div className="lv-kpi-grid">
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

          <div className="lv-two-col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              {summary.actions.map((section) => {
                const kind = kindForSection(section.key);

                return (
                  <Section key={section.key} theme={theme} title={section.title} count={section.totalCount} countTone={section.totalCount > 0 && URGENT_SECTION.test(section.key) ? 'danger' : undefined}>
                    {section.rows.length === 0 ? (
                      <EmptyState theme={theme} text={section.emptyText} />
                    ) : (
                      <RecordList>
                        {section.rows.map((row) => {
                          const record = row as Record<string, unknown>;
                          const facts = rowFacts(record);
                          const statusValue = facts.verification ?? facts.status;
                          const statusKind: StatusKind = facts.verification ? 'document' : kind;
                          const badgeTone = badgeToneOf(describeStatus(statusKind, statusValue).tone);
                          const tone: Tone | undefined = badgeTone === 'neutral' ? undefined : badgeTone;

                          return (
                            <RecordRow
                              key={String(record.id)}
                              theme={theme}
                              primary={facts.name}
                              secondary={facts.secondary || null}
                              badge={
                                <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                                  {statusValue && <LvStatusBadge theme={theme} kind={statusKind} value={statusValue} />}
                                  {facts.priority && <LvStatusBadge theme={theme} kind="priority" value={facts.priority} />}
                                </span>
                              }
                              meta={facts.when ? formatWhen(facts.when, now) : null}
                              tone={tone}
                              onClick={facts.target ? () => open(facts.target) : undefined}
                            />
                          );
                        })}
                        {section.totalCount > section.rows.length && (
                          <li style={{ ...theme.type.caption, listStyle: 'none', padding: `${theme.space(2)}px 0`, color: theme.color.textMuted }}>
                            Showing {section.rows.length} of {section.totalCount}.
                          </li>
                        )}
                      </RecordList>
                    )}
                  </Section>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              {lens !== 'ONBOARDING' && (
                <Section theme={theme} title="Pipeline" hint="leads by lifecycle status">
                  <Bars theme={theme} rows={summary.pipeline} />
                  {summary.inactive.some((row) => row.count > 0) && (
                    <details style={{ marginTop: theme.space(2) }}>
                      <summary style={{ ...theme.type.bodySmall, cursor: 'pointer', color: theme.color.textMuted }}>
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
                  <Bars theme={theme} rows={summary.health.map((row) => ({ key: row.state, label: row.state.replace('_', ' ').toLowerCase(), count: row.count, tone: row.state === 'BLOCKED' ? 'danger' : row.state === 'NEEDS_ATTENTION' ? 'warning' : 'success' }))} />
                </Section>
              )}
              <Section theme={theme} title={lens === 'ONBOARDING' ? 'Document queue' : lens === 'COORDINATOR' ? 'Response / stuck' : 'Lead quality'}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: theme.space(2) }}>
                  {summary.quality.map((kpi) => (
                    <KpiTile key={kpi.key} theme={theme} label={kpi.label} value={kpi.value} emptyText={kpi.emptyText} unavailableReason={kpi.unavailableReason} tone={kpi.tone} />
                  ))}
                </div>
              </Section>
              <Section theme={theme} title="Recent activity" hint="last 14 days">
                {summary.activity.length === 0 ? (
                  <EmptyState theme={theme} text="Nothing has happened in the last 14 days on the records you can see." />
                ) : (
                  <RecordList>
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
                  </RecordList>
                )}
              </Section>
              {summary.notes.length > 0 && (
                <div>
                  <LvButton theme={theme} variant="ghost" size="sm" onClick={() => setShowNotes((value) => !value)}>
                    {showNotes ? 'Hide definitions' : 'How are these calculated?'}
                  </LvButton>
                  {showNotes && (
                    <ul style={{ ...theme.type.bodySmall, margin: `${theme.space(2)}px 0 0`, paddingLeft: 18, color: theme.color.textMuted }}>
                      {summary.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </LvPage>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_MY_DASHBOARD_ID,
  name: 'lv-my-dashboard',
  description: 'Role-aware operational dashboard for Experience Hunters, Lead Coordinators, Onboarding Experts and administrators',
  component: MyDashboard,
});
