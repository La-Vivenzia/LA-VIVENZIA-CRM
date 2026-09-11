/*
 * La Vivenzia record scoping — NOT an Enterprise feature.
 *
 * Twenty's row-level permission predicates are licensed Enterprise
 * (`resolve-row-level-permission-record-filter.util.ts` carries the licence
 * banner) and La Vivenzia has decided not to depend on any paid feature. This
 * file is the free replacement: a small, fixed scoping rule owned by La
 * Vivenzia, evaluated in the same place so it covers every access path.
 *
 * It deliberately shares no code with the Enterprise path. If the Enterprise
 * predicate tables are empty — which they are — nothing here changes.
 *
 * Why this lives in core rather than in the application package:
 * a Twenty application can hook cron jobs, database events and HTTP routes.
 * It cannot intercept a record read. Anything that must filter rows *before*
 * they are returned therefore has to run inside the ORM, which is here. The
 * application still owns action-level authorization (may this person approve?);
 * this owns row visibility (may this person see the row at all?).
 *
 * Enforcement point: WorkspaceRepository, so it applies to GraphQL, REST, the
 * metadata API and any internal service equally. It is not a UI filter.
 */

// Role universal identifiers are stable across workspaces because the
// application manifest declares them; the per-workspace role *id* is not, so
// it is never used here.
const LV_ROLE = {
  MAIN_ADMIN: 'c1253597-4b22-4659-97e2-b74b18fb57d9',
  EXPERIENCE_HUNTER: 'fbda0f69-8c2b-44e3-b5a3-005762d20a39',
  LEAD_COORDINATOR: '45ea5a71-b058-45e6-84ba-7ee4885883db',
  ONBOARDING_EXPERT: 'be99c1d8-2c34-4841-ab31-359c3aa9e73a',
  EXPERIENCE_TEAM: '15afad08-afbc-4d49-b6b0-483aac7777c3',
  MARKETING: '8e231881-c27f-494c-8113-93e027b8d69b',
  OPERATIONS: '13919940-3648-4780-a6c2-8ded8b9bb76f',
  MANAGEMENT: 'e5a958bd-a4a5-431f-91e5-0c221f8d1edd',
} as const;

/*
 * Roles that see every row of a scoped object.
 *
 * Management is here on purpose: SECURITY-RBAC.md gives it read oversight of
 * the whole pipeline, and its role definition already denies every write. Wide
 * *reading* with no ability to change anything is the access that role is for.
 *
 * Operations is here because its remit is the pipeline as a whole; it is
 * constrained by object permissions instead, not by ownership.
 */
const UNSCOPED_ROLE_UNIVERSAL_IDENTIFIERS: ReadonlySet<string> = new Set([
  LV_ROLE.MAIN_ADMIN,
  LV_ROLE.OPERATIONS,
  LV_ROLE.MANAGEMENT,
]);

export type LvScopeRule = {
  /*
   * Column on the scoped table holding the workspace member this row belongs
   * to. A row is visible when this equals the caller, or when it is NULL —
   * an unassigned lead has to stay visible or nobody could ever pick it up.
   */
  ownerColumn: string;
  /*
   * Optional second column that also grants access, for records that have both
   * an owner and a reviewer.
   */
  secondaryColumn?: string;
};

/*
 * Which objects are scoped, keyed by nameSingular.
 *
 * Documents are scoped through their onboarding rather than directly: a
 * document has no owner of its own, and the whole point is that a person who
 * cannot open the onboarding cannot reach its papers by guessing a file id.
 */
export const LV_SCOPED_OBJECTS: Readonly<Record<string, LvScopeRule>> = {
  lvLead: { ownerColumn: 'ownerId' },
  lvOnboarding: { ownerColumn: 'reviewerId' },
  lvInteraction: { ownerColumn: 'actorId' },
};

/*
 * Objects reachable only through a parent, expressed as a subquery so the
 * child inherits exactly the parent's visibility.
 */
export const LV_PARENT_SCOPED_OBJECTS: Readonly<
  Record<string, { foreignKey: string; parentTable: string; parentColumn: string }>
> = {
  lvOnboardingDocument: {
    foreignKey: 'onboardingId',
    parentTable: '_lvOnboarding',
    parentColumn: 'reviewerId',
  },
};

export const isUnscopedForRoles = (roleUniversalIdentifiers: string[]): boolean =>
  roleUniversalIdentifiers.some((identifier) =>
    UNSCOPED_ROLE_UNIVERSAL_IDENTIFIERS.has(identifier),
  );

/*
 * True when this caller is governed by La Vivenzia scoping at all.
 *
 * A caller holding no LV role — the application's own automation role, an
 * integration API key, Twenty's built-in Admin — is left alone. Scoping people
 * who are not part of the La Vivenzia role model would break the platform
 * rather than secure it, and those callers are already constrained by object
 * permissions.
 */
export const isGovernedByLvScope = (
  roleUniversalIdentifiers: string[],
): boolean =>
  roleUniversalIdentifiers.some(
    (identifier) =>
      identifier === LV_ROLE.EXPERIENCE_HUNTER ||
      identifier === LV_ROLE.LEAD_COORDINATOR ||
      identifier === LV_ROLE.ONBOARDING_EXPERT ||
      identifier === LV_ROLE.EXPERIENCE_TEAM ||
      identifier === LV_ROLE.MARKETING,
  );

export type LvScopeCondition = {
  sql: string;
  parameters: Record<string, unknown>;
};

/*
 * The SQL a scoped caller's query is narrowed by.
 *
 * Returns null when no narrowing applies, which the caller must treat as "add
 * nothing" rather than "deny everything" — the deny decision belongs to object
 * permissions, which have already run by this point.
 */
export const buildLvScopeCondition = ({
  objectNameSingular,
  tableAlias,
  schemaName,
  workspaceMemberId,
  roleUniversalIdentifiers,
  parameterPrefix,
}: {
  objectNameSingular: string;
  tableAlias: string;
  schemaName: string;
  workspaceMemberId: string | undefined;
  roleUniversalIdentifiers: string[];
  parameterPrefix: string;
}): LvScopeCondition | null => {
  if (!isGovernedByLvScope(roleUniversalIdentifiers)) {
    return null;
  }

  if (isUnscopedForRoles(roleUniversalIdentifiers)) {
    return null;
  }

  /*
   * A governed caller with no resolved workspace member cannot own anything,
   * so it sees nothing. Returning null here would silently hand over every
   * row, which is the failure mode this whole file exists to prevent.
   */
  if (workspaceMemberId === undefined) {
    return { sql: 'FALSE', parameters: {} };
  }

  const parameterName = `${parameterPrefix}_lvActor`;
  const direct = LV_SCOPED_OBJECTS[objectNameSingular];

  if (direct !== undefined) {
    const columns = [direct.ownerColumn, direct.secondaryColumn].filter(
      (column): column is string => column !== undefined,
    );

    const clauses = columns
      .map(
        (column) =>
          `"${tableAlias}"."${column}" = :${parameterName} OR "${tableAlias}"."${column}" IS NULL`,
      )
      .join(' OR ');

    return {
      sql: `(${clauses})`,
      parameters: { [parameterName]: workspaceMemberId },
    };
  }

  const viaParent = LV_PARENT_SCOPED_OBJECTS[objectNameSingular];

  if (viaParent !== undefined) {
    return {
      sql:
        `EXISTS (SELECT 1 FROM "${schemaName}"."${viaParent.parentTable}" lv_parent ` +
        `WHERE lv_parent."id" = "${tableAlias}"."${viaParent.foreignKey}" ` +
        `AND (lv_parent."${viaParent.parentColumn}" = :${parameterName} ` +
        `OR lv_parent."${viaParent.parentColumn}" IS NULL))`,
      parameters: { [parameterName]: workspaceMemberId },
    };
  }

  return null;
};
