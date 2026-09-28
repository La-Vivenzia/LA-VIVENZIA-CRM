import { useId, useState } from 'react';

import { callRoute } from 'src/api/client';
import { Field, InlineNotice, LvInput, LvSelect, LvTextarea } from 'src/design/kit';
import { LvModal, LvModalFooter } from 'src/design/overlay';
import { describeStatus } from 'src/design/status';
import { type LvTheme } from 'src/design/theme';

// The four things a person does to a relationship: record what happened, move
// it forward, schedule the next touch, and write something down.
//
// Each one posts to the route that already owns the rule — logging an
// interaction is what creates the follow-up task and resolves the SLA, and a
// status change is refused by the server unless the transition is allowed. The
// dialog's only job is to collect the fields and show the refusal honestly.

export type LeadAction = 'interaction' | 'status' | 'task' | 'note';

const CHANNELS = ['PHONE', 'WHATSAPP', 'EMAIL', 'MEETING', 'INSTAGRAM', 'VIDEO_CALL', 'OTHER'];
const DIRECTIONS = ['OUTBOUND', 'INBOUND'];
const OUTCOMES = ['CONNECTED', 'NO_ANSWER', 'INTERESTED', 'NOT_INTERESTED', 'INFORMATION_SHARED', 'COMMITMENT_MADE', 'DOCUMENT_RECEIVED', 'OBJECTION_RAISED', 'RESCHEDULED', 'NO_OUTCOME'];
const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

const label = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

const localNow = (): string => {
  const now = new Date();

  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const LeadActionDialog = ({
  theme,
  action,
  leadId,
  settableStatuses,
  onClose,
  onDone,
}: {
  theme: LvTheme;
  action: LeadAction;
  leadId: string;
  settableStatuses: string[];
  onClose: () => void;
  // Called after the server accepted, so the profile can reload itself.
  onDone: () => void;
}) => {
  const ids = { a: useId(), b: useId(), c: useId(), d: useId(), e: useId(), f: useId() };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState('PHONE');
  const [direction, setDirection] = useState('OUTBOUND');
  const [occurredAt, setOccurredAt] = useState(localNow());
  const [outcome, setOutcome] = useState('CONNECTED');
  const [sentiment, setSentiment] = useState('NEUTRAL');
  const [summary, setSummary] = useState('');

  const [status, setStatus] = useState(settableStatuses[0] ?? '');
  const [reason, setReason] = useState('');

  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState(localNow());
  const [priority, setPriority] = useState('MEDIUM');

  const [note, setNote] = useState('');

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      if (action === 'interaction') {
        await callRoute('/interactions/log', {
          leadId,
          channel,
          direction,
          occurredAt: new Date(occurredAt).toISOString(),
          outcome,
          sentiment,
          summary: summary.trim() || null,
        });
      } else if (action === 'status') {
        await callRoute('/leads/lifecycle', { leadId, action: 'SET_STATUS', status, reason: reason.trim() || null });
      } else if (action === 'task') {
        await callRoute('/tasks/create', {
          leadId,
          title: title.trim(),
          dueAt: new Date(dueAt).toISOString(),
          priority,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        });
      } else {
        await callRoute('/notes/create', { leadId, body: note.trim() });
      }

      onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The server refused that action.');
      setBusy(false);
    }
  };

  const titles: Record<LeadAction, { title: string; description: string; confirm: string }> = {
    interaction: { title: 'Log an interaction', description: 'What happened, and what it means for the next step.', confirm: 'Log it' },
    status: { title: 'Change the status', description: 'Only the transitions this lead allows are offered.', confirm: 'Change status' },
    task: { title: 'Create a follow-up', description: 'It appears in Today and in the follow-up queue.', confirm: 'Create task' },
    note: { title: 'Add an internal note', description: 'Visible to the team on this relationship.', confirm: 'Save note' },
  };
  const copy = titles[action];
  const canSubmit =
    action === 'interaction'
      ? occurredAt !== ''
      : action === 'status'
        ? status !== ''
        : action === 'task'
          ? title.trim().length > 1
          : note.trim().length > 1;

  return (
    <LvModal
      theme={theme}
      title={copy.title}
      description={copy.description}
      onClose={onClose}
      footer={<LvModalFooter theme={theme} onCancel={onClose} onConfirm={() => void submit()} confirmLabel={copy.confirm} busy={busy} disabled={!canSubmit} />}
    >
      {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}

      {action === 'interaction' && (
        <>
          <div className="lv-field-grid">
            <Field theme={theme} label="Channel" htmlFor={ids.a}>
              <LvSelect theme={theme} id={ids.a} value={channel} onChange={(event) => setChannel(event.target.value)} >
                {CHANNELS.map((value) => (<option key={value} value={value}>{label(value)}</option>))}
              </LvSelect>
            </Field>
            <Field theme={theme} label="Direction" htmlFor={ids.b}>
              <LvSelect theme={theme} id={ids.b} value={direction} onChange={(event) => setDirection(event.target.value)} >
                {DIRECTIONS.map((value) => (<option key={value} value={value}>{label(value)}</option>))}
              </LvSelect>
            </Field>
            <Field theme={theme} label="When" htmlFor={ids.c}>
              <LvInput theme={theme} id={ids.c} type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
            </Field>
            <Field theme={theme} label="Outcome" htmlFor={ids.d}>
              <LvSelect theme={theme} id={ids.d} value={outcome} onChange={(event) => setOutcome(event.target.value)} >
                {OUTCOMES.map((value) => (<option key={value} value={value}>{label(value)}</option>))}
              </LvSelect>
            </Field>
          </div>
          <Field theme={theme} label="Sentiment" htmlFor={ids.e}>
            <LvSelect theme={theme} id={ids.e} value={sentiment} onChange={(event) => setSentiment(event.target.value)} >
                {SENTIMENTS.map((value) => (<option key={value} value={value}>{label(value)}</option>))}
            </LvSelect>
          </Field>
          <Field theme={theme} label="What was said" htmlFor={ids.f} help="A short summary; the assistant uses it later.">
            <LvTextarea theme={theme} id={ids.f} value={summary} rows={4} onChange={(event) => setSummary(event.target.value)} />
          </Field>
        </>
      )}

      {action === 'status' && (
        <>
          <Field theme={theme} label="New status" htmlFor={ids.a}>
            <LvSelect
              theme={theme}
              id={ids.a}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {settableStatuses.map((value) => (
                <option key={value} value={value}>
                  {describeStatus('lead', value).label}
                </option>
              ))}
            </LvSelect>
          </Field>
          <Field theme={theme} label="Reason" htmlFor={ids.b} help="Required for a negative outcome, kept in the audit trail.">
            <LvTextarea theme={theme} id={ids.b} value={reason} rows={3} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </>
      )}

      {action === 'task' && (
        <>
          <Field theme={theme} label="What needs doing" htmlFor={ids.a} required>
            <LvInput theme={theme} id={ids.a} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <div className="lv-field-grid">
            <Field theme={theme} label="Due" htmlFor={ids.b}>
              <LvInput theme={theme} id={ids.b} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </Field>
            <Field theme={theme} label="Priority" htmlFor={ids.c}>
              <LvSelect theme={theme} id={ids.c} value={priority} onChange={(event) => setPriority(event.target.value)} >
                {PRIORITIES.map((value) => (<option key={value} value={value}>{label(value)}</option>))}
              </LvSelect>
            </Field>
          </div>
        </>
      )}

      {action === 'note' && (
        <Field theme={theme} label="Note" htmlFor={ids.a} required>
          <LvTextarea theme={theme} id={ids.a} value={note} rows={6} onChange={(event) => setNote(event.target.value)} />
        </Field>
      )}
    </LvModal>
  );
};
