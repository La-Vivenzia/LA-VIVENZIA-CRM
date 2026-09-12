import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Live verification of the Day 5 dashboards, Control Tower and governance
// routes against a RUNNING server, with real sessions and a controlled
// fixture set whose exact counts the dashboards must report:
//
//   5 leads owned by the Hunter — 1 unowned, 1 with an overdue follow-up task
//   (owned by the Hunter), 1 SLA time-travelled to BREACHED/ESCALATED, 1
//   marked DUPLICATE, 1 onboarding INTERNAL_REVIEW with 2 pending documents
//   and 1 rejected document.
//
// Everything is destroyed afterwards. Requirements as in the other live tests.

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.TWENTY_FRONT_ORIGIN ?? 'http://localhost:3001';
const API_KEY = process.env.TWENTY_API_KEY ?? '';

const loadDevUsers = (): Record<string, string> => {
  for (const file of [path.resolve(__dirname, '../../../../../../.notes/lv-dev-users.env'), path.resolve(process.cwd(), '.notes/lv-dev-users.env')]) {
    if (fs.existsSync(file)) {
      return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.includes('=') && !line.startsWith('#')).map((line) => line.split('=').map((part) => part.trim()) as [string, string]));
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
  const response = await fetch(`${API_URL}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

  return (await response.json()) as Json;
};
const gql = async <T>(query: string, token: string, variables: Json = {}): Promise<T> => ((await post('graphql', { query, variables }, token)) as { data?: T }).data ?? ({} as T);
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
    throw new Error(`No member ${email}`);
  }

  return id;
};
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

type Kpi = { key: string; value: number | null };
type Section = { key: string; totalCount: number; rows: Record<string, unknown>[] };
type Dashboard = { ok: boolean; lens?: string; availableLenses?: string[]; kpis?: Kpi[]; actions?: Section[]; quality?: Kpi[]; pipeline?: { key: string; count: number }[]; capabilities?: { controlTower: boolean }; refusal?: string; error?: string };
type Tower = { ok: boolean; refusal?: string; kpis?: Kpi[]; sections?: Section[]; filtered?: boolean; breakdown?: { slaByStatus: { key: string; count: number }[]; documentsByState: { key: string; count: number }[] }; systemHealth?: { key: string; value: unknown }[]; members?: { id: string }[] };

const kpi = (list: Kpi[] | undefined, key: string) => list?.find((item) => item.key === key)?.value ?? null;
const section = (list: Section[] | undefined, key: string) => list?.find((item) => item.key === key);

describeIfLive('La Vivenzia dashboards, Control Tower and governance — live', () => {
  let admin = '';
  let hunter = '';
  let reviewer = '';
  let adminId = '';
  let hunterId = '';
  let reviewerId = '';
  let functionId = '';
  const fx = { leads: [] as string[], onboardings: [] as string[], documents: [] as string[], tasks: [] as string[], destroyedLeadIds: [] as string[] };
  const auditFor = async (recordId: string) =>
    (await gql<{ lvAuditEvents: { edges: { node: { action: string; outcome: string; actorId: string | null; targetLabel: string | null } }[] } }>(`query { lvAuditEvents(first: 20, filter: { targetRecordId: { eq: "${recordId}" } }) { edges { node { action outcome actorId targetLabel } } } }`, admin)).lvAuditEvents?.edges.map((edge) => edge.node) ?? [];
  const before = { hunterOverdue: 0, hunterBreaches: 0, towerUnowned: 0, towerBreached: 0, towerOverdue: 0, towerApprovals: 0, towerDuplicates: 0, docsPending: 0, docsRejected: 0 };

  const newLead = async (name: string, ownerId: string | null, priority = 'LOW'): Promise<string> => {
    const lead = await gql<{ createLvLead: { id: string } }>(`mutation { createLvLead(data: { name: "${name}", source: "WEBSITE", status: "NEW", priority: "${priority}" }) { id } }`, admin);

    fx.leads.push(lead.createLvLead.id);
    await waitFor(async () => (await gql<{ lvSlas: { edges: unknown[] } }>(`query { lvSlas(first: 1, filter: { leadId: { eq: "${lead.createLvLead.id}" } }) { edges { node { id } } } }`, admin)).lvSlas?.edges?.length > 0);
    await gql(`mutation { updateLvLead(id: "${lead.createLvLead.id}", data: { ownerId: ${ownerId ? `"${ownerId}"` : 'null'} }) { id } }`, admin);
    await waitFor(async () => (await gql<{ lvLead: { ownerId: string | null } }>(`query { lvLead(filter: { id: { eq: "${lead.createLvLead.id}" } }) { ownerId } }`, admin)).lvLead?.ownerId === ownerId);

    return lead.createLvLead.id;
  };

  beforeAll(async () => {
    admin = await signIn(USERS.admin);
    hunter = await signIn(USERS.hunter);
    reviewer = await signIn(USERS.reviewer);
    adminId = await memberIdOf(admin, USERS.admin.email);
    hunterId = await memberIdOf(admin, USERS.hunter.email);
    reviewerId = await memberIdOf(admin, USERS.reviewer.email);

    const list = (await post('metadata', { query: `query { findManyLogicFunctions { id name } }` }, admin)) as { data?: { findManyLogicFunctions?: { id: string; name: string }[] } };

    functionId = list.data?.findManyLogicFunctions?.find((fn) => fn.name === 'lv-sla-evaluator')?.id ?? '';

    // Baselines, so the assertions are deltas over whatever else exists.
    const h = (await route('/dashboard/summary', {}, hunter)) as Dashboard;
    const t = (await route('/control-tower/summary', {}, admin)) as Tower;

    before.hunterOverdue = Number(kpi(h.kpis, 'overdueTasks') ?? 0);
    before.hunterBreaches = Number(kpi(h.kpis, 'slaBreaches') ?? 0);
    before.towerUnowned = Number(kpi(t.kpis, 'unowned') ?? 0);
    before.towerBreached = Number(kpi(t.kpis, 'breached') ?? 0);
    before.towerOverdue = Number(kpi(t.kpis, 'overdue') ?? 0);
    before.towerApprovals = Number(kpi(t.kpis, 'approvals') ?? 0);
    before.towerDuplicates = section(t.sections, 'markedDuplicates')?.totalCount ?? 0;
    before.docsPending = t.breakdown?.documentsByState.find((row) => row.key === 'PENDING')?.count ?? 0;
    before.docsRejected = t.breakdown?.documentsByState.find((row) => row.key === 'REJECTED')?.count ?? 0;

    // ---- fixtures
    const owned1 = await newLead('[IT-D5] owned one', hunterId, 'HIGH');
    const owned2 = await newLead('[IT-D5] owned two', hunterId);
    const breachedLead = await newLead('[IT-D5] breached', hunterId);
    await newLead('[IT-D5] unowned', null);
    const dup = await newLead('[IT-D5] duplicate', hunterId);

    await gql(`mutation { updateLvLead(id: "${dup}", data: { status: "DUPLICATE" }) { id } }`, admin);

    // Overdue follow-up task assigned to the Hunter, on owned1.
    const task = await gql<{ createTask: { id: string } }>(`mutation { createTask(data: { title: "[IT-D5] overdue call", status: "TODO", dueAt: "${new Date(Date.now() - 3_600_000).toISOString()}", assigneeId: "${hunterId}", lvPriority: "HIGH" }) { id } }`, admin);

    fx.tasks.push(task.createTask.id);
    await gql(`mutation { createTaskTarget(data: { taskId: "${task.createTask.id}", targetLvLeadId: "${owned1}" }) { id } }`, admin);

    // SLA breach via time travel on the breached lead's contact SLA.
    const sla = await gql<{ lvSlas: { edges: { node: { id: string; startedAt: string } }[] } }>(`query { lvSlas(first: 1, filter: { leadId: { eq: "${breachedLead}" } }) { edges { node { id startedAt } } } }`, admin);
    const slaNode = sla.lvSlas.edges[0].node;

    await post('metadata', { query: `mutation($input: ExecuteOneLogicFunctionInput!) { executeOneLogicFunction(input: $input) { data status error } }`, variables: { input: { id: functionId, payload: { clock: new Date(Date.parse(slaNode.startedAt) + 26 * 3_600_000).toISOString(), slaIds: [slaNode.id] } } } }, admin);

    // Onboarding awaiting approval with 2 pending + 1 rejected documents.
    const onboarding = await gql<{ createLvOnboarding: { id: string } }>(`mutation { createLvOnboarding(data: { name: "[IT-D5] onboarding", status: "INTERNAL_REVIEW", reviewerId: "${reviewerId}", leadId: "${owned2}" }) { id } }`, admin);

    fx.onboardings.push(onboarding.createLvOnboarding.id);

    for (const [name, state] of [['[IT-D5] doc pending 1', 'PENDING'], ['[IT-D5] doc pending 2', 'PENDING'], ['[IT-D5] doc rejected', 'REJECTED']] as const) {
      const doc = await gql<{ createLvOnboardingDocument: { id: string } }>(`mutation { createLvOnboardingDocument(data: { name: "${name}", onboardingId: "${onboarding.createLvOnboarding.id}", documentType: "IDENTITY", verificationState: "${state}" }) { id } }`, admin);

      fx.documents.push(doc.createLvOnboardingDocument.id);
    }

    await sleep(3000);
  }, 180_000);

  afterAll(async () => {
    const destroyAll = async (collection: string, mutation: string, filter: string) => {
      const data = await gql<Record<string, { edges: { node: { id: string } }[] }>>(`query { ${collection}(first: 100, filter: ${filter}) { edges { node { id } } } }`, admin);

      for (const edge of data[collection]?.edges ?? []) {
        await gql(`mutation { ${mutation}(id: "${edge.node.id}") { id } }`, admin);
      }
    };

    for (const id of fx.documents) {
      await destroyAll('lvSlas', 'destroyLvSla', `{ documentId: { eq: "${id}" } }`);
      await gql(`mutation { destroyLvOnboardingDocument(id: "${id}") { id } }`, admin);
    }

    for (const id of fx.onboardings) {
      await destroyAll('lvSlas', 'destroyLvSla', `{ onboardingId: { eq: "${id}" } }`);
      await gql(`mutation { destroyLvOnboarding(id: "${id}") { id } }`, admin);
    }

    for (const id of fx.tasks) {
      await destroyAll('taskTargets', 'destroyTaskTarget', `{ taskId: { eq: "${id}" } }`);
      await gql(`mutation { destroyTask(id: "${id}") { id } }`, admin);
    }

    for (const id of fx.destroyedLeadIds) {
      await destroyAll('lvAuditEvents', 'destroyLvAuditEvent', `{ targetRecordId: { eq: "${id}" } }`);
      await destroyAll('lvSlas', 'destroyLvSla', `{ targetRecordId: { eq: "${id}" } }`);
      await destroyAll('lvNotifications', 'destroyLvNotification', `{ targetRecordId: { eq: "${id}" } }`);
    }

    for (const id of fx.leads) {
      const slas = await gql<{ lvSlas: { edges: { node: { id: string; escalationTaskId: string | null } }[] } }>(`query { lvSlas(first: 20, filter: { leadId: { eq: "${id}" } }) { edges { node { id escalationTaskId } } } }`, admin);

      for (const edge of slas.lvSlas?.edges ?? []) {
        if (edge.node.escalationTaskId) {
          await destroyAll('taskTargets', 'destroyTaskTarget', `{ taskId: { eq: "${edge.node.escalationTaskId}" } }`);
          await gql(`mutation { destroyTask(id: "${edge.node.escalationTaskId}") { id } }`, admin);
        }

        await gql(`mutation { destroyLvSla(id: "${edge.node.id}") { id } }`, admin);
      }

      await destroyAll('lvNotifications', 'destroyLvNotification', `{ leadId: { eq: "${id}" } }`);
      await destroyAll('lvAssignmentHistories', 'destroyLvAssignmentHistory', `{ leadId: { eq: "${id}" } }`);
      await destroyAll('lvAuditEvents', 'destroyLvAuditEvent', `{ targetRecordId: { eq: "${id}" } }`);
      await destroyAll('taskTargets', 'destroyTaskTarget', `{ targetLvLeadId: { eq: "${id}" } }`);
      await gql(`mutation { destroyLvLead(id: "${id}") { id } }`, admin);
    }

    // The destroys above are themselves audited (asynchronously, from the
    // *.destroyed events); give the worker a moment, then remove those rows
    // so a test run leaves no trace in the governance log.
    await new Promise((resolve) => setTimeout(resolve, 6000));
    for (const id of [...fx.leads, ...fx.destroyedLeadIds, ...fx.onboardings, ...fx.documents]) {
      await destroyAll('lvAuditEvents', 'destroyLvAuditEvent', `{ targetRecordId: { eq: "${id}" } }`);
    }
  }, 180_000);

  it('Hunter dashboard reports exactly the fixture deltas, scoped to the Hunter', async () => {
    const summary = (await route('/dashboard/summary', { timeZoneOffsetMinutes: 0 }, hunter)) as Dashboard;

    expect(summary.ok).toBe(true);
    expect(summary.lens).toBe('HUNTER');
    expect(summary.availableLenses).toEqual(['HUNTER']);
    expect(summary.capabilities?.controlTower).toBe(false);
    expect(kpi(summary.kpis, 'overdueTasks')).toBe(before.hunterOverdue + 1);
    expect(kpi(summary.kpis, 'slaBreaches')).toBe(before.hunterBreaches + 1);
    // Day 6: Opportunity Score v1 exists. The KPI is a real count once any
    // lead has been scored, and honestly unavailable (null) before that.
    const highOpportunity = kpi(summary.kpis, 'highOpportunity');

    expect(highOpportunity === null || (typeof highOpportunity === 'number' && highOpportunity >= 0)).toBe(true);
    expect((summary.pipeline ?? []).find((row) => row.key === 'ASSIGNED')?.count).toBeGreaterThanOrEqual(3);

    const overdue = section(summary.actions, 'overdueFollowUps');

    expect(overdue?.rows.some((row) => row.title === '[IT-D5] overdue call' && row.leadName === '[IT-D5] owned one')).toBe(true);
    expect(section(summary.actions, 'slaBreached')?.rows.some((row) => String(row.name).includes('[IT-D5] breached'))).toBe(true);
    expect(kpi(summary.quality, 'duplicates')).toBeGreaterThanOrEqual(1);
  });

  it('Hunter cannot request the ADMIN lens or the Control Tower', async () => {
    const forced = (await route('/dashboard/summary', { lens: 'ADMIN' }, hunter)) as Dashboard;

    expect(forced.lens).toBe('HUNTER');

    const tower = (await route('/control-tower/summary', { filters: {}, isAdmin: true }, hunter)) as Tower;

    expect(tower.ok).toBe(false);
    expect(tower.refusal).toBe('NOT_AUTHORIZED');
    expect(tower.kpis).toBeUndefined();
  });

  it('Onboarding Expert dashboard sees the review queue and documents, not the Hunter’s leads', async () => {
    const summary = (await route('/dashboard/summary', {}, reviewer)) as Dashboard;

    expect(summary.lens).toBe('ONBOARDING');
    expect(kpi(summary.kpis, 'review')).toBeGreaterThanOrEqual(1);
    expect(kpi(summary.quality, 'docPending')).toBeGreaterThanOrEqual(before.docsPending + 2);
    expect(kpi(summary.quality, 'docRejected')).toBeGreaterThanOrEqual(before.docsRejected + 1);
    expect(section(summary.actions, 'approvals')?.rows.some((row) => row.name === '[IT-D5] onboarding')).toBe(true);
    // Lead-scoped figures are empty for a reviewer who owns no leads.
    expect((summary.pipeline ?? []).every((row) => row.count === 0)).toBe(true);
  });

  it('Admin dashboard and Control Tower report the org-wide fixture deltas, and filters change them', async () => {
    const dashboard = (await route('/dashboard/summary', {}, admin)) as Dashboard;

    expect(dashboard.lens).toBe('ADMIN');
    expect(dashboard.capabilities?.controlTower).toBe(true);

    const tower = (await route('/control-tower/summary', { filters: {} }, admin)) as Tower;

    expect(tower.ok).toBe(true);
    expect(kpi(tower.kpis, 'unowned')).toBe(before.towerUnowned + 1);
    expect(kpi(tower.kpis, 'overdue')).toBe(before.towerOverdue + 1);
    expect(kpi(tower.kpis, 'breached')).toBe(before.towerBreached + 1);
    expect(kpi(tower.kpis, 'approvals')).toBe(before.towerApprovals + 1);
    expect(section(tower.sections, 'markedDuplicates')?.totalCount).toBe(before.towerDuplicates + 1);
    expect(section(tower.sections, 'unowned')?.rows.some((row) => row.name === '[IT-D5] unowned')).toBe(true);
    expect(section(tower.sections, 'breached')?.rows.some((row) => String(row.name).includes('[IT-D5] breached') && row.ownerName)).toBe(true);
    expect(section(tower.sections, 'approvals')?.rows.some((row) => row.name === '[IT-D5] onboarding')).toBe(true);
    expect(tower.breakdown?.documentsByState.find((row) => row.key === 'PENDING')?.count).toBe(before.docsPending + 2);
    expect(tower.breakdown?.documentsByState.find((row) => row.key === 'REJECTED')?.count).toBe(before.docsRejected + 1);
    expect(tower.systemHealth?.find((row) => row.key === 'slaEvaluator')?.value).toBeTruthy();

    // Server-side filters: owner = reviewer → the Hunter's overdue/unowned disappear.
    const filtered = (await route('/control-tower/summary', { filters: { ownerIds: [reviewerId] } }, admin)) as Tower;

    expect(filtered.filtered).toBe(true);
    expect(kpi(filtered.kpis, 'overdue')).toBe(0);
    expect(section(filtered.sections, 'unowned')?.totalCount).toBe(0);

    const unownedOnly = (await route('/control-tower/summary', { filters: { unownedOnly: true } }, admin)) as Tower;

    expect(section(unownedOnly.sections, 'unowned')?.rows.some((row) => row.name === '[IT-D5] unowned')).toBe(true);
    expect(kpi(unownedOnly.kpis, 'breached')).toBe(0);

    const bogus = (await route('/control-tower/summary', { filters: { statuses: ['HACKED'], ownerIds: ['x'] } }, admin)) as Tower;

    expect(bogus.ok).toBe(true);
    expect(bogus.filtered).toBe(false);
  });

  it('governance: a Hunter can archive and reopen their lead (audited) but cannot permanently delete', async () => {
    const leadId = fx.leads[1];
    const archived = (await route('/leads/lifecycle', { leadId, action: 'ARCHIVE' }, hunter)) as Json;

    expect(archived.ok).toBe(true);
    expect(archived.to).toBe('DORMANT');
    expect(archived.auditId).toBeTruthy();

    const closedNoReason = (await route('/leads/lifecycle', { leadId, action: 'CLOSE' }, hunter)) as Json;

    expect(closedNoReason.ok).toBe(false);
    expect(closedNoReason.refusal).toBe('POLICY');

    const reopened = (await route('/leads/lifecycle', { leadId, action: 'REOPEN' }, hunter)) as Json;

    expect(reopened.to).toBe('QUALIFYING');

    const audit = await gql<{ lvAuditEvents: { edges: { node: { action: string; outcome: string; actorId: string; reason: string | null } }[] } }>(`query { lvAuditEvents(first: 10, filter: { targetRecordId: { eq: "${leadId}" } }) { edges { node { action outcome actorId reason } } } }`, admin);

    expect(audit.lvAuditEvents.edges.map((edge) => edge.node.action).sort()).toEqual(['ARCHIVE', 'REOPEN']);
    expect(audit.lvAuditEvents.edges.every((edge) => edge.node.actorId === hunterId && edge.node.outcome === 'APPLIED')).toBe(true);

    // A Hunter cannot touch a lead that is not theirs (CM-004 hides it).
    const theirs = (await route('/leads/lifecycle', { leadId: fx.leads[3], action: 'ARCHIVE' }, reviewer)) as Json;

    expect(theirs.ok).toBe(false);

    // Permanent delete: a Hunter's role cannot soft-delete or destroy — the
    // platform refuses the native mutations, and the impact route says so.
    const impact = (await route('/records/delete-impact', { object: 'lvLead', recordId: leadId }, hunter)) as Json;

    expect(impact.ok).toBe(true);
    expect(impact.canDestroy).toBe(false);
    expect(impact.canSoftDelete).toBe(false);
    expect((impact.dependents as Record<string, number>).slas).toBeGreaterThanOrEqual(1);

    const softDelete = (await post('graphql', { query: `mutation { deleteLvLead(id: "${leadId}") { id } }` }, hunter)) as { data?: { deleteLvLead?: unknown } };

    expect(softDelete.data?.deleteLvLead ?? null).toBeNull();

    const destroy = (await post('graphql', { query: `mutation { destroyLvLead(id: "${leadId}") { id } }` }, hunter)) as { data?: { destroyLvLead?: unknown } };

    expect(destroy.data?.destroyLvLead ?? null).toBeNull();

    const stillThere = await gql<{ lvLead: { id: string } | null }>(`query { lvLead(filter: { id: { eq: "${leadId}" } }) { id } }`, admin);

    expect(stillThere.lvLead?.id).toBe(leadId);

    // An API key (no human) cannot even review a deletion.
    const key = (await route('/records/delete-impact', { object: 'lvLead', recordId: leadId }, API_KEY)) as Json;

    expect(key.refusal).toBe('NOT_AUTHENTICATED');
  });

  it('governance: the Main Admin sees the impact, then trash → restore → destroy are each audited with the admin as actor', async () => {
    const leadId = fx.leads[4]; // the duplicate
    const impact = (await route('/records/delete-impact', { object: 'lvLead', recordId: leadId }, admin)) as Json;

    expect(impact.ok).toBe(true);
    expect(impact.canDestroy).toBe(true);
    expect((impact.dependents as Record<string, number>).slas).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(impact.path)).toBe(true);

    // Twenty's own two-step path, as the Main Admin.
    await gql(`mutation { deleteLvLead(id: "${leadId}") { id } }`, admin);
    const trashed = await waitFor(async () => (await auditFor(leadId)).find((row) => row.action === 'TRASH'));

    expect(trashed?.actorId).toBe(adminId);
    expect(trashed?.targetLabel).toContain('[IT-D5] duplicate');

    await gql(`mutation { restoreLvLead(id: "${leadId}") { id } }`, admin);
    const restored = await waitFor(async () => (await auditFor(leadId)).find((row) => row.action === 'RESTORE'));

    expect(restored?.actorId).toBe(adminId);

    // Clean the dependents first so the destroy is a clean fixture teardown.
    await gql(`mutation { deleteLvLead(id: "${leadId}") { id } }`, admin);
    await gql(`mutation { destroyLvLead(id: "${leadId}") { id } }`, admin);
    const destroyed = await waitFor(async () => (await auditFor(leadId)).find((row) => row.action === 'PERMANENT_DELETE'));

    expect(destroyed?.actorId).toBe(adminId);
    expect(destroyed?.outcome).toBe('APPLIED');
    expect(destroyed?.targetLabel).toContain('[IT-D5] duplicate');

    const gone = await gql<{ lvLead: { id: string } | null }>(`query { lvLead(filter: { id: { eq: "${leadId}" } }) { id } }`, admin).catch(() => ({ lvLead: null }));

    expect(gone.lvLead ?? null).toBeNull();
    fx.leads.splice(4, 1);
    fx.destroyedLeadIds.push(leadId);
  });
});
