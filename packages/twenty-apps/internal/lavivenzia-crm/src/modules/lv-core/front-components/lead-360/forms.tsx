import { type ReactNode, useState } from 'react';

import { LEAD_PRIORITIES, LEAD_PRIORITY_LABELS, type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { formatDateTimeLocal, localInputToIso, statusLabel } from 'src/modules/lv-core/front-components/lead-360/lead-360-view';
import { type Lead360Model, type MemberSummary, type TaskSummary } from 'src/modules/lv-core/services/lead-360';
import { Disclosure, Field, LvButton, LvCard } from 'src/modules/lv-core/ui/kit';
import { type LvTheme, layout } from 'src/modules/lv-core/ui/theme';
import { CLOSING_STATUSES } from 'src/modules/lv-governance/services/governance';
import { LEAD_CATEGORY_OPTIONS, LEAD_SOURCE_OPTIONS, LEAD_SUBCATEGORY_OPTIONS } from 'src/modules/lv-core/constants/select-options.generated';
import { QUICK_ACTIONS } from 'src/modules/lv-followups/utils/quick-actions';
import { INTERACTION_DIRECTIONS } from 'src/modules/lv-interactions/constants/interaction-direction';
import {
  channelSupportsDuration,
  INTERACTION_CHANNEL_LABELS,
  INTERACTION_CHANNELS,
  INTERACTION_OUTCOME_LABELS,
  INTERACTION_OUTCOMES,
  INTERACTION_PURPOSE_LABELS,
  INTERACTION_PURPOSES,
  INTERACTION_SENTIMENT_LABELS,
  INTERACTION_SENTIMENTS,
  type InteractionChannel,
  isInteractionChannel,
} from 'src/modules/lv-interactions/constants/interaction-vocabulary';
import { validateInteractionInput } from 'src/modules/lv-interactions/utils/validate-interaction-input';

// The inline forms Lead 360 opens in place of a modal: add interaction, create
// task, add note, change status, change owner. Each collects input and hands
// a body to `onSubmit`; identity is never part of that body — the route takes
// the actor from the session. Validation that exists on the server is reused
// here (validateInteractionInput) so the page cannot invent a looser rule.

type Submit = (body: Record<string, unknown>) => Promise<void>;

const grid = (theme: LvTheme) => ({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.space(3) });

const FormShell = ({ theme, title, children, error, busy, submitLabel, onSubmit, onCancel, submitDisabled, intro }: { theme: LvTheme; title: string; children: ReactNode; error: string | null; busy: boolean; submitLabel: string; onSubmit: () => void; onCancel: () => void; submitDisabled?: boolean; intro?: string }) => (
  <form
    aria-label={title}
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <LvCard theme={theme} tone="info" padding={theme.space(3)} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), background: theme.color.surfaceRaised }}>
      <div>
        <h3 style={{ ...theme.type.title, margin: 0, color: theme.color.heading }}>{title}</h3>
        {intro && <p style={{ ...theme.type.bodySmall, margin: `${theme.space(1)}px 0 0`, color: theme.color.textMuted }}>{intro}</p>}
      </div>
      {children}
      {error && (
        <div role="alert" style={{ ...theme.type.bodySmall, color: theme.color.danger, background: theme.color.dangerMuted, borderRadius: theme.radius.sm, padding: `${theme.space(2)}px ${theme.space(3)}px` }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
        <LvButton theme={theme} type="submit" variant="primary" disabled={submitDisabled} busy={busy}>
          {submitLabel}
        </LvButton>
        <LvButton theme={theme} variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </LvButton>
      </div>
    </LvCard>
  </form>
);

const nowLocal = () => formatDateTimeLocal(new Date().toISOString());

// ----------------------------------------------------------- interaction
export const InteractionForm = ({ theme, leadId, onSubmit, onCancel, initialChannel = 'PHONE' }: { theme: LvTheme; leadId: string; onSubmit: Submit; onCancel: () => void; initialChannel?: InteractionChannel }) => {
  const s = layout(theme);
  const [channel, setChannel] = useState<InteractionChannel>(initialChannel);
  const [direction, setDirection] = useState<string>('OUTBOUND');
  const [occurredAt, setOccurredAt] = useState(nowLocal());
  const [duration, setDuration] = useState('');
  const [purpose, setPurpose] = useState('');
  const [summary, setSummary] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [outcome, setOutcome] = useState('');
  const [objections, setObjections] = useState('');
  const [commitments, setCommitments] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const body = {
      leadId,
      channel,
      direction,
      occurredAt: localInputToIso(occurredAt),
      durationMinutes: duration === '' ? null : Number.parseInt(duration, 10),
      purpose: purpose || null,
      summary: summary || null,
      sentiment: sentiment || null,
      outcome: outcome || null,
      objections: objections || null,
      commitments: commitments || null,
      nextAction: nextAction || null,
      nextFollowUpAt: localInputToIso(nextFollowUpAt),
    };
    const check = validateInteractionInput(body, new Date().toISOString());

    if (!check.ok) {
      setError(check.errors[0]);

      return;
    }

    setError(null);
    setBusy(true);

    try {
      await onSubmit(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The interaction was not saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell theme={theme} title="Add interaction" intro="The essentials take a minute; open the details if the conversation had more in it." error={error} busy={busy} submitLabel="Log interaction" onSubmit={() => void submit()} onCancel={onCancel}>
      <div style={grid(theme)}>
        <Field theme={theme} label="Channel" htmlFor="lv360-channel" required>
          <select id="lv360-channel" value={channel} onChange={(event) => (isInteractionChannel(event.target.value) ? setChannel(event.target.value) : undefined)} style={s.input}>
            {INTERACTION_CHANNELS.map((value) => (
              <option key={value} value={value}>{INTERACTION_CHANNEL_LABELS[value]}</option>
            ))}
          </select>
        </Field>
        <Field theme={theme} label="Direction" htmlFor="lv360-direction">
          <select id="lv360-direction" value={direction} onChange={(event) => setDirection(event.target.value)} style={s.input}>
            {INTERACTION_DIRECTIONS.map((value) => (
              <option key={value} value={value}>{value === 'INBOUND' ? 'Inbound — they contacted us' : 'Outbound — we contacted them'}</option>
            ))}
          </select>
        </Field>
        <Field theme={theme} label="Date and time" htmlFor="lv360-occurred">
          <input id="lv360-occurred" type="datetime-local" defaultValue={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} style={s.input} />
        </Field>
        <Field theme={theme} label="Outcome" htmlFor="lv360-outcome">
          <select id="lv360-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} style={s.input}>
            <option value="">—</option>
            {INTERACTION_OUTCOMES.map((value) => (
              <option key={value} value={value}>{INTERACTION_OUTCOME_LABELS[value]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field theme={theme} label="Summary" htmlFor="lv360-summary" help="What was said, in the lead's own words where possible.">
        <textarea id="lv360-summary" defaultValue={summary} onChange={(event) => setSummary(event.target.value)} rows={4} style={{ ...s.input, minHeight: 88 }} placeholder="Interested in hosting weekend wellness experiences; wants pricing before onboarding." />
      </Field>
      <div style={grid(theme)}>
        <Field theme={theme} label="Next action" htmlFor="lv360-next-action">
          <input id="lv360-next-action" defaultValue={nextAction} onChange={(event) => setNextAction(event.target.value)} style={s.input} placeholder="Send pricing sheet" />
        </Field>
        <Field theme={theme} label="Next follow-up" htmlFor="lv360-next-follow-up" help="Creates a follow-up task.">
          <input id="lv360-next-follow-up" type="datetime-local" defaultValue={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} style={s.input} />
        </Field>
      </div>
      <Disclosure theme={theme} label="More detail" hint="purpose, sentiment, objections, commitments, duration">
        <div style={grid(theme)}>
          {channelSupportsDuration(channel) && (
            <Field theme={theme} label="Duration" htmlFor="lv360-duration" help="Minutes.">
              <input id="lv360-duration" type="number" min={0} max={1440} defaultValue={duration} onChange={(event) => setDuration(event.target.value)} style={s.input} placeholder="e.g. 15" />
            </Field>
          )}
          <Field theme={theme} label="Purpose" htmlFor="lv360-purpose">
            <select id="lv360-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} style={s.input}>
              <option value="">—</option>
              {INTERACTION_PURPOSES.map((value) => (
                <option key={value} value={value}>{INTERACTION_PURPOSE_LABELS[value]}</option>
              ))}
            </select>
          </Field>
          <Field theme={theme} label="Sentiment" htmlFor="lv360-sentiment">
            <select id="lv360-sentiment" value={sentiment} onChange={(event) => setSentiment(event.target.value)} style={s.input}>
              <option value="">—</option>
              {INTERACTION_SENTIMENTS.map((value) => (
                <option key={value} value={value}>{INTERACTION_SENTIMENT_LABELS[value]}</option>
              ))}
            </select>
          </Field>
          <Field theme={theme} label="Problems / objections" htmlFor="lv360-objections">
            <input id="lv360-objections" defaultValue={objections} onChange={(event) => setObjections(event.target.value)} style={s.input} />
          </Field>
          <Field theme={theme} label="Commitments" htmlFor="lv360-commitments">
            <input id="lv360-commitments" defaultValue={commitments} onChange={(event) => setCommitments(event.target.value)} style={s.input} />
          </Field>
        </div>
      </Disclosure>
    </FormShell>
  );
};

// ------------------------------------------------------------------ task
export const TaskForm = ({ theme, leadId, members, defaultAssigneeId, sourceInteractionId, onSubmit, onCancel }: { theme: LvTheme; leadId: string; members: MemberSummary[]; defaultAssigneeId: string; sourceInteractionId?: string | null; onSubmit: Submit; onCancel: () => void }) => {
  const s = layout(theme);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<LeadPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (quickActionKey?: string) => {
    if (!quickActionKey && title.trim().length === 0) {
      setError('Give the task a title.');

      return;
    }

    setError(null);
    setBusy(true);

    try {
      await onSubmit({
        leadId,
        title: quickActionKey ? undefined : title.trim(),
        description: description.trim() || undefined,
        dueAt: quickActionKey ? undefined : localInputToIso(dueAt),
        priority: quickActionKey ? undefined : priority,
        assigneeId,
        quickAction: quickActionKey,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        sourceInteractionId: sourceInteractionId ?? undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The task was not created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell theme={theme} title="Create task" error={error} busy={busy} submitLabel="Create task" onSubmit={() => void submit()} onCancel={onCancel}>
      <div>
        <div style={{ ...theme.type.label, color: theme.color.textMuted, marginBottom: 6 }}>Quick actions</div>
        <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
          {QUICK_ACTIONS.map((action) => (
            <LvButton key={action.key} theme={theme} variant="secondary" size="sm" disabled={busy} onClick={() => void submit(action.key)}>
              {action.label}
            </LvButton>
          ))}
        </div>
      </div>
      <div style={grid(theme)}>
        <Field theme={theme} label="Title" htmlFor="lv360-task-title">
          <input id="lv360-task-title" defaultValue={title} onChange={(event) => setTitle(event.target.value)} style={s.input} placeholder="Call the lead regarding experience partnership" />
        </Field>
        <Field theme={theme} label="Due" htmlFor="lv360-task-due">
          <input id="lv360-task-due" type="datetime-local" defaultValue={dueAt} onChange={(event) => setDueAt(event.target.value)} style={s.input} />
        </Field>
        <Field theme={theme} label="Priority" htmlFor="lv360-task-priority">
          <select id="lv360-task-priority" value={priority} onChange={(event) => setPriority(event.target.value as LeadPriority)} style={s.input}>
            {LEAD_PRIORITIES.map((value) => (
              <option key={value} value={value}>{LEAD_PRIORITY_LABELS[value]}</option>
            ))}
          </select>
        </Field>
        <Field theme={theme} label="Assignee" htmlFor="lv360-task-assignee">
          <select id="lv360-task-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} style={s.input}>
            {members.length === 0 && <option value={defaultAssigneeId}>Me</option>}
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.displayName ?? member.email ?? member.id}{member.id === defaultAssigneeId ? ' (me)' : ''}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field theme={theme} label="Description" htmlFor="lv360-task-description">
        <textarea id="lv360-task-description" defaultValue={description} onChange={(event) => setDescription(event.target.value)} rows={3} style={{ ...s.input, minHeight: 72 }} />
      </Field>
    </FormShell>
  );
};

// ------------------------------------------------------------------ note
export const NoteForm = ({ theme, leadId, onSubmit, onCancel }: { theme: LvTheme; leadId: string; onSubmit: Submit; onCancel: () => void }) => {
  const s = layout(theme);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (body.trim().length < 2) {
      setError('Write the note first.');

      return;
    }

    setError(null);
    setBusy(true);

    try {
      await onSubmit({ leadId, title: title.trim() || undefined, body: body.trim() });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The note was not saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell theme={theme} title="Internal note" error={error} busy={busy} submitLabel="Add note" onSubmit={() => void submit()} onCancel={onCancel}>
      <Field theme={theme} label="Title" htmlFor="lv360-note-title" help="(optional)">
        <input id="lv360-note-title" defaultValue={title} onChange={(event) => setTitle(event.target.value)} style={s.input} />
      </Field>
      <Field theme={theme} label="Note" htmlFor="lv360-note-body">
        <textarea id="lv360-note-body" defaultValue={body} onChange={(event) => setBody(event.target.value)} rows={5} style={{ ...s.input, minHeight: 110 }} placeholder="Spoke with owner. Interested in weekend wellness experiences. Wants pricing discussion before onboarding." />
      </Field>
    </FormShell>
  );
};

// ---------------------------------------------------------------- status
export const StatusForm = ({ theme, leadId, currentStatus, settableStatuses, onSubmit, onCancel }: { theme: LvTheme; leadId: string; currentStatus: string | null; settableStatuses: string[]; onSubmit: Submit; onCancel: () => void }) => {
  const s = layout(theme);
  const [mode, setMode] = useState<'SET_STATUS' | 'CLOSE'>('SET_STATUS');
  const [status, setStatus] = useState(settableStatuses[0] ?? '');
  const [closeStatus, setCloseStatus] = useState<string>('LOST');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (mode === 'CLOSE' && reason.trim().length < 3) {
      setError('A reason is required to close a lead.');

      return;
    }

    setError(null);
    setBusy(true);

    try {
      await onSubmit(mode === 'CLOSE' ? { leadId, action: 'CLOSE', status: closeStatus, reason: reason.trim() } : { leadId, action: 'SET_STATUS', status, reason: reason.trim() || undefined });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The status was not changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell theme={theme} title="Change status" error={error} busy={busy} submitLabel={mode === 'CLOSE' ? 'Close lead' : 'Change status'} onSubmit={() => void submit()} onCancel={onCancel}>
      <p style={{ margin: 0, fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
        Currently <strong>{statusLabel(currentStatus)}</strong>. Every change is audited with your name and, when given, the reason.
      </p>
      <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
        <LvButton theme={theme} size="sm" variant={mode === 'SET_STATUS' ? 'primary' : 'secondary'} ariaPressed={mode === 'SET_STATUS'} onClick={() => setMode('SET_STATUS')}>Progress</LvButton>
        <LvButton theme={theme} size="sm" variant={mode === 'CLOSE' ? 'primary' : 'secondary'} ariaPressed={mode === 'CLOSE'} onClick={() => setMode('CLOSE')}>Close</LvButton>
      </div>
      {mode === 'SET_STATUS' ? (
        <Field theme={theme} label="New status" htmlFor="lv360-status">
          <select id="lv360-status" value={status} onChange={(event) => setStatus(event.target.value)} style={s.input}>
            {settableStatuses.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
            ))}
          </select>
        </Field>
      ) : (
        <Field theme={theme} label="Close as" htmlFor="lv360-close-status">
          <select id="lv360-close-status" value={closeStatus} onChange={(event) => setCloseStatus(event.target.value)} style={s.input}>
            {CLOSING_STATUSES.map((value) => (
              <option key={value} value={value}>{statusLabel(value)}</option>
            ))}
          </select>
        </Field>
      )}
      <Field theme={theme} label="Reason" htmlFor="lv360-status-reason" help={mode === 'CLOSE' ? '(required)' : '(optional)'}>
        <input id="lv360-status-reason" defaultValue={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} style={s.input} />
      </Field>
    </FormShell>
  );
};

// ----------------------------------------------------------------- owner
export const OwnerForm = ({ theme, model, onSubmit, onCancel }: { theme: LvTheme; model: Lead360Model; onSubmit: Submit; onCancel: () => void }) => {
  const s = layout(theme);
  const claimOnly = model.capabilities.canClaim && !model.capabilities.canChangeOwner;
  const [newOwnerId, setNewOwnerId] = useState<string>(claimOnly ? model.caller.workspaceMemberId : (model.lead.ownerId ?? ''));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);

    try {
      await onSubmit({ leadId: model.lead.id, newOwnerId: newOwnerId || null, reason: reason.trim() || undefined });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The owner was not changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell theme={theme} title={claimOnly ? 'Claim this lead' : 'Change owner'} error={error} busy={busy} submitLabel={claimOnly ? 'Claim for me' : 'Change owner'} onSubmit={() => void submit()} onCancel={onCancel}>
      {claimOnly ? (
        <p style={{ margin: 0, fontSize: theme.font.size.sm }}>This lead is unassigned. Claiming it makes you the owner and starts the contact clock.</p>
      ) : (
        <Field theme={theme} label="New owner" htmlFor="lv360-owner">
          <select id="lv360-owner" value={newOwnerId} onChange={(event) => setNewOwnerId(event.target.value)} style={s.input}>
            <option value="">Unassigned (release)</option>
            {model.members.map((member) => (
              <option key={member.id} value={member.id}>{member.displayName ?? member.email ?? member.id}{member.id === model.caller.workspaceMemberId ? ' (me)' : ''}</option>
            ))}
          </select>
        </Field>
      )}
      <Field theme={theme} label="Reason" htmlFor="lv360-owner-reason" help="(optional, kept in the assignment history)">
        <input id="lv360-owner-reason" defaultValue={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} style={s.input} />
      </Field>
    </FormShell>
  );
};

// ------------------------------------------------------------ reschedule
export const RescheduleForm = ({ theme, leadId, task, onSubmit, onCancel }: { theme: LvTheme; leadId: string; task: TaskSummary; onSubmit: Submit; onCancel: () => void }) => {
  const s = layout(theme);
  const [dueAt, setDueAt] = useState(formatDateTimeLocal(task.dueAt));
  const [title, setTitle] = useState(task.title ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const iso = localInputToIso(dueAt);

    if (!iso) {
      setError('Choose a new due date.');

      return;
    }

    setError(null);
    setBusy(true);

    try {
      await onSubmit({ leadId, taskId: task.id, action: 'RESCHEDULE', dueAt: iso, title: title.trim() || undefined });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The task was not rescheduled.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell theme={theme} title="Edit next action" error={error} busy={busy} submitLabel="Save" onSubmit={() => void submit()} onCancel={onCancel}>
      <div style={grid(theme)}>
        <Field theme={theme} label="Title" htmlFor="lv360-resched-title">
          <input id="lv360-resched-title" defaultValue={title} onChange={(event) => setTitle(event.target.value)} style={s.input} />
        </Field>
        <Field theme={theme} label="Due" htmlFor="lv360-resched-due">
          <input id="lv360-resched-due" type="datetime-local" defaultValue={dueAt} onChange={(event) => setDueAt(event.target.value)} style={s.input} />
        </Field>
      </div>
    </FormShell>
  );
};

// ------------------------------------------------------------------ edit
// Plain field edits (contact, organisation, classification). These are not
// governed — Twenty's lead permission and CM-004 decide, exactly as the
// native field editor would — so the page updates the record directly;
// status and owner deliberately stay out of this form.
export const EditLeadForm = ({ theme, model, onSubmit, onCancel }: { theme: LvTheme; model: Lead360Model; onSubmit: Submit; onCancel: () => void }) => {
  const s = layout(theme);
  const { lead } = model;
  const [name, setName] = useState(lead.name ?? '');
  const [organisationName, setOrganisationName] = useState(lead.organisationName ?? '');
  const [email, setEmail] = useState(lead.emails?.primaryEmail ?? '');
  const [phone, setPhone] = useState(lead.phones?.primaryPhoneNumber ?? '');
  const [website, setWebsite] = useState(lead.website?.primaryLinkUrl ?? '');
  const [instagram, setInstagram] = useState(lead.instagram?.primaryLinkUrl ?? '');
  const [location, setLocation] = useState(lead.location ?? '');
  const [category, setCategory] = useState(lead.category ?? '');
  const [subcategory, setSubcategory] = useState(lead.subcategory ?? '');
  const [source, setSource] = useState(lead.source ?? '');
  const [priority, setPriority] = useState<string>(lead.priority ?? 'MEDIUM');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length === 0) {
      setError('The lead needs a name.');

      return;
    }

    setError(null);
    setBusy(true);

    try {
      await onSubmit({
        name: name.trim(),
        organisationName: organisationName.trim() || null,
        emails: { primaryEmail: email.trim() },
        phones: { primaryPhoneNumber: phone.trim() },
        website: { primaryLinkUrl: website.trim() },
        instagram: { primaryLinkUrl: instagram.trim() },
        location: location.trim() || null,
        category: category || null,
        subcategory: subcategory || null,
        source: source || null,
        priority: priority || null,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The lead was not updated.');
    } finally {
      setBusy(false);
    }
  };

  const select = (id: string, value: string, onChange: (value: string) => void, options: { value: string; label: string }[]) => (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} style={s.input}>
      <option value="">—</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );

  return (
    <FormShell theme={theme} title="Edit lead" error={error} busy={busy} submitLabel="Save changes" onSubmit={() => void submit()} onCancel={onCancel}>
      <div style={grid(theme)}>
        <Field theme={theme} label="Name" htmlFor="lv360-edit-name"><input id="lv360-edit-name" defaultValue={name} onChange={(event) => setName(event.target.value)} style={s.input} /></Field>
        <Field theme={theme} label="Organisation" htmlFor="lv360-edit-org"><input id="lv360-edit-org" defaultValue={organisationName} onChange={(event) => setOrganisationName(event.target.value)} style={s.input} /></Field>
        <Field theme={theme} label="Email" htmlFor="lv360-edit-email"><input id="lv360-edit-email" type="email" defaultValue={email} onChange={(event) => setEmail(event.target.value)} style={s.input} /></Field>
        <Field theme={theme} label="Phone" htmlFor="lv360-edit-phone"><input id="lv360-edit-phone" type="tel" defaultValue={phone} onChange={(event) => setPhone(event.target.value)} style={s.input} /></Field>
        <Field theme={theme} label="Website" htmlFor="lv360-edit-website"><input id="lv360-edit-website" type="url" defaultValue={website} onChange={(event) => setWebsite(event.target.value)} style={s.input} /></Field>
        <Field theme={theme} label="Instagram" htmlFor="lv360-edit-instagram"><input id="lv360-edit-instagram" defaultValue={instagram} onChange={(event) => setInstagram(event.target.value)} style={s.input} /></Field>
        <Field theme={theme} label="Location" htmlFor="lv360-edit-location"><input id="lv360-edit-location" defaultValue={location} onChange={(event) => setLocation(event.target.value)} style={s.input} /></Field>
        <Field theme={theme} label="Category" htmlFor="lv360-edit-category">{select('lv360-edit-category', category, setCategory, LEAD_CATEGORY_OPTIONS)}</Field>
        <Field theme={theme} label="Subcategory" htmlFor="lv360-edit-subcategory">{select('lv360-edit-subcategory', subcategory, setSubcategory, LEAD_SUBCATEGORY_OPTIONS)}</Field>
        <Field theme={theme} label="Source" htmlFor="lv360-edit-source">{select('lv360-edit-source', source, setSource, LEAD_SOURCE_OPTIONS)}</Field>
        <Field theme={theme} label="Priority" htmlFor="lv360-edit-priority">
          <select id="lv360-edit-priority" value={priority} onChange={(event) => setPriority(event.target.value)} style={s.input}>
            {LEAD_PRIORITIES.map((value) => (
              <option key={value} value={value}>{LEAD_PRIORITY_LABELS[value]}</option>
            ))}
          </select>
        </Field>
      </div>
    </FormShell>
  );
};
