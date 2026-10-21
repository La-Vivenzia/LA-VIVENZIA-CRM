import { describe, expect, it } from 'vitest';

import { parseInviteEmails, validateWorkspaceName, withRoles, workspacePatch, WORKSPACE_NAME_MAX, type Member, type Role, type Workspace } from 'src/api/workspace';
import { parseConsoleUrl } from 'src/screens/SettingsScreen';

// Settings.
//
// Three things the audit established and these tests hold in place:
//
//   - `subdomain` must never reach a patch. It is editable in
//     UpdateWorkspaceInput and it is the address the product is served from.
//   - Google and Microsoft sign-in must never reach a patch either. The
//     server refuses them unless the *instance* has those providers
//     configured ("Google auth is not enabled in the system"), so a switch
//     would fail every time it was pressed.
//   - Roles are readable only by an administrator, so the member list has to
//     work without them.

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  id: 'ws-1',
  displayName: 'La Vivenzia',
  logo: null,
  subdomain: 'apple',
  activationStatus: 'ACTIVE',
  isPublicInviteLinkEnabled: true,
  isPasswordAuthEnabled: true,
  isGoogleAuthEnabled: false,
  isMicrosoftAuthEnabled: false,
  isTwoFactorAuthenticationEnforced: false,
  allowImpersonation: true,
  trashRetentionDays: 30,
  eventLogRetentionDays: 90,
  ...over,
});

describe('the workspace name', () => {
  it('is required', () => {
    expect(validateWorkspaceName('')).toMatch(/needs a name/i);
    expect(validateWorkspaceName('   ')).toMatch(/needs a name/i);
  });

  it('is bounded', () => {
    expect(validateWorkspaceName('a'.repeat(WORKSPACE_NAME_MAX + 1))).toMatch(/under/);
    expect(validateWorkspaceName('a'.repeat(WORKSPACE_NAME_MAX))).toBeNull();
  });

  it('accepts an ordinary name', () => {
    expect(validateWorkspaceName('La Vivenzia')).toBeNull();
  });
});

describe('what a workspace save actually sends', () => {
  it('sends nothing when nothing changed', () => {
    const current = workspace();

    expect(workspacePatch(current, { ...current })).toEqual({});
  });

  it('sends only the changed field, trimmed', () => {
    const current = workspace();

    expect(workspacePatch(current, { ...current, displayName: '  La Vivenzia Travel  ' })).toEqual({ displayName: 'La Vivenzia Travel' });
  });

  it('never sends the subdomain, even when it differs', () => {
    // Changing it moves where the CRM is served from. A settings page must
    // not be able to lock everyone out of the product.
    const current = workspace();
    const patch = workspacePatch(current, { ...current, subdomain: 'somewhere-else' });

    expect(patch).toEqual({});
    expect(Object.keys(patch)).not.toContain('subdomain');
  });

  it('never sends the Google or Microsoft switches', () => {
    // The server refuses these unless the instance supports them, so the
    // screen reports their state instead of offering a control.
    const current = workspace();
    const patch = workspacePatch(current, { ...current, isGoogleAuthEnabled: true, isMicrosoftAuthEnabled: true });

    expect(patch).toEqual({});
  });

  it('sends the switches that were verified to work', () => {
    const current = workspace();
    const patch = workspacePatch(current, {
      ...current,
      isPublicInviteLinkEnabled: false,
      isTwoFactorAuthenticationEnforced: true,
      allowImpersonation: false,
    });

    expect(patch).toEqual({ isPublicInviteLinkEnabled: false, isTwoFactorAuthenticationEnforced: true, allowImpersonation: false });
  });

  it('does not send a retention value that is not a number', () => {
    const current = workspace();

    expect(workspacePatch(current, { ...current, trashRetentionDays: null })).toEqual({});
  });
});

describe('invite addresses', () => {
  it('accepts one', () => {
    expect(parseInviteEmails('priya@example.com')).toEqual({ emails: ['priya@example.com'], invalid: [] });
  });

  it('accepts several, however they were separated', () => {
    const { emails, invalid } = parseInviteEmails('a@example.com, b@example.com; c@example.com\nd@example.com');

    expect(emails).toEqual(['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com']);
    expect(invalid).toEqual([]);
  });

  it('lowercases and de-duplicates', () => {
    expect(parseInviteEmails('A@Example.com a@example.com').emails).toEqual(['a@example.com']);
  });

  it('separates what is not an address rather than sending it', () => {
    const { emails, invalid } = parseInviteEmails('good@example.com, not-an-email, also bad@');

    expect(emails).toEqual(['good@example.com']);
    expect(invalid).toEqual(['not-an-email', 'also', 'bad@']);
  });

  it('treats an empty box as nothing, not as an error', () => {
    expect(parseInviteEmails('')).toEqual({ emails: [], invalid: [] });
    expect(parseInviteEmails('   ,  ; ')).toEqual({ emails: [], invalid: [] });
  });
});

describe('members and their roles', () => {
  const member = (id: string): Member => ({ id, firstName: 'A', lastName: 'B', email: `${id}@example.com`, jobTitle: '', avatarUrl: '', roleLabel: null, roleId: null });
  const role = (id: string, label: string, memberIds: string[]): Role => ({ id, label, description: null, canUpdateAllSettings: false, isEditable: true, memberIds });

  it('folds each role onto its members', () => {
    const merged = withRoles([member('m1'), member('m2'), member('m3')], [role('r1', 'Lead Coordinator', ['m1', 'm2']), role('r2', 'Marketing', ['m3'])]);

    expect(merged.map((m) => m.roleLabel)).toEqual(['Lead Coordinator', 'Lead Coordinator', 'Marketing']);
    expect(merged[0].roleId).toBe('r1');
  });

  it('leaves a member without a role alone rather than inventing one', () => {
    const merged = withRoles([member('m1')], [role('r1', 'Marketing', [])]);

    expect(merged[0].roleLabel).toBeNull();
    expect(merged[0].roleId).toBeNull();
  });

  it('returns the list unchanged when roles could not be read', () => {
    // A non-administrator is refused `getRoles`, so the member list must still
    // render — just without role badges.
    const members = [member('m1'), member('m2')];

    expect(withRoles(members, [])).toEqual(members);
  });
});

describe('the Twenty console link', () => {
  it('is offered for an absolute http(s) address', () => {
    expect(parseConsoleUrl('https://console.example.com')).toBe('https://console.example.com/');
    expect(parseConsoleUrl('  http://localhost:3002 ')).toBe('http://localhost:3002/');
  });

  it('is withheld when unconfigured', () => {
    expect(parseConsoleUrl(undefined)).toBeNull();
    expect(parseConsoleUrl('')).toBeNull();
  });

  it('is withheld rather than guessed from something unusable', () => {
    expect(parseConsoleUrl('/settings')).toBeNull();
    expect(parseConsoleUrl('console.example.com')).toBeNull();
    expect(parseConsoleUrl('javascript:alert(1)')).toBeNull();
  });
});
