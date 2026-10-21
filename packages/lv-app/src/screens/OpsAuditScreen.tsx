import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AUDIT_ACTIONS,
  AUDIT_OUTCOME_TONE,
  AUDIT_OUTCOMES,
  EMPTY_AUDIT_FILTERS,
  matchesAudit,
  opsLinkFor,
  useAuditTrail,
  type AuditEvent,
  type AuditFilters,
} from 'src/api/ops';
import {
  EmptyState,
  Field,
  formatWhen,
  InlineNotice,
  LvBadge,
  LvButton,
  LvCard,
  LvSearchField,
  LvSelect,
} from 'src/design/kit';
import { type LvTheme } from 'src/design/theme';
import { OpsShell, OpsState, RefreshAction } from 'src/screens/ops/parts';

// 12.6 — the audit trail: who did what, when, and why.
//
// `lvAuditEvent` rows, read as the caller. They are written only by the
// governance routes with the application role and nobody holds update or
// delete on them, so this screen reads and never writes.
//
// A refusal is a recorded outcome, not a missing row: `REFUSED` and `FAILED`
// are first-class here, because an audit trail that only shows what succeeded
// is not an audit trail.

const label = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

export const OpsAuditScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { data, loading, error, forbidden, reload } = useAuditTrail();
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const now = new Date().toISOString();

  const visible = useMemo(() => (data?.events ?? []).filter((event) => matchesAudit(event, filters)), [data, filters]);
  const filtered = filters.action !== 'ALL' || filters.outcome !== 'ALL' || filters.query.trim().length > 0;
  const state = OpsState({ theme, loading, error, forbidden, onRetry: reload, label: 'the audit trail' });

  // Only the actions that actually occur in what was read — a 28-entry dropdown
  // of mostly-empty options is a worse filter than a short, true one.
  const actionsPresent = useMemo(() => {
    const present = new Set((data?.events ?? []).map((event) => event.action).filter((value): value is string => Boolean(value)));

    return AUDIT_ACTIONS.filter((action) => present.has(action));
  }, [data]);

  return (
    <OpsShell
      theme={theme}
      section="audit"
      title="Audit trail"
      subtitle="Who did what, to which record, when — and why."
      actions={<RefreshAction theme={theme} onRefresh={reload} />}
    >
      {state ?? (
        data && (
          <LvCard theme={theme}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              <LvSearchField
                theme={theme}
                label="Search the audit trail"
                placeholder="Record, actor or reason"
                value={filters.query}
                onChange={(query) => setFilters((current) => ({ ...current, query }))}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: theme.space(3) }}>
                <Field theme={theme} label="Action" htmlFor="audit-action">
                  <LvSelect theme={theme} id="audit-action" value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}>
                    <option value="ALL">Every action</option>
                    {actionsPresent.map((action) => (
                      <option key={action} value={action}>
                        {label(action)}
                      </option>
                    ))}
                  </LvSelect>
                </Field>
                <Field theme={theme} label="Outcome" htmlFor="audit-outcome">
                  <LvSelect theme={theme} id="audit-outcome" value={filters.outcome} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value }))}>
                    <option value="ALL">Every outcome</option>
                    {AUDIT_OUTCOMES.map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {label(outcome)}
                      </option>
                    ))}
                  </LvSelect>
                </Field>
              </div>

              {data.events.length === 0 ? (
                <EmptyState theme={theme} icon="info" tint="blue" title="Nothing has been recorded yet" text="Governed actions are written here as they happen." />
              ) : visible.length === 0 ? (
                <EmptyState
                  theme={theme}
                  icon="filter"
                  tint="blue"
                  title="Nothing matches this view"
                  text="The events exist — this filter or search just does not match them."
                  action={
                    <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}>
                      Show everything
                    </LvButton>
                  }
                />
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                  {visible.map((event) => (
                    <AuditRow key={event.id} theme={theme} event={event} now={now} onOpen={(path) => navigate(path)} />
                  ))}
                </ul>
              )}

              {data.events.length > 0 && (
                <InlineNotice theme={theme}>
                  Showing {visible.length} of the {data.read} most recent events
                  {data.total !== null ? ` of ${data.total} recorded` : ''}
                  {filtered ? ' that match this view' : ''}. These rows are written by the system and cannot be edited or removed.
                </InlineNotice>
              )}
            </div>
          </LvCard>
        )
      )}
    </OpsShell>
  );
};

const AuditRow = ({ theme, event, now, onOpen }: { theme: LvTheme; event: AuditEvent; now: string; onOpen: (path: string) => void }) => {
  const link = opsLinkFor(event.targetObject, event.targetRecordId);
  const tone = AUDIT_OUTCOME_TONE[event.outcome ?? ''] ?? 'neutral';

  return (
    <li className="lv-action-row" style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap' }}>
        <span style={{ ...theme.type.subheading, color: theme.color.heading, overflowWrap: 'anywhere' }}>{event.action ? label(event.action) : 'Event'}</span>
        {event.outcome && (
          <LvBadge theme={theme} tone={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : tone === 'danger' ? 'danger' : 'neutral'}>
            {event.outcome.toLowerCase()}
          </LvBadge>
        )}
        <span style={{ ...theme.type.caption, color: theme.color.textSubtle, marginLeft: 'auto' }}>{formatWhen(event.at, now)}</span>
      </span>

      <span style={{ ...theme.type.body, color: theme.color.text, overflowWrap: 'anywhere' }}>
        {link ? (
          <button
            type="button"
            onClick={() => onOpen(link)}
            className="lv-text-button"
            style={{ ...theme.type.body, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: theme.color.brand, fontFamily: theme.font.body, cursor: 'pointer', overflowWrap: 'anywhere' }}
          >
            {event.targetLabel ?? event.targetObject ?? 'Record'}
          </button>
        ) : (
          (event.targetLabel ?? event.targetObject ?? 'Record')
        )}
      </span>

      <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>
        {event.actorName ? `By ${event.actorName}` : 'Actor not recorded'}
        {event.targetObject ? ` · ${event.targetObject}` : ''}
      </span>

      {event.reason && (
        <span style={{ ...theme.type.bodySmall, color: theme.color.text, overflowWrap: 'anywhere' }}>
          <span style={{ color: theme.color.textMuted }}>Reason: </span>
          {event.reason}
        </span>
      )}
    </li>
  );
};
