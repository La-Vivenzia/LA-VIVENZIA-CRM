import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme } from 'twenty-sdk/front-component';

import { FC_CONTROL_TOWER_ID } from 'src/constants/universal-identifiers';
import { LEAD_PRIORITIES, LEAD_STATUSES, LEAD_STATUS_LABELS } from 'src/modules/lv-core/constants/lead-lifecycle';
import { LEAD_CATEGORY_OPTIONS, LEAD_SOURCE_OPTIONS } from 'src/modules/lv-core/constants/select-options.generated';
import { layout, themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { ONBOARDING_STATUSES, ONBOARDING_STATUS_LABELS } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { SLA_STATUSES } from 'src/modules/lv-sla/constants/sla-rules';
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
import { type ControlTowerSummary } from 'src/modules/lv-dashboard/services/control-tower-summary';

// The Admin Control Tower. Every figure and every row comes from
// POST /control-tower/summary, which refuses anyone who is not an
// administrator (decided server-side from the session). Filters are sent to
// the server and re-run the aggregations; nothing is filtered in the browser.

type Summary = ControlTowerSummary & { ok: true };

type FilterState = {
  ownerIds: string[];
  unownedOnly: boolean;
  categories: string[];
  location: string;
  statuses: string[];
  priorities: string[];
  createdFrom: string;
  createdTo: string;
  slaStatuses: string[];
  onboardingStatuses: string[];
  sources: string[];
};

const EMPTY: FilterState = {
  ownerIds: [],
  unownedOnly: false,
  categories: [],
  location: '',
  statuses: [],
  priorities: [],
  createdFrom: '',
  createdTo: '',
  slaStatuses: [],
  onboardingStatuses: [],
  sources: [],
};

const toneFor = (status: string | null | undefined): Tone | undefined =>
  status === 'BREACHED' || status === 'ESCALATED' || status === 'CRITICAL' || status === 'REJECTED'
    ? 'danger'
    : status === 'DUE' || status === 'DUE_SOON' || status === 'HIGH' || status === 'NEEDS_REPLACEMENT' || status === 'EXPIRED'
      ? 'warning'
      : undefined;

const open = (target: { object: string; recordId: string } | null | undefined) => {
  if (target) {
    void navigate(AppPath.RecordShowPage, { objectNameSingular: target.object, objectRecordId: target.recordId });
  }
};

const readMulti = (select: HTMLSelectElement): string[] => Array.from(select.selectedOptions).map((option) => option.value);

export const ControlTower = () => {
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const s = useMemo(() => layout(theme), [theme]);
  const [draft, setDraft] = useState<FilterState>(EMPTY);
  const [applied, setApplied] = useState<FilterState>(EMPTY);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const load = useCallback(async (filters: FilterState) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = (await callRoute('/control-tower/summary', {
        filters: {
          ...filters,
          location: filters.location || undefined,
          createdFrom: filters.createdFrom ? new Date(filters.createdFrom).toISOString() : undefined,
          createdTo: filters.createdTo ? new Date(`${filters.createdTo}T23:59:59.999Z`).toISOString() : undefined,
        },
      })) as unknown as Summary;

      setSummary(result);
      setForbidden(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The Control Tower could not be loaded.';

      if (/administrators only/i.test(message)) {
        setForbidden(true);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(EMPTY);
  }, [load]);

  const apply = () => {
    setApplied(draft);
    void load(draft);
  };
  const reset = () => {
    setDraft(EMPTY);
    setApplied(EMPTY);
    void load(EMPTY);
  };

  const now = summary?.generatedAt ?? new Date().toISOString();
  const activeFilterCount = Object.entries(applied).filter(([, value]) => (Array.isArray(value) ? value.length > 0 : Boolean(value))).length;
  const selectStyle = { ...s.input, minHeight: 36, padding: theme.space(1), fontSize: theme.font.size.sm } as const;
  const labelStyle = { display: 'block', fontSize: theme.font.size.xs, color: theme.color.textMuted, marginBottom: 4 } as const;

  if (forbidden) {
    return (
      <div className="lv-dash" style={s.page}>
        <div style={s.container(720)}>
          <PageHeader theme={theme} title="Control Tower" subtitle="Management view of CRM health." />
          <div role="alert" style={{ ...s.card, border: `1px solid ${theme.color.warning}` }}>
            <strong style={{ display: 'block', marginBottom: theme.space(1) }}>Administrators only</strong>
            <span style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm }}>
              Your role does not include the Control Tower. Your operational view is <em>My Dashboard</em> under Work.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-dash" style={s.page}>
      <FocusStyles theme={theme} />
      <div style={s.container(1400)}>
        <PageHeader
          theme={theme}
          title="Control Tower"
          subtitle={`Management view of CRM health.${summary ? ` Updated ${formatWhen(summary.generatedAt, new Date().toISOString())}.${summary.filtered ? ' Filters applied.' : ''}` : ''}`}
          right={
            <>
              <button type="button" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} aria-controls="lv-ct-filters" style={{ ...s.button(activeFilterCount > 0 ? 'primary' : 'secondary'), minHeight: 36 }}>
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
              <button type="button" onClick={() => void load(applied)} disabled={isLoading} style={{ ...s.button('secondary'), minHeight: 36 }}>
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </>
          }
        />

        {showFilters && (
          <form
            id="lv-ct-filters"
            aria-label="Control Tower filters"
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
            style={{ ...s.card, marginBottom: theme.space(4), display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: theme.space(3) }}
          >
            <div>
              <label htmlFor="ct-owner" style={labelStyle}>Owner / team</label>
              <select id="ct-owner" multiple size={4} value={draft.ownerIds} onChange={(event) => setDraft({ ...draft, ownerIds: readMulti(event.target) })} style={selectStyle}>
                {(summary?.members ?? []).map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <label style={{ ...labelStyle, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={draft.unownedOnly} onChange={(event) => setDraft({ ...draft, unownedOnly: event.target.checked })} /> Unowned only
              </label>
            </div>
            <div>
              <label htmlFor="ct-category" style={labelStyle}>Category</label>
              <select id="ct-category" multiple size={4} value={draft.categories} onChange={(event) => setDraft({ ...draft, categories: readMulti(event.target) })} style={selectStyle}>
                {LEAD_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ct-location" style={labelStyle}>Geography (location contains)</label>
              <input id="ct-location" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="e.g. Lonavala" style={{ ...s.input, minHeight: 36 }} />
              <label htmlFor="ct-source" style={{ ...labelStyle, marginTop: 6 }}>Lead source</label>
              <select id="ct-source" multiple size={3} value={draft.sources} onChange={(event) => setDraft({ ...draft, sources: readMulti(event.target) })} style={selectStyle}>
                {LEAD_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ct-status" style={labelStyle}>Lead status</label>
              <select id="ct-status" multiple size={4} value={draft.statuses} onChange={(event) => setDraft({ ...draft, statuses: readMulti(event.target) })} style={selectStyle}>
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>{LEAD_STATUS_LABELS[status]}</option>
                ))}
              </select>
              <label htmlFor="ct-priority" style={{ ...labelStyle, marginTop: 6 }}>Priority</label>
              <select id="ct-priority" multiple size={4} value={draft.priorities} onChange={(event) => setDraft({ ...draft, priorities: readMulti(event.target) })} style={selectStyle}>
                {LEAD_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{priority.toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ct-from" style={labelStyle}>Created from</label>
              <input id="ct-from" type="date" value={draft.createdFrom} onChange={(event) => setDraft({ ...draft, createdFrom: event.target.value })} style={{ ...s.input, minHeight: 36 }} />
              <label htmlFor="ct-to" style={{ ...labelStyle, marginTop: 6 }}>Created to</label>
              <input id="ct-to" type="date" value={draft.createdTo} onChange={(event) => setDraft({ ...draft, createdTo: event.target.value })} style={{ ...s.input, minHeight: 36 }} />
            </div>
            <div>
              <label htmlFor="ct-sla" style={labelStyle}>SLA state</label>
              <select id="ct-sla" multiple size={4} value={draft.slaStatuses} onChange={(event) => setDraft({ ...draft, slaStatuses: readMulti(event.target) })} style={selectStyle}>
                {SLA_STATUSES.map((status) => (
                  <option key={status} value={status}>{status.replace('_', ' ').toLowerCase()}</option>
                ))}
              </select>
              <label htmlFor="ct-onb" style={{ ...labelStyle, marginTop: 6 }}>Onboarding state</label>
              <select id="ct-onb" multiple size={4} value={draft.onboardingStatuses} onChange={(event) => setDraft({ ...draft, onboardingStatuses: readMulti(event.target) })} style={selectStyle}>
                {ONBOARDING_STATUSES.map((status) => (
                  <option key={status} value={status}>{ONBOARDING_STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <button type="submit" style={s.button('primary')}>Apply filters</button>
              <button type="button" onClick={reset} style={s.button('secondary')}>Reset</button>
            </div>
          </form>
        )}

        {error && <ErrorState theme={theme} text={error} onRetry={() => void load(applied)} />}
        {isLoading && !summary && <LoadingState theme={theme} rows={5} />}

        {summary && (
          <>
            {summary.partial.length > 0 && (
              <p role="status" style={{ ...s.card, border: `1px solid ${theme.color.warning}`, color: theme.color.warning, marginBottom: theme.space(3) }}>
                {summary.partial[0]} Figures shown may be incomplete.
              </p>
            )}
            <div style={kpiGrid(theme)}>
              {summary.kpis.map((kpi) => (
                <KpiTile key={kpi.key} theme={theme} label={kpi.label} value={kpi.value} emptyText={kpi.emptyText} tone={kpi.tone} onClick={kpi.link ? () => void navigate(AppPath.RecordIndexPage, { objectNamePlural: `${kpi.link!.object}s` }) : undefined} />
              ))}
            </div>

            <div style={twoColumn(theme)}>
              <div style={s.stack(3)}>
                {summary.sections.map((section) => (
                  <Section key={section.key} theme={theme} title={section.title} count={section.totalCount}>
                    {section.rows.length === 0 ? (
                      <EmptyState theme={theme} text={section.emptyText} />
                    ) : (
                      <ul style={{ margin: 0, padding: 0 }}>
                        {section.rows.map((row) => {
                          const record = row as Record<string, unknown>;
                          const target = (record.target ?? null) as { object: string; recordId: string } | null;
                          const slaTarget = (record.slaTarget ?? null) as { object: string; recordId: string } | null;
                          const name = String(record.name ?? record.title ?? record.leadName ?? 'Record');
                          const secondary = [
                            record.lvLeadId,
                            record.leadName && record.leadName !== name ? record.leadName : null,
                            record.ownerName ? `owner ${record.ownerName}` : record.reviewerName ? `reviewer ${record.reviewerName}` : null,
                            record.ruleLabel ?? null,
                            record.escalationOwnerName ? `→ ${record.escalationOwnerName}` : null,
                            record.hasEmail === false && record.hasPhone === false ? 'no email · no phone' : null,
                            record.verificationState ?? null,
                          ]
                            .filter(Boolean)
                            .join(' · ');
                          const status = String(record.statusLabel ?? record.status ?? record.priority ?? '');
                          const when = (record.breachedAt ?? record.dueAt ?? record.nextFollowUpAt ?? record.updatedAt ?? record.createdAt ?? null) as string | null;
                          const whenLabel = record.breachedAt ? 'breached' : record.dueAt ? 'due' : 'updated';

                          return (
                            <RecordRow
                              key={String(record.id)}
                              theme={theme}
                              primary={name}
                              secondary={secondary || null}
                              meta={[status || null, when ? `${whenLabel} ${formatWhen(when, now)}` : null].filter(Boolean).join(' · ') || null}
                              tone={toneFor(String(record.status ?? record.priority ?? ''))}
                              onClick={target ? () => open(target) : undefined}
                              actions={
                                slaTarget ? (
                                  <button type="button" onClick={() => open(slaTarget)} aria-label={`Open SLA record for ${name}`} style={{ ...s.button('secondary'), minHeight: 32, padding: `0 ${theme.space(2)}px`, fontSize: theme.font.size.xs }}>
                                    SLA
                                  </button>
                                ) : undefined
                              }
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
                <Section theme={theme} title="SLA by state">
                  <Bars theme={theme} rows={summary.breakdown.slaByStatus} />
                </Section>
                <Section theme={theme} title="Open SLAs by rule">
                  <Bars theme={theme} rows={summary.breakdown.slaByRule} />
                </Section>
                <Section theme={theme} title="Document verification backlog">
                  <Bars theme={theme} rows={summary.breakdown.documentsByState.map((row) => ({ key: row.key, label: row.key.replace('_', ' ').toLowerCase(), count: row.count }))} />
                </Section>
                <Section theme={theme} title="Onboardings by state">
                  {summary.breakdown.onboardingByStatus.length === 0 ? (
                    <EmptyState theme={theme} text="No onboarding matches the current filters." />
                  ) : (
                    <Bars theme={theme} rows={summary.breakdown.onboardingByStatus.map((row) => ({ key: row.key, label: row.key.replace(/_/g, ' ').toLowerCase(), count: row.count }))} />
                  )}
                </Section>
                <Section theme={theme} title="Leads by status">
                  {summary.breakdown.leadsByStatus.length === 0 ? (
                    <EmptyState theme={theme} text="No lead matches the current filters." />
                  ) : (
                    <Bars theme={theme} rows={summary.breakdown.leadsByStatus} />
                  )}
                </Section>
                <Section theme={theme} title="Contact data (informational)">
                  <div style={{ ...kpiGrid(theme), gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 0 }}>
                    {summary.contactBreakdown.map((kpi) => (
                      <KpiTile key={kpi.key} theme={theme} label={kpi.label} value={kpi.value} emptyText={kpi.emptyText} tone={kpi.tone} />
                    ))}
                  </div>
                </Section>
                <Section theme={theme} title="11 · Notification health">
                  <div style={{ ...kpiGrid(theme), gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 0 }}>
                    {summary.notificationHealth.map((kpi) => (
                      <KpiTile key={kpi.key} theme={theme} label={kpi.label} value={kpi.value} emptyText={kpi.emptyText} tone={kpi.tone} />
                    ))}
                  </div>
                </Section>
                <Section theme={theme} title="12 · System health" hint="real signals only">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.sm }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ textAlign: 'left', padding: '6px 4px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.textMuted, fontWeight: theme.font.weight.medium }}>Indicator</th>
                        <th scope="col" style={{ textAlign: 'right', padding: '6px 4px', borderBottom: `1px solid ${theme.color.border}`, color: theme.color.textMuted, fontWeight: theme.font.weight.medium }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.systemHealth.map((row) => (
                        <tr key={row.key}>
                          <td style={{ padding: '6px 4px', borderBottom: `1px solid ${theme.color.border}` }}>
                            {row.label}
                            <span style={{ display: 'block', fontSize: theme.font.size.xs, color: theme.color.textMuted }}>{row.detail}</span>
                          </td>
                          <td style={{ padding: '6px 4px', borderBottom: `1px solid ${theme.color.border}`, textAlign: 'right', fontFamily: theme.font.mono, whiteSpace: 'nowrap' }}>
                            {row.value === null ? '—' : typeof row.value === 'string' && row.value.includes('T') ? formatWhen(row.value, now) : String(row.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
                <div>
                  <button type="button" onClick={() => setShowNotes((value) => !value)} aria-expanded={showNotes} style={{ ...s.button('secondary'), minHeight: 36 }}>
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
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_CONTROL_TOWER_ID,
  name: 'lv-control-tower',
  description: 'Admin Control Tower: unowned leads, overdue follow-ups, SLA breaches, stuck records, approvals, document backlog, notification and system health, with server-side filters',
  component: ControlTower,
});
