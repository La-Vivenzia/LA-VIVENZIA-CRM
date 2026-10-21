import { useMemo, useRef, useState } from 'react';

import { type Viewer } from 'src/api/client';
import {
  assignRole,
  fetchWorkspace,
  parseInviteEmails,
  resendInvitation,
  revokeInvitation,
  saveWorkspace,
  sendInvitations,
  uploadWorkspaceLogo,
  useSettingsData,
  validateWorkspaceName,
  workspacePatch,
  WORKSPACE_NAME_MAX,
  type Workspace,
} from 'src/api/workspace';
import { LvIcon } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  Field,
  InlineNotice,
  LoadingState,
  LvAvatar,
  LvBadge,
  LvButton,
  LvInput,
  LvSelect,
  LvTabs,
} from 'src/design/kit';
import { EditorialSection } from 'src/design/editorial';
import { LvPageHeader } from 'src/design/page';
import { LvFactRow } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { type ColorSchemeChoice, type SchemePreference } from 'src/design/use-color-scheme';
import { LvAdminOnly, LvMemberRow, LvSaveBar, LvToggleRow } from 'src/screens/settings/parts';

// Settings — the workspace, its people and how it behaves.
//
// Every control here is an existing platform capability, traced before it was
// built. Whether the caller may use it is decided by the server, and this
// screen learns the answer the honest way: `getRoles` is refused for a
// non-administrator, so a refusal on it *is* the signal that this person is
// not one. Nothing is hidden on a guess, and no mutation is attempted that
// the server would refuse without saying so.
//
// Two things are deliberately not here, and the report says so:
//
//   - `subdomain`, though UpdateWorkspaceInput accepts it. It is the address
//     the product is served from; a settings page should not be able to lock
//     everyone out.
//   - Notification preferences. There is no table and no mutation for them
//     anywhere in the backend, so a toggle would persist nothing. An empty
//     state that explains itself is the honest version.

const SECTIONS = [
  { key: 'general', label: 'General' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'members', label: 'Members' },
  { key: 'security', label: 'Security' },
] as const;

type Section = (typeof SECTIONS)[number]['key'];

const APPEARANCE: { key: SchemePreference; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

const CONSOLE_URL_RAW = import.meta.env.VITE_LV_CONSOLE_URL as string | undefined;

/**
 * Only an absolute http(s) address is offered as a link. A relative path, a
 * `javascript:` URL or an unparseable string all mean "not configured" — a
 * dead link in a settings page is worse than an honest absence.
 */
export const parseConsoleUrl = (raw: string | undefined | null): string | null => {
  const trimmed = raw?.trim() ?? '';

  if (trimmed === '') {
    return null;
  }

  try {
    const url = new URL(trimmed);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export const SettingsScreen = ({
  theme,
  viewer,
  appearance,
  onOpenProfile,
}: {
  theme: LvTheme;
  viewer: Viewer | null;
  appearance: ColorSchemeChoice;
  onOpenProfile: () => void;
}) => {
  const data = useSettingsData();
  const [section, setSection] = useState<Section>('general');

  // General / Security editing
  const [draft, setDraft] = useState<Workspace | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Logo
  const fileInput = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Invitations
  const [inviteRaw, setInviteRaw] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [inviteActing, setInviteActing] = useState<string | null>(null);

  // Role changes, per member
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const workspace = data.workspace;
  const isAdmin = data.canSeeRoles && workspace !== null;
  const current = draft ?? workspace;
  const nameError = current === null ? null : validateWorkspaceName(current.displayName);
  const dirty = useMemo(() => (workspace === null || draft === null ? false : Object.keys(workspacePatch(workspace, draft)).length > 0), [workspace, draft]);

  const header = (
    <LvPageHeader
      theme={theme}
      variant="panel"
      title="Settings"
      subtitle="The workspace, the people in it, and how the CRM behaves."
      actions={
        <LvButton theme={theme} variant="ghost" onClick={onOpenProfile} icon={<LvIcon name="profile" size={16} />}>
          Your profile
        </LvButton>
      }
    />
  );

  if (data.loading) {
    return (
      <>
        {header}
        <LoadingState theme={theme} rows={4} label="Loading settings" />
      </>
    );
  }

  if (data.error !== null) {
    return (
      <>
        {header}
        <ErrorState theme={theme} title="Settings could not be loaded" text={data.error} onRetry={data.reload} />
      </>
    );
  }

  const set = <K extends keyof Workspace>(key: K, value: Workspace[K]) => {
    setSaved(false);
    setSaveError(null);
    setDraft((existing) => {
      const base = existing ?? workspace;

      return base === null ? existing : { ...base, [key]: value };
    });
  };

  const commit = async () => {
    if (workspace === null || draft === null || nameError !== null) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      await saveWorkspace(workspacePatch(workspace, draft));
      // Re-read rather than trusting the returned object, so "Saved" means
      // the server will hand this back on the next load.
      await fetchWorkspace();
      data.reload();
      setDraft(null);
      setSaved(true);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'The workspace was not updated.');
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (file: File | undefined) => {
    if (file === undefined) {
      return;
    }

    setLogoBusy(true);
    setLogoError(null);

    try {
      await uploadWorkspaceLogo(file);
      data.reload();
    } catch (cause) {
      setLogoError(cause instanceof Error ? cause.message : 'The logo was not uploaded.');
    } finally {
      setLogoBusy(false);

      if (fileInput.current !== null) {
        fileInput.current.value = '';
      }
    }
  };

  const invite = async () => {
    const { emails, invalid } = parseInviteEmails(inviteRaw);

    setInviteError(null);
    setInviteResult(null);

    if (invalid.length > 0) {
      setInviteError(`${invalid.length === 1 ? 'That is not an email address' : 'Those are not email addresses'}: ${invalid.slice(0, 3).join(', ')}`);

      return;
    }

    if (emails.length === 0) {
      setInviteError('Add at least one email address.');

      return;
    }

    setInviteBusy(true);

    try {
      await sendInvitations(emails, inviteRole === '' ? null : inviteRole);
      setInviteResult(`Invited ${emails.length === 1 ? emails[0] : `${emails.length} people`}.`);
      setInviteRaw('');
      data.reload();
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : 'The invitations were not sent.');
    } finally {
      setInviteBusy(false);
    }
  };

  const actOnInvitation = async (appTokenId: string, action: 'resend' | 'revoke') => {
    setInviteActing(`${action}-${appTokenId}`);
    setInviteError(null);
    setInviteResult(null);

    try {
      await (action === 'resend' ? resendInvitation(appTokenId) : revokeInvitation(appTokenId));
      setInviteResult(action === 'resend' ? 'Invitation sent again.' : 'Invitation revoked.');
      data.reload();
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : 'That did not work.');
    } finally {
      setInviteActing(null);
    }
  };

  const changeRole = async (memberId: string, roleId: string) => {
    setRoleBusy(memberId);
    setRoleError(null);

    try {
      await assignRole(memberId, roleId);
      data.reload();
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : 'The role was not changed.');
    } finally {
      setRoleBusy(null);
    }
  };

  const consoleHref = parseConsoleUrl(CONSOLE_URL_RAW);

  return (
    <div className="lv-acct">
      {/* The workspace identity band — the same calm header the profile uses. */}
      <div className="lv-acct-band">
        {workspace !== null ? (
          <span style={{ flex: '0 0 auto', padding: 3, borderRadius: theme.radius.pill, background: theme.color.surfaceRaised, boxShadow: `0 0 0 2px ${theme.tint.mint.glyph}`, display: 'inline-flex' }}>
            <LvAvatar theme={theme} name={workspace.displayName} src={workspace.logo ?? undefined} size={72} />
          </span>
        ) : (
          <span style={{ flex: '0 0 auto', width: 60, height: 60, borderRadius: theme.radius.xl, background: `linear-gradient(140deg, ${theme.color.brand}, ${theme.color.brandHover})`, color: theme.color.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <LvIcon name="settings" size={28} />
          </span>
        )}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.space(1) }}>
          <h1 style={{ ...theme.type.title, fontSize: 26, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>{workspace?.displayName ?? 'Settings'}</h1>
          <span style={{ ...theme.type.body, color: theme.color.textMuted }}>Your workspace, its people and how it behaves.</span>
          {workspace !== null && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(1) }}>
              <span style={{ ...theme.type.caption, fontWeight: theme.font.weight.medium, background: theme.color.surfaceSunken, color: theme.color.textMuted, borderRadius: theme.radius.pill, padding: `4px ${theme.space(3)}px`, overflowWrap: 'anywhere' }}>{workspace.subdomain}</span>
              <span style={{ ...theme.type.caption, fontWeight: theme.font.weight.medium, background: theme.tint.mint.wash, color: theme.tint.mint.ink, borderRadius: theme.radius.pill, padding: `4px ${theme.space(3)}px` }}>
                {workspace.activationStatus === 'ACTIVE' ? 'Active' : workspace.activationStatus}
              </span>
            </div>
          )}
        </div>
        <div className="lv-acct-band-actions">
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onOpenProfile} icon={<LvIcon name="profile" size={16} />}>
            Your profile
          </LvButton>
        </div>
      </div>

      <LvTabs
        theme={theme}
        label="Settings sections"
        value={section}
        onChange={(next) => setSection(next as Section)}
        tabs={SECTIONS.map((entry) => ({ key: entry.key, label: entry.label }))}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        {/* ----------------------------------------------------- GENERAL */}
        {section === 'general' && (
          <>
            <EditorialSection theme={theme} title="Workspace" icon="organisation">
              {workspace === null ? (
                <LvAdminOnly theme={theme} what="The workspace name and logo" />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(4), minWidth: 0, flexWrap: 'wrap', paddingBottom: theme.space(4) }}>
                    <LvAvatar theme={theme} name={workspace.displayName} src={workspace.logo ?? undefined} size={56} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>Logo</p>
                      <p style={{ ...theme.type.caption, color: theme.color.textMuted, margin: '2px 0 0' }}>A square image reads best. Replacing it applies everywhere immediately.</p>
                    </div>
                    {isAdmin ? (
                      <>
                        <input
                          ref={fileInput}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={(event) => void onLogo(event.target.files?.[0])}
                          style={{ display: 'none' }}
                        />
                        <LvButton theme={theme} variant="secondary" size="sm" busy={logoBusy} onClick={() => fileInput.current?.click()} icon={<LvIcon name="upload" size={16} />}>
                          {logoBusy ? 'Uploading' : 'Replace logo'}
                        </LvButton>
                      </>
                    ) : undefined}
                  </div>

                  {logoError !== null && (
                    <InlineNotice theme={theme} tone="danger">
                      {logoError}
                    </InlineNotice>
                  )}

                  <Field theme={theme} label="Workspace name" htmlFor="ws-name" required error={nameError ?? undefined} help="Shown wherever the workspace is named.">
                    <LvInput
                      theme={theme}
                      id="ws-name"
                      value={current?.displayName ?? ''}
                      maxLength={WORKSPACE_NAME_MAX}
                      disabled={!isAdmin}
                      invalid={nameError !== null}
                      onChange={(event) => set('displayName', event.target.value)}
                    />
                  </Field>

                  <LvFactRow theme={theme} label="Address">{workspace.subdomain}</LvFactRow>
                  <LvFactRow theme={theme} label="Status">{workspace.activationStatus === 'ACTIVE' ? 'Active' : workspace.activationStatus}</LvFactRow>

                  {!isAdmin && <LvAdminOnly theme={theme} what="The workspace name and logo" />}
                  <InlineNotice theme={theme}>
                    The workspace address is fixed here on purpose — changing it moves where the CRM is served from, which is a deployment change rather than a setting.
                  </InlineNotice>
                </>
              )}
            </EditorialSection>

            {isAdmin && dirty && (
              <LvSaveBar
                theme={theme}
                dirty={dirty}
                saving={saving}
                saved={saved}
                error={saveError}
                disabled={nameError !== null}
                onDiscard={() => { setDraft(null); setSaveError(null); }}
                onSave={() => void commit()}
              />
            )}
            {isAdmin && !dirty && saved && (
              <LvSaveBar theme={theme} dirty={false} saving={false} saved onDiscard={() => undefined} onSave={() => undefined} error={null} />
            )}

            <EditorialSection theme={theme} title="Notifications" icon="bell">
              <EmptyState
                theme={theme}
                icon="bell"
                tint="lavender"
                title="Nothing to set yet"
                text="The CRM sends notifications from its own engines — assignments, SLA clocks, document reviews — and the backend has no per-person preference for them. Rather than offer switches that would remember nothing, there are none here until it does."
              />
            </EditorialSection>
          </>
        )}

        {/* -------------------------------------------------- APPEARANCE */}
        {section === 'appearance' && (
          <EditorialSection
            theme={theme}
            title="Colour scheme"
            icon="sparkle"
            action={
              appearance.preference !== 'system' ? (
                <LvButton theme={theme} variant="ghost" size="sm" onClick={() => appearance.choose('system')}>
                  Follow the system
                </LvButton>
              ) : undefined
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                {APPEARANCE.map((option) => (
                  <LvButton
                    key={option.key}
                    theme={theme}
                    variant={appearance.preference === option.key ? 'primary' : 'secondary'}
                    ariaPressed={appearance.preference === option.key}
                    onClick={() => appearance.choose(option.key)}
                  >
                    {option.label}
                  </LvButton>
                ))}
              </div>

              <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
                {appearance.preference === 'system'
                  ? `Following this device, which is currently ${appearance.system}.`
                  : `Always ${appearance.preference}, whatever this device is set to.`}
              </p>

              <InlineNotice theme={theme}>
                Your scheme is stored on your account, so it follows you to another browser. Change it on{' '}
                <button
                  type="button"
                  className="lv-text-button"
                  onClick={onOpenProfile}
                  style={{ ...theme.type.bodySmall, background: 'transparent', border: 'none', padding: 0, color: theme.color.heading, cursor: 'pointer', fontFamily: theme.font.body, textDecoration: 'underline' }}
                >
                  your profile
                </button>{' '}
                to save it there; changing it here applies immediately to this browser.
              </InlineNotice>
            </div>
          </EditorialSection>
        )}

        {/* ----------------------------------------------------- MEMBERS */}
        {section === 'members' && (
          <>
            <EditorialSection theme={theme} title={`People in this workspace (${data.members.length})`} icon="leads">
              {data.members.length === 0 ? (
                <EmptyState theme={theme} text="No members were returned." />
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                  {data.members.map((member) => (
                    <LvMemberRow
                      key={member.id}
                      theme={theme}
                      name={[member.firstName, member.lastName].filter((part) => part !== '').join(' ')}
                      email={member.email}
                      jobTitle={member.jobTitle}
                      avatarUrl={member.avatarUrl}
                      roleLabel={member.roleLabel}
                      isYou={member.id === viewer?.workspaceMemberId}
                      action={
                        isAdmin ? (
                          <LvSelect
                            theme={theme}
                            id={`role-${member.id}`}
                            value={member.roleId ?? ''}
                            disabled={roleBusy === member.id}
                            onChange={(event) => void changeRole(member.id, event.target.value)}
                            style={{ maxWidth: 220 }}
                          >
                            <option value="" disabled>
                              No role
                            </option>
                            {data.roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.label}
                              </option>
                            ))}
                          </LvSelect>
                        ) : undefined
                      }
                    />
                  ))}
                </ul>
              )}

              {roleError !== null && (
                <InlineNotice theme={theme} tone="danger">
                  {roleError}
                </InlineNotice>
              )}

              {!data.canSeeRoles && <LvAdminOnly theme={theme} what="Roles and role assignment" />}
            </EditorialSection>

            {isAdmin && (
              <>
                <EditorialSection theme={theme} title="Invite people" icon="plus">
                  <div className="lv-field-grid">
                    <Field theme={theme} label="Email addresses" htmlFor="invite-emails" span help="One or several, separated by commas or spaces.">
                      <LvInput theme={theme} id="invite-emails" value={inviteRaw} onChange={(event) => { setInviteRaw(event.target.value); setInviteError(null); setInviteResult(null); }} />
                    </Field>

                    <Field theme={theme} label="Role they start with" htmlFor="invite-role">
                      <LvSelect theme={theme} id="invite-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                        <option value="">The workspace default</option>
                        {data.roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.label}
                          </option>
                        ))}
                      </LvSelect>
                    </Field>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: theme.space(3) }}>
                    <LvButton theme={theme} variant="primary" busy={inviteBusy} disabled={inviteRaw.trim() === ''} onClick={() => void invite()} icon={<LvIcon name="email" size={16} />}>
                      {inviteBusy ? 'Sending' : 'Send invitations'}
                    </LvButton>
                  </div>

                  {inviteError !== null && (
                    <InlineNotice theme={theme} tone="danger">
                      {inviteError}
                    </InlineNotice>
                  )}
                  {inviteResult !== null && (
                    <InlineNotice theme={theme} tone="success">
                      {inviteResult}
                    </InlineNotice>
                  )}
                </EditorialSection>

                <EditorialSection theme={theme} title={`Invitations awaiting a reply (${data.invitations.length})`} icon="clock">
                  {data.invitations.length === 0 ? (
                    <EmptyState theme={theme} quiet text="Nobody has an outstanding invitation." />
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                      {data.invitations.map((invitation) => (
                        <li
                          key={invitation.id}
                          className="lv-action-row"
                          style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'center', gap: theme.space(2), minWidth: 0, flexWrap: 'wrap' }}
                        >
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.heading, overflowWrap: 'anywhere' }}>{invitation.email}</span>
                            <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>
                              {invitation.expiresAt === null ? 'No expiry recorded' : `Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                            </span>
                          </span>
                          <LvButton
                            theme={theme}
                            variant="ghost"
                            size="sm"
                            busy={inviteActing === `resend-${invitation.id}`}
                            onClick={() => void actOnInvitation(invitation.id, 'resend')}
                          >
                            Send again
                          </LvButton>
                          <LvButton
                            theme={theme}
                            variant="danger"
                            size="sm"
                            busy={inviteActing === `revoke-${invitation.id}`}
                            onClick={() => void actOnInvitation(invitation.id, 'revoke')}
                          >
                            Revoke
                          </LvButton>
                        </li>
                      ))}
                    </ul>
                  )}
                </EditorialSection>

                <EditorialSection theme={theme} title={`Roles in this workspace (${data.roles.length})`} icon="settings">
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                    {data.roles.map((role) => (
                      <li
                        key={role.id}
                        className="lv-action-row"
                        style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'center', gap: theme.space(3), minWidth: 0, flexWrap: 'wrap' }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' }}>
                            <span style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>{role.label}</span>
                            {role.canUpdateAllSettings && <LvBadge theme={theme} tone="warning">Full settings access</LvBadge>}
                          </span>
                          {role.description !== null && role.description !== '' && (
                            <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{role.description}</span>
                          )}
                        </span>
                        <LvBadge theme={theme} tone="neutral">
                          {role.memberIds.length === 1 ? '1 person' : `${role.memberIds.length} people`}
                        </LvBadge>
                      </li>
                    ))}
                  </ul>

                  <InlineNotice theme={theme}>
                    Which objects and settings each role may reach is defined in the workspace&apos;s role configuration, not here. This page assigns roles; it does not redefine them.
                  </InlineNotice>
                </EditorialSection>
              </>
            )}
          </>
        )}

        {/* ---------------------------------------------------- SECURITY */}
        {section === 'security' && (
          <>
            {workspace === null ? (
              <EditorialSection theme={theme} title="Sign-in and security" icon="settings">
                <LvAdminOnly theme={theme} what="Sign-in and security" />
              </EditorialSection>
            ) : (
              <>
                <EditorialSection theme={theme} title="How people sign in" icon="settings">
                  <LvToggleRow
                    theme={theme}
                    label="Email and password"
                    help="Turning this off while no other method is enabled would lock everyone out."
                    checked={current?.isPasswordAuthEnabled ?? false}
                    disabled={!isAdmin}
                    onChange={(next) => set('isPasswordAuthEnabled', next)}
                  />
                  {/* Shown, not offered. The workspace field exists, but the
                      server refuses to set it — "Google auth is not enabled in
                      the system" — because it is an instance-level setting
                      configured outside any workspace. A switch here would
                      fail every time it was pressed, so this reports the state
                      and says what would change it. */}
                  <LvFactRow theme={theme} label="Google">{(current?.isGoogleAuthEnabled ?? false) ? 'Enabled' : 'Not available on this server'}</LvFactRow>
                  <LvFactRow theme={theme} label="Microsoft">{(current?.isMicrosoftAuthEnabled ?? false) ? 'Enabled' : 'Not available on this server'}</LvFactRow>
                  <LvToggleRow
                    theme={theme}
                    label="Require two-factor authentication"
                    help="Everyone must set up a second factor before they can continue."
                    checked={current?.isTwoFactorAuthenticationEnforced ?? false}
                    disabled={!isAdmin}
                    onChange={(next) => set('isTwoFactorAuthenticationEnforced', next)}
                  />
                  {!isAdmin && <LvAdminOnly theme={theme} what="Sign-in methods" />}
                  <InlineNotice theme={theme}>
                    Google and Microsoft sign-in are configured on the server itself, not per workspace, so they are reported here rather than switched. Ask whoever runs the
                    deployment to enable them.
                  </InlineNotice>
                </EditorialSection>

                <EditorialSection theme={theme} title="Access and joining" icon="person">
                  <LvToggleRow
                    theme={theme}
                    label="Allow joining by invite link"
                    help="A shareable link, in addition to emailed invitations."
                    checked={current?.isPublicInviteLinkEnabled ?? false}
                    disabled={!isAdmin}
                    onChange={(next) => set('isPublicInviteLinkEnabled', next)}
                  />
                  <LvToggleRow
                    theme={theme}
                    label="Allow support impersonation"
                    help="Lets a workspace administrator view the CRM as another member."
                    checked={current?.allowImpersonation ?? false}
                    disabled={!isAdmin}
                    onChange={(next) => set('allowImpersonation', next)}
                  />
                </EditorialSection>

                {isAdmin && (dirty || saved) && (
                  <LvSaveBar
                    theme={theme}
                    dirty={dirty}
                    saving={saving}
                    saved={saved}
                    error={saveError}
                    onDiscard={() => { setDraft(null); setSaveError(null); }}
                    onSave={() => void commit()}
                  />
                )}

                <EditorialSection theme={theme} title="Administered in the Twenty console" icon="website">
                  <p style={{ ...theme.type.bodySmall, color: theme.color.text, margin: `0 0 ${theme.space(3)}px` }}>
                    A few workspace-level things sit outside this application on purpose: defining what each role may do, API keys, workflows, and the workspace address. They are set
                    once, in one place.
                  </p>
                  {consoleHref === null ? (
                    <InlineNotice theme={theme}>This installation has no console address configured, so there is nothing to link to. Your administrator knows where it is.</InlineNotice>
                  ) : (
                    <LvButton theme={theme} variant="secondary" href={consoleHref} target="_blank" icon={<LvIcon name="website" size={16} />}>
                      Open the Twenty console
                    </LvButton>
                  )}
                </EditorialSection>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
