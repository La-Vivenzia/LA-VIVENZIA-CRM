import { type CoreApiClient } from 'twenty-client-sdk/core';

// Small read helpers shared by the notification producers. All run through the
// caller's client (the application role for producers), and every value they
// return was read from the workspace — nothing here comes from a request body.

export type MemberSummary = {
  id: string;
  displayName: string | null;
  firstName: string | null;
  email: string | null;
};

type MemberRow = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  userEmail?: string | null;
};

const displayNameOf = (member: MemberRow): string | null => {
  const name = [member.name?.firstName, member.name?.lastName]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');

  return name.length > 0 ? name : null;
};

export const findMember = async (
  client: CoreApiClient,
  workspaceMemberId: string | null | undefined,
): Promise<MemberSummary | null> => {
  if (!workspaceMemberId) {
    return null;
  }

  const result = await client.query({
    workspaceMember: {
      __args: { filter: { id: { eq: workspaceMemberId } } },
      id: true,
      name: { firstName: true, lastName: true },
      userEmail: true,
    },
  });

  const member = (result as { workspaceMember?: MemberRow | null }).workspaceMember;

  if (!member) {
    return null;
  }

  return {
    id: member.id,
    displayName: displayNameOf(member),
    firstName: member.name?.firstName ?? null,
    email: member.userEmail ?? null,
  };
};

export type LeadSummary = {
  id: string;
  name: string;
  ownerWorkspaceMemberId: string | null;
  priority: string | null;
};

export const findLead = async (
  client: CoreApiClient,
  leadId: string | null | undefined,
): Promise<LeadSummary | null> => {
  if (!leadId) {
    return null;
  }

  const result = await client.query({
    lvLead: {
      __args: { filter: { id: { eq: leadId } } },
      id: true,
      name: true,
      ownerId: true,
      priority: true,
    },
  });

  const lead = (
    result as {
      lvLead?: { id: string; name?: string | null; ownerId?: string | null; priority?: string | null } | null;
    }
  ).lvLead;

  if (!lead) {
    return null;
  }

  return {
    id: lead.id,
    name: lead.name ?? 'this lead',
    ownerWorkspaceMemberId: lead.ownerId ?? null,
    priority: lead.priority ?? null,
  };
};
