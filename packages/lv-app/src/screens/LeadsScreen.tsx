import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { inView, isOverdue, LEAD_SORTS, LEAD_VIEWS, sortLeads, useLeadList, type LeadListRow, type LeadSort, type LeadView } from 'src/api/leads';
import {
  isPilotZoneFilter,
  matchesPilotZone,
  normalizePilotZone,
  PILOT_ZONE_FILTER_OPTIONS,
  PILOT_ZONE_LABELS,
  type PilotZone,
  type PilotZoneFilter,
} from 'src/domain/pilot-zones';
import {
  matchesVibe,
  normalizeVibeFilter,
  VIBE_FILTER_OPTIONS,
  VIBE_LABELS,
  type VibeFilter,
  type VibeKey,
} from 'src/domain/vibe-taxonomy';
import { contextLine, withoutSubject } from 'src/design/copy';
import { LvFilterBar } from 'src/design/data';
import { LvIcon } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  formatWhen,
  LvAvatar,
  LvBadge,
  LvButton,
  LvCard,
  LvSelect,
  LvSkeletonRow,
  Segmented,
  VisuallyHidden,
} from 'src/design/kit';
import { LvPageHeader } from 'src/design/page';
import { describeStatus, statusBadgeTone } from 'src/design/status';
import { type LvTheme } from 'src/design/theme';

// My Leads — the relationship workspace, not a record table.
//
// Every row answers the three questions a person actually has about a lead
// they are scanning past: who is this, where does it stand, and is it waiting
// on me. The urgency line is the only thing coloured, because on a list of
// forty rows the eye should land on the three that are late.
//
// The query runs under the signed-in person's own permissions, so a
// coordinator and an administrator get different rows from the same code.

const Row = ({
  theme,
  lead,
  now,
  onOpen,
}: {
  theme: LvTheme;
  lead: LeadListRow;
  now: number;
  onOpen: () => void;
}) => {
  const status = describeStatus('lead', lead.status);
  const overdue = isOverdue(lead, now);
  const heading = lead.name ?? lead.lvLeadId ?? 'Unnamed lead';
  // "The Forest Table · Lonavala" under a row headed "The Forest Table" spent
  // a line to say "Lonavala".
  const context = contextLine([lead.organisationName, lead.location], heading);
  // The next action names the lead again — "Find contact details for
  // LV-000012 D8] Example Site mu3zh881[" sitting under that exact heading.
  // Both the name and the reference are removed.
  const nextAction = withoutSubject(lead.nextAction, lead.name, lead.lvLeadId);

  return (
    <li className="lv-lead-row" style={{ listStyle: 'none' }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${lead.name ?? lead.lvLeadId ?? 'lead'}`}
        className="lv-row-hover"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.space(4),
          width: '100%',
          // Matches the Today rows: at space(4) three lines of text ran into
          // the row below and the list read as one block.
          padding: `${theme.space(5)}px ${theme.space(4)}px`,
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${theme.color.border}`,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: theme.font.body,
        }}
      >
        <LvAvatar theme={theme} name={lead.name ?? lead.organisationName ?? 'Lead'} src={lead.photoUrl} size={44} />

        <span className="lv-lead-identity" style={{ minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap' }}>
            <span style={{ ...theme.type.subheading, fontSize: 16, color: theme.color.heading, overflowWrap: 'anywhere' }}>
              {heading}
            </span>
            {lead.lvLeadId && lead.name && (
              <span style={{ ...theme.type.caption, color: theme.color.textSubtle, fontFamily: theme.font.mono }}>{lead.lvLeadId}</span>
            )}
          </span>
          {context && <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>{context}</span>}
          {overdue && (
            // The quietest line, not the loudest. Five of seven rows carry it,
            // and in full-weight danger at body size that made "overdue" mean
            // nothing and buried the names above it. The marker carries the
            // urgency; the words only have to be readable.
            <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), marginTop: 2, minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{ flex: '0 0 auto', width: 5, height: 5, borderRadius: theme.radius.pill, background: theme.color.danger, transform: 'translateY(-2px)' }}
              />
              <span style={{ ...theme.type.caption, color: theme.color.textMuted, overflowWrap: 'anywhere', minWidth: 0 }}>
                Follow-up overdue{nextAction ? ` — ${nextAction}` : ''}
              </span>
            </span>
          )}
        </span>

        <span className="lv-lead-meta" style={{ display: 'flex', alignItems: 'center', gap: theme.space(3) }}>
          {lead.priority === 'HIGH' && (
            <LvBadge theme={theme} tone="warning">
              High
            </LvBadge>
          )}
          <LvBadge theme={theme} tone={statusBadgeTone('lead', lead.status)}>
            {status.label}
          </LvBadge>
          <span className="lv-hide-mobile" style={{ ...theme.type.bodySmall, color: theme.color.textSubtle, minWidth: 74, textAlign: 'right' }}>
            {lead.lastInteractionAt ? formatWhen(lead.lastInteractionAt, new Date(now).toISOString()) : 'No contact'}
          </span>
        </span>

        <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', flex: '0 0 auto' }}>
          <LvIcon name="chevronRight" size={18} />
        </span>
      </button>
    </li>
  );
};

export const LeadsScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { rows, error, reload } = useLeadList();
  const query = params.get('q') ?? '';
  const view = (params.get('view') as LeadView | null) ?? 'all';
  const zoneParam = params.get('zone');
  const zone: PilotZoneFilter = isPilotZoneFilter(zoneParam)
    ? (zoneParam as PilotZoneFilter)
    : (normalizePilotZone(zoneParam) ?? 'all');
  const vibeParam = params.get('vibe');
  const vibe: VibeFilter = normalizeVibeFilter(vibeParam);
  const [sort, setSort] = useState<LeadSort>('urgent');
  const now = Date.now();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);

    if (value === null || value === '' || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    setParams(next, { replace: true });
  };

  const visible = useMemo(() => {
    if (rows === null) {
      return [];
    }

    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((lead) => {
      if (!inView(lead, view, now)) {
        return false;
      }

      if (!matchesPilotZone(lead.pilotZone, zone)) {
        return false;
      }

      if (!matchesVibe(lead.subcategory, lead.category, vibe)) {
        return false;
      }

      if (needle === '') {
        return true;
      }

      return `${lead.name ?? ''} ${lead.organisationName ?? ''} ${lead.location ?? ''} ${lead.lvLeadId ?? ''}`.toLowerCase().includes(needle);
    });

    return sortLeads(filtered, sort, now);
  }, [rows, view, zone, vibe, query, sort, now]);

  const viewDefinition = LEAD_VIEWS.find((candidate) => candidate.key === view) ?? LEAD_VIEWS[0];
  const counts = useMemo(
    () => Object.fromEntries(LEAD_VIEWS.map((definition) => [definition.key, (rows ?? []).filter((lead) => inView(lead, definition.key, now)).length])),
    [rows, now],
  );

  const header = (
    <LvPageHeader
      theme={theme}
      variant="hero"
      title="My Leads"
      subtitle={rows === null ? 'Reading your relationships…' : `${visible.length} of ${rows.length} relationship${rows.length === 1 ? '' : 's'}${query ? ` matching “${query.trim()}”` : ''}`}
      actions={
        <LvButton theme={theme} variant="primary" icon={<LvIcon name="capture" size={16} />} onClick={() => navigate('/capture')}>
          Capture a lead
        </LvButton>
      }
    />
  );

  // ------------------------------------------------------------------ error
  if (error !== null) {
    return (
      <>
        {header}
        <ErrorState theme={theme} title="Your leads could not be loaded" text={error} onRetry={reload} />
      </>
    );
  }

  // ---------------------------------------------------------------- loading
  if (rows === null) {
    return (
      <>
        {header}
        <VisuallyHidden>Loading your leads</VisuallyHidden>
        <LvCard theme={theme} padding={0} aria-busy="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: theme.space(4), padding: theme.space(4), borderBottom: `1px solid ${theme.color.border}` }}>
              <span className="lv-skeleton" aria-hidden="true" style={{ width: 44, height: 44, borderRadius: theme.radius.pill, flex: '0 0 auto' }} />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <LvSkeletonRow theme={theme} width="42%" />
                <LvSkeletonRow theme={theme} width="64%" />
              </span>
            </div>
          ))}
        </LvCard>
      </>
    );
  }

  const filtering = query.trim() !== '' || view !== 'all' || zone !== 'all' || vibe !== 'all';

  return (
    <>
      {header}

      <LvFilterBar
        theme={theme}
        label="Filter leads"
        active={[
          ...(view !== 'all' ? [{ key: 'view', label: viewDefinition.label, onRemove: () => setParam('view', null) }] : []),
          ...(zone !== 'all' ? [{ key: 'zone', label: PILOT_ZONE_LABELS[zone as PilotZone] ?? zone, onRemove: () => setParam('zone', null) }] : []),
          ...(vibe !== 'all' ? [{ key: 'vibe', label: VIBE_LABELS[vibe as VibeKey] ?? vibe, onRemove: () => setParam('vibe', null) }] : []),
          ...(query.trim() !== '' ? [{ key: 'q', label: `“${query.trim()}”`, onRemove: () => setParam('q', null) }] : []),
        ]}
        onClearAll={
          filtering
            ? () => {
                setParams(new URLSearchParams(), { replace: true });
              }
            : undefined
        }
      >
        <Segmented
          theme={theme}
          label="Saved views"
          value={view}
          onChange={(key) => setParam('view', key)}
          options={LEAD_VIEWS.map((definition) => ({ key: definition.key, label: definition.label, count: counts[definition.key] }))}
        />
        <Segmented
          theme={theme}
          label="Pilot zone"
          value={zone}
          onChange={(key) => setParam('zone', key)}
          options={PILOT_ZONE_FILTER_OPTIONS}
        />
        <Segmented
          theme={theme}
          label="Vibe"
          value={vibe}
          onChange={(key) => setParam('vibe', key)}
          options={VIBE_FILTER_OPTIONS}
        />
        <label htmlFor="lv-lead-sort" style={{ display: 'inline-flex', alignItems: 'center', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.textMuted }}>
          Sort
          <LvSelect theme={theme} id="lv-lead-sort" value={sort} onChange={(event) => setSort(event.target.value as LeadSort)} style={{ width: 'auto', minWidth: 170 }}>
            {LEAD_SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </LvSelect>
        </label>
      </LvFilterBar>

      {view !== 'all' && (
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>{viewDefinition.description}</p>
      )}

      <LvCard theme={theme} padding={0} style={{ overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <div style={{ padding: theme.space(6) }}>
            {/* Three different nothings, and they need three different
                sentences: an empty workspace, a view with nothing in it, and a
                search that matched nothing. */}
            {rows.length === 0 ? (
              <EmptyState
                theme={theme}
                quiet={false}
                icon="leads"
                tint="blue"
                title="No relationships yet"
                text="Every partner, host and property you meet starts here. Capture the first one and it will appear in this list."
                action={
                  <LvButton theme={theme} variant="primary" icon={<LvIcon name="capture" size={16} />} onClick={() => navigate('/capture')}>
                    Capture a lead
                  </LvButton>
                }
              />
            ) : query.trim() !== '' ? (
              <EmptyState
                theme={theme}
                quiet={false}
                icon="search"
                tint="peach"
                title={`Nothing matches “${query.trim()}”`}
                text="Try a shorter name, a place, or a reference like LV-000005."
                action={
                  <LvButton theme={theme} variant="secondary" onClick={() => setParam('q', null)}>
                    Clear the search
                  </LvButton>
                }
              />
            ) : zone !== 'all' || vibe !== 'all' ? (
              <EmptyState
                theme={theme}
                quiet={false}
                icon="filter"
                title="No leads match the selected filters"
                text="Try switching your zone or vibe filter to 'All' to see more leads."
                action={
                  <LvButton
                    theme={theme}
                    variant="secondary"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.delete('zone');
                      next.delete('vibe');
                      setParams(next, { replace: true });
                    }}
                  >
                    Reset zone &amp; vibe
                  </LvButton>
                }
              />
            ) : (
              <EmptyState
                theme={theme}
                quiet={false}
                icon="check"
                title={`Nothing in ${viewDefinition.label.toLowerCase()}`}
                text={viewDefinition.description}
                action={
                  <LvButton theme={theme} variant="secondary" onClick={() => setParam('view', null)}>
                    Show all leads
                  </LvButton>
                }
              />
            )}
          </div>
        ) : (
          <>
            {/* The filter bar immediately above already reads "All 7" /
                "Follow-ups 5", so this strip said the same thing a second
                time in a tinted band. */}
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {visible.map((lead) => (
                <Row key={lead.id} theme={theme} lead={lead} now={now} onOpen={() => navigate(`/leads/${lead.id}`)} />
              ))}
            </ul>
          </>
        )}
      </LvCard>
    </>
  );
};
