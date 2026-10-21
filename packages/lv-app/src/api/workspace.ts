import { useCallback, useEffect, useState } from 'react';

import { graphql, uploadMultipart } from 'src/api/client';

// The workspace, its members and its roles.
//
// Every call below is an existing platform capability, traced before it was
// used. What the audit established, and what shapes this file:
//
//   workspaceMembers   readable by every role (all six were visible as a
//                      coordinator), so the member list is not admin-only
//   getRoles           ADMIN ONLY — refused outright for the team roles, so
//                      roles and role assignment live behind that
//   updateWorkspace    ADMIN ONLY — refused for the team roles
//   uploadWorkspaceLogo  takes a multipart Upload scalar, which is why
//                      `uploadMultipart` had to exist at all
//   sendInvitations    admin-gated by the same setting permission
//
// `subdomain` is deliberately absent. It is editable through
// UpdateWorkspaceInput, and changing it moves the address the application is
// served from — a settings screen is the wrong place to be able to lock
// everyone out of the product.
//
// Twenty's own AI fields (fastModel, smartModel, aiAdditionalInstructions,
// enabledAiModelIds) are also absent. They configure the platform's assistant,
// not La Vivenzia's Gemini integration, and exposing them here would offer two
// unrelated AI configurations in one screen.

export type Workspace = {
  id: string;
  displayName: string;
  logo: string | null;
  subdomain: string;
  activationStatus: string;
  isPublicInviteLinkEnabled: boolean;
  isPasswordAuthEnabled: boolean;
  isGoogleAuthEnabled: boolean;
  isMicrosoftAuthEnabled: boolean;
  isTwoFactorAuthenticationEnforced: boolean;
  allowImpersonation: boolean;
  trashRetentionDays: number | null;
  eventLogRetentionDays: number | null;
};

const WORKSPACE_FIELDS =
  'id displayName logo subdomain activationStatus isPublicInviteLinkEnabled isPasswordAuthEnabled isGoogleAuthEnabled isMicrosoftAuthEnabled isTwoFactorAuthenticationEnforced allowImpersonation trashRetentionDays eventLogRetentionDays';

export const fetchWorkspace = async (): Promise<Workspace> => {
  const data = await graphql<{ currentWorkspace?: Workspace }>(`{ currentWorkspace { ${WORKSPACE_FIELDS} } }`, {}, 'metadata');

  if (!data.currentWorkspace) {
    throw new Error('The workspace could not be read.');
  }

  return data.currentWorkspace;
};

/** Exactly the fields this product offers. Never `subdomain`. */
export type WorkspacePatch = Partial<{
  displayName: string;
  isPublicInviteLinkEnabled: boolean;
  isPasswordAuthEnabled: boolean;
  isGoogleAuthEnabled: boolean;
  isMicrosoftAuthEnabled: boolean;
  isTwoFactorAuthenticationEnforced: boolean;
  allowImpersonation: boolean;
  trashRetentionDays: number;
  eventLogRetentionDays: number;
}>;

export const saveWorkspace = async (patch: WorkspacePatch): Promise<Workspace> => {
  const data = await graphql<{ updateWorkspace?: Workspace }>(
    `mutation($data: UpdateWorkspaceInput!) { updateWorkspace(data: $data) { ${WORKSPACE_FIELDS} } }`,
    { data: patch },
    'metadata',
  );

  if (!data.updateWorkspace) {
    throw new Error('The workspace was not updated.');
  }

  return data.updateWorkspace;
};

/**
 * The logo, through the platform's own multipart mutation.
 *
 * `UpdateWorkspaceInput.logo` is a String and could be set directly, but
 * nothing would have put a file behind that string — the upload mutation is
 * what stores the image and returns its signed URL. So the real capability is
 * used, not the shortcut that would have looked like it worked.
 */
export const uploadWorkspaceLogo = async (file: File): Promise<string> => {
  const data = await uploadMultipart<{ uploadWorkspaceLogo?: { path?: string; token?: string } }>(
    'mutation($file: Upload!) { uploadWorkspaceLogo(file: $file) { path token } }',
    'variables.file',
    file,
    'metadata',
  );

  const path = data.uploadWorkspaceLogo?.path;

  if (typeof path !== 'string' || path === '') {
    throw new Error('The logo was uploaded but the server returned no path.');
  }

  return path;
};

// ---------------------------------------------------------------------------
// Members and roles
// ---------------------------------------------------------------------------

export type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  avatarUrl: string;
  /** Filled from `getRoles`, which only an administrator may read. */
  roleLabel: string | null;
  roleId: string | null;
};

export type Role = {
  id: string;
  label: string;
  description: string | null;
  canUpdateAllSettings: boolean;
  isEditable: boolean;
  memberIds: string[];
};

type RawMember = {
  id: string;
  userEmail: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  name: { firstName: string | null; lastName: string | null } | null;
};

export const fetchMembers = async (): Promise<Member[]> => {
  const data = await graphql<{ workspaceMembers?: { edges: { node: RawMember }[] } }>(
    '{ workspaceMembers(first: 200, orderBy: [{ name: { firstName: AscNullsLast } }]) { edges { node { id userEmail jobTitle avatarUrl name { firstName lastName } } } } }',
  );

  return (data.workspaceMembers?.edges ?? []).map(({ node }) => ({
    id: node.id,
    firstName: node.name?.firstName ?? '',
    lastName: node.name?.lastName ?? '',
    email: node.userEmail ?? '',
    jobTitle: node.jobTitle ?? '',
    avatarUrl: node.avatarUrl ?? '',
    roleLabel: null,
    roleId: null,
  }));
};

/**
 * Roles, which only an administrator may read.
 *
 * A non-administrator gets a refusal from the server, so the caller treats an
 * error here as "not permitted to see roles" and shows the member list without
 * them rather than failing the whole screen.
 */
export const fetchRoles = async (): Promise<Role[]> => {
  const data = await graphql<{ getRoles?: { id: string; label: string; description: string | null; canUpdateAllSettings: boolean; isEditable: boolean; workspaceMembers: { id: string }[] }[] }>(
    '{ getRoles { id label description canUpdateAllSettings isEditable workspaceMembers { id } } }',
    {},
    'metadata',
  );

  return (data.getRoles ?? []).map((role) => ({
    id: role.id,
    label: role.label,
    description: role.description,
    canUpdateAllSettings: role.canUpdateAllSettings,
    isEditable: role.isEditable,
    memberIds: (role.workspaceMembers ?? []).map((member) => member.id),
  }));
};

export const assignRole = async (workspaceMemberId: string, roleId: string): Promise<void> => {
  const data = await graphql<{ updateWorkspaceMemberRole?: { id: string } }>(
    'mutation($workspaceMemberId: UUID!, $roleId: UUID!) { updateWorkspaceMemberRole(workspaceMemberId: $workspaceMemberId, roleId: $roleId) { id } }',
    { workspaceMemberId, roleId },
    'metadata',
  );

  if (!data.updateWorkspaceMemberRole) {
    throw new Error('The role was not changed.');
  }
};

/** Members with their role folded in, where the caller may see roles. */
export const withRoles = (members: Member[], roles: Role[]): Member[] => {
  const byMember = new Map<string, Role>();

  for (const role of roles) {
    for (const id of role.memberIds) {
      byMember.set(id, role);
    }
  }

  return members.map((member) => {
    const role = byMember.get(member.id);

    return role === undefined ? member : { ...member, roleLabel: role.label, roleId: role.id };
  });
};

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export type Invitation = { id: string; email: string; roleId: string | null; expiresAt: string | null };

export const fetchInvitations = async (): Promise<Invitation[]> => {
  const data = await graphql<{ findWorkspaceInvitations?: Invitation[] }>(
    '{ findWorkspaceInvitations { id email roleId expiresAt } }',
    {},
    'metadata',
  );

  return data.findWorkspaceInvitations ?? [];
};

/**
 * Invitations, with the result actually read.
 *
 * This mutation can answer `{ success: false }` and raise no GraphQL error at
 * all — inviting somebody who is already a member does exactly that. Ignoring
 * the payload would have shown "Invited" for an invitation that was never
 * sent, which is the precise kind of fake success this product must not have.
 */
export const sendInvitations = async (emails: string[], roleId: string | null): Promise<void> => {
  const data = await graphql<{ sendInvitations?: { success?: boolean } }>(
    'mutation($emails: [String!]!, $roleId: UUID) { sendInvitations(emails: $emails, roleId: $roleId) { success } }',
    { emails, roleId },
    'metadata',
  );

  if (data.sendInvitations?.success !== true) {
    throw new Error('The server did not send those invitations. Someone on the list may already be a member, or already invited.');
  }
};

export const revokeInvitation = async (appTokenId: string): Promise<void> => {
  await graphql<{ deleteWorkspaceInvitation?: unknown }>(
    'mutation($appTokenId: String!) { deleteWorkspaceInvitation(appTokenId: $appTokenId) }',
    { appTokenId },
    'metadata',
  );
};

export const resendInvitation = async (appTokenId: string): Promise<void> => {
  await graphql<{ resendWorkspaceInvitation?: unknown }>(
    'mutation($appTokenId: String!) { resendWorkspaceInvitation(appTokenId: $appTokenId) { success } }',
    { appTokenId },
    'metadata',
  );
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const WORKSPACE_NAME_MAX = 100;

export const validateWorkspaceName = (name: string): string | null => {
  if (name.trim().length === 0) {
    return 'The workspace needs a name.';
  }

  if (name.trim().length > WORKSPACE_NAME_MAX) {
    return `Keep this under ${WORKSPACE_NAME_MAX} characters.`;
  }

  return null;
};

/** Deliberately permissive: the server is the authority on deliverability. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const parseInviteEmails = (raw: string): { emails: string[]; invalid: string[] } => {
  const parts = raw
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '');
  const emails: string[] = [];
  const invalid: string[] = [];

  for (const part of parts) {
    if (!EMAIL.test(part)) {
      invalid.push(part);
    } else if (!emails.includes(part)) {
      emails.push(part);
    }
  }

  return { emails, invalid };
};

export const workspacePatch = (current: Workspace, draft: Workspace): WorkspacePatch => {
  const patch: WorkspacePatch = {};

  if (draft.displayName.trim() !== current.displayName) {
    patch.displayName = draft.displayName.trim();
  }

  for (const key of [
    'isPublicInviteLinkEnabled',
    'isPasswordAuthEnabled',
    // isGoogleAuthEnabled / isMicrosoftAuthEnabled are deliberately absent:
    // the server refuses them unless the instance itself has those providers
    // configured, so the screen reports them instead of offering a switch.
    'isTwoFactorAuthenticationEnforced',
    'allowImpersonation',
  ] as const) {
    if (draft[key] !== current[key]) {
      patch[key] = draft[key];
    }
  }

  for (const key of ['trashRetentionDays', 'eventLogRetentionDays'] as const) {
    if (draft[key] !== current[key] && typeof draft[key] === 'number') {
      patch[key] = draft[key] as number;
    }
  }

  return patch;
};

// ---------------------------------------------------------------------------
// The hook the screen uses
// ---------------------------------------------------------------------------

export type SettingsData = {
  workspace: Workspace | null;
  members: Member[];
  roles: Role[];
  /** Outstanding invitations. Admin-only, like roles. */
  invitations: Invitation[];
  /** The server refused `getRoles`, which is how we learn this is not an admin. */
  canSeeRoles: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useSettingsData = (): SettingsData => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [canSeeRoles, setCanSeeRoles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // The member list is the one thing every role may read, so it is loaded
    // independently of the two admin-only calls. A refusal on either of those
    // narrows the screen; it does not break it.
    const [workspaceResult, membersResult, rolesResult, invitationsResult] = await Promise.allSettled([
      fetchWorkspace(),
      fetchMembers(),
      fetchRoles(),
      fetchInvitations(),
    ]);

    if (membersResult.status === 'fulfilled') {
      setMembers(membersResult.value);
    } else {
      setError(membersResult.reason instanceof Error ? membersResult.reason.message : 'Members could not be read.');
    }

    setWorkspace(workspaceResult.status === 'fulfilled' ? workspaceResult.value : null);
    setInvitations(invitationsResult.status === 'fulfilled' ? invitationsResult.value : []);

    if (rolesResult.status === 'fulfilled') {
      setRoles(rolesResult.value);
      setCanSeeRoles(true);
      if (membersResult.status === 'fulfilled') {
        setMembers(withRoles(membersResult.value, rolesResult.value));
      }
    } else {
      setRoles([]);
      setCanSeeRoles(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { workspace, members, roles, invitations, canSeeRoles, loading, error, reload: load };
};
