import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Live verification of the SLA engine against a RUNNING server with this
// application installed. Time travel is `executeOneLogicFunction` on
// lv-sla-evaluator with a `clock` payload — the same code the cron runs, with
// an injected "now". Real sessions: a Main Admin (also the configured
// escalation owner), an Experience Hunter and an Onboarding Expert.
//
// Requirements (all skipped when absent): TWENTY_API_KEY plus the dev users —
// see lv-notifications.integration-test.ts for the variables / .notes file.

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.TWENTY_FRONT_ORIGIN ?? 'http://localhost:3001';
const API_KEY = process.env.TWENTY_API_KEY ?? '';

const loadDevUsers = (): Record<string, string> => {
  for (const file of [
    path.resolve(__dirname, '../../../../../../.notes/lv-dev-users.env'),
    path.resolve(process.cwd(), '.notes/lv-dev-users.env'),
  ]) {
    if (fs.existsSync(file)) {
      return Object.fromEntries(
        fs
          .readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .filter((line) => line.includes('=') && !line.startsWith('#'))
          .map((line) => line.split('=').map((part) => part.trim()) as [string, string]),
      );
    }
  }

  return {};
};

const dev = loadDevUsers();
const USERS = {
  admin: { email: process.env.LV_TEST_ADMIN_EMAIL ?? dev.USER_B_EMAIL ?? '', password: process.env.LV_TEST_ADMIN_PASSWORD ?? dev.USER_B_PASSWORD ?? '' },
  hunter: { email: process.env.LV_TEST_HUNTER_EMAIL ?? 'tim@apple.dev', password: process.env.LV_TEST_HUNTER_PASSWORD ?? 'tim@apple.dev' },
  reviewer: { email: process.env.LV_TEST_REVIEWER_EMAIL ?? dev.USER_C_EMAIL ?? '', password: process.env.LV_TEST_REVIEWER_PASSWORD ?? dev.USER_C_PASSWORD ?? '' },
};
const describeIfLive = API_KEY && USERS.admin.email && USERS.reviewer.email ? describe : describe.skip;

type Json = Record<string, unknown>;

const post = async (endpoint: string, body: Json, token?: string): Promise<Json> => {
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

  return (await response.json()) as Json;
};
const gql = async <T>(query: string, token: string, variables: Json = {}): Promise<T> =>
  ((await post('graphql', { query, variables }, token)) as { data?: T }).data ?? ({} as T);
const route = (routePath: string, body: Json, token: string) => post(`s${routePath}`, body, token);

const signIn = async ({ email, password }: { email: string; password: string }): Promise<string> => {
  const login = (await post('metadata', { query: `mutation { getLoginTokenFromCredentials(email: "${email}", password: "${password}", origin: "${ORIGIN}") { loginToken { token } } }` })) as { data?: { getLoginTokenFromCredentials?: { loginToken?: { token: string } } } };
  const loginToken = login.data?.getLoginTokenFromCredentials?.loginToken?.token;

  if (!loginToken) {
    throw new Error(`Could not sign in ${email}`);
  }

  const tokens = (await post('metadata', { query: `mutation { getAuthTokensFromLoginToken(loginToken: "${loginToken}", origin: "${ORIGIN}") { tokens { accessOrWorkspaceAgnosticToken { token } } } }` })) as { data: { getAuthTokensFromLoginToken: { tokens: { accessOrWorkspaceAgnosticToken: { token: string } } } } };

  return tokens.data.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
};

const memberIdOf = async (token: string, email: string): Promise<string> => {
  const data = await gql<{ workspaceMembers: { edges: { node: { id: string } }[] } }>(`query($email: String!) { workspaceMembers(first: 1, filter: { userEmail: { eq: $email } }) { edges { node { id } } } }`, token, { email });
  const id = data.workspaceMembers?.edges?.[0]?.node?.id;

  if (!id) {
    throw new Error(`No workspace member for ${email}`);
  }

  return id;
};

type SlaNode = {
  id: string;
  rule: string;
  status: string;
  ownerId: string | null;
  escalationOwnerId: string | null;
  escalationTaskId: string | null;
  escalationBlockedReason: string | null;
  startedAt: string;
  dueSoonAt: string;
  dueAt: string;
  breachedAt: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  lastEvaluatedAt: string | null;
  dedupeKey: string | null;
  auditTrail: { event: string }[] | null;
  leadId: string | null;
};
const SLA_FIELDS = 'id rule status ownerId escalationOwnerId escalationTaskId escalationBlockedReason startedAt dueSoonAt dueAt breachedAt escalatedAt resolvedAt resolutionReason lastEvaluatedAt dedupeKey auditTrail leadId';

const slas = async (token: string, filter: Json): Promise<SlaNode[]> =>
  (await gql<{ lvSlas?: { edges: { node: SlaNode }[] } }>(`query($f: LvSlaFilterInput) { lvSlas(first: 50, filter: $f) { edges { node { ${SLA_FIELDS} } } } }`, token, { f: filter })).lvSlas?.edges.map((edge) => edge.node) ?? [];
const slaById = async (token: string, id: string) => (await slas(token, { id: { eq: id } }))[0] ?? null;

const notifications = async (token: string, filter: Json) =>
  (await gql<{ lvNotifications?: { edges: { node: { id: string; recipientId: string; notificationType: string } }[] } }>(`query($f: LvNotificationFilterInput) { lvNotifications(first: 100, filter: $f) { edges { node { id recipientId notificationType } } } }`, token, { f: filter })).lvNotifications?.edges.map((edge) => edge.node) ?? [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async <T>(probe: () => Promise<T | null | undefined | false>, ms = 20_000): Promise<T | null> => {
  const deadline = Date.now() + ms;

  while (Date.now() < deadline) {
    const value = await probe();

    if (value) {
      return value as T;
    }

    await sleep(1000);
  }

  return null;
};
const plusHours = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * 3_600_000).toISOString();

const evaluatorId = async (token: string): Promise<string> => {
  const list = (await post('metadata', { query: `query { findManyLogicFunctions { id name } }` }, token)) as { data?: { findManyLogicFunctions?: { id: string; name: string }[] } };
  const id = list.data?.findManyLogicFunctions?.find((fn) => fn.name === 'lv-sla-evaluator')?.id;

  if (!id) {
    throw new Error('lv-sla-evaluator not found');
  }

  return id;
};

describeIfLive('La Vivenzia SLA engine — live', () => {
  let admin = '';
  let hunter = '';
  let reviewer = '';
  let adminId = '';
  let hunterId = '';
  let reviewerId = '';
  let functionId = '';
  let applicationId = '';
  const created = { leads: [] as string[], slas: [] as string[] };

  const evaluate = async (clock: string, slaIds: string[]): Promise<Json> => {
    const result = (await post('metadata', {
      query: `mutation($input: ExecuteOneLogicFunctionInput!) { executeOneLogicFunction(input: $input) { data status error } }`,
      variables: { input: { id: functionId, payload: { clock, slaIds } } },
    }, admin)) as { data?: { executeOneLogicFunction?: { data?: Json; error?: unknown } } };

    return result.data?.executeOneLogicFunction?.data ?? { error: result.data?.executeOneLogicFunction?.error };
  };

  const newLead = async (name: string, ownerId: string | null): Promise<{ id: string; sla: SlaNode }> => {
    const lead = await gql<{ createLvLead: { id: string } }>(`mutation { createLvLead(data: { name: "${name}", source: "WEBSITE", status: "NEW", priority: "HIGH" }) { id } }`, admin);

    created.leads.push(lead.createLvLead.id);

    const sla = await waitFor(async () => (await slas(admin, { leadId: { eq: lead.createLvLead.id }, rule: { eq: 'NEW_LEAD_CONTACT' } }))[0]);

    if (!sla) {
      throw new Error('SLA was not created by lvLead.created');
    }

    created.slas.push(sla.id);

    if (ownerId !== null) {
      await gql(`mutation { updateLvLead(id: "${lead.createLvLead.id}", data: { ownerId: "${ownerId}" }) { id } }`, admin);
      await waitFor(async () => (await slaById(admin, sla.id))?.ownerId === ownerId);
    }

    return { id: lead.createLvLead.id, sla: (await slaById(admin, sla.id)) as SlaNode };
  };

  beforeAll(async () => {
    admin = await signIn(USERS.admin);
    hunter = await signIn(USERS.hunter);
    reviewer = await signIn(USERS.reviewer);
    adminId = await memberIdOf(admin, USERS.admin.email);
    hunterId = await memberIdOf(admin, USERS.hunter.email);
    reviewerId = await memberIdOf(admin, USERS.reviewer.email);
    functionId = await evaluatorId(admin);

    const apps = (await post('metadata', { query: `query { findManyApplications { id universalIdentifier } }` }, admin)) as { data?: { findManyApplications?: { id: string; universalIdentifier: string }[] } };

    applicationId = apps.data?.findManyApplications?.find((app) => app.universalIdentifier === 'c9a2e367-05d5-4faf-af14-599a67aa496c')?.id ?? '';

    if (applicationId) {
      await post('metadata', {
        query: `mutation($key: String!, $value: String!, $applicationId: UUID!) { updateOneApplicationVariable(key: $key, value: $value, applicationId: $applicationId) }`,
        variables: { key: 'LV_ESCALATION_OWNER_EMAIL', value: USERS.admin.email, applicationId },
      }, admin);
    }
  });

  afterAll(async () => {
    for (const slaId of created.slas) {
      const sla = await slaById(admin, slaId);

      if (sla?.escalationTaskId) {
        const targets = await gql<{ taskTargets?: { edges: { node: { id: string } }[] } }>(`query { taskTargets(first: 10, filter: { taskId: { eq: "${sla.escalationTaskId}" } }) { edges { node { id } } } }`, admin);

        for (const edge of targets.taskTargets?.edges ?? []) {
          await gql(`mutation { destroyTaskTarget(id: "${edge.node.id}") { id } }`, admin);
        }

        await gql(`mutation { destroyTask(id: "${sla.escalationTaskId}") { id } }`, admin);
      }

      await gql(`mutation { destroyLvSla(id: "${slaId}") { id } }`, admin);
    }

    for (const leadId of created.leads) {
      for (const sla of await slas(admin, { leadId: { eq: leadId } })) {
        if (!created.slas.includes(sla.id)) {
          await gql(`mutation { destroyLvSla(id: "${sla.id}") { id } }`, admin);
        }
      }

      for (const row of await notifications(admin, { leadId: { eq: leadId } })) {
        await gql(`mutation { destroyLvNotification(id: "${row.id}") { id } }`, admin);
      }

      const history = await gql<{ lvAssignmentHistories?: { edges: { node: { id: string } }[] } }>(`query { lvAssignmentHistories(first: 50, filter: { leadId: { eq: "${leadId}" } }) { edges { node { id } } } }`, admin);

      for (const edge of history.lvAssignmentHistories?.edges ?? []) {
        await gql(`mutation { destroyLvAssignmentHistory(id: "${edge.node.id}") { id } }`, admin);
      }

      await gql(`mutation { destroyLvLead(id: "${leadId}") { id } }`, admin);
    }
  });

  it('starts a 24h clock from the lead’s own createdAt and follows the owner on reassignment', async () => {
    const { sla } = await newLead('[IT-SLA] clock', hunterId);

    expect(sla.status).toBe('ON_TRACK');
    expect(Date.parse(sla.dueAt) - Date.parse(sla.startedAt)).toBe(24 * 3_600_000);
    expect(Date.parse(sla.dueSoonAt) - Date.parse(sla.startedAt)).toBe(18 * 3_600_000);
    expect(sla.ownerId).toBe(hunterId);
    expect(sla.dedupeKey?.startsWith('NEW_LEAD_CONTACT:')).toBe(true);
    expect(sla.auditTrail?.map((entry) => entry.event)).toContain('REASSIGNED');
  });

  it('time-travels ON_TRACK → DUE_SOON → DUE → BREACHED → ESCALATED with one notification per state and one task', async () => {
    const { id: leadId, sla } = await newLead('[IT-SLA] lifecycle', hunterId);
    const T0 = sla.startedAt;

    await evaluate(plusHours(T0, 10), [sla.id]);
    expect((await slaById(admin, sla.id))?.status).toBe('ON_TRACK');

    await evaluate(plusHours(T0, 18), [sla.id]);
    expect((await slaById(admin, sla.id))?.status).toBe('DUE_SOON');
    expect(await notifications(hunter, { leadId: { eq: leadId }, notificationType: { eq: 'SLA_DUE_SOON' } })).toHaveLength(1);

    await evaluate(plusHours(T0, 24), [sla.id]);
    expect((await slaById(admin, sla.id))?.status).toBe('DUE');

    const breach = await evaluate(plusHours(T0, 25), [sla.id]);
    const escalated = await slaById(admin, sla.id);

    expect(breach.breached).toBe(1);
    expect(breach.escalated).toBe(1);
    expect(escalated?.status).toBe('ESCALATED');
    expect(escalated?.breachedAt).toBe(plusHours(T0, 25));
    expect(escalated?.escalationOwnerId).toBe(adminId);
    expect(escalated?.escalationTaskId).toBeTruthy();
    expect(await notifications(hunter, { leadId: { eq: leadId }, notificationType: { eq: 'SLA_BREACH' } })).toHaveLength(1);
    expect(await notifications(admin, { leadId: { eq: leadId }, notificationType: { eq: 'ESCALATION' }, recipientId: { eq: adminId } })).toHaveLength(1);

    // Restart / repeat: nothing more happens.
    for (const hours of [26, 30, 100]) {
      const again = await evaluate(plusHours(T0, hours), [sla.id]);

      expect(again.notified).toBe(0);
      expect(again.escalationTasksCreated).toBe(0);
    }

    expect((await slaById(admin, sla.id))?.status).toBe('ESCALATED');
    expect((await notifications(admin, { leadId: { eq: leadId } })).filter((n) => ['SLA_BREACH', 'ESCALATION'].includes(n.notificationType))).toHaveLength(2);
  });

  it('five concurrent evaluations produce exactly one breach, one escalation, one task', async () => {
    const { id: leadId, sla } = await newLead('[IT-SLA] concurrency', hunterId);
    const clock = plusHours(sla.startedAt, 26);
    const runs = await Promise.all([1, 2, 3, 4, 5].map(() => evaluate(clock, [sla.id])));

    expect(runs.filter((run) => run.breached === 1)).toHaveLength(1);
    expect(runs.filter((run) => run.escalated === 1)).toHaveLength(1);
    expect(runs.reduce((sum, run) => sum + Number(run.escalationTasksCreated ?? 0), 0)).toBe(1);
    expect(runs.reduce((sum, run) => sum + Number(run.notified ?? 0), 0)).toBe(2);
    expect((await notifications(admin, { leadId: { eq: leadId } })).filter((n) => ['SLA_BREACH', 'ESCALATION'].includes(n.notificationType))).toHaveLength(2);
    expect((await slaById(admin, sla.id))?.status).toBe('ESCALATED');
  });

  it('resolves before the deadline when contact is logged, and stays resolved forever', async () => {
    const { id: leadId, sla } = await newLead('[IT-SLA] resolution', hunterId);

    await gql(`mutation { createLvInteraction(data: { name: "[IT-SLA] call", leadId: "${leadId}", channel: "PHONE", direction: "OUTBOUND", occurredAt: "${new Date().toISOString()}", actorId: "${adminId}" }) { id } }`, admin);

    const resolved = await waitFor(async () => {
      const row = await slaById(admin, sla.id);

      return row?.status === 'RESOLVED' ? row : null;
    });

    expect(resolved?.resolutionReason).toBe('CONTACT_LOGGED');

    const later = await evaluate(plusHours(sla.startedAt, 200), [sla.id]);

    expect(later.evaluated).toBe(0);
    expect((await slaById(admin, sla.id))?.status).toBe('RESOLVED');
  });

  it('resolves after a breach when the lead is contacted; escalation does not continue', async () => {
    const { id: leadId, sla } = await newLead('[IT-SLA] late resolution', hunterId);

    await evaluate(plusHours(sla.startedAt, 30), [sla.id]);
    expect((await slaById(admin, sla.id))?.status).toBe('ESCALATED');

    await gql(`mutation { updateLvLead(id: "${leadId}", data: { status: "CONTACTED" }) { id } }`, admin);

    const resolved = await waitFor(async () => {
      const row = await slaById(admin, sla.id);

      return row?.status === 'RESOLVED' ? row : null;
    });

    expect(resolved?.resolutionReason).toBe('LEAD_CONTACTED');
  });

  it('CM-004: a Hunter sees only their SLAs, cannot read the reviewer’s, cannot resolve or reassign by mutation', async () => {
    const mine = await newLead('[IT-SLA] mine', hunterId);
    const theirs = await newLead('[IT-SLA] theirs', reviewerId);

    expect(await slaById(hunter, mine.sla.id)).not.toBeNull();
    expect(await slaById(hunter, theirs.sla.id)).toBeNull();
    expect(await slaById(reviewer, mine.sla.id)).toBeNull();
    expect((await slas(hunter, {})).every((row) => row.ownerId === hunterId || row.ownerId === null)).toBe(true);

    const forge = (await post('graphql', { query: `mutation { updateLvSla(id: "${mine.sla.id}", data: { status: "RESOLVED" }) { id } }` }, hunter)) as { data?: { updateLvSla?: unknown } };

    expect(forge.data?.updateLvSla ?? null).toBeNull();
    expect((await slaById(admin, mine.sla.id))?.status).toBe('ON_TRACK');

    const summary = await route('/sla/summary', { statuses: ['ON_TRACK'], ownerId: reviewerId }, hunter);

    expect(summary.ok).toBe(true);
    expect((summary.items as { ownerWorkspaceMemberId: string | null }[]).every((item) => item.ownerWorkspaceMemberId === hunterId || item.ownerWorkspaceMemberId === null)).toBe(true);
  });
});
