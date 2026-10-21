import { useState } from 'react';

import {
  isReadinessGated,
  KIND_LABELS,
  requiresReason,
  statusLabel,
  STATUS_COPY,
  transitionEcosystem,
  type Capabilities,
  type EcosystemKind,
  type Readiness,
  type SettableStatus,
} from 'src/api/ecosystem';
import { LvIcon } from 'src/design/icons';
import { Field, InlineNotice, isForbiddenMessage, LvBadge, LvButton, LvTextarea } from 'src/design/kit';
import { LvSheet } from 'src/design/overlay';
import { type LvTheme } from 'src/design/theme';

// 8.8 — the ecosystem transition.
//
// The server decides what is on offer: `settableStatuses` already accounts
// for the transition table, the caller's write permission and the governance
// rule that nobody approves their own work. This screen shows that list and
// nothing beyond it, says what each option does before it is chosen, and asks
// for a reason only where the server requires one.
//
// It never asks "are you sure?". It says what will happen.

export const EcosystemTransitionSheet = ({
  theme,
  kind,
  id,
  name,
  currentStatus,
  statuses,
  capabilities,
  readiness,
  onClose,
  onDone,
}: {
  theme: LvTheme;
  kind: EcosystemKind;
  id: string;
  name: string | null;
  currentStatus: string | null;
  statuses: SettableStatus[];
  capabilities: Capabilities;
  readiness: Readiness;
  onClose: () => void;
  onDone: () => void;
}) => {
  const [choice, setChoice] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsReason = choice !== null && requiresReason(kind, choice);
  const ready = choice !== null && (!needsReason || reason.trim().length >= 3);

  const apply = async () => {
    if (choice === null) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await transitionEcosystem({ kind, id, to: choice, reason: reason.trim() === '' ? null : reason.trim() });
      onDone();
      onClose();
    } catch (cause) {
      // The refusal is the useful part — "Cannot move from X to Y", "not
      // ready", "a reason is required" — so it is shown as written.
      setError(cause instanceof Error ? cause.message : 'That change was not applied.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LvSheet
      theme={theme}
      title={`Change ${name ?? `this ${KIND_LABELS[kind].one.toLowerCase()}`}`}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <LvButton theme={theme} variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </LvButton>
          <LvButton
            theme={theme}
            variant={choice === 'SUSPENDED' || choice === 'OFFBOARDED' || choice === 'RETIRED' ? 'danger' : 'primary'}
            disabled={!ready}
            busy={busy}
            onClick={() => void apply()}
          >
            {choice === null ? 'Choose what happens' : statusLabel(kind, choice)}
          </LvButton>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
          It is <strong style={{ color: theme.color.heading }}>{statusLabel(kind, currentStatus)}</strong>.
        </p>

        {!capabilities.canChangeStatus ? (
          <InlineNotice theme={theme} tone="warning">
            Your role cannot change this record’s status. You can still see everything about it.
          </InlineNotice>
        ) : statuses.length === 0 ? (
          <InlineNotice theme={theme}>
            {statusLabel(kind, currentStatus)} is the end of the road for a {KIND_LABELS[kind].one.toLowerCase()}. Nothing follows it.
          </InlineNotice>
        ) : (
          <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
            <legend style={{ ...theme.type.label, color: theme.color.textMuted, padding: 0, marginBottom: theme.space(2) }}>What happens next</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
              {statuses.map((status) => {
                const active = choice === status.value;
                // The readiness gate is knowable in advance, so a move that
                // the server will refuse says so rather than being discovered
                // by pressing it.
                const blocked = isReadinessGated(kind, status.value) && readiness.status === 'NOT_READY';

                return (
                  <label
                    key={status.value}
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
                      name={`ecosystem-${id}`}
                      value={status.value}
                      checked={active}
                      onChange={() => {
                        setChoice(status.value);
                        setReason('');
                        setError(null);
                      }}
                      style={{ marginTop: 3, width: 18, height: 18, flex: '0 0 auto', accentColor: theme.color.brand }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' }}>
                        <span style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>{status.label}</span>
                        {status.governed && <LvBadge theme={theme} tone="info">A governance decision</LvBadge>}
                      </span>
                      <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>
                        {STATUS_COPY[status.value] ?? `Moves it to ${status.label.toLowerCase()}.`}
                      </span>
                      {blocked && (
                        <span style={{ display: 'flex', gap: theme.space(2), marginTop: 6, ...theme.type.caption, color: theme.color.warning }}>
                          <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 auto' }}>
                            <LvIcon name="warning" size={14} />
                          </span>
                          <span>
                            The readiness check is failing, so the server will refuse this: {readiness.reasons[0]?.text}
                            {readiness.reasons.length > 1 ? ` And ${readiness.reasons.length - 1} more.` : ''}
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
          <Field theme={theme} label="Reason" htmlFor="ecosystem-reason" required help="Recorded on the record and in the audit trail. At least a few words.">
            <LvTextarea theme={theme} id="ecosystem-reason" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        )}

        {error && (
          <InlineNotice theme={theme} tone="danger">
            {isForbiddenMessage(error) ? `${error} Ecosystem changes need write access to this object.` : error}
          </InlineNotice>
        )}
      </div>
    </LvSheet>
  );
};
