import { useState } from 'react';

import {
  blockersFor,
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_TRANSITIONS,
  requiresReason,
  transitionOnboarding,
  TRANSITION_COPY,
  type OnboardingRecord,
  type OnboardingStatus,
} from 'src/api/onboarding';
import { LvIcon } from 'src/design/icons';
import { Field, InlineNotice, isForbiddenMessage, LvButton, LvTextarea } from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { type LvTheme } from 'src/design/theme';

// 7.8 — moving the onboarding on.
//
// Only the statuses the state machine actually allows from here are offered;
// the rest would be refused with "Cannot move from X to Y", and a button that
// always fails is worse than no button. Each option says what it does to the
// partner before it is chosen, a reason box appears where the server demands
// one, and what is currently blocking approval is shown next to the choice
// rather than discovered by pressing it.
//
// This is not a generic confirmation. It never asks "are you sure?" — it says
// what will happen and names the consequence.

export const TransitionDialog = ({
  theme,
  record,
  initial,
  onClose,
  onDone,
}: {
  theme: LvTheme;
  record: OnboardingRecord;
  initial?: OnboardingStatus | null;
  onClose: () => void;
  onDone: () => void;
}) => {
  const allowed = ONBOARDING_TRANSITIONS[record.status];
  const [choice, setChoice] = useState<OnboardingStatus | null>(initial ?? null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blockers = blockersFor(record).filter((blocker) => blocker.kind !== 'PARTNER');
  const needsReason = choice !== null && requiresReason(choice);
  const ready = choice !== null && (!needsReason || reason.trim().length > 0);

  const apply = async () => {
    if (choice === null) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await transitionOnboarding({
        onboardingId: record.id,
        to: choice,
        reason: reason.trim() === '' ? null : reason.trim(),
        note: note.trim() === '' ? null : note.trim(),
      });
      onDone();
      onClose();
    } catch (cause) {
      // The server's refusal is the useful part — "Every uploaded document
      // must be verified", "Approval requires a named reviewer" — so it is
      // shown as written rather than replaced with something softer.
      setError(cause instanceof Error ? cause.message : 'That change was not applied.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LvSheet
      theme={theme}
      title={`Move ${record.name ?? 'this onboarding'} on`}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <LvButton theme={theme} variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </LvButton>
          <LvButton
            theme={theme}
            variant={choice === 'REJECTED' ? 'danger' : 'primary'}
            disabled={!ready}
            busy={busy}
            onClick={() => void apply()}
          >
            {choice === null ? 'Choose what happens' : TRANSITION_COPY[choice].verb}
          </LvButton>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
          It is <strong style={{ color: theme.color.heading }}>{ONBOARDING_STATUS_LABELS[record.status]}</strong>. These are the states it can move to from
          there.
        </p>

        {allowed.length === 0 ? (
          <InlineNotice theme={theme}>
            {ONBOARDING_STATUS_LABELS[record.status]} is the end of the journey. Nothing follows it.
          </InlineNotice>
        ) : (
          <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            <legend style={{ ...theme.type.label, color: theme.color.textMuted, padding: 0, marginBottom: theme.space(2) }}>What happens next</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
              {allowed.map((status) => {
                const active = choice === status;
                // Approval is the one move the client can see is blocked in
                // advance; it is marked rather than hidden, because a reviewer
                // needs to know it exists and why they cannot use it.
                const willFail = status === 'APPROVED' && blockers.length > 0;

                return (
                  <label
                    key={status}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: theme.space(3),
                      minHeight: 44,
                      padding: theme.space(3),
                      borderRadius: theme.radius.md,
                      border: `1px solid ${active ? theme.color.brand : theme.color.border}`,
                      background: active ? theme.tint.mint.wash : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="transition"
                      value={status}
                      checked={active}
                      onChange={() => {
                        setChoice(status);
                        setReason('');
                        setError(null);
                      }}
                      style={{ marginTop: 3, width: 18, height: 18, flex: '0 0 auto', accentColor: theme.color.brand }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>
                        {TRANSITION_COPY[status].verb}
                      </span>
                      <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{TRANSITION_COPY[status].consequence}</span>
                      {willFail && (
                        <span style={{ display: 'flex', gap: theme.space(2), marginTop: 6, ...theme.type.caption, color: theme.color.warning }}>
                          <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 auto' }}>
                            <LvIcon name="warning" size={14} />
                          </span>
                          <span>
                            The server will refuse this right now: {blockers[0].text} {blockers.length > 1 ? `And ${blockers.length - 1} more.` : ''}
                          </span>
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {needsReason && (
          <Field
            theme={theme}
            label="Reason"
            htmlFor="transition-reason"
            required
            help="Recorded on the onboarding and shown to the partner. Say what has to change."
          >
            <LvTextarea theme={theme} id="transition-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        )}

        {choice !== null && (
          <Field theme={theme} label="Internal note" htmlFor="transition-note" help="Optional, and never shown to the partner.">
            <LvTextarea theme={theme} id="transition-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        )}

        {error && (
          <InlineNotice theme={theme} tone="danger">
            {isForbiddenMessage(error) ? `${error} Onboarding changes are limited to the Onboarding Expert and Operations roles.` : error}
          </InlineNotice>
        )}
      </div>
    </LvSheet>
  );
};
