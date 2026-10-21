import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CHANNEL_LABELS, CHANNELS } from 'src/api/messages';
import { EMPTY_LOG_FILTERS, matchesLog, useInteractionLog, type LogEntry, type LogFilters } from 'src/api/work';
import { channelIcon, LvIcon } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  Field,
  ForbiddenState,
  formatWhen,
  InlineNotice,
  isForbiddenMessage,
  LoadingState,
  LvBadge,
  LvButton,
  LvCard,
  LvIconTile,
  LvSearchField,
  LvSelect,
} from 'src/design/kit';
import { LvPageHeader } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';

// 11.5 — the interactions log.
//
// The same `lvInteraction` rows the inbox reads, flat and in time order rather
// than folded into conversations. The two answer different questions: Messages
// asks "who is waiting on us", this asks "what contact happened, when, and who
// made it". Nothing here sends anything — an interaction is the *record* of a
// contact that already happened, which is all the backend stores.

const DIRECTIONS = [
  { key: 'ALL', label: 'Any direction' },
  { key: 'INBOUND', label: 'From them' },
  { key: 'OUTBOUND', label: 'From us' },
];

export const WorkLogScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { entries, loading, error, reload } = useInteractionLog();
  const [filters, setFilters] = useState<LogFilters>(EMPTY_LOG_FILTERS);

  const now = new Date().toISOString();
  const visible = useMemo(() => entries.filter((entry) => matchesLog(entry, filters)), [entries, filters]);
  const filtered = filters.channel !== 'ALL' || filters.direction !== 'ALL' || filters.query.trim().length > 0;

  const header = (
    <LvPageHeader
      theme={theme}
      variant="panel"
      title="Interactions log"
      subtitle="Every contact recorded with a relationship, newest first."
      onBack={() => navigate('/today')}
      backLabel="Back to Today"
      actions={
        <LvButton theme={theme} variant="secondary" size="sm" onClick={reload} icon={<LvIcon name="clock" size={16} />}>
          Refresh
        </LvButton>
      }
    />
  );

  if (error !== null && isForbiddenMessage(error)) {
    return (
      <>
        {header}
        <ForbiddenState theme={theme} text="Your role cannot read the interactions log. Ask an administrator if you need it." />
      </>
    );
  }

  return (
    <>
      {header}

      <LvCard theme={theme}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <LvSearchField
            theme={theme}
            label="Search the log"
            placeholder="Name, reference, what was said"
            value={filters.query}
            onChange={(query) => setFilters((current) => ({ ...current, query }))}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: theme.space(3) }}>
            <Field theme={theme} label="Channel" htmlFor="log-channel">
              <LvSelect theme={theme} id="log-channel" value={filters.channel} onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}>
                <option value="ALL">Every channel</option>
                {CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {CHANNEL_LABELS[channel] ?? channel}
                  </option>
                ))}
              </LvSelect>
            </Field>
            <Field theme={theme} label="Direction" htmlFor="log-direction">
              <LvSelect theme={theme} id="log-direction" value={filters.direction} onChange={(event) => setFilters((current) => ({ ...current, direction: event.target.value }))}>
                {DIRECTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </LvSelect>
            </Field>
          </div>

          {loading ? (
            <LoadingState theme={theme} rows={5} label="Loading the interactions log" />
          ) : error !== null ? (
            <ErrorState theme={theme} title="The log could not be loaded" text={error} onRetry={reload} />
          ) : entries.length === 0 ? (
            <EmptyState
              theme={theme}
              icon="messages"
              tint="mint"
              title="Nothing has been logged yet"
              text="Contacts recorded against a relationship appear here as they happen."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              theme={theme}
              icon="filter"
              tint="blue"
              title="Nothing matches this view"
              text="The contacts exist — this filter or search just does not match them."
              action={
                <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setFilters(EMPTY_LOG_FILTERS)}>
                  Show everything
                </LvButton>
              }
            />
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
              {visible.map((entry) => (
                <LogRow key={entry.id} theme={theme} entry={entry} now={now} onOpenLead={(leadId) => navigate(`/leads/${leadId}`)} />
              ))}
            </ul>
          )}

          {!loading && error === null && entries.length > 0 && (
            <InlineNotice theme={theme}>
              Showing the {visible.length} most recent of {entries.length} loaded contacts
              {filtered ? ' that match this view' : ''}. Older contacts are on each relationship&apos;s own timeline.
            </InlineNotice>
          )}
        </div>
      </LvCard>
    </>
  );
};

const LogRow = ({ theme, entry, now, onOpenLead }: { theme: LvTheme; entry: LogEntry; now: string; onOpenLead: (leadId: string) => void }) => (
  <li className="lv-action-row" style={{ listStyle: 'none', display: 'flex', alignItems: 'flex-start', gap: theme.space(3), padding: `${theme.space(3)}px 0` }}>
    <LvIconTile theme={theme} icon={channelIcon(entry.channel)} tint={entry.direction === 'INBOUND' ? 'blue' : 'mint'} size={36} />

    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap' }}>
        {entry.leadId === null ? (
          <span style={{ ...theme.type.subheading, color: theme.color.textMuted }}>No relationship</span>
        ) : (
          <button
            type="button"
            onClick={() => onOpenLead(entry.leadId as string)}
            className="lv-text-button"
            style={{ ...theme.type.subheading, background: 'transparent', border: 'none', padding: 0, color: theme.color.heading, fontFamily: theme.font.body, cursor: 'pointer', textAlign: 'left', overflowWrap: 'anywhere' }}
          >
            {entry.leadName ?? 'Open the relationship'}
          </button>
        )}
        <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>{entry.leadRef}</span>
      </span>

      <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>
        {CHANNEL_LABELS[entry.channel] ?? entry.channel} · {entry.direction === 'INBOUND' ? 'from them' : 'from us'}
        {entry.actorName ? ` · ${entry.actorName}` : ''}
        {typeof entry.durationMinutes === 'number' ? ` · ${entry.durationMinutes} min` : ''}
      </span>

      {entry.summary && (
        <span style={{ display: 'block', ...theme.type.body, color: theme.color.text, marginTop: 2, overflowWrap: 'anywhere' }}>{entry.summary}</span>
      )}

      {(entry.purpose || entry.outcome) && (
        <span style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: 4 }}>
          {entry.purpose && <LvBadge theme={theme}>{entry.purpose.replace(/_/g, ' ').toLowerCase()}</LvBadge>}
          {entry.outcome && <LvBadge theme={theme} tone="info">{entry.outcome.replace(/_/g, ' ').toLowerCase()}</LvBadge>}
        </span>
      )}
    </span>

    <span style={{ ...theme.type.caption, color: theme.color.textSubtle, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{formatWhen(entry.occurredAt, now)}</span>
  </li>
);
