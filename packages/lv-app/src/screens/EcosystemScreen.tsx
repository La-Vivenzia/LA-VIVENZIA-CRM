import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  ATTENTION_STATUSES,
  formatMoney,
  humanise,
  kindFromPath,
  KIND_LABELS,
  useEcosystemCounts,
  useEcosystemList,
  type EcosystemKind,
  type EcosystemRow,
} from 'src/api/ecosystem';
import { LvDataTable, type LvColumn } from 'src/design/data';
import { LvIcon, type LvIconName } from 'src/design/icons';
import { EmptyState, ErrorState, formatWhen, isForbiddenMessage, KpiTile, LoadingState, LvButton, LvCard, LvSearchField, Segmented } from 'src/design/kit';
import { LvPageHeader } from 'src/design/page';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { EcosystemStatus } from 'src/screens/ecosystem/parts';

// 8.1 Partners, 8.3 Properties, 8.5 Experiences.
//
// The three lists are the same surface over three kinds of record, so they
// are one screen: the columns differ, nothing else does. The overview strip
// above them is what makes it a workspace rather than three tables — it says
// how big the ecosystem is, how much of it is live and how much is waiting on
// somebody, and moves between the kinds without a page change.

const KIND_ICON: Record<EcosystemKind, LvIconName> = { partner: 'partner', property: 'property', experience: 'experience' };

type Filter = 'ALL' | 'ATTENTION' | 'LIVE' | 'MINE';

export const EcosystemScreen = ({ theme, viewerId }: { theme: LvTheme; viewerId: string | null }) => {
  const navigate = useNavigate();
  const { kind: kindParam } = useParams<{ kind?: string }>();
  const kind = kindFromPath(kindParam) ?? 'partner';
  const { rows, error, loading, reload } = useEcosystemList(kind);
  const { counts } = useEcosystemCounts();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const now = new Date().toISOString();
  const liveStatus = kind === 'partner' ? 'ACTIVE' : 'LIVE';

  const matches = useMemo(
    () => ({
      ALL: () => true,
      ATTENTION: (row: EcosystemRow) => ATTENTION_STATUSES[kind].includes(row.status ?? ''),
      LIVE: (row: EcosystemRow) => row.status === liveStatus,
      MINE: (row: EcosystemRow) => viewerId !== null && row.ownerId === viewerId,
    }),
    [kind, liveStatus, viewerId],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return (rows ?? [])
      .filter((row) => matches[filter](row))
      .filter((row) => needle === '' || `${row.name ?? ''} ${row.code ?? ''} ${row.location ?? ''} ${row.partnerName ?? ''}`.toLowerCase().includes(needle));
  }, [rows, filter, query, matches]);

  const columns: LvColumn<EcosystemRow>[] = [
    {
      key: 'name',
      label: KIND_LABELS[kind].one,
      primary: true,
      render: (row) => (
        <span style={{ display: 'block', minWidth: 0 }}>
          <span style={{ display: 'block', color: theme.color.heading, fontWeight: theme.font.weight.medium, overflowWrap: 'anywhere' }}>{row.name ?? 'Unnamed'}</span>
          <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>
            {[row.code, row.location].filter(Boolean).join(' · ') || '—'}
          </span>
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <EcosystemStatus theme={theme} kind={kind} status={row.status} /> },
    ...(kind === 'partner'
      ? ([
          {
            key: 'category',
            label: 'Category',
            render: (row: EcosystemRow) => humanise(row.category) ?? <span style={{ color: theme.color.textSubtle }}>—</span>,
          },
        ] as LvColumn<EcosystemRow>[])
      : ([
          {
            key: 'partner',
            label: 'Partner',
            render: (row: EcosystemRow) =>
              row.partnerName ?? <span style={{ color: theme.color.textSubtle }}>Not linked</span>,
          },
          {
            key: 'price',
            label: 'From',
            secondary: true,
            render: (row: EcosystemRow) => formatMoney(row.basePrice, row.priceUnit) ?? <span style={{ color: theme.color.textSubtle }}>—</span>,
          },
          {
            key: 'capacity',
            label: 'Guests',
            secondary: true,
            render: (row: EcosystemRow) => (row.capacity === null ? <span style={{ color: theme.color.textSubtle }}>—</span> : String(row.capacity)),
          },
        ] as LvColumn<EcosystemRow>[])),
    { key: 'owner', label: 'Owner', secondary: true, render: (row) => row.ownerName ?? <span style={{ color: theme.color.textSubtle }}>Nobody</span> },
    { key: 'updated', label: 'Last change', secondary: true, render: (row) => formatWhen(row.updatedAt, now) },
  ];

  return (
    <>
      <LvPageHeader
        theme={theme}
        variant="hero"
        title="Ecosystem"
        subtitle="The partners La Vivenzia works with, and everything they have put on the platform."
        actions={
          <>
            {/* The people and businesses behind all of this. They belong to
                the ecosystem, so they are reached from it. */}
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => navigate('/directory/people')} icon={<LvIcon name="leads" size={16} />}>
              Directory
            </LvButton>
            <LvButton theme={theme} variant="secondary" onClick={() => void reload()}>
              Refresh
            </LvButton>
          </>
        }
      />

      {/* The overview: how much of the ecosystem is live, and how much is
          waiting on somebody. Each tile is also the way into that kind. */}
      <LvCard theme={theme} padding={4}>
        <div className="lv-kpi-grid">
          {(Object.keys(KIND_LABELS) as EcosystemKind[]).map((candidate) => {
            const count = counts?.[candidate];

            return (
              <KpiTile
                key={candidate}
                theme={theme}
                label={KIND_LABELS[candidate].many}
                value={count?.total ?? null}
                emptyText="None yet"
                unavailableReason={count === undefined ? 'Still counting' : undefined}
                tone={candidate === kind ? 'info' : undefined}
                hint={count === undefined ? undefined : `${count.live} live · ${count.attention} need attention`}
                onClick={() => navigate(`/ecosystem/${KIND_LABELS[candidate].path}`)}
              />
            );
          })}
        </div>
      </LvCard>

      {error !== null && (
        <ErrorState
          theme={theme}
          title={isForbiddenMessage(error) ? `Your role cannot see ${KIND_LABELS[kind].many.toLowerCase()}` : `${KIND_LABELS[kind].many} could not be loaded`}
          text={error}
          onRetry={isForbiddenMessage(error) ? undefined : () => void reload()}
        />
      )}

      {loading && rows === null && <LoadingState theme={theme} rows={4} label={`Loading ${KIND_LABELS[kind].many.toLowerCase()}`} />}

      {rows !== null && (
        <LvSectionCard
          theme={theme}
          title={`${KIND_LABELS[kind].many} · ${visible.length} of ${rows.length}`}
          icon={KIND_ICON[kind]}
          action={
            // The tiles above already move between the three kinds and are
            // the whole width of a phone; a second switcher under them is the
            // same control twice, so it appears only where there is room.
            <div className="lv-kind-switch">
              {(Object.keys(KIND_LABELS) as EcosystemKind[]).map((candidate) => (
                <LvButton
                  key={candidate}
                  theme={theme}
                  variant={candidate === kind ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(`/ecosystem/${KIND_LABELS[candidate].path}`)}
                >
                  {KIND_LABELS[candidate].many}
                </LvButton>
              ))}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            <LvSearchField
              theme={theme}
              value={query}
              onChange={setQuery}
              label={`Search ${KIND_LABELS[kind].many.toLowerCase()}`}
              placeholder="Name, code or place"
            />
            <Segmented
              theme={theme}
              label="Which records"
              value={filter}
              onChange={(next) => setFilter(next as Filter)}
              options={[
                { key: 'ALL', label: 'Everything', count: rows.length },
                { key: 'ATTENTION', label: 'Needs attention', count: rows.filter(matches.ATTENTION).length },
                { key: 'LIVE', label: 'Live', count: rows.filter(matches.LIVE).length },
                { key: 'MINE', label: 'Mine', count: rows.filter(matches.MINE).length },
              ]}
            />

            {rows.length === 0 ? (
              <EmptyState
                theme={theme}
                icon={KIND_ICON[kind]}
                tint="lavender"
                title={`No ${KIND_LABELS[kind].many.toLowerCase()} yet`}
                text={
                  kind === 'partner'
                    ? 'A partner is created when an onboarding is approved. Once one exists it appears here with everything it is waiting on.'
                    : `A ${KIND_LABELS[kind].one.toLowerCase()} is created against a partner. None have been added yet.`
                }
              />
            ) : visible.length === 0 ? (
              <EmptyState
                theme={theme}
                icon="filter"
                tint="blue"
                title="Nothing matches this view"
                text={`The ${KIND_LABELS[kind].many.toLowerCase()} exist — this filter or search just does not match them.`}
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
                caption={`${KIND_LABELS[kind].many} in the ecosystem`}
                columns={columns}
                rows={visible}
                rowKey={(row) => row.id}
                onRowClick={(row) => navigate(`/ecosystem/${KIND_LABELS[kind].path}/${row.id}`)}
              />
            )}
          </div>
        </LvSectionCard>
      )}
    </>
  );
};
