import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// Who is asking, according to the platform — never according to the body.
//
// The dashboards adapt to the caller's role, and the Control Tower and
// permanent delete are admin-only. The application cannot read role
// membership (that needs the ROLES settings permission), but every signed-in
// user can read their OWN permissions through `currentUser`, and those are
// what the role model actually grants:
//
//   - settings permission WORKSPACE  → an administrator (Main Admin / Admin)
//   - update on lvOnboarding          → onboarding work (Onboarding Expert)
//   - update on lvInteraction         → coordination work (Lead Coordinator)
//   - update on lvLead only           → hunting (Experience Hunter)
//   - none of the above               → read-only oversight (Management,
//                                        Marketing, Experience Team)
//
// This drives which dashboard is shown and which capabilities the UI offers.
// It is NOT the security boundary: every query the dashboard runs is delegated,
// so CM-004 and object permissions apply regardless of the lens.

export type DashboardLens = 'HUNTER' | 'COORDINATOR' | 'ONBOARDING' | 'ADMIN' | 'OVERSIGHT';

export type CallerContext = {
  workspaceMemberId: string | null;
  displayName: string | null;
  firstName: string | null;
  userId: string | null;
  isAdmin: boolean;
  permissionFlags: string[];
  // Object nameSingular → what the caller may do with it.
  objectPermissions: Record<
    string,
    { read: boolean; update: boolean; softDelete: boolean; destroy: boolean }
  >;
  lens: DashboardLens;
  // Lenses the caller may switch to (a view of the same scoped data).
  availableLenses: DashboardLens[];
};

type CurrentUserResponse = {
  currentUser?: {
    id?: string;
    workspaceMember?: { id?: string; name?: { firstName?: string | null; lastName?: string | null } | null } | null;
    currentUserWorkspace?: {
      permissionFlags?: string[] | null;
      objectPermissions?:
        | {
            objectMetadataId: string;
            canReadObjectRecords?: boolean | null;
            canUpdateObjectRecords?: boolean | null;
            canSoftDeleteObjectRecords?: boolean | null;
            canDestroyObjectRecords?: boolean | null;
          }[]
        | null;
    } | null;
  } | null;
  objects?: { edges?: { node?: { id: string; nameSingular: string } }[] } | null;
};

export const ADMIN_PERMISSION_FLAG = 'WORKSPACE';

export const deriveLens = ({
  isAdmin,
  objectPermissions,
}: Pick<CallerContext, 'isAdmin' | 'objectPermissions'>): {
  lens: DashboardLens;
  availableLenses: DashboardLens[];
} => {
  if (isAdmin) {
    return { lens: 'ADMIN', availableLenses: ['ADMIN', 'HUNTER', 'COORDINATOR', 'ONBOARDING'] };
  }

  const can = (object: string) => objectPermissions[object]?.update === true;

  if (can('lvOnboarding')) {
    // Operations can update leads, interactions and onboardings: give it the
    // widest working view and let it switch.
    const lenses: DashboardLens[] = can('lvInteraction')
      ? ['COORDINATOR', 'HUNTER', 'ONBOARDING']
      : ['ONBOARDING'];

    return { lens: lenses[0], availableLenses: lenses };
  }

  if (can('lvInteraction')) {
    return { lens: 'COORDINATOR', availableLenses: ['COORDINATOR', 'HUNTER'] };
  }

  if (can('lvLead')) {
    return { lens: 'HUNTER', availableLenses: ['HUNTER'] };
  }

  return { lens: 'OVERSIGHT', availableLenses: ['OVERSIGHT'] };
};

export const resolveCaller = async (client: DelegatedGraphqlClient): Promise<CallerContext> => {
  const { data } = await client.query<CurrentUserResponse>(
    `query { currentUser { id workspaceMember { id name { firstName lastName } } currentUserWorkspace { permissionFlags objectPermissions { objectMetadataId canReadObjectRecords canUpdateObjectRecords canSoftDeleteObjectRecords canDestroyObjectRecords } } } objects(paging: { first: 200 }) { edges { node { id nameSingular } } } }`,
    {},
    'metadata',
  );

  const nameById = new Map<string, string>();

  for (const edge of data.objects?.edges ?? []) {
    if (edge.node) {
      nameById.set(edge.node.id, edge.node.nameSingular);
    }
  }

  const objectPermissions: CallerContext['objectPermissions'] = {};

  for (const permission of data.currentUser?.currentUserWorkspace?.objectPermissions ?? []) {
    const name = nameById.get(permission.objectMetadataId);

    if (name) {
      objectPermissions[name] = {
        read: permission.canReadObjectRecords === true,
        update: permission.canUpdateObjectRecords === true,
        softDelete: permission.canSoftDeleteObjectRecords === true,
        destroy: permission.canDestroyObjectRecords === true,
      };
    }
  }

  const permissionFlags = data.currentUser?.currentUserWorkspace?.permissionFlags ?? [];
  const isAdmin = permissionFlags.includes(ADMIN_PERMISSION_FLAG);
  const { lens, availableLenses } = deriveLens({ isAdmin, objectPermissions });

  const member = data.currentUser?.workspaceMember;
  const firstName = member?.name?.firstName?.trim() ?? '';
  const lastName = member?.name?.lastName?.trim() ?? '';

  return {
    workspaceMemberId: member?.id ?? null,
    // The shell greets the person by name; nothing else needs it, so it is
    // carried on the caller rather than queried a second time.
    displayName: [firstName, lastName].filter(Boolean).join(' ') || null,
    firstName: firstName || null,
    userId: data.currentUser?.id ?? null,
    isAdmin,
    permissionFlags,
    objectPermissions,
    lens,
    availableLenses,
  };
};
