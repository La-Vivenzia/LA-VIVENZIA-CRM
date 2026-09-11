import {
  buildLvScopeCondition,
  isGovernedByLvScope,
  isUnscopedForRoles,
} from 'src/engine/twenty-orm/utils/lv-record-scope.util';

const ROLE = {
  MAIN_ADMIN: 'c1253597-4b22-4659-97e2-b74b18fb57d9',
  EXPERIENCE_HUNTER: 'fbda0f69-8c2b-44e3-b5a3-005762d20a39',
  ONBOARDING_EXPERT: 'be99c1d8-2c34-4841-ab31-359c3aa9e73a',
  MANAGEMENT: 'e5a958bd-a4a5-431f-91e5-0c221f8d1edd',
  OPERATIONS: '13919940-3648-4780-a6c2-8ded8b9bb76f',
};

const TWENTY_ADMIN = '20202020-02c2-43f2-b94d-cab1f2b532eb';
const MEMBER = 'wm-1';

const build = (
  objectNameSingular: string,
  roles: string[],
  workspaceMemberId: string | undefined = MEMBER,
) =>
  buildLvScopeCondition({
    objectNameSingular,
    tableAlias: 't',
    schemaName: 'workspace_x',
    workspaceMemberId,
    roleUniversalIdentifiers: roles,
    parameterPrefix: 't',
  });

describe('lv-record-scope (CM-004)', () => {
  describe('who is governed', () => {
    it('scopes the La Vivenzia team roles', () => {
      expect(isGovernedByLvScope([ROLE.EXPERIENCE_HUNTER])).toBe(true);
      expect(isGovernedByLvScope([ROLE.ONBOARDING_EXPERT])).toBe(true);
    });

    it("leaves Twenty's own roles, API keys and the app role alone", () => {
      // Nothing LV about these callers; object permissions constrain them.
      expect(isGovernedByLvScope([TWENTY_ADMIN])).toBe(false);
      expect(isGovernedByLvScope([])).toBe(false);
      expect(build('lvLead', [TWENTY_ADMIN])).toBeNull();
      expect(build('lvLead', [])).toBeNull();
    });

    it('treats Main Admin, Operations and Management as unscoped', () => {
      for (const role of [ROLE.MAIN_ADMIN, ROLE.OPERATIONS, ROLE.MANAGEMENT]) {
        expect(isUnscopedForRoles([role])).toBe(true);
      }
    });
  });

  describe('lead scoping', () => {
    it('narrows a scoped role to owned or unassigned rows', () => {
      const condition = build('lvLead', [ROLE.EXPERIENCE_HUNTER]);

      expect(condition).not.toBeNull();
      expect(condition?.sql).toContain('"t"."ownerId" = :t_lvActor');
      // Unassigned leads stay visible, or nobody could ever pick one up.
      expect(condition?.sql).toContain('"t"."ownerId" IS NULL');
      expect(condition?.parameters).toEqual({ t_lvActor: MEMBER });
    });

    it('adds nothing for an unscoped LV role', () => {
      expect(build('lvLead', [ROLE.MAIN_ADMIN])).toBeNull();
    });

    it('holding an unscoped role alongside a scoped one lifts the scope', () => {
      expect(
        build('lvLead', [ROLE.EXPERIENCE_HUNTER, ROLE.OPERATIONS]),
      ).toBeNull();
    });
  });

  describe('notification scoping', () => {
    it('narrows a governed role to notifications addressed to them, and never to NULL', () => {
      const condition = build('lvNotification', [ROLE.EXPERIENCE_HUNTER]);

      expect(condition?.sql).toBe('("t"."recipientId" = :t_lvActor)');
      expect(condition?.sql).not.toContain('IS NULL');
      expect(condition?.parameters).toEqual({ t_lvActor: MEMBER });
    });

    it('leaves an unscoped role alone', () => {
      expect(build('lvNotification', [ROLE.MAIN_ADMIN])).toBeNull();
    });
  });

  describe('SLA scoping', () => {
    it('narrows a governed role to SLAs it owns or that are unowned', () => {
      const condition = build('lvSla', [ROLE.ONBOARDING_EXPERT]);

      expect(condition?.sql).toContain('"t"."ownerId" = :t_lvActor');
      expect(condition?.sql).toContain('"t"."ownerId" IS NULL');
    });

    it('leaves an unscoped role (the escalation owners) alone', () => {
      expect(build('lvSla', [ROLE.OPERATIONS])).toBeNull();
    });
  });

  describe('fail closed', () => {
    it('denies every row to a governed caller with no resolved member', () => {
      // Returning null here would silently hand over everything — the exact
      // failure this file exists to prevent.
      const condition = buildLvScopeCondition({
        objectNameSingular: 'lvLead',
        tableAlias: 't',
        schemaName: 'workspace_x',
        workspaceMemberId: undefined,
        roleUniversalIdentifiers: [ROLE.EXPERIENCE_HUNTER],
        parameterPrefix: 't',
      });

      expect(condition).toEqual({ sql: 'FALSE', parameters: {} });
    });
  });

  describe('documents inherit their onboarding’s visibility', () => {
    it('scopes a document through a subquery on its onboarding’s reviewer', () => {
      const condition = build('lvOnboardingDocument', [ROLE.ONBOARDING_EXPERT]);

      expect(condition?.sql).toContain(
        'EXISTS (SELECT 1 FROM "workspace_x"."_lvOnboarding"',
      );
      expect(condition?.sql).toContain('lv_parent."id" = "t"."onboardingId"');
      expect(condition?.sql).toContain('lv_parent."reviewerId" = :t_lvActor');
    });
  });

  describe('objects outside the policy', () => {
    it('is not applied to unlisted objects, even for a scoped role', () => {
      expect(build('person', [ROLE.EXPERIENCE_HUNTER])).toBeNull();
      expect(build('task', [ROLE.EXPERIENCE_HUNTER])).toBeNull();
    });
  });

  describe('SQL safety', () => {
    it('uses a bound parameter for the member id, never string interpolation', () => {
      const condition = build(
        'lvLead',
        [ROLE.EXPERIENCE_HUNTER],
        "x' OR 1=1 --",
      );

      expect(condition?.sql).not.toContain('1=1');
      expect(condition?.parameters.t_lvActor).toBe("x' OR 1=1 --");
    });

    it('prefixes the parameter with the alias so joins do not collide', () => {
      const a = buildLvScopeCondition({
        objectNameSingular: 'lvLead',
        tableAlias: 'a',
        schemaName: 's',
        workspaceMemberId: MEMBER,
        roleUniversalIdentifiers: [ROLE.EXPERIENCE_HUNTER],
        parameterPrefix: 'a',
      });
      const b = { ...a, parameters: {} };

      expect(Object.keys(a?.parameters ?? {})).toEqual(['a_lvActor']);
      expect(b).toBeDefined();
    });
  });
});
