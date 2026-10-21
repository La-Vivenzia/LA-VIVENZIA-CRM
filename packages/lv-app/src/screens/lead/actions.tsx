import { useEffect, useId, useMemo, useState } from 'react';

import { callRoute } from 'src/api/client';
import { type Lead360 } from 'src/api/leads';
import { LvIcon } from 'src/design/icons';
import { Field, formatWhen, LvButton, LvInput, LvSelect, LvTextarea, Segmented } from 'src/design/kit';
import { describeStatus } from 'src/design/status';
import { type LvTheme } from 'src/design/theme';
import { ActionConsequence, ActionContext, ActionSuccess, LeadActionSurface, type ActionPhase } from 'src/screens/lead/action-surface';

// The six things a person does to a relationship.
//
// Each one posts to the route that already owns the rule — logging an
// interaction is what creates the follow-up task and resolves the SLA, and a
// status change is refused by the server unless the transition is allowed.
// None of these dialogs re-implements a rule; they collect what the route
// needs, say what it will do, and show the refusal honestly when it says no.

export const LEAD_ACTIONS = ['interaction', 'task', 'note', 'status', 'owner'] as const;

export type LeadAction = (typeof LEAD_ACTIONS)[number];

const CHANNELS = ['PHONE', 'WHATSAPP', 'EMAIL', 'MEETING', 'INSTAGRAM', 'VIDEO_CALL', 'OTHER'];
const DIRECTIONS = ['OUTBOUND', 'INBOUND'];
const OUTCOMES = [
  'CONNECTED',
  'NO_ANSWER',
  'INTERESTED',
  'NOT_INTERESTED',
  'INFORMATION_SHARED',
  'COMMITMENT_MADE',
  'DOCUMENT_RECEIVED',
  'OBJECTION_RAISED',
  'RESCHEDULED',
  'NO_OUTCOME',
];
const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

// The server requires a reason of at least this length for the two lifecycle
// actions that end a relationship. Mirrored here so the button can say so
// before the round trip, never instead of the server's own check.
const MIN_REASON = 3;

const label = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

const localNow = (offsetMinutes = 0): string => {
  const now = new Date(Date.now() + offsetMinutes * 60_000);

  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

type WorkflowProps = {
  theme: LvTheme;
  data: Lead360;
  onClose: () => void;
  /** Re-reads the relationship; the routes change more than the record. */
  onDone: () => void;
  /** Moves the profile to a section, for a success step that has somewhere to go. */
  onOpenTab: (tab: string) => void;
};

const useSubmit = (onDone: () => void) => {
  const [phase, setPhase] = useState<ActionPhase>('form');
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setPhase('saving');
    setError(null);

    try {
      await work();
      setPhase('done');
      // The relationship is re-read straight away so whatever is behind the
      // dialog is already correct when it closes.
      onDone();
    } catch (cause) {
      // The server's own words. It knows why it refused.
      setError(cause instanceof Error ? cause.message : 'The server refused that action.');
      setPhase('form');
    }
  };

  return { phase, error, run, clearError: () => setError(null) };
};

// ---------------------------------------------------------------------------
// 4.1 Log an interaction
// ---------------------------------------------------------------------------
const LogInteraction = ({ theme, data, onClose, onDone, onOpenTab }: WorkflowProps) => {
  const ids = { channel: useId(), direction: useId(), when: useId(), outcome: useId(), sentiment: useId(), summary: useId() };
  const { phase, error, run } = useSubmit(onDone);
  const [channel, setChannel] = useState('PHONE');
  const [direction, setDirection] = useState('OUTBOUND');
  const [occurredAt, setOccurredAt] = useState(localNow());
  const [outcome, setOutcome] = useState('CONNECTED');
  const [sentiment, setSentiment] = useState('NEUTRAL');
  const [summary, setSummary] = useState('');
  const future = Date.parse(occurredAt) > Date.now() + 60_000;

  return (
    <LeadActionSurface
      theme={theme}
      title="Log an interaction"
      description="What happened, and what it means for the next step."
      size="full"
      phase={phase}
      error={error}
      onClose={onClose}
      submitLabel="Log it"
      canSubmit={occurredAt !== '' && !future}
      onSubmit={() =>
        void run(async () => {
          await callRoute('/interactions/log', {
            leadId: data.lead.id,
            channel,
            direction,
            occurredAt: new Date(occurredAt).toISOString(),
            outcome,
            sentiment,
            summary: summary.trim() || null,
          });
        })
      }
      context={<ActionContext theme={theme} name={data.lead.name ?? 'This lead'} reference={data.lead.lvLeadId} photoUrl={data.lead.photoUrl} />}
      consequence={
        <ActionConsequence theme={theme}>
          Recorded on the relationship&apos;s timeline. Logging a contact is also what resolves an open response clock and schedules the next follow-up.
        </ActionConsequence>
      }
      success={
        <ActionSuccess
          theme={theme}
          icon="messages"
          title="Interaction logged"
          detail="The timeline, the response clock and the next follow-up have all been updated."
          actions={
            <>
              <LvButton theme={theme} variant="secondary" onClick={onClose}>
                Back to the lead
              </LvButton>
              <LvButton
                theme={theme}
                variant="primary"
                onClick={() => {
                  onOpenTab('conversations');
                  onClose();
                }}
              >
                See conversations
              </LvButton>
            </>
          }
        />
      }
    >
      <div className="lv-field-grid">
        <Field theme={theme} label="Channel" htmlFor={ids.channel}>
          <LvSelect theme={theme} id={ids.channel} value={channel} onChange={(event) => setChannel(event.target.value)}>
            {CHANNELS.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </LvSelect>
        </Field>
        <Field theme={theme} label="Direction" htmlFor={ids.direction}>
          <LvSelect theme={theme} id={ids.direction} value={direction} onChange={(event) => setDirection(event.target.value)}>
            {DIRECTIONS.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </LvSelect>
        </Field>
        <Field
          theme={theme}
          label="When"
          htmlFor={ids.when}
          error={future ? 'An interaction cannot be logged in the future.' : undefined}
        >
          <LvInput theme={theme} id={ids.when} type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
        </Field>
        <Field theme={theme} label="Outcome" htmlFor={ids.outcome}>
          <LvSelect theme={theme} id={ids.outcome} value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            {OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </LvSelect>
        </Field>
      </div>
      <Field theme={theme} label="Sentiment" htmlFor={ids.sentiment} help="How the other person seemed, not how it went for us.">
        <LvSelect theme={theme} id={ids.sentiment} value={sentiment} onChange={(event) => setSentiment(event.target.value)}>
          {SENTIMENTS.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </LvSelect>
      </Field>
      <Field theme={theme} label="What was said" htmlFor={ids.summary} help="A short summary. The whole team reads this, and the assistant uses it later.">
        <LvTextarea theme={theme} id={ids.summary} value={summary} rows={4} onChange={(event) => setSummary(event.target.value)} />
      </Field>
    </LeadActionSurface>
  );
};

// ---------------------------------------------------------------------------
// 4.2 Create a follow-up
// ---------------------------------------------------------------------------
const CreateFollowUp = ({ theme, data, onClose, onDone }: WorkflowProps) => {
  const ids = { title: useId(), due: useId(), priority: useId() };
  const { phase, error, run } = useSubmit(onDone);
  const suggestion = data.intelligence.nextBestAction?.primary ?? null;
  const [title, setTitle] = useState(suggestion?.title ?? '');
  const [dueAt, setDueAt] = useState(localNow(24 * 60));
  const [priority, setPriority] = useState('MEDIUM');
  const past = Date.parse(dueAt) < Date.now() - 60_000;
  const tooShort = title.trim().length < 2;

  return (
    <LeadActionSurface
      theme={theme}
      title="Create a follow-up"
      description="One thing to do, and when it is due."
      phase={phase}
      error={error}
      onClose={onClose}
      submitLabel="Create the follow-up"
      canSubmit={!tooShort}
      onSubmit={() =>
        void run(async () => {
          await callRoute('/tasks/create', {
            leadId: data.lead.id,
            title: title.trim(),
            dueAt: new Date(dueAt).toISOString(),
            priority,
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          });
        })
      }
      context={<ActionContext theme={theme} name={data.lead.name ?? 'This lead'} reference={data.lead.lvLeadId} photoUrl={data.lead.photoUrl} />}
      consequence={
        <ActionConsequence theme={theme} tone={past ? 'warning' : 'neutral'}>
          {past
            ? 'This due date is in the past, so the follow-up will appear as overdue on Today the moment it is created.'
            : 'It appears on Today and in the follow-up queue, and this relationship stops counting as having no next action.'}
        </ActionConsequence>
      }
      success={
        <ActionSuccess
          theme={theme}
          icon="task"
          title="Follow-up created"
          detail={`Due ${formatWhen(new Date(dueAt).toISOString(), new Date().toISOString())}. It is on Today from now on.`}
          actions={
            <LvButton theme={theme} variant="primary" onClick={onClose}>
              Back to the lead
            </LvButton>
          }
        />
      }
    >
      <Field
        theme={theme}
        label="What needs doing"
        htmlFor={ids.title}
        required
        help={suggestion?.title ? 'Pre-filled from the recommended next step. Change it if something else matters more.' : undefined}
      >
        <LvInput theme={theme} id={ids.title} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <div className="lv-field-grid">
        <Field theme={theme} label="Due" htmlFor={ids.due}>
          <LvInput theme={theme} id={ids.due} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        <Field theme={theme} label="Priority" htmlFor={ids.priority}>
          <LvSelect theme={theme} id={ids.priority} value={priority} onChange={(event) => setPriority(event.target.value)}>
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </LvSelect>
        </Field>
      </div>
    </LeadActionSurface>
  );
};

// ---------------------------------------------------------------------------
// 4.3 Add an internal note
// ---------------------------------------------------------------------------
const AddNote = ({ theme, data, onClose, onDone, onOpenTab }: WorkflowProps) => {
  const id = useId();
  const { phase, error, run } = useSubmit(onDone);
  const [body, setBody] = useState('');
  const tooShort = body.trim().length < 2;

  return (
    <LeadActionSurface
      theme={theme}
      title="Add an internal note"
      description="Something the team should know that is not an interaction."
      phase={phase}
      error={error}
      onClose={onClose}
      submitLabel="Save the note"
      canSubmit={!tooShort}
      onSubmit={() =>
        void run(async () => {
          await callRoute('/notes/create', { leadId: data.lead.id, body: body.trim() });
        })
      }
      context={<ActionContext theme={theme} name={data.lead.name ?? 'This lead'} reference={data.lead.lvLeadId} photoUrl={data.lead.photoUrl} />}
      consequence={
        <ActionConsequence theme={theme}>
          Visible to everyone on the team who can see this relationship, and kept on its timeline. It is never sent to the partner.
        </ActionConsequence>
      }
      success={
        <ActionSuccess
          theme={theme}
          icon="note"
          title="Note saved"
          detail="It is on the relationship timeline for the rest of the team."
          actions={
            <>
              <LvButton theme={theme} variant="secondary" onClick={onClose}>
                Back to the lead
              </LvButton>
              <LvButton
                theme={theme}
                variant="primary"
                onClick={() => {
                  onOpenTab('timeline');
                  onClose();
                }}
              >
                See the timeline
              </LvButton>
            </>
          }
        />
      }
    >
      <Field theme={theme} label="Note" htmlFor={id} required>
        <LvTextarea theme={theme} id={id} value={body} rows={6} onChange={(event) => setBody(event.target.value)} />
      </Field>
    </LeadActionSurface>
  );
};

// ---------------------------------------------------------------------------
// 4.4 Change the status — including the two that end a relationship
// ---------------------------------------------------------------------------
type LifecycleAction = 'SET_STATUS' | 'CLOSE' | 'MARK_DUPLICATE' | 'ARCHIVE' | 'REOPEN';

type Impact = { dependents?: Record<string, number>; dependentTotal?: number } | null;

const ChangeStatus = ({ theme, data, onClose, onDone }: WorkflowProps) => {
  const ids = { status: useId(), reason: useId() };
  const { phase, error, run } = useSubmit(onDone);
  const settable = data.settableStatuses ?? [];
  const closed = settable.length === 0;
  const [mode, setMode] = useState<LifecycleAction>(closed ? 'REOPEN' : 'SET_STATUS');
  const [status, setStatus] = useState(settable[0] ?? '');
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState<Impact>(null);

  // What ending this relationship actually touches, counted by the server.
  // Only asked for when it matters, and never guessed at.
  const ending = mode === 'CLOSE' || mode === 'MARK_DUPLICATE';

  useEffect(() => {
    if (!ending) {
      setImpact(null);

      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const result = await callRoute<Impact>('/records/delete-impact', { object: 'lvLead', recordId: data.lead.id });

        if (!cancelled) {
          setImpact(result);
        }
      } catch {
        // The consequence line falls back to what it can say for certain.
        if (!cancelled) {
          setImpact(null);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [ending, data.lead.id]);

  const reasonRequired = mode === 'CLOSE' || mode === 'MARK_DUPLICATE';
  const reasonTooShort = reasonRequired && reason.trim().length < MIN_REASON;
  const canSubmit = mode === 'SET_STATUS' ? status !== '' : !reasonTooShort;

  const modes: { key: LifecycleAction; label: string }[] = closed
    ? [{ key: 'REOPEN', label: 'Reopen' }]
    : [
        { key: 'SET_STATUS', label: 'Move forward' },
        { key: 'CLOSE', label: 'Close' },
        { key: 'MARK_DUPLICATE', label: 'Duplicate' },
        { key: 'ARCHIVE', label: 'Archive' },
      ];

  const kept = useMemo(() => {
    const rows = impact?.dependents ?? {};

    return Object.entries(rows)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${count} ${key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`);
  }, [impact]);

  const consequence = () => {
    if (mode === 'REOPEN') {
      return <ActionConsequence theme={theme}>The relationship becomes active again and starts appearing in your open views.</ActionConsequence>;
    }

    if (mode === 'ARCHIVE') {
      return (
        <ActionConsequence theme={theme} tone="warning">
          Archiving takes the relationship out of your working views. Nothing is deleted, and it can be reopened.
        </ActionConsequence>
      );
    }

    if (ending) {
      return (
        <ActionConsequence theme={theme} tone="danger">
          <strong>{mode === 'CLOSE' ? 'Closing' : 'Marking as duplicate'} ends this relationship.</strong> It leaves your open views and its clocks stop.
          {kept.length > 0 ? ` Its history stays: ${kept.join(', ')}.` : ' Its history stays on the record.'} Nothing is deleted, and it can be reopened later.
        </ActionConsequence>
      );
    }

    return (
      <ActionConsequence theme={theme}>
        Moving to <strong>{describeStatus('lead', status).label}</strong>. The change is recorded in the audit trail with your name against it.
      </ActionConsequence>
    );
  };

  return (
    <LeadActionSurface
      theme={theme}
      title={closed ? 'Reopen this relationship' : 'Change the status'}
      description={closed ? 'A closed relationship has to be reopened before anything else can change.' : 'Only the transitions this relationship allows are offered.'}
      size="full"
      phase={phase}
      error={error}
      onClose={onClose}
      submitTone={ending ? 'danger' : 'primary'}
      submitLabel={
        mode === 'SET_STATUS'
          ? `Move to ${describeStatus('lead', status).label}`
          : mode === 'CLOSE'
            ? 'Close the relationship'
            : mode === 'MARK_DUPLICATE'
              ? 'Mark as duplicate'
              : mode === 'ARCHIVE'
                ? 'Archive it'
                : 'Reopen it'
      }
      canSubmit={canSubmit}
      onSubmit={() =>
        void run(async () => {
          await callRoute('/leads/lifecycle', {
            leadId: data.lead.id,
            action: mode,
            ...(mode === 'SET_STATUS' ? { status } : {}),
            reason: reason.trim() || null,
          });
        })
      }
      context={
        <ActionContext
          theme={theme}
          name={data.lead.name ?? 'This lead'}
          reference={data.lead.lvLeadId}
          photoUrl={data.lead.photoUrl}
          status={describeStatus('lead', data.lead.status).label}
        />
      }
      consequence={consequence()}
      success={
        <ActionSuccess
          theme={theme}
          icon="check"
          title="Status changed"
          detail="The relationship, its clocks and the audit trail have all been updated."
          actions={
            <LvButton theme={theme} variant="primary" onClick={onClose}>
              Back to the lead
            </LvButton>
          }
        />
      }
    >
      {modes.length > 1 && (
        <Segmented
          theme={theme}
          label="What kind of change"
          value={mode}
          onChange={(key) => {
            setMode(key as LifecycleAction);
            setReason('');
          }}
          options={modes.map((entry) => ({ key: entry.key, label: entry.label }))}
        />
      )}

      {mode === 'SET_STATUS' && (
        <Field theme={theme} label="New status" htmlFor={ids.status} help="Statuses the server will not accept from here are not listed.">
          <LvSelect theme={theme} id={ids.status} value={status} onChange={(event) => setStatus(event.target.value)}>
            {settable.map((value) => (
              <option key={value} value={value}>
                {describeStatus('lead', value).label}
              </option>
            ))}
          </LvSelect>
        </Field>
      )}

      <Field
        theme={theme}
        label="Reason"
        htmlFor={ids.reason}
        required={reasonRequired}
        help={reasonRequired ? 'Required, and kept in the audit trail. Say what happened, not what status it is.' : 'Optional. Kept in the audit trail.'}
        error={reasonTooShort && reason.length > 0 ? `At least ${MIN_REASON} characters.` : undefined}
      >
        <LvTextarea theme={theme} id={ids.reason} value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </LeadActionSurface>
  );
};

// ---------------------------------------------------------------------------
// 4.5 Assign / reassign the owner
// ---------------------------------------------------------------------------
const ChangeOwner = ({ theme, data, onClose, onDone }: WorkflowProps) => {
  const ids = { owner: useId(), reason: useId() };
  const { phase, error, run } = useSubmit(onDone);
  const me = data.caller.workspaceMemberId;
  const current = data.lead.owner;
  const claiming = data.capabilities.canClaim && current === null;
  const [ownerId, setOwnerId] = useState<string>(claiming && me ? me : (current?.id ?? ''));
  const [reason, setReason] = useState('');
  const chosen = data.members.find((member) => member.id === ownerId) ?? null;
  const unchanged = (current?.id ?? '') === ownerId;

  // The last assignment the engine made, with the reason it gave. It is the
  // most useful thing on this screen: it says why the lead is where it is.
  const lastAssignment = data.assignment.history[0] ?? null;

  return (
    <LeadActionSurface
      theme={theme}
      title={claiming ? 'Claim this relationship' : 'Change the owner'}
      description={claiming ? 'Nobody owns it yet. Taking it makes you responsible for the next step.' : 'Who is responsible for this relationship from now on.'}
      phase={phase}
      error={error}
      onClose={onClose}
      submitLabel={claiming ? 'Claim it' : ownerId === '' ? 'Leave it unassigned' : `Assign to ${chosen?.displayName ?? 'them'}`}
      canSubmit={!unchanged || ownerId === ''}
      onSubmit={() =>
        void run(async () => {
          await callRoute('/leads/assign', { leadId: data.lead.id, newOwnerId: ownerId === '' ? null : ownerId, reason: reason.trim() || null });
        })
      }
      context={
        <ActionContext
          theme={theme}
          name={data.lead.name ?? 'This lead'}
          reference={data.lead.lvLeadId}
          photoUrl={data.lead.photoUrl}
          status={current ? `Owned by ${current.displayName ?? 'someone'}` : 'Unassigned'}
        />
      }
      consequence={
        <ActionConsequence theme={theme} tone={ownerId === '' && current !== null ? 'warning' : 'neutral'}>
          {ownerId === '' && current !== null
            ? 'Leaving it unassigned means nobody is responsible for it and it will show up as needing an owner.'
            : 'The new owner is notified, the response clocks are re-evaluated against them, and the handover is recorded with its reason.'}
        </ActionConsequence>
      }
      success={
        <ActionSuccess
          theme={theme}
          icon="person"
          title={claiming ? 'It is yours' : 'Owner changed'}
          detail="They have been notified and the handover is on the record."
          actions={
            <LvButton theme={theme} variant="primary" onClick={onClose}>
              Back to the lead
            </LvButton>
          }
        />
      }
    >
      {lastAssignment && (
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
          Last handover: <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.medium }}>{lastAssignment.from?.displayName ?? 'Unassigned'} → {lastAssignment.to?.displayName ?? 'Unassigned'}</strong>
          {lastAssignment.reason ? ` — ${lastAssignment.reason}` : ''}
        </p>
      )}

      <Field theme={theme} label="Owner" htmlFor={ids.owner} help="Only team members the assignment policy will accept for this relationship are listed.">
        <LvSelect theme={theme} id={ids.owner} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
          <option value="">Unassigned</option>
          {data.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName ?? member.email ?? 'Team member'}
              {member.id === me ? ' (you)' : ''}
            </option>
          ))}
        </LvSelect>
      </Field>

      <Field theme={theme} label="Reason" htmlFor={ids.reason} help="Optional, but it is what the next person reads when they wonder why.">
        <LvTextarea theme={theme} id={ids.reason} value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </LeadActionSurface>
  );
};

// ---------------------------------------------------------------------------

export const LeadActionDialog = ({
  theme,
  action,
  data,
  onClose,
  onDone,
  onOpenTab,
}: {
  theme: LvTheme;
  action: LeadAction;
  data: Lead360;
  onClose: () => void;
  onDone: () => void;
  onOpenTab: (tab: string) => void;
}) => {
  const shared = { theme, data, onClose, onDone, onOpenTab };

  switch (action) {
    case 'interaction':
      return <LogInteraction theme={shared.theme} data={shared.data} onClose={shared.onClose} onDone={shared.onDone} onOpenTab={shared.onOpenTab} />;
    case 'task':
      return <CreateFollowUp theme={shared.theme} data={shared.data} onClose={shared.onClose} onDone={shared.onDone} onOpenTab={shared.onOpenTab} />;
    case 'note':
      return <AddNote theme={shared.theme} data={shared.data} onClose={shared.onClose} onDone={shared.onDone} onOpenTab={shared.onOpenTab} />;
    case 'status':
      return <ChangeStatus theme={shared.theme} data={shared.data} onClose={shared.onClose} onDone={shared.onDone} onOpenTab={shared.onOpenTab} />;
    case 'owner':
      return <ChangeOwner theme={shared.theme} data={shared.data} onClose={shared.onClose} onDone={shared.onDone} onOpenTab={shared.onOpenTab} />;
    default:
      return null;
  }
};

export { LvIcon as LeadActionIcon };
