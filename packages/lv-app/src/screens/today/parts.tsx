import { useState, type ReactNode } from 'react';

import { type ActionRow, type ActionSection } from 'src/api/today';
import { LvIcon, type LvIconName } from 'src/design/icons';
import { CountPill, formatWhen, LvBadge, LvButton, LvCard, toneColour, toneWash, type Tone } from 'src/design/kit';
import { type LvTheme } from 'src/design/theme';

// The pieces Today is built from.
//
// They exist here rather than in the design system because they are shaped by
// what the dashboard engine returns — a row that is a task, a lead or an SLA
// clock, told apart by the fields it carries — and that is Today's business,
// not the component kit's.

const sentence = (value: string | null | undefined): string =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '';

/** What a row is, decided by what the engine put on it. */
export const rowKind = (row: ActionRow): 'task' | 'sla' | 'lead' =>
  row.target?.object === 'task' ? 'task' : typeof row.rule === 'string' ? 'sla' : 'lead';

/** The lead a row belongs to, whatever kind of row it is. */
export const leadIdOf = (row: ActionRow): string | null =>
  row.leadId ?? (row.target?.object === 'lvLead' ? row.target.recordId : null) ?? null;

const rowTitle = (row: ActionRow): string =>
  (rowKind(row) === 'task' ? row.title : null) ?? row.name ?? row.leadName ?? row.title ?? 'Untitled';

const rowDetail = (row: ActionRow, now: string): string | null => {
  const parts: string[] = [];
  const kind = rowKind(row);

  if (kind === 'task') {
    if (row.dueAt) {
      parts.push(`Due ${formatWhen(row.dueAt, now)}`);
    }

    if (row.leadName) {
      parts.push([row.lvLeadId, row.leadName].filter(Boolean).join(' '));
    }
  } else {
    if (row.lvLeadId) {
      parts.push(String(row.lvLeadId));
    }

    if (kind === 'sla' && row.rule) {
      parts.push(`${sentence(String(row.rule))} · ${sentence(row.status)}`);
    } else if (row.status) {
      parts.push(sentence(row.status));
    }
  }

  return parts.join(' · ') || null;
};

/**
 * One line of work, with the actions the backend actually supports for it: a
 * task can be completed, anything attached to a lead can be opened. Nothing
 * else is offered, because nothing else exists.
 */
export const WorkRow = ({
  theme,
  row,
  now,
  onOpenLead,
  onCompleteTask,
  busy,
}: {
  theme: LvTheme;
  row: ActionRow;
  now: string;
  onOpenLead: (leadId: string) => void;
  onCompleteTask?: (taskId: string, leadId: string) => void;
  busy?: boolean;
}) => {
  const kind = rowKind(row);
  const leadId = leadIdOf(row);
  const detail = rowDetail(row, now);
  const canComplete = kind === 'task' && typeof row.id === 'string' && leadId !== null && onCompleteTask;

  return (
    <li className="lv-action-row lv-work-row" style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: theme.space(3), padding: `${theme.space(2)}px 0` }}>
      <span className="lv-action-row-body" style={{ minWidth: 0 }}>
        <span style={{ display: 'block', ...theme.type.body, color: theme.color.heading, overflowWrap: 'anywhere' }}>{rowTitle(row)}</span>
        {detail && <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>{detail}</span>}
      </span>

      {row.priority === 'HIGH' && (
        <LvBadge theme={theme} tone="warning">
          High
        </LvBadge>
      )}

      <span className="lv-action-row-cta" style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
        {canComplete && (
          <LvButton
            theme={theme}
            size="sm"
            variant="secondary"
            busy={busy}
            icon={<LvIcon name="check" size={15} />}
            onClick={() => onCompleteTask?.(String(row.id), leadId as string)}
          >
            Mark done
          </LvButton>
        )}
        {leadId && (
          <LvButton theme={theme} size="sm" variant={canComplete ? 'ghost' : 'secondary'} onClick={() => onOpenLead(leadId)}>
            Open
          </LvButton>
        )}
      </span>
    </li>
  );
};

/**
 * A group of work — "Overdue follow-ups", "Due today". Collapsible, because on
 * a phone six open groups is a page nobody scrolls to the end of; the first
 * one is open so the screen is never a row of closed doors.
 */
export const WorkGroup = ({
  theme,
  section,
  tone,
  icon,
  now,
  defaultOpen,
  onOpenLead,
  onCompleteTask,
  busyTaskId,
}: {
  theme: LvTheme;
  section: ActionSection;
  tone: Tone;
  icon: LvIconName;
  now: string;
  defaultOpen?: boolean;
  onOpenLead: (leadId: string) => void;
  onCompleteTask?: (taskId: string, leadId: string) => void;
  busyTaskId?: string | null;
}) => {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <LvCard theme={theme} padding={0} style={{ overflow: 'hidden' }}>
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.space(3),
            width: '100%',
            minHeight: 60,
            padding: `0 ${theme.space(4)}px`,
            background: 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: theme.font.body,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 36,
              height: 36,
              flex: '0 0 auto',
              borderRadius: theme.radius.pill,
              background: toneWash(theme, tone),
              color: toneColour(theme, tone),
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LvIcon name={icon} size={18} />
          </span>
          <span style={{ flex: 1, minWidth: 0, ...theme.type.subheading, fontSize: 16, color: theme.color.heading }}>{section.title}</span>
          <CountPill theme={theme} count={section.totalCount} tone={tone === 'neutral' ? 'neutral' : tone} />
          <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
            <LvIcon name={open ? 'chevronUp' : 'chevronDown'} size={17} />
          </span>
        </button>
      </h3>

      {open && (
        <div style={{ padding: `0 ${theme.space(4)}px ${theme.space(3)}px` }}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: `1px solid ${theme.color.border}` }}>
            {section.rows.map((row, index) => (
              <WorkRow
                key={String(row.id ?? index)}
                theme={theme}
                row={row}
                now={now}
                onOpenLead={onOpenLead}
                onCompleteTask={onCompleteTask}
                busy={busyTaskId === row.id}
              />
            ))}
          </ul>
          {section.totalCount > section.rows.length && (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(2)}px 0 0` }}>
              Showing {section.rows.length} of {section.totalCount}.
            </p>
          )}
        </div>
      )}
    </LvCard>
  );
};

/** The strip that says which ranking is on screen, and what the assistant is doing. */
export const AiRankingNote = ({
  theme,
  phase,
  onRetry,
}: {
  theme: LvTheme;
  phase: 'none' | 'loading' | 'ready' | 'cached' | 'failed';
  onRetry: () => void;
}) => {
  const line: Record<typeof phase, ReactNode> = {
    none: 'No assistant is enabled, so this is ranked by the CRM’s own rules — breaches first, then overdue, then high priority.',
    loading: 'Ranked by the CRM’s own rules. The assistant is reading your day and will reorder this shortly.',
    ready: 'Reordered by the assistant from the same facts.',
    cached: 'Reordered by the assistant from the same facts.',
    failed: 'Ranked by the CRM’s own rules. The assistant could not finish.',
  };

  return (
    <p
      style={{
        ...theme.type.bodySmall,
        color: theme.color.textMuted,
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: theme.space(2),
        flexWrap: 'wrap',
      }}
    >
      <span aria-hidden="true" style={{ color: phase === 'ready' || phase === 'cached' ? theme.color.accentInk : theme.color.textSubtle, display: 'inline-flex' }}>
        <LvIcon name="sparkle" size={15} />
      </span>
      <span aria-live="polite" style={{ flex: 1, minWidth: 140 }}>
        {line[phase]}
      </span>
      {phase === 'loading' && <span className="lv-skeleton" aria-hidden="true" style={{ display: 'inline-block', width: 56, height: 8, borderRadius: 4 }} />}
      {phase === 'failed' && (
        <LvButton theme={theme} size="sm" variant="ghost" onClick={onRetry}>
          Try again
        </LvButton>
      )}
    </p>
  );
};
