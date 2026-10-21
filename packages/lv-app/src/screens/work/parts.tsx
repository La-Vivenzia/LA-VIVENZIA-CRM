import { useEffect, useState } from 'react';

import {
  createTask,
  QUICK_ACTIONS,
  searchLeads,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type LeadOption,
  type QuickActionKey,
  type TaskPriority,
  type WorkLens,
  type WorkTask,
} from 'src/api/work';
import { LvIcon } from 'src/design/icons';
import {
  EmptyState,
  Field,
  formatWhen,
  InlineNotice,
  LvBadge,
  LvButton,
  LvInput,
  LvSelect,
  LvTable,
  LvTextarea,
  VisuallyHidden,
} from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { type BadgeTone } from 'src/design/status';
import { type LvTheme } from 'src/design/theme';

// The pieces the four task lenses share. Nothing here knows which lens it is
// rendering — a row is a row; the screen decides which rows it has.

// ---------------------------------------------------------------------------
// Reading a task at a glance
// ---------------------------------------------------------------------------

/** Priority is the lead priority enum, so it reads on the same tone scale. */
const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
};

export const PriorityBadge = ({ theme, priority }: { theme: LvTheme; priority: TaskPriority | null }) =>
  priority === null ? (
    <span style={{ ...theme.type.bodySmall, color: theme.color.textSubtle }}>—</span>
  ) : (
    <LvBadge theme={theme} tone={PRIORITY_TONE[priority]}>
      {TASK_PRIORITY_LABELS[priority]}
    </LvBadge>
  );

/**
 * A due date carries its own urgency, so it is coloured by the day it falls on
 * rather than by the lens it happens to be shown in — the same row reads the
 * same way wherever it appears.
 */
export const DueLabel = ({ theme, task, now }: { theme: LvTheme; task: WorkTask; now: string }) => {
  if (task.dueAt === null) {
    return (
      <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
        No date yet
      </span>
    );
  }

  const overdue = task.status !== 'DONE' && Date.parse(task.dueAt) < Date.parse(now);
  const stamp = new Date(task.dueAt);
  const date = stamp.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = stamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <span style={{ ...theme.type.bodySmall, color: overdue ? theme.color.danger : theme.color.text, fontWeight: overdue ? theme.font.weight.medium : undefined }}>
      {date}, {time}
      <span style={{ display: 'block', ...theme.type.caption, color: overdue ? theme.color.danger : theme.color.textSubtle }}>
        {formatWhen(task.dueAt, now)}
      </span>
    </span>
  );
};

/**
 * Which relationship this belongs to. A task with no `taskTarget` on a lead
 * cannot be completed through `/tasks/update`, so the row says so instead of
 * offering a button that would be refused.
 */
export const LeadCell = ({ theme, task, onOpenLead }: { theme: LvTheme; task: WorkTask; onOpenLead: (leadId: string) => void }) => {
  if (task.leadId === null) {
    return (
      <span style={{ ...theme.type.bodySmall, color: theme.color.textSubtle }} title="This follow-up is not attached to a lead.">
        Not on a relationship
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenLead(task.leadId as string)}
      className="lv-text-button"
      style={{
        ...theme.type.bodySmall,
        background: 'transparent',
        border: 'none',
        padding: 0,
        textAlign: 'left',
        color: theme.color.brand,
        fontFamily: theme.font.body,
        cursor: 'pointer',
        minWidth: 0,
        overflowWrap: 'anywhere',
      }}
    >
      {task.leadName ?? 'Open the lead'}
      {task.leadRef && <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle }}>{task.leadRef}</span>}
    </button>
  );
};

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

export const TaskQueue = ({
  theme,
  tasks,
  now,
  lens,
  busyId,
  onOpen,
  onOpenLead,
  onPrimary,
}: {
  theme: LvTheme;
  tasks: WorkTask[];
  now: string;
  lens: WorkLens;
  busyId: string | null;
  onOpen: (task: WorkTask) => void;
  onOpenLead: (leadId: string) => void;
  onPrimary: (task: WorkTask) => void;
}) => (
  <LvTable
    theme={theme}
    caption={`Follow-ups, ${lens}`}
    rowKey={(task: WorkTask) => task.id}
    rows={tasks}
    emptyText="Nothing here."
    columns={[
      {
        key: 'title',
        label: 'Follow-up',
        render: (task: WorkTask) => (
          <button
            type="button"
            onClick={() => onOpen(task)}
            className="lv-text-button"
            style={{
              ...theme.type.subheading,
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              color: theme.color.heading,
              fontFamily: theme.font.body,
              cursor: 'pointer',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {task.title}
            {task.sourceChannel && (
              <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle, fontWeight: theme.font.weight.regular }}>
                From a {task.sourceChannel.toLowerCase().replace(/_/g, ' ')}
              </span>
            )}
          </button>
        ),
      },
      { key: 'lead', label: 'Relationship', render: (task: WorkTask) => <LeadCell theme={theme} task={task} onOpenLead={onOpenLead} /> },
      { key: 'due', label: lens === 'completed' ? 'Was due' : 'Due', render: (task: WorkTask) => <DueLabel theme={theme} task={task} now={now} /> },
      { key: 'priority', label: 'Priority', render: (task: WorkTask) => <PriorityBadge theme={theme} priority={task.priority} /> },
      {
        key: 'assignee',
        label: 'Owner',
        hideOnMobile: false,
        render: (task: WorkTask) => (
          <span style={{ ...theme.type.bodySmall, color: task.assigneeName ? theme.color.text : theme.color.textSubtle }}>
            {task.assigneeName ?? 'Unassigned'}
          </span>
        ),
      },
      {
        key: 'action',
        label: 'Action',
        align: 'right',
        render: (task: WorkTask) => (
          <LvButton
            theme={theme}
            size="sm"
            variant={lens === 'completed' ? 'secondary' : lens === 'overdue' ? 'primary' : 'secondary'}
            busy={busyId === task.id}
            disabled={task.leadId === null || busyId !== null}
            onClick={() => onPrimary(task)}
            icon={<LvIcon name={lens === 'completed' ? 'clock' : 'check'} size={16} />}
          >
            {lens === 'completed' ? 'Reopen' : 'Mark done'}
          </LvButton>
        ),
      },
    ]}
  />
);

// ---------------------------------------------------------------------------
// One task, opened
// ---------------------------------------------------------------------------

export const TaskSheet = ({
  theme,
  task,
  now,
  busy,
  error,
  onClose,
  onComplete,
  onReopen,
  onReschedule,
  onOpenLead,
}: {
  theme: LvTheme;
  task: WorkTask;
  now: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onReschedule: (dueAt: string) => void;
  onOpenLead: (leadId: string) => void;
}) => {
  // `datetime-local` wants a local-time string with no zone; the route wants an
  // ISO instant. The input converts on the way out, so the two never disagree.
  const [when, setWhen] = useState(() => {
    const base = task.dueAt ? new Date(task.dueAt) : new Date(Date.now() + 24 * 3600 * 1000);
    const local = new Date(base.getTime() - base.getTimezoneOffset() * 60_000);

    return local.toISOString().slice(0, 16);
  });
  const done = task.status === 'DONE';

  return (
    <LvSheet
      theme={theme}
      title={task.title}
      description={task.leadName ? `On ${task.leadName}${task.leadRef ? ` · ${task.leadRef}` : ''}` : 'Not attached to a relationship'}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
          {done ? (
            <LvButton theme={theme} variant="secondary" busy={busy} disabled={task.leadId === null} onClick={onReopen} icon={<LvIcon name="clock" size={16} />}>
              Reopen
            </LvButton>
          ) : (
            <LvButton theme={theme} variant="primary" busy={busy} disabled={task.leadId === null} onClick={onComplete} icon={<LvIcon name="check" size={16} />}>
              Mark done
            </LvButton>
          )}
          <LvButton theme={theme} variant="ghost" onClick={onClose}>
            Close
          </LvButton>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}

        {task.leadId === null && (
          <InlineNotice theme={theme} tone="warning">
            This follow-up is not attached to a relationship, so it cannot be completed or rescheduled from here.
          </InlineNotice>
        )}

        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: theme.space(3), margin: 0 }}>
          <Detail theme={theme} label="Status" value={TASK_STATUS_LABELS[task.status]} />
          <Detail theme={theme} label="Priority" value={task.priority ? TASK_PRIORITY_LABELS[task.priority] : 'Not set'} />
          <Detail theme={theme} label="Owner" value={task.assigneeName ?? 'Unassigned'} />
          <Detail theme={theme} label={done ? 'Was due' : 'Due'} value={task.dueAt ? `${new Date(task.dueAt).toLocaleString()} · ${formatWhen(task.dueAt, now)}` : 'No date yet'} />
        </dl>

        {task.leadId !== null && (
          <LvButton theme={theme} variant="secondary" size="sm" onClick={() => onOpenLead(task.leadId as string)} icon={<LvIcon name="leads" size={16} />}>
            Open the relationship
          </LvButton>
        )}

        {!done && task.leadId !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), borderTop: `1px solid ${theme.color.border}`, paddingTop: theme.space(3) }}>
            <Field theme={theme} label="Move it to" htmlFor="work-reschedule">
              <LvInput theme={theme} id="work-reschedule" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
            </Field>
            <LvButton
              theme={theme}
              variant="secondary"
              size="sm"
              busy={busy}
              disabled={when.length === 0}
              onClick={() => onReschedule(new Date(when).toISOString())}
              icon={<LvIcon name="meeting" size={16} />}
            >
              Reschedule
            </LvButton>
          </div>
        )}
      </div>
    </LvSheet>
  );
};

const Detail = ({ theme, label, value }: { theme: LvTheme; label: string; value: string }) => (
  <div style={{ minWidth: 0 }}>
    <dt style={{ ...theme.type.label, color: theme.color.textMuted, marginBottom: 2 }}>{label}</dt>
    <dd style={{ ...theme.type.body, margin: 0, color: theme.color.text, overflowWrap: 'anywhere' }}>{value}</dd>
  </div>
);

// ---------------------------------------------------------------------------
// Creating one
// ---------------------------------------------------------------------------

/**
 * `/tasks/create` requires a `leadId`, so this starts with the relationship
 * rather than ending with it. A quick action fills title, due date and
 * priority on the server; the fields below are the long way round to the same
 * task.
 */
export const NewTaskSheet = ({ theme, onClose, onCreated }: { theme: LvTheme; onClose: () => void; onCreated: () => void }) => {
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState<LeadOption[]>([]);
  const [lead, setLead] = useState<LeadOption | null>(null);
  const [preset, setPreset] = useState<QuickActionKey | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (lead !== null || term.trim().length < 2) {
      setOptions([]);

      return;
    }

    let live = true;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchLeads(term)
        .then((found) => {
          if (live) {
            setOptions(found);
          }
        })
        .catch(() => {
          if (live) {
            setOptions([]);
          }
        })
        .finally(() => {
          if (live) {
            setSearching(false);
          }
        });
    }, 250);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term, lead]);

  const submit = async () => {
    if (lead === null) {
      setError('Choose the relationship this follow-up belongs to.');

      return;
    }

    if (preset === '' && title.trim().length === 0) {
      setError('Give the follow-up a title, or choose one of the presets.');

      return;
    }

    setBusy(true);
    setError(null);

    try {
      await createTask({
        leadId: lead.id,
        ...(preset !== '' ? { quickAction: preset } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        ...(priority !== '' ? { priority } : {}),
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That follow-up could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LvSheet
      theme={theme}
      title="New follow-up"
      description="Every follow-up belongs to a relationship."
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
          <LvButton theme={theme} variant="primary" busy={busy} disabled={lead === null} onClick={() => void submit()}>
            Create follow-up
          </LvButton>
          <LvButton theme={theme} variant="ghost" onClick={onClose}>
            Cancel
          </LvButton>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}

        {lead === null ? (
          <Field theme={theme} label="Relationship" htmlFor="work-lead" required help="Search by name, reference or place.">
            <LvInput theme={theme} id="work-lead" value={term} placeholder="e.g. Sunset Villa, LV-000003" onChange={(event) => setTerm(event.target.value)} />
            {searching && <VisuallyHidden>Searching</VisuallyHidden>}
            {options.length > 0 && (
              <ul style={{ margin: `${theme.space(2)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                {options.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      onClick={() => setLead(option)}
                      style={{
                        ...theme.type.body,
                        width: '100%',
                        minHeight: 44,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${theme.color.border}`,
                        padding: `${theme.space(2)}px 0`,
                        color: theme.color.text,
                        fontFamily: theme.font.body,
                        cursor: 'pointer',
                      }}
                    >
                      {option.name}
                      {option.ref && <span style={{ ...theme.type.caption, color: theme.color.textSubtle, display: 'block' }}>{option.ref}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!searching && term.trim().length >= 2 && options.length === 0 && (
              <EmptyState theme={theme} quiet text="No relationship matches that." />
            )}
          </Field>
        ) : (
          <InlineNotice theme={theme} tone="success">
            {lead.name}
            {lead.ref ? ` · ${lead.ref}` : ''}{' '}
            <LvButton
              theme={theme}
              variant="ghost"
              size="sm"
              onClick={() => {
                setLead(null);
                setTerm('');
              }}
            >
              change
            </LvButton>
          </InlineNotice>
        )}

        <Field theme={theme} label="One of the usual ones" htmlFor="work-preset" help="Fills the title, due date and priority.">
          <LvSelect theme={theme} id="work-preset" value={preset} onChange={(event) => setPreset(event.target.value as QuickActionKey | '')}>
            <option value="">Write it myself</option>
            {QUICK_ACTIONS.map((action) => (
              <option key={action.key} value={action.key}>
                {action.label}
              </option>
            ))}
          </LvSelect>
        </Field>

        <Field theme={theme} label="Title" htmlFor="work-title" help={preset === '' ? undefined : 'Leave empty to use the preset’s own title.'}>
          <LvInput theme={theme} id="work-title" value={title} maxLength={200} placeholder="What needs doing" onChange={(event) => setTitle(event.target.value)} />
        </Field>

        <Field theme={theme} label="Detail" htmlFor="work-description">
          <LvTextarea theme={theme} id="work-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: theme.space(3) }}>
          <Field theme={theme} label="Due" htmlFor="work-due" help={preset === '' ? undefined : 'Overrides the preset.'}>
            <LvInput theme={theme} id="work-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </Field>
          <Field theme={theme} label="Priority" htmlFor="work-priority">
            <LvSelect theme={theme} id="work-priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority | '')}>
              <option value="">Leave to the preset</option>
              {TASK_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {TASK_PRIORITY_LABELS[value]}
                </option>
              ))}
            </LvSelect>
          </Field>
        </div>
      </div>
    </LvSheet>
  );
};
