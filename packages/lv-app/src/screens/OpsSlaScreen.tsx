import { useNavigate } from 'react-router-dom';

import {
  SLA_BOARD_COLUMNS,
  SLA_STATUS_LABELS,
  SLA_STATUS_TONE,
  slaCountOf,
  slaRuleRows,
  slaStatusRows,
  useSla,
  type SlaItem,
  type SlaStatus,
} from 'src/api/ops';
import { LvIcon } from 'src/design/icons';
import { CountPill, EmptyState, formatWhen, InlineNotice, LvBadge, LvCard } from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { CountBars, OpsShell, OpsState, RefreshAction } from 'src/screens/ops/parts';

// 12.3 — the SLA board.
//
// `/sla/summary` runs **delegated**, so this is the one leadership screen a
// governed member can open: CM-004 decides which clocks they see. An unscoped
// administrator sees the pipeline. No argument here widens that.
//
// The board is the four open clocks the inventory names plus On track, in the
// order a reader scans them. Resolved is counted but not given a column — a
// board is what is still running.

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
};

export const OpsSlaScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { data, loading, error, forbidden, reload } = useSla();
  const now = new Date().toISOString();
  const state = OpsState({ theme, loading, error, forbidden, onRetry: reload, label: 'the SLA board' });

  const byStatus = (status: SlaStatus): SlaItem[] => (data?.items ?? []).filter((item) => item.status === status);
  const countOf = (status: SlaStatus): number => slaCountOf(data?.byStatus, status);

  return (
    <OpsShell
      theme={theme}
      section="sla"
      title="SLA board"
      subtitle="The clocks that are still running, and who owns them."
      actions={<RefreshAction theme={theme} onRefresh={reload} />}
    >
      {state ?? (
        data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5) }}>
            <div className="lv-sla-board" style={{ display: 'grid', gap: theme.space(4) }}>
              {SLA_BOARD_COLUMNS.map((status) => {
                const items = byStatus(status);
                const count = countOf(status);
                const tone = SLA_STATUS_TONE[status];

                return (
                  <LvSectionCard
                    key={status}
                    theme={theme}
                    title={SLA_STATUS_LABELS[status]}
                    icon={status === 'BREACHED' || status === 'ESCALATED' ? 'warning' : 'clock'}
                    action={<CountPill theme={theme} count={count} tone={count > 0 && tone !== 'neutral' && tone !== 'success' ? tone : 'neutral'} />}
                  >
                    {items.length === 0 ? (
                      <EmptyState
                        theme={theme}
                        quiet
                        text={count === 0 ? `Nothing is ${SLA_STATUS_LABELS[status].toLowerCase()}.` : `${count} counted; none returned in this page.`}
                      />
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                        {items.map((item) => (
                          <li key={item.id} className="lv-action-row" style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'flex-start', gap: theme.space(3) }}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              {item.leadId ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/leads/${item.leadId}`)}
                                  className="lv-text-button"
                                  style={{ ...theme.type.body, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: theme.color.heading, fontFamily: theme.font.body, cursor: 'pointer', overflowWrap: 'anywhere' }}
                                >
                                  {item.leadName ?? item.name ?? 'Record'}
                                </button>
                              ) : (
                                <span style={{ ...theme.type.body, color: theme.color.heading, overflowWrap: 'anywhere' }}>{item.name ?? 'Record'}</span>
                              )}
                              <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle, overflowWrap: 'anywhere' }}>
                                {[item.leadRef, item.ruleLabel ?? item.rule].filter(Boolean).join(' · ')}
                              </span>
                              <span style={{ display: 'block', ...theme.type.bodySmall, color: tone === 'danger' ? theme.color.danger : theme.color.textMuted }}>
                                {item.escalatedAt
                                  ? `Escalated ${formatWhen(item.escalatedAt, now)}`
                                  : item.breachedAt
                                    ? `Breached ${formatWhen(item.breachedAt, now)}`
                                    : item.dueAt
                                      ? `Due ${formatWhen(item.dueAt, now)}`
                                      : 'No clock recorded'}
                              </span>
                              <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle }}>
                                {item.ownerName ? `Owned by ${item.ownerName}` : 'Unowned'}
                              </span>
                            </span>
                            {item.priority && (
                              <LvBadge theme={theme} tone={PRIORITY_TONE[item.priority] ?? 'neutral'}>
                                {item.priority.toLowerCase()}
                              </LvBadge>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </LvSectionCard>
                );
              })}
            </div>

            <div className="lv-ops-grid" style={{ display: 'grid', gap: theme.space(4) }}>
              <LvSectionCard theme={theme} title="By rule" icon="chart">
                <CountBars theme={theme} caption="By rule" rows={slaRuleRows(data.byRule)} labelFor={(row) => row.label ?? row.key} />
              </LvSectionCard>
              <LvSectionCard theme={theme} title="By state" icon="chart">
                <CountBars
                  theme={theme}
                  caption="By state"
                  rows={slaStatusRows(data.byStatus)}
                  labelFor={(row) => row.label ?? SLA_STATUS_LABELS[row.key as SlaStatus] ?? row.key}
                  toneFor={(row) => SLA_STATUS_TONE[row.key as SlaStatus] ?? 'neutral'}
                />
              </LvSectionCard>
            </div>

            <LvCard theme={theme}>
              <InlineNotice theme={theme}>
                {data.total} {data.total === 1 ? 'clock' : 'clocks'} returned for you across the five states above. Resolved work is not boarded here.
                What you can see is scoped by your own record permissions, so two people may read different boards.
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6, color: theme.color.textSubtle }}>
                  <LvIcon name="info" size={14} />
                </span>
              </InlineNotice>
            </LvCard>
          </div>
        )
      )}
    </OpsShell>
  );
};
