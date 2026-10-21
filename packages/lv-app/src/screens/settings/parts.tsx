import { type ReactNode } from 'react';

import { LvIcon } from 'src/design/icons';
import { InlineNotice, LvAvatar, LvBadge, LvButton, LvCard } from 'src/design/kit';
import { type LvTheme } from 'src/design/theme';

// Shared pieces for the settings sections. Nothing new visually: the same
// cards, rows, badges and notices the rest of the product uses.

/** A labelled switch. Controlled, with its own saving state. */
export const LvToggleRow = ({
  theme,
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  theme: LvTheme;
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) => (
  <label
    className="lv-action-row"
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.space(3),
      padding: `${theme.space(3)}px 0`,
      minWidth: 0,
      cursor: disabled === true ? 'not-allowed' : 'pointer',
      opacity: disabled === true ? 0.55 : 1,
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      // 18px is the control; the 44px row around it is the target.
      style={{ width: 18, height: 18, marginTop: 3, flex: '0 0 auto', accentColor: theme.color.brand }}
    />
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ display: 'block', ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>{label}</span>
      {help !== undefined && <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{help}</span>}
    </span>
  </label>
);

/** The save bar every editable section ends with. One commit, honest states. */
export const LvSaveBar = ({
  theme,
  dirty,
  saving,
  saved,
  error,
  disabled,
  onDiscard,
  onSave,
  idleText = 'Everything here matches the workspace.',
}: {
  theme: LvTheme;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  disabled?: boolean;
  onDiscard: () => void;
  onSave: () => void;
  idleText?: string;
}) => (
  <LvCard theme={theme} style={{ padding: theme.space(4) }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, marginRight: 'auto', minWidth: 0 }}>
        {error !== null ? '' : saved ? 'Saved.' : dirty ? 'You have unsaved changes.' : idleText}
      </span>
      <LvButton theme={theme} variant="ghost" disabled={!dirty || saving} onClick={onDiscard}>
        Discard
      </LvButton>
      <LvButton theme={theme} variant="primary" disabled={disabled === true || !dirty || saving} busy={saving} onClick={onSave}>
        {saving ? 'Saving' : 'Save changes'}
      </LvButton>
    </div>

    {error !== null && (
      <div style={{ paddingTop: theme.space(3) }}>
        <InlineNotice theme={theme} tone="danger">
          {error}
        </InlineNotice>
      </div>
    )}
  </LvCard>
);

/** One member, as a row that survives a 320px screen. */
export const LvMemberRow = ({
  theme,
  name,
  email,
  jobTitle,
  avatarUrl,
  roleLabel,
  isYou,
  action,
}: {
  theme: LvTheme;
  name: string;
  email: string;
  jobTitle: string;
  avatarUrl: string;
  roleLabel: string | null;
  isYou: boolean;
  action?: ReactNode;
}) => (
  <li
    className="lv-action-row"
    style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'center', gap: theme.space(3), minWidth: 0, flexWrap: 'wrap' }}
  >
    <LvAvatar theme={theme} name={name} src={avatarUrl === '' ? undefined : avatarUrl} size={36} />
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>{name || 'Unnamed member'}</span>
        {isYou && <LvBadge theme={theme} tone="info">You</LvBadge>}
        {roleLabel !== null && <LvBadge theme={theme} tone="neutral">{roleLabel}</LvBadge>}
      </span>
      <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>
        {[email, jobTitle].filter((part) => part !== '').join(' · ') || '—'}
      </span>
    </span>
    {action}
  </li>
);

/** What a non-administrator sees where an administrative control would be. */
export const LvAdminOnly = ({ theme, what }: { theme: LvTheme; what: string }) => (
  <InlineNotice theme={theme}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <LvIcon name="info" size={14} />
      {what} is managed by an administrator. You can see it here but not change it.
    </span>
  </InlineNotice>
);
