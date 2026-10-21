import { useEffect, useMemo, useState } from 'react';

import {
  accountPatch,
  COLOR_SCHEMES,
  DATE_FORMATS,
  JOB_TITLE_MAX,
  localeOptions,
  NAME_MAX,
  NUMBER_FORMATS,
  requestPasswordReset,
  TIME_FORMATS,
  timeZoneOptions,
  useAccount,
  validateAccount,
  type AccountRecord,
} from 'src/api/account';
import { signOut, type Viewer } from 'src/api/client';
import { LvIcon } from 'src/design/icons';
import {
  ErrorState,
  InlineNotice,
  isForbiddenMessage,
  LoadingState,
  LvAvatar,
  LvButton,
  LvInput,
  LvSelect,
} from 'src/design/kit';
import { EditorialRow as Row, EditorialReadOnly as ReadOnly, EditorialSection as Section } from 'src/design/editorial';
import { LvPageHeader } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';
import { type ColorSchemeChoice } from 'src/design/use-color-scheme';

// 1.4 — the signed-in person's own page.
//
// The page is laid out as an editorial settings list rather than a stack of
// boxed forms: an identity band, then sections whose rows carry a label on the
// left and the control on the right, parted by hairlines. Nothing about what
// is saved changed — every editable field still goes through
// `updateWorkspaceMemberSettings`, the platform's self-service path, because
// the obvious alternative (`updateWorkspaceMember`) is gated on object
// permissions the La Vivenzia team roles do not hold.
//
// What is deliberately not here: the avatar image (its mutation needs a
// multipart Upload this transport does not send), the custom member fields
// (the self-service endpoint rejects them), and a password form (the auth
// module only offers an emailed reset link).

export const AccountScreen = ({
  theme,
  viewer,
  appearance,
  onSignedOut,
  onOpenSettings,
}: {
  theme: LvTheme;
  viewer: Viewer | null;
  appearance: ColorSchemeChoice;
  onSignedOut: () => void;
  onOpenSettings: () => void;
}) => {
  const account = useAccount(viewer?.workspaceMemberId ?? null, (scheme) => appearance.adopt(scheme));
  const [draft, setDraft] = useState<AccountRecord | null>(null);
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [resetError, setResetError] = useState<string | null>(null);

  // The record is the source of truth; the draft is what the person is typing.
  useEffect(() => {
    if (account.record !== null) {
      setDraft(account.record);
      appearance.adopt(account.record.colorScheme);
    }
    // `appearance.adopt` is stable; re-running on it would fight the person's
    // own in-session choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.record]);

  const errors = useMemo(() => (draft === null ? {} : validateAccount(draft)), [draft]);
  const dirty = useMemo(() => (account.record === null || draft === null ? false : Object.keys(accountPatch(account.record, draft)).length > 0), [account.record, draft]);
  const canSave = dirty && Object.keys(errors).length === 0 && !account.saving;

  const header = (
    <LvPageHeader theme={theme} variant="panel" title="Your profile" subtitle="Who you are in this workspace, and how the CRM behaves for you." />
  );

  if (account.loading) {
    return (
      <>
        {header}
        <LoadingState theme={theme} rows={4} label="Loading your profile" />
      </>
    );
  }

  if (account.error !== null || account.record === null || draft === null) {
    return (
      <>
        {header}
        <ErrorState
          theme={theme}
          title="Your profile could not be loaded"
          text={account.error ?? 'Unknown error.'}
          onRetry={isForbiddenMessage(account.error) ? undefined : account.reload}
        />
      </>
    );
  }

  const record = account.record;
  const set = <K extends keyof AccountRecord>(key: K, value: AccountRecord[K]) => setDraft((current) => (current === null ? current : { ...current, [key]: value }));
  const displayName = [record.firstName, record.lastName].filter((part) => part.trim() !== '').join(' ') || 'Signed in';
  const email = viewer?.email ?? (record.userEmail === '' ? '' : record.userEmail);

  const sendReset = async () => {
    const target = viewer?.email ?? record.userEmail;

    if (target === '') {
      return;
    }

    setResetState('sending');
    setResetError(null);

    try {
      await requestPasswordReset(target);
      setResetState('sent');
    } catch (cause) {
      setResetState('failed');
      setResetError(cause instanceof Error ? cause.message : 'The reset email could not be sent.');
    }
  };

  const showSaveBar = dirty || account.saving || account.saved || account.saveError !== null;

  return (
    <div className="lv-acct">
      {/* The identity band — the one place the page says who you are. */}
      <div className="lv-acct-band">
        <span
          style={{
            flex: '0 0 auto',
            padding: 3,
            borderRadius: theme.radius.pill,
            background: theme.color.surfaceRaised,
            boxShadow: `0 0 0 2px ${theme.tint.mint.glyph}`,
            display: 'inline-flex',
          }}
        >
          <LvAvatar theme={theme} name={displayName} src={record.avatarUrl === '' ? undefined : record.avatarUrl} size={72} />
        </span>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.space(1) }}>
          <h1 style={{ ...theme.type.title, fontSize: 26, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>{displayName}</h1>
          {email !== '' && <span style={{ ...theme.type.body, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{email}</span>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(1) }}>
            {viewer?.role && (
              <span style={{ ...theme.type.caption, fontWeight: theme.font.weight.medium, background: theme.tint.mint.wash, color: theme.tint.mint.ink, borderRadius: theme.radius.pill, padding: `4px ${theme.space(3)}px`, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <LvIcon name="check" size={12} /> {viewer.role}
              </span>
            )}
            {record.jobTitle !== '' && (
              <span style={{ ...theme.type.caption, fontWeight: theme.font.weight.medium, background: theme.color.surfaceSunken, color: theme.color.textMuted, borderRadius: theme.radius.pill, padding: `4px ${theme.space(3)}px`, overflowWrap: 'anywhere' }}>{record.jobTitle}</span>
            )}
          </div>
        </div>

        <div className="lv-acct-band-actions">
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onOpenSettings} icon={<LvIcon name="settings" size={16} />}>
            Settings
          </LvButton>
          <LvButton
            theme={theme}
            variant="secondary"
            size="sm"
            icon={<LvIcon name="signout" size={16} />}
            onClick={() => {
              signOut();
              onSignedOut();
            }}
          >
            Sign out
          </LvButton>
        </div>
      </div>

      {/* Personal */}
      <Section theme={theme} title="Personal" desc="Your photograph and email come from your workspace account and are changed by an administrator — everything else here is yours.">
        <Row theme={theme} label="First name" htmlFor="account-first" error={errors.firstName}>
          <LvInput theme={theme} id="account-first" style={{ width: '100%' }} value={draft.firstName} maxLength={NAME_MAX} invalid={errors.firstName !== undefined} onChange={(event) => set('firstName', event.target.value)} />
        </Row>
        <Row theme={theme} label="Last name" htmlFor="account-last" error={errors.lastName}>
          <LvInput theme={theme} id="account-last" style={{ width: '100%' }} value={draft.lastName} maxLength={NAME_MAX} invalid={errors.lastName !== undefined} onChange={(event) => set('lastName', event.target.value)} />
        </Row>
        <Row theme={theme} label="Job title" help="How you are described on records you own." htmlFor="account-job" error={errors.jobTitle}>
          <LvInput theme={theme} id="account-job" style={{ width: '100%' }} value={draft.jobTitle} maxLength={JOB_TITLE_MAX} invalid={errors.jobTitle !== undefined} onChange={(event) => set('jobTitle', event.target.value)} />
        </Row>
      </Section>

      {/* Preferences */}
      <Section theme={theme} title="Preferences" desc="How the CRM behaves for you. Saved to your account, so it follows you to another device.">
        <Row theme={theme} label="Colour scheme" htmlFor="account-scheme">
          <LvSelect theme={theme} id="account-scheme" style={{ width: '100%' }} value={draft.colorScheme} onChange={(event) => set('colorScheme', event.target.value)}>
            {COLOR_SCHEMES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LvSelect>
        </Row>
        <Row theme={theme} label="Language" htmlFor="account-locale">
          <LvSelect theme={theme} id="account-locale" style={{ width: '100%' }} value={draft.locale} onChange={(event) => set('locale', event.target.value)}>
            {localeOptions(record.locale).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LvSelect>
        </Row>
        <Row theme={theme} label="Time zone" help="Due dates and times are shown in this zone." htmlFor="account-tz">
          <LvSelect theme={theme} id="account-tz" style={{ width: '100%' }} value={draft.timeZone} onChange={(event) => set('timeZone', event.target.value)}>
            {timeZoneOptions(record.timeZone).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LvSelect>
        </Row>
        <Row theme={theme} label="Date format" htmlFor="account-date">
          <LvSelect theme={theme} id="account-date" style={{ width: '100%' }} value={draft.dateFormat} onChange={(event) => set('dateFormat', event.target.value)}>
            {DATE_FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LvSelect>
        </Row>
        <Row theme={theme} label="Time format" htmlFor="account-time">
          <LvSelect theme={theme} id="account-time" style={{ width: '100%' }} value={draft.timeFormat} onChange={(event) => set('timeFormat', event.target.value)}>
            {TIME_FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LvSelect>
        </Row>
        <Row theme={theme} label="Number format" htmlFor="account-number">
          <LvSelect theme={theme} id="account-number" style={{ width: '100%' }} value={draft.numberFormat} onChange={(event) => set('numberFormat', event.target.value)}>
            {NUMBER_FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LvSelect>
        </Row>
      </Section>

      {/* Account & security */}
      <Section theme={theme} title="Account &amp; security">
        <Row theme={theme} label="Email">
          <ReadOnly theme={theme}>{email === '' ? '—' : email}</ReadOnly>
        </Row>
        <Row theme={theme} label="Role">
          <ReadOnly theme={theme}>{viewer?.role ?? 'Team member'}</ReadOnly>
        </Row>
        <Row theme={theme} label="Password" help="Changing a password is done through a link sent to your email — the only route this workspace's sign-in provides.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), alignItems: 'flex-start' }}>
            <LvButton
              theme={theme}
              variant="secondary"
              size="sm"
              busy={resetState === 'sending'}
              disabled={resetState === 'sent'}
              onClick={() => void sendReset()}
              icon={<LvIcon name="email" size={16} />}
            >
              {resetState === 'sent' ? 'Link sent' : 'Email me a reset link'}
            </LvButton>
            {resetState === 'sent' && (
              <InlineNotice theme={theme} tone="success">
                Sent to {email === '' ? record.userEmail : email}. The link is short-lived; if it expires, ask for another.
              </InlineNotice>
            )}
            {resetState === 'failed' && (
              <InlineNotice theme={theme} tone="danger">
                {resetError ?? 'The reset email could not be sent.'}
              </InlineNotice>
            )}
          </div>
        </Row>
        <Row theme={theme} label="Sessions" help="This workspace's sign-in does not expose a list of active sessions, so none is shown. Use Sign out at the top to end this browser's session.">
          <ReadOnly theme={theme}>Signed in on this device</ReadOnly>
        </Row>
      </Section>

      {/* One commit for the whole page: several fields, then save. Only what
          changed is sent. The bar floats at the foot while there is something
          to do. */}
      {showSaveBar && (
        <div className="lv-acct-savebar">
          <span style={{ ...theme.type.bodySmall, color: account.saveError !== null ? theme.color.danger : theme.color.textMuted, marginRight: 'auto', minWidth: 0 }}>
            {account.saveError !== null
              ? isForbiddenMessage(account.saveError)
                ? `${account.saveError} Tell an administrator if this persists.`
                : account.saveError
              : account.saved
                ? 'Saved.'
                : 'You have unsaved changes.'}
          </span>
          <LvButton theme={theme} variant="ghost" disabled={!dirty || account.saving} onClick={() => setDraft(record)}>
            Discard
          </LvButton>
          <LvButton theme={theme} variant="primary" disabled={!canSave} busy={account.saving} onClick={() => void account.save(draft)}>
            {account.saving ? 'Saving' : 'Save changes'}
          </LvButton>
        </div>
      )}
    </div>
  );
};
