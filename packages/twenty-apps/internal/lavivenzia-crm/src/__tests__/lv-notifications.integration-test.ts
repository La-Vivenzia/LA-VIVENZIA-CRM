import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Live verification of the notification system against a RUNNING server with
// this application installed. Uses REAL sessions, not just the API key, so
// CM-004 scoping and session-derived identity are exercised as a person hits
// them. Nothing is asserted from a row insert alone: every check reads back
// through the recipient's own token or the server's own response.
//
// Requirements (all skipped when absent):
//   TWENTY_API_URL, TWENTY_API_KEY              — admin API key (fixtures)
//   LV_TEST_ADMIN_EMAIL / LV_TEST_ADMIN_PASSWORD — a Main Admin (unscoped)
//   LV_TEST_HUNTER_EMAIL / LV_TEST_HUNTER_PASSWORD — an Experience Hunter
//   LV_TEST_REVIEWER_EMAIL / LV_TEST_REVIEWER_PASSWORD — an Onboarding Expert
// For local development these can live in the gitignored .notes/lv-dev-users.env
// (USER_B_* = admin, USER_C_* = reviewer; tim@apple.dev is the hunter).

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.TWENTY_FRONT_ORIGIN ?? 'http://localhost:3001';

const loadDevUsers = (): Record<string, string> => {
  const candidates = [
    path.resolve(__dirname, '../../../../../../.notes/lv-dev-users.env'),
    path.resolve(process.cwd(), '.notes/lv-dev-users.env'),
  ];

  for (const file of candidates) {
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
  admin: {
    email: process.env.LV_TEST_ADMIN_EMAIL ?? dev.USER_B_EMAIL ?? '',
    password: process.env.LV_TEST_ADMIN_PASSWORD ?? dev.USER_B_PASSWORD ?? '',
  },
  hunter: {
    email: process.env.LV_TEST_HUNTER_EMAIL ?? 'tim@apple.dev',
    password: process.env.LV_TEST_HUNTER_PASSWORD ?? 'tim@apple.dev',
  },
  reviewer: {
    email: process.env.LV_TEST_REVIEWER_EMAIL ?? dev.USER_C_EMAIL ?? '',
    password: process.env.LV_TEST_REVIEWER_PASSWORD ?? dev.USER_C_PASSWORD ?? '',
  },
};

const API_KEY = process.env.TWENTY_API_KEY ?? '';
const canRun =
  API_KEY.length > 0 &&
  USERS.admin.email.length > 0 &&
  USERS.reviewer.email.length > 0;

const describeIfLive = canRun ? describe : describe.skip;

type Json = Record<string, unknown>;

const post = async (endpoint: string, body: Json, token?: string): Promise<Json> => {
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  return (await response.json()) as Json;
};

const gql = async <T>(query: string, token: string, variables: Json = {}): Promise<T> => {
  const body = (await post('graphql', { query, variables }, token)) as {
    data?: T;
    errors?: { message: string }[];
  };

  return (body.data ?? ({} as T)) as T;
};

const route = (routePath: string, body: Json, token: string) => post(`s${routePath}`, body, token);

const signIn = async ({ email, password }: { email: string; password: string }): Promise<string> => {
  const login = (await post('metadata', {
    query: `mutation { getLoginTokenFromCredentials(email: "${email}", password: "${password}", origin: "${ORIGIN}") { loginToken { token } } }`,
  })) as { data?: { getLoginTokenFromCredentials?: { loginToken?: { token: string } } } };
  const loginToken = login.data?.getLoginTokenFromCredentials?.loginToken?.token;

  if (!loginToken) {
    throw new Error(`Could not sign in ${email}`);
  }

  const tokens = (await post('metadata', {
    query: `mutation { getAuthTokensFromLoginToken(loginToken: "${loginToken}", origin: "${ORIGIN}") { tokens { accessOrWorkspaceAgnosticToken { token } } } }`,
  })) as {
    data: { getAuthTokensFromLoginToken: { tokens: { accessOrWorkspaceAgnosticToken: { token: string } } } };
  };

  return tokens.data.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
};

const memberIdOf = async (token: string, email: string): Promise<string> => {
  const data = await gql<{ workspaceMembers: { edges: { node: { id: string } }[] } }>(
    `query($email: String!) { workspaceMembers(first: 1, filter: { userEmail: { eq: $email } }) { edges { node { id } } } }`,
    token,
    { email },
  );
  const id = data.workspaceMembers?.edges?.[0]?.node?.id;

  if (!id) {
    throw new Error(`No workspace member for ${email}`);
  }

  return id;
};

type NotificationNode = {
  id: string;
  recipientId: string | null;
  notificationType: string | null;
  priority: string | null;
  isRead: boolean;
  readAt: string | null;
  deepLink: string | null;
  targetObject: string | null;
  targetRecordId: string | null;
  leadId: string | null;
  triggeredById: string | null;
  sourceEvent: string | null;
  emailStatus: string | null;
  dedupeKey: string | null;
};

const FIELDS =
  'id recipientId notificationType priority isRead readAt deepLink targetObject targetRecordId leadId triggeredById sourceEvent emailStatus dedupeKey';

const notifications = async (token: string, filter: Json): Promise<NotificationNode[]> => {
  const data = await gql<{ lvNotifications?: { edges: { node: NotificationNode }[] } }>(
    `query($f: LvNotificationFilterInput) { lvNotifications(first: 100, filter: $f, orderBy: [{ createdAt: DescNullsLast }]) { edges { node { ${FIELDS} } } } }`,
    token,
    { f: filter },
  );

  return data.lvNotifications?.edges.map((edge) => edge.node) ?? [];
};

const unreadCount = async (token: string, recipientId: string): Promise<number> => {
  const data = await gql<{ lvNotifications?: { totalCount: number } }>(
    `query($f: LvNotificationFilterInput) { lvNotifications(first: 1, filter: $f) { totalCount } }`,
    token,
    { f: { recipientId: { eq: recipientId }, isRead: { eq: false } } },
  );

  return data.lvNotifications?.totalCount ?? 0;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async <T>(probe: () => Promise<T | null | undefined>, ms = 20_000): Promise<T | null> => {
  const deadline = Date.now() + ms;

  while (Date.now() < deadline) {
    const value = await probe();

    if (value) {
      return value;
    }

    await sleep(1000);
  }

  return null;
};

const executeFunction = async (token: string, name: string, payload: Json): Promise<Json> => {
  const list = (await post('metadata', { query: `query { findManyLogicFunctions { id name } }` }, token)) as {
    data?: { findManyLogicFunctions?: { id: string; name: string }[] };
  };
  const id = list.data?.findManyLogicFunctions?.find((fn) => fn.name === name)?.id;

  if (!id) {
    throw new Error(`logic function ${name} not found`);
  }

  const result = (await post(
    'metadata',
    {
      query: `mutation($input: ExecuteOneLogicFunctionInput!) { executeOneLogicFunction(input: $input) { data status error } }`,
      variables: { input: { id, payload } },
    },
    token,
  )) as { data?: { executeOneLogicFunction?: { data?: Json } } };

  return result.data?.executeOneLogicFunction?.data ?? {};
};

describeIfLive('La Vivenzia notifications — live', () => {
  let admin = '';
  let hunter = '';
  let reviewer = '';
  let adminId = '';
  let hunterId = '';
  let reviewerId = '';
  const created = { leads: [] as string[], tasks: [] as string[] };

  beforeAll(async () => {
    admin = await signIn(USERS.admin);
    hunter = await signIn(USERS.hunter);
    reviewer = await signIn(USERS.reviewer);
    adminId = await memberIdOf(admin, USERS.admin.email);
    hunterId = await memberIdOf(admin, USERS.hunter.email);
    reviewerId = await memberIdOf(admin, USERS.reviewer.email);
  });

  afterAll(async () => {
    for (const leadId of created.leads) {
      // Day 4B: every lead now carries an SLA; remove it with the lead.
      const slas = await gql<{ lvSlas?: { edges: { node: { id: string } }[] } }>(
        `query { lvSlas(first: 20, filter: { leadId: { eq: "${leadId}" } }) { edges { node { id } } } }`,
        admin,
      );

      for (const edge of slas.lvSlas?.edges ?? []) {
        await gql(`mutation { destroyLvSla(id: "${edge.node.id}") { id } }`, admin);
      }

      const rows = await notifications(admin, { leadId: { eq: leadId } });

      for (const row of rows) {
        await gql(`mutation { destroyLvNotification(id: "${row.id}") { id } }`, admin);
      }

      const history = await gql<{ lvAssignmentHistories?: { edges: { node: { id: string } }[] } }>(
        `query { lvAssignmentHistories(first: 50, filter: { leadId: { eq: "${leadId}" } }) { edges { node { id } } } }`,
        admin,
      );

      for (const edge of history.lvAssignmentHistories?.edges ?? []) {
        await gql(`mutation { destroyLvAssignmentHistory(id: "${edge.node.id}") { id } }`, admin);
      }
    }

    for (const taskId of created.tasks) {
      const rows = await notifications(admin, { targetRecordId: { eq: taskId } });

      for (const row of rows) {
        await gql(`mutation { destroyLvNotification(id: "${row.id}") { id } }`, admin);
      }

      const targets = await gql<{ taskTargets?: { edges: { node: { id: string } }[] } }>(
        `query { taskTargets(first: 10, filter: { taskId: { eq: "${taskId}" } }) { edges { node { id } } } }`,
        admin,
      );

      for (const edge of targets.taskTargets?.edges ?? []) {
        await gql(`mutation { destroyTaskTarget(id: "${edge.node.id}") { id } }`, admin);
      }

      await gql(`mutation { destroyTask(id: "${taskId}") { id } }`, admin);
    }

    for (const leadId of created.leads) {
      await gql(`mutation { destroyLvLead(id: "${leadId}") { id } }`, admin);
    }

    // Day 5: destroys are audited from the platform's events (asynchronously);
    // remove those rows so a test run leaves no trace in the governance log.
    await new Promise((resolve) => setTimeout(resolve, 6000));
    for (const leadId of created.leads) {
      const audit = await gql<{ lvAuditEvents?: { edges: { node: { id: string } }[] } }>(`query { lvAuditEvents(first: 50, filter: { targetRecordId: { eq: "${leadId}" } }) { edges { node { id } } } }`, admin);

      for (const edge of audit.lvAuditEvents?.edges ?? []) {
        await gql(`mutation { destroyLvAuditEvent(id: "${edge.node.id}") { id } }`, admin);
      }
    }
  });

  it('notifies the new owner through the real lvLead.updated flow, with server-derived audit', async () => {
    const lead = await gql<{ createLvLead: { id: string } }>(
      `mutation { createLvLead(data: { name: "[IT-4A] assignment", source: "WEBSITE", status: "NEW", priority: "HIGH" }) { id } }`,
      admin,
    );

    created.leads.push(lead.createLvLead.id);
    await sleep(6000); // let the assignment engine finish

    await gql(
      `mutation { updateLvLead(id: "${lead.createLvLead.id}", data: { ownerId: "${hunterId}" }) { id } }`,
      admin,
    );

    const mine = await waitFor(async () =>
      (await notifications(hunter, { leadId: { eq: lead.createLvLead.id } })).find((row) =>
        ['LEAD_ASSIGNED', 'LEAD_REASSIGNED'].includes(row.notificationType ?? ''),
      ),
    );

    expect(mine).not.toBeNull();
    expect(mine?.recipientId).toBe(hunterId);
    expect(mine?.triggeredById).toBe(adminId);
    expect(mine?.sourceEvent).toBe('lvLead.updated');
    expect(mine?.deepLink).toBe(`/object/lvLead/${lead.createLvLead.id}`);

    // Email was warranted (HIGH) and its real outcome was recorded.
    const emailed = await waitFor(async () => {
      const [row] = await notifications(hunter, { id: { eq: mine?.id } });

      return row?.emailStatus !== 'QUEUED' ? row : null;
    });

    expect(['SENT', 'SKIPPED_NO_PROVIDER', 'FAILED']).toContain(emailed?.emailStatus);
  });

  it('reassignment notifies only the new owner, and CM-004 hides it from everyone else', async () => {
    const lead = await gql<{ createLvLead: { id: string } }>(
      `mutation { createLvLead(data: { name: "[IT-4A] reassignment", source: "WEBSITE", status: "NEW", priority: "LOW" }) { id } }`,
      admin,
    );

    created.leads.push(lead.createLvLead.id);
    await sleep(6000);
    await gql(`mutation { updateLvLead(id: "${lead.createLvLead.id}", data: { ownerId: "${hunterId}" }) { id } }`, admin);
    await waitFor(async () => (await notifications(hunter, { leadId: { eq: lead.createLvLead.id } }))[0]);

    const hunterBefore = (await notifications(hunter, { recipientId: { eq: hunterId } })).length;

    await gql(`mutation { updateLvLead(id: "${lead.createLvLead.id}", data: { ownerId: "${reviewerId}" }) { id } }`, admin);

    const theirs = await waitFor(async () =>
      (await notifications(reviewer, { leadId: { eq: lead.createLvLead.id } })).find(
        (row) => row.notificationType === 'LEAD_REASSIGNED',
      ),
    );

    expect(theirs?.recipientId).toBe(reviewerId);
    await sleep(2000);
    expect((await notifications(hunter, { recipientId: { eq: hunterId } })).length).toBe(hunterBefore);

    // Unauthorized recipient prevention: the hunter cannot see the reviewer's row.
    expect(await notifications(hunter, { id: { eq: theirs?.id } })).toEqual([]);
    expect(await notifications(hunter, { recipientId: { eq: reviewerId } })).toEqual([]);

    // Deep-link authorization: the hunter can no longer open the lead.
    const asHunter = await gql<{ lvLead: { id: string } | null }>(
      `query { lvLead(filter: { id: { eq: "${lead.createLvLead.id}" } }) { id } }`,
      hunter,
    );

    expect(asHunter.lvLead).toBeNull();
  });

  it('is idempotent: replaying the same event produces a duplicate, never a second row', async () => {
    const leadId = created.leads[1];
    const lead = await gql<{ lvLead: { updatedAt: string } }>(
      `query { lvLead(filter: { id: { eq: "${leadId}" } }) { updatedAt } }`,
      admin,
    );
    const before = (await notifications(admin, { leadId: { eq: leadId } })).length;

    const replay = await executeFunction(admin, 'lv-on-lead-updated', {
      name: 'lvLead.updated',
      workspaceId: 'replay',
      objectMetadata: {},
      recordId: leadId,
      workspaceMemberId: adminId,
      properties: {
        updatedFields: ['ownerId'],
        diff: {},
        before: { id: leadId, name: '[IT-4A] reassignment', ownerId: hunterId, priority: 'LOW' },
        after: {
          id: leadId,
          name: '[IT-4A] reassignment',
          ownerId: reviewerId,
          priority: 'LOW',
          updatedAt: lead.lvLead.updatedAt,
        },
      },
    });

    expect(replay.notified).toBe(0);
    expect(replay.duplicates).toBe(1);
    expect((await notifications(admin, { leadId: { eq: leadId } })).length).toBe(before);
  });

  it('never notifies the actor about their own action', async () => {
    const leadId = created.leads[1];
    const self = await executeFunction(admin, 'lv-on-lead-updated', {
      name: 'lvLead.updated',
      workspaceId: 'replay',
      objectMetadata: {},
      recordId: leadId,
      workspaceMemberId: reviewerId,
      properties: {
        updatedFields: ['ownerId'],
        diff: {},
        before: { id: leadId, ownerId: hunterId },
        after: { id: leadId, ownerId: reviewerId, priority: 'LOW', updatedAt: '2030-01-01T00:00:00.000Z' },
      },
    });

    expect(self.notified).toBe(0);
    expect((self.suppressed as { reason: string }[])[0]?.reason).toBe('ACTOR_IS_RECIPIENT');
  });

  it('follow-up sweep reminds once per task and due time, however often it runs', async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const due = await gql<{ createTask: { id: string } }>(
      `mutation { createTask(data: { title: "[IT-4A] due soon", status: "TODO", dueAt: "${soon}", assigneeId: "${hunterId}", lvPriority: "MEDIUM" }) { id } }`,
      admin,
    );
    const late = await gql<{ createTask: { id: string } }>(
      `mutation { createTask(data: { title: "[IT-4A] overdue", status: "TODO", dueAt: "${past}", assigneeId: "${hunterId}", lvPriority: "LOW" }) { id } }`,
      admin,
    );

    created.tasks.push(due.createTask.id, late.createTask.id);

    await executeFunction(admin, 'lv-follow-up-reminders', {});

    const dueRow = (await notifications(hunter, { targetRecordId: { eq: due.createTask.id } }))[0];
    const lateRow = (await notifications(hunter, { targetRecordId: { eq: late.createTask.id } }))[0];

    expect(dueRow?.notificationType).toBe('FOLLOW_UP_DUE');
    expect(lateRow?.notificationType).toBe('FOLLOW_UP_OVERDUE');
    expect(lateRow?.priority).toBe('HIGH');

    const again = await executeFunction(admin, 'lv-follow-up-reminders', {});

    expect(again.notified).toBe(0);
    expect((await notifications(hunter, { targetRecordId: { eq: due.createTask.id } })).length).toBe(1);
  });

  it('mark read is bound to the session identity; API keys and other recipients are refused', async () => {
    const unreadBefore = await unreadCount(hunter, hunterId);
    const mine = (await notifications(hunter, { recipientId: { eq: hunterId }, isRead: { eq: false } }))[0];
    const theirs = (await notifications(reviewer, { recipientId: { eq: reviewerId } }))[0];

    expect(mine).toBeDefined();
    expect(theirs).toBeDefined();

    const own = await route('/notifications/mark-read', { notificationId: mine.id }, hunter);

    expect(own.ok).toBe(true);
    expect((await notifications(hunter, { id: { eq: mine.id } }))[0]?.isRead).toBe(true);
    expect((await notifications(hunter, { id: { eq: mine.id } }))[0]?.readAt).toBeTruthy();
    expect(await unreadCount(hunter, hunterId)).toBe(unreadBefore - 1);

    const notMine = await route('/notifications/mark-read', { notificationId: theirs.id }, hunter);

    expect(notMine.ok).toBe(false);
    expect((await notifications(reviewer, { id: { eq: theirs.id } }))[0]?.isRead).toBe(theirs.isRead);

    const apiKey = await route('/notifications/mark-read', { notificationId: mine.id }, API_KEY);

    expect(apiKey.ok).toBe(false);
    expect(apiKey.refusal).toBe('NOT_AUTHENTICATED');

    const reviewerUnread = await unreadCount(reviewer, reviewerId);
    const all = await route('/notifications/mark-all-read', { recipientId: reviewerId }, hunter);

    expect(all.ok).toBe(true);
    expect(await unreadCount(hunter, hunterId)).toBe(0);
    expect(await unreadCount(reviewer, reviewerId)).toBe(reviewerUnread);
  });
});
