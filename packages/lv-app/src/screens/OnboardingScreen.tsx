import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ONBOARDING_JOURNEY,
  ONBOARDING_STATUS_LABELS,
  stageOf,
  useOnboardingList,
  type OnboardingSummary,
} from 'src/api/onboarding';
import { LvDataTable, type LvColumn } from 'src/design/data';
import { LvIcon } from 'src/design/icons';
import { EmptyState, ErrorState, formatWhen, isForbiddenMessage, LoadingState, LvBadge, LvButton, LvSearchField, Segmented } from 'src/design/kit';
import { LvPageHeader } from 'src/design/page';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { LvQueueCounts, STATUS_TONE } from 'src/screens/onboarding/parts';

// 7.1 â€” the onboarding queue.
//
// A partner in onboarding is a person waiting on La Vivenzia, so the list is
// ordered by what is waiting rather than alphabetically, and every row says
// where that partner is and what state their documents are in.

export type Filter = 'ALL' | 'MINE' | 'WAITING' | 'REVIEW' | 'LIVE' | 'AMANORA' | 'SEASONS' | 'MAGARPATTA' | 'HADAPSAR' | 'IN_PROGRESS' | 'VERIFICATION' | 'APPROVED';

export type FilterDef = { key: Filter; label: string; matches: (row: OnboardingSummary, viewerId: string | null) => boolean };

// Filters shown in the segmented tab bar.
export const TAB_FILTERS: FilterDef[] = [
  { key: 'ALL', label: 'Everything', matches: () => true },
  { key: 'MINE', label: 'My reviews', matches: (row, viewerId) => viewerId !== null && row.reviewerId === viewerId },
  { key: 'WAITING', label: 'With the partner', matches: (row) => ONBOARDING_JOURNEY[1].statuses.includes(row.status) },
  { key: 'REVIEW', label: 'Needs a decision', matches: (row) => row.status === 'VERIFICATION' || row.status === 'INTERNAL_REVIEW' },
  { key: 'LIVE', label: 'Live', matches: (row) => row.status === 'ACTIVATED' },
  { key: 'AMANORA', label: 'Amanora', matches: (row) => (row.leadLocation ?? '').toLowerCase().includes('amanora') },
  { key: 'SEASONS', label: 'Seasons Mall', matches: (row) => (row.leadLocation ?? '').toLowerCase().includes('seasons mall') },
  { key: 'MAGARPATTA', label: 'Magarpatta', matches: (row) => (row.leadLocation ?? '').toLowerCase().includes('magarpatta') },
  { key: 'HADAPSAR', label: 'Hadapsar', matches: (row) => (row.leadLocation ?? '').toLowerCase().includes('hadapsar') },
];

// Status-counter filters — reachable by clicking a KPI tile but not shown as
// segmented tabs, so the tab bar does not grow with every counter added.
export const COUNTER_FILTERS: FilterDef[] = [
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    matches: (row) =>
      row.status === 'IN_PROGRESS' ||
      row.status === 'INITIATED' ||
      row.status === 'WAITING_FOR_PARTNER' ||
      row.status === 'CHANGES_REQUESTED',
  },
  {
    key: 'VERIFICATION',
    label: 'Under Verification',
    matches: (row) => row.status === 'VERIFICATION' || row.status === 'INTERNAL_REVIEW',
  },
  {
    key: 'APPROVED',
    label: 'Approved',
    matches: (row) => row.status === 'APPROVED' || row.status === 'ACTIVATED',
  },
];

export const ALL_FILTERS: FilterDef[] = [...TAB_FILTERS, ...COUNTER_FILTERS];

export const OnboardingScreen = ({ theme, viewerId }: { theme: LvTheme; viewerId: string | null }) => {
  const navigate = useNavigate();
  const { rows, error, loading, reload } = useOnboardingList();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const now = useMemo(() => new Date().toISOString(), []);

  const counts = useMemo(() => {
    const list = rows ?? [];

    return [
      {
        key: 'IN_PROGRESS',
        label: 'In Progress',
        value: list.filter(
          (row) =>
            row.status === 'IN_PROGRESS' ||
            row.status === 'INITIATED' ||
            row.status === 'WAITING_FOR_PARTNER' ||
            row.status === 'CHANGES_REQUESTED',
        ).length,
        tone: 'info' as const,
        hint: 'Partner is filling in or revising their submission',
        icon: 'task' as const,
        tint: 'blue' as const,
      },
      {
        key: 'VERIFICATION',
        label: 'Under Verification',
        value: list.filter((row) => row.status === 'VERIFICATION' || row.status === 'INTERNAL_REVIEW').length,
        tone: 'warning' as const,
        hint: 'Submitted and documents under review',
        icon: 'search' as const,
        tint: 'peach' as const,
      },
      {
        key: 'APPROVED',
        label: 'Approved',
        value: list.filter((row) => row.status === 'APPROVED' || row.status === 'ACTIVATED').length,
        tone: 'success' as const,
        hint: 'Approved or already live',
        icon: 'check' as const,
        tint: 'mint' as const,
      },
    ];
  }, [rows]);

  const visible = useMemo(() => {
    const list = rows ?? [];
    const rule = ALL_FILTERS.find((entry) => entry.key === filter) ?? ALL_FILTERS[0];
    const needle = query.trim().toLowerCase();

    return list
      .filter((row) => rule.matches(row, viewerId))
      .filter((row) => needle === '' || `${row.name ?? ''} ${row.leadName ?? ''} ${row.leadLocation ?? ''}`.toLowerCase().includes(needle))
      .slice()
      .sort((left, right) => stageOf(left.status) - stageOf(right.status) || Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? ''));
  }, [rows, filter, query, viewerId]);

  const columns: LvColumn<OnboardingSummary>[] = [
    {
      key: 'partner',
      label: 'Partner',
      primary: true,
      render: (row) => (
        <span style={{ display: 'block', minWidth: 0 }}>
          <span style={{ display: 'block', color: theme.color.heading, fontWeight: theme.font.weight.medium, overflowWrap: 'anywhere' }}>
            {row.name ?? row.leadName ?? 'Unnamed onboarding'}
          </span>
          {row.leadLocation && <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{row.leadLocation}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Stage',
      render: (row) => <LvBadge theme={theme} tone={STATUS_TONE[row.status]}>{ONBOARDING_STATUS_LABELS[row.status]}</LvBadge>,
    },
    {
      key: 'progress',
      label: 'Form',
      render: (row) => (row.progressPercentage === null ? <span style={{ color: theme.color.textSubtle }}>â€”</span> : `${row.progressPercentage}%`),
    },
    {
      key: 'documents',
      label: 'Documents',
      render: (row) =>
        row.documentCount === 0 ? (
          <span style={{ color: theme.color.textSubtle }}>None</span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.space(2) }}>
            <span>
              {row.verifiedCount} of {row.documentCount} verified
            </span>
            {row.blockedCount > 0 && <LvBadge theme={theme} tone="warning">{row.blockedCount} blocked</LvBadge>}
          </span>
        ),
    },
    { key: 'reviewer', label: 'Reviewer', secondary: true, render: (row) => row.reviewerName ?? <span style={{ color: theme.color.textSubtle }}>Nobody yet</span> },
    { key: 'updated', label: 'Last change', secondary: true, render: (row) => formatWhen(row.updatedAt, now) },
  ];

  return (
    <>
      <LvPageHeader
        theme={theme}
        variant="hero"
        title="Onboarding"
        subtitle="Every partner on their way to going live, and what each of them is waiting for."
        actions={
          <LvButton theme={theme} variant="secondary" onClick={() => void reload()} icon={<LvIcon name="clock" size={16} />}>
            Refresh
          </LvButton>
        }
      />

      {error !== null && (
        <ErrorState
          theme={theme}
          title={isForbiddenMessage(error) ? 'Your role cannot see onboarding' : 'The queue could not be loaded'}
          text={error}
          onRetry={isForbiddenMessage(error) ? undefined : () => void reload()}
        />
      )}

      {loading && rows === null && <LoadingState theme={theme} rows={4} label="Loading the onboarding queue" />}

      {rows !== null && (
        <>
          <LvQueueCounts theme={theme} counts={counts} onPick={(key) => setFilter(key as Filter)} />

          <LvSectionCard theme={theme} title={`${visible.length} of ${rows.length}`} icon="onboarding">
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              <LvSearchField theme={theme} value={query} onChange={setQuery} label="Search onboardings" placeholder="Partner or place" />
              <Segmented
                theme={theme}
                label="Which onboardings"
                value={TAB_FILTERS.some((entry) => entry.key === filter) ? filter : ''}
                onChange={(next) => setFilter(next as Filter)}
                options={TAB_FILTERS.map((entry) => ({ key: entry.key, label: entry.label, count: (rows ?? []).filter((row) => entry.matches(row, viewerId)).length }))}
              />
              {COUNTER_FILTERS.some((entry) => entry.key === filter) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
                  <LvBadge theme={theme} tone={counts.find((c) => c.key === filter)?.tone ?? 'info'}>
                    Filtered by {ALL_FILTERS.find((entry) => entry.key === filter)?.label}
                  </LvBadge>
                  <LvButton theme={theme} variant="ghost" size="sm" onClick={() => setFilter('ALL')}>
                    Reset to all
                  </LvButton>
                </div>
              )}

              {rows.length === 0 ? (
                <EmptyState
                  theme={theme}
                  icon="onboarding"
                  tint="lavender"
                  title="No partner is being onboarded yet"
                  text="An onboarding is created when a lead is taken forward. Once one exists, it appears here with everything it is waiting on."
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  theme={theme}
                  icon="filter"
                  tint="blue"
                  title="Nothing matches this view"
                  text="The onboardings exist â€” this filter or search just does not match them."
                  action={
                    <LvButton
                      theme={theme}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFilter('ALL');
                        setQuery('');
                      }}
                    >
                      Show everything
                    </LvButton>
                  }
                />
              ) : (
                <LvDataTable
                  theme={theme}
                  caption="Partners in onboarding"
                  columns={columns}
                  rows={visible}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => navigate(`/onboarding/${row.id}`)}
                />
              )}
            </div>
          </LvSectionCard>
        </>
      )}
    </>
  );
};
