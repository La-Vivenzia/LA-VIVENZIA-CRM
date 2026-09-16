import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme } from 'twenty-sdk/front-component';

import { FC_CONTROL_TOWER_ID } from 'src/constants/universal-identifiers';
import { LEAD_PRIORITIES, LEAD_PRIORITY_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS } from 'src/modules/lv-core/constants/lead-lifecycle';
import { LEAD_CATEGORY_OPTIONS, LEAD_SOURCE_OPTIONS } from 'src/modules/lv-core/constants/select-options.generated';
import {
  Bars,
  EmptyState,
  ErrorState,
  Eyebrow,
  Field,
  ForbiddenState,
  formatWhen,
  InlineNotice,
  KpiTile,
  LvBadge,
  LvButton,
  LvCard,
  LvInput,
  LvPage,
  LvSelect,
  LvStatusBadge,
  LoadingState,
  PageHeader,
  RecordList,
  RecordRow,
  Section,
  type Tone,
} from 'src/modules/lv-core/ui/kit';
import { badgeToneOf, describeStatus, type StatusKind } from 'src/modules/lv-core/ui/status';
import { themeFor } from 'src/modules/lv-core/ui/theme';
import { pluralOf } from 'src/modules/lv-core/utils/object-plural';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { type ControlTowerSummary } from 'src/modules/lv-dashboard/services/control-tower-summary';
import { ONBOARDING_STATUSES, ONBOARDING_STATUS_LABELS } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { SLA_STATUSES } from 'src/modules/lv-sla/constants/sla-rules';

// The Admin Control Tower. Every figure and every row comes from
// POST /control-tower/summary, which refuses anyone who is not an
// administrator (decided server-side from the session). Filters are sent to
// the server and re-run the aggregations; nothing is filtered in the browser.
//
// The page is organised by how urgently a manager must act, not by the order
// the metrics were specified: Critical → Needs attention → Operational flow
// → Quality → System health. The original numbering stays in the section
// titles so the metric definitions in DAY_5_DASHBOARDS.md still line up.

type Summary = ControlTowerSummary & { ok: true };
type SummarySection = Summary['sections'][number];

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

// Section keys → the group they belong to.
export const CONTROL_TOWER_GROUPS: { key: string; title: string; eyebrow: string; tone: Tone; sections: string[] }[] = [
  { key: 'critical', title: 'Critical', eyebrow: 'Act today', tone: 'danger', sections: ['breached', 'onboardingBreached', 'overdue', 'unowned'] },
  { key: 'attention', title: 'Needs attention', eyebrow: 'This week', tone: 'warning', sections: ['hot', 'stuck', 'stuckOnboardings', 'approvals'] },
  { key: 'flow', title: 'Operational flow', eyebrow: 'Keep moving', tone: 'info', sections: ['backlog'] },
  { key: 'quality', title: 'Quality', eyebrow: 'Data hygiene', tone: 'neutral', sections: ['noContact', 'markedDuplicates', 'flaggedDuplicates'] },
  // Day 9 — the ecosystem backlog: approvals, activations, expired papers, unowned partners.
  { key: 'ecosystem', title: 'Ecosystem', eyebrow: 'Partners · experiences · properties', tone: 'info', sections: ['partnerApprovalBacklog', 'experienceApprovalBacklog', 'propertyApprovalBacklog', 'expiredDocuments', 'unownedPartners'] },
];

const toBadgeTone = (tone: Tone) => badgeToneOf(tone === 'danger' ? 'critical' : tone === 'warning' ? 'caution' : tone === 'info' ? 'progress' : tone === 'success' ? 'positive' : 'neutral');

const kindForSection = (key: string): StatusKind =>
  /partner/i.test(key) ? 'partner' : /experience|property/i.test(key) ? 'listing' : /breached|sla/i.test(key) ? 'sla' : /overdue/i.test(key) ? 'task' : /backlog|document/i.test(key) ? 'document' : /onboarding|approvals/i.test(key) ? 'onboarding' : 'lead';

const open = (target: { object: string; recordId: string } | null | undefined) => {
  if (target) {
    void navigate(AppPath.RecordShowPage, { objectNameSingular: target.object, objectRecordId: target.recordId });
  }
};

const readMulti = (select: HTMLSelectElement): string[] => Array.from(select.selectedOptions).map((option) => option.value);

export const ControlTower = () => {
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
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
  const sectionsByKey = useMemo(() => new Map<string, SummarySection>([...(summary?.sections ?? []), ...(summary?.ecosystem?.sections ?? [])].map((section) => [section.key, section])), [summary]);
  const groups = useMemo(
    () =>
      CONTROL_TOWER_GROUPS.map((group) => {
        const sections = group.sections.map((key) => sectionsByKey.get(key)).filter((section): section is SummarySection => Boolean(section));

        return { ...group, sections, total: sections.reduce((sum, section) => sum + section.totalCount, 0) };
      }),
    [sectionsByKey],
  );
  // Anything the server sends that the groups above do not know goes last.
  const ungrouped = (summary?.sections ?? []).filter((section) => !CONTROL_TOWER_GROUPS.some((group) => group.sections.includes(section.key)));
  const criticalTotal = groups.find((group) => group.key === 'critical')?.total ?? 0;
  const attentionTotal = groups.find((group) => group.key === 'attention')?.total ?? 0;
  const headlineTone: Tone = criticalTotal > 0 ? 'danger' : attentionTotal > 0 ? 'warning' : 'success';
  const multiSelectStyle = { minHeight: 'auto', padding: theme.space(1) } as const;

  if (forbidden) {
    return (
      <LvPage theme={theme} maxWidth={720}>
        <PageHeader theme={theme} eyebrow="Insights" title="Control Tower" subtitle="Management view of CRM health." />
        <ForbiddenState theme={theme} title="Administrators only" text="Your role does not include the Control Tower. Your operational view is My Dashboard, under Workspace." />
      </LvPage>
    );
  }

  const renderSection = (section: SummarySection, tone: Tone): ReactNode => {
    const kind = kindForSection(section.key);

    return (
      <Section key={section.key} theme={theme} title={section.title} count={section.totalCount} countTone={section.totalCount > 0 && tone !== 'neutral' ? toBadgeTone(tone) : undefined}>
        {section.rows.length === 0 ? (
          <EmptyState theme={theme} text={section.emptyText} />
        ) : (
          <RecordList>
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
              ]
                .filter(Boolean)
                .join(' · ');
              const statusValue = (record.verificationState ?? record.status ?? null) as string | null;
              const statusKind: StatusKind = record.verificationState ? 'document' : kind;
              const priority = (record.priority ?? null) as string | null;
              const when = (record.breachedAt ?? record.dueAt ?? record.nextFollowUpAt ?? record.updatedAt ?? record.createdAt ?? null) as string | null;
              const whenLabel = record.breachedAt ? 'breached' : record.dueAt ? 'due' : 'updated';
              const rowTone = badgeToneOf(describeStatus(statusKind, statusValue).tone);

              return (
                <RecordRow
                  key={String(record.id)}
                  theme={theme}
                  primary={name}
                  secondary={secondary || null}
                  badge={
                    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                      {statusValue && <LvStatusBadge theme={theme} kind={statusKind} value={statusValue} />}
                      {priority && <LvStatusBadge theme={theme} kind="priority" value={priority} />}
                    </span>
                  }
                  meta={when ? `${whenLabel} ${formatWhen(when, now)}` : null}
                  tone={rowTone === 'neutral' ? undefined : rowTone}
                  onClick={target ? () => open(target) : undefined}
                  actions={
                    slaTarget ? (
                      <LvButton theme={theme} variant="ghost" size="sm" onClick={() => open(slaTarget)} ariaLabel={`Open SLA record for ${name}`}>
                        SLA
                      </LvButton>
                    ) : undefined
                  }
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
  };

  const kpiRow = (kpis: Summary['kpis']) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: theme.space(2) }}>
      {kpis.map((kpi) => (
        <KpiTile key={kpi.key} theme={theme} label={kpi.label} value={kpi.value} emptyText={kpi.emptyText} tone={kpi.tone} />
      ))}
    </div>
  );

  const barsFor = (kind: StatusKind, rows: { key: string; count: number; label?: string }[]) =>
    rows.map((row) => {
      const described = describeStatus(kind, row.key);
      const tone = badgeToneOf(described.tone);

      return { key: row.key, label: described.label, count: row.count, tone: tone === 'neutral' ? undefined : tone };
    });

  return (
    <LvPage theme={theme} maxWidth={1400}>
      <PageHeader
        theme={theme}
        eyebrow="Insights"
        title="Control Tower"
        subtitle={`Management view of CRM health.${summary ? ` Updated ${formatWhen(summary.generatedAt, new Date().toISOString())}.${summary.filtered ? ' Filters applied.' : ''}` : ''}`}
        right={
          <>
            <LvButton theme={theme} variant={activeFilterCount > 0 ? 'primary' : 'secondary'} size="sm" onClick={() => setShowFilters((value) => !value)} title={showFilters ? 'Hide filters' : 'Show filters'}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </LvButton>
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => void load(applied)} disabled={isLoading} busy={isLoading && summary !== null}>
              Refresh
            </LvButton>
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
          style={{ marginBottom: theme.space(4) }}
        >
          <LvCard theme={theme} padding={theme.space(3)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: theme.space(3) }}>
              <Field theme={theme} label="Owner / team" htmlFor="ct-owner">
                <LvSelect theme={theme} id="ct-owner" multiple size={4} value={draft.ownerIds} onChange={(event) => setDraft({ ...draft, ownerIds: readMulti(event.target) })} style={multiSelectStyle}>
                  {(summary?.members ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </LvSelect>
                <label style={{ ...theme.type.bodySmall, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: theme.color.textMuted }}>
                  <input type="checkbox" checked={draft.unownedOnly} onChange={(event) => setDraft({ ...draft, unownedOnly: event.target.checked })} /> Unowned only
                </label>
              </Field>
              <Field theme={theme} label="Category" htmlFor="ct-category">
                <LvSelect theme={theme} id="ct-category" multiple size={4} value={draft.categories} onChange={(event) => setDraft({ ...draft, categories: readMulti(event.target) })} style={multiSelectStyle}>
                  {LEAD_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </LvSelect>
              </Field>
              <div style={{ display: 'grid', gap: theme.space(2) }}>
                <Field theme={theme} label="Geography (location contains)" htmlFor="ct-location">
                  <LvInput theme={theme} id="ct-location" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="e.g. Lonavala" />
                </Field>
                <Field theme={theme} label="Lead source" htmlFor="ct-source">
                  <LvSelect theme={theme} id="ct-source" multiple size={3} value={draft.sources} onChange={(event) => setDraft({ ...draft, sources: readMulti(event.target) })} style={multiSelectStyle}>
                    {LEAD_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </LvSelect>
                </Field>
              </div>
              <div style={{ display: 'grid', gap: theme.space(2) }}>
                <Field theme={theme} label="Lead status" htmlFor="ct-status">
                  <LvSelect theme={theme} id="ct-status" multiple size={4} value={draft.statuses} onChange={(event) => setDraft({ ...draft, statuses: readMulti(event.target) })} style={multiSelectStyle}>
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {LEAD_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </LvSelect>
                </Field>
                <Field theme={theme} label="Priority" htmlFor="ct-priority">
                  <LvSelect theme={theme} id="ct-priority" multiple size={4} value={draft.priorities} onChange={(event) => setDraft({ ...draft, priorities: readMulti(event.target) })} style={multiSelectStyle}>
                    {LEAD_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {LEAD_PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </LvSelect>
                </Field>
              </div>
              <div style={{ display: 'grid', gap: theme.space(2) }}>
                <Field theme={theme} label="Created from" htmlFor="ct-from">
                  <LvInput theme={theme} id="ct-from" type="date" value={draft.createdFrom} onChange={(event) => setDraft({ ...draft, createdFrom: event.target.value })} />
                </Field>
                <Field theme={theme} label="Created to" htmlFor="ct-to">
                  <LvInput theme={theme} id="ct-to" type="date" value={draft.createdTo} onChange={(event) => setDraft({ ...draft, createdTo: event.target.value })} />
                </Field>
              </div>
              <div style={{ display: 'grid', gap: theme.space(2) }}>
                <Field theme={theme} label="SLA state" htmlFor="ct-sla">
                  <LvSelect theme={theme} id="ct-sla" multiple size={4} value={draft.slaStatuses} onChange={(event) => setDraft({ ...draft, slaStatuses: readMulti(event.target) })} style={multiSelectStyle}>
                    {SLA_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {describeStatus('sla', status).label}
                      </option>
                    ))}
                  </LvSelect>
                </Field>
                <Field theme={theme} label="Onboarding state" htmlFor="ct-onb">
                  <LvSelect theme={theme} id="ct-onb" multiple size={4} value={draft.onboardingStatuses} onChange={(event) => setDraft({ ...draft, onboardingStatuses: readMulti(event.target) })} style={multiSelectStyle}>
                    {ONBOARDING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {ONBOARDING_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </LvSelect>
                </Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: theme.space(2), marginTop: theme.space(3), flexWrap: 'wrap' }}>
              <LvButton theme={theme} type="submit" variant="primary">
                Apply filters
              </LvButton>
              <LvButton theme={theme} variant="secondary" onClick={reset}>
                Reset
              </LvButton>
            </div>
          </LvCard>
        </form>
      )}

      {error && <ErrorState theme={theme} text={error} onRetry={() => void load(applied)} />}
      {isLoading && !summary && <LoadingState theme={theme} rows={5} label="Loading Control Tower" />}

      {summary && (
        <div className="lv-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
          {summary.partial.length > 0 && (
            <InlineNotice theme={theme} tone="warning">
              {summary.partial[0]} Figures shown may be incomplete.
            </InlineNotice>
          )}

          {/* Headline: the one line a manager reads first. */}
          <LvCard theme={theme} as="section" ariaLabel="Health headline" tone={headlineTone} padding={theme.space(3)}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(3), alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div>
                <Eyebrow theme={theme} tone={headlineTone}>
                  {criticalTotal > 0 ? 'Critical' : attentionTotal > 0 ? 'Needs attention' : 'Healthy'}
                </Eyebrow>
                <h2 style={{ ...theme.type.title, margin: `${theme.space(1)}px 0 0`, color: theme.color.heading }}>
                  {criticalTotal > 0
                    ? `${criticalTotal} critical ${criticalTotal === 1 ? 'item' : 'items'} across the pipeline`
                    : attentionTotal > 0
                      ? `${attentionTotal} ${attentionTotal === 1 ? 'item needs' : 'items need'} attention this week`
                      : 'Nothing is breached, overdue or unowned'}
                </h2>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {groups.map((group) => (
                  <LvBadge key={group.key} theme={theme} tone={group.total > 0 ? toBadgeTone(group.tone) : 'neutral'}>
                    {group.title} {group.total}
                  </LvBadge>
                ))}
              </div>
            </div>
          </LvCard>

          <div className="lv-kpi-grid">
            {summary.kpis.map((kpi) => (
              <KpiTile key={kpi.key} theme={theme} label={kpi.label} value={kpi.value} emptyText={kpi.emptyText} tone={kpi.tone} onClick={kpi.link ? () => void navigate(AppPath.RecordIndexPage, { objectNamePlural: pluralOf(kpi.link!.object) }) : undefined} />
            ))}
          </div>

          <div className="lv-two-col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
              {groups.map((group) => (
                <section key={group.key} aria-label={group.title} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), paddingLeft: 2, flexWrap: 'wrap' }}>
                    <Eyebrow theme={theme} tone={group.tone === 'neutral' ? undefined : group.tone}>
                      {group.eyebrow}
                    </Eyebrow>
                    <h2 style={{ ...theme.type.heading, margin: 0, color: theme.color.heading }}>{group.title}</h2>
                    <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{group.total} open</span>
                  </div>
                  {group.sections.map((section) => renderSection(section, group.tone))}
                </section>
              ))}
              {ungrouped.map((section) => renderSection(section, 'neutral'))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              <Section theme={theme} title="SLA by state">
                <Bars theme={theme} rows={barsFor('sla', summary.breakdown.slaByStatus)} />
              </Section>
              <Section theme={theme} title="Open SLAs by rule">
                <Bars theme={theme} rows={summary.breakdown.slaByRule} />
              </Section>
              <Section theme={theme} title="Document verification backlog">
                <Bars theme={theme} rows={barsFor('document', summary.breakdown.documentsByState)} />
              </Section>
              <Section theme={theme} title="Onboardings by state">
                {summary.breakdown.onboardingByStatus.length === 0 ? <EmptyState theme={theme} text="No onboarding matches the current filters." /> : <Bars theme={theme} rows={barsFor('onboarding', summary.breakdown.onboardingByStatus)} />}
              </Section>
              <Section theme={theme} title="Leads by status">
                {summary.breakdown.leadsByStatus.length === 0 ? <EmptyState theme={theme} text="No lead matches the current filters." /> : <Bars theme={theme} rows={summary.breakdown.leadsByStatus} />}
              </Section>
              <Section theme={theme} title="Contact data" hint="informational">
                {kpiRow(summary.contactBreakdown)}
              </Section>
              <Section theme={theme} title="Ecosystem · partners" hint="real counts">
                {kpiRow(summary.ecosystem.partners)}
              </Section>
              <Section theme={theme} title="Ecosystem · experiences">
                {kpiRow(summary.ecosystem.experiences)}
              </Section>
              <Section theme={theme} title="Ecosystem · properties">
                {kpiRow(summary.ecosystem.properties)}
              </Section>
              <Section theme={theme} title="Ecosystem · onboarding pipeline">
                {kpiRow(summary.ecosystem.onboarding)}
              </Section>
              <Section theme={theme} title="11 · Notification health">
                {kpiRow(summary.notificationHealth)}
              </Section>
              <Section theme={theme} title="12 · System health" hint="real signals only">
                <table style={{ ...theme.type.bodySmall, width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ ...theme.type.label, textAlign: 'left', padding: '6px 4px', borderBottom: `1px solid ${theme.color.borderStrong}`, color: theme.color.textMuted }}>
                        Indicator
                      </th>
                      <th scope="col" style={{ ...theme.type.label, textAlign: 'right', padding: '6px 4px', borderBottom: `1px solid ${theme.color.borderStrong}`, color: theme.color.textMuted }}>
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.systemHealth.map((row) => (
                      <tr key={row.key}>
                        <td style={{ padding: '6px 4px', borderBottom: `1px solid ${theme.color.border}` }}>
                          {row.label}
                          <span style={{ ...theme.type.caption, display: 'block', color: theme.color.textMuted }}>{row.detail}</span>
                        </td>
                        <td style={{ ...theme.type.mono, padding: '6px 4px', borderBottom: `1px solid ${theme.color.border}`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {row.value === null ? '—' : typeof row.value === 'string' && row.value.includes('T') ? formatWhen(row.value, now) : String(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
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
            </div>
          </div>
        </div>
      )}
    </LvPage>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_CONTROL_TOWER_ID,
  name: 'lv-control-tower',
  description: 'Admin Control Tower: unowned leads, overdue follow-ups, SLA breaches, stuck records, approvals, document backlog, notification and system health, with server-side filters',
  component: ControlTower,
});
