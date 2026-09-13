import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Live verification of Lead 360 and the Day 7 relationship routes against a
// RUNNING server with this application installed. Real sessions for a Main
// Admin, an Experience Hunter, a Lead Coordinator and an Onboarding Expert,
// so CM-004 scoping, object permissions and session-derived identity are
// exercised exactly as a person hits them. Every assertion reads back
// through a session or the server's own response — never a row insert.
//
// Requirements (all skipped when absent):
//   TWENTY_API_URL, TWENTY_API_KEY                — admin API key (fixtures)
//   LV_TEST_ADMIN_EMAIL / LV_TEST_ADMIN_PASSWORD   — a Main Admin
//   LV_TEST_HUNTER_EMAIL / LV_TEST_HUNTER_PASSWORD — an Experience Hunter
//   LV_TEST_REVIEWER_EMAIL / _PASSWORD             — an Onboarding Expert
//   LV_TEST_COORDINATOR_EMAIL / _PASSWORD          — a Lead Coordinator
// Locally these come from the gitignored .notes/lv-dev-users.env
// (USER_B = admin, USER_C = reviewer, USER_D = coordinator; tim@apple.dev is
// the hunter).

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.TWENTY_FRONT_ORIGIN ?? 'http://localhost:3001';

const loadDevUsers = (): Record<string, string> => {
  const candidates = [path.resolve(__dirname, '../../../../../../.notes/lv-dev-users.env'), path.resolve(process.cwd(), '.notes/lv-dev-users.env')];

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
  admin: { email: process.env.LV_TEST_ADMIN_EMAIL ?? dev.USER_B_EMAIL ?? '', password: process.env.LV_TEST_ADMIN_PASSWORD ?? dev.USER_B_PASSWORD ?? '' },
  hunter: { email: process.env.LV_TEST_HUNTER_EMAIL ?? 'tim@apple.dev', password: process.env.LV_TEST_HUNTER_PASSWORD ?? 'tim@apple.dev' },
  reviewer: { email: process.env.LV_TEST_REVIEWER_EMAIL ?? dev.USER_C_EMAIL ?? '', password: process.env.LV_TEST_REVIEWER_PASSWORD ?? dev.USER_C_PASSWORD ?? '' },
  coordinator: { email: process.env.LV_TEST_COORDINATOR_EMAIL ?? dev.USER_D_EMAIL ?? '', password: process.env.LV_TEST_COORDINATOR_PASSWORD ?? dev.USER_D_PASSWORD ?? '' },
};
const API_KEY = process.env.TWENTY_API_KEY ?? '';
const canRun = API_KEY.length > 0 && USERS.admin.email.length > 0 && USERS.reviewer.email.length > 0 && USERS.coordinator.email.length > 0;
const describeIfLive = canRun ? describe : describe.skip;

type Json = Record<string, unknown>;

const post = async (endpoint: string, body: Json, token?: string): Promise<Json> => {
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

  return (await response.json()) as Json;
};

const gql = async <T>(query: string, token: string, variables: Json = {}): Promise<T> => {
  const body = (await post('graphql', { query, variables }, token)) as { data?: T; errors?: { message: string }[] };

  return (body.data ?? ({} as T)) as T;
};

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async <T>(probe: () => Promise<T | null>, attempts = 20, delayMs = 500): Promise<T | null> => {
  for (let index = 0; index < attempts; index += 1) {
    const value = await probe();

    if (value !== null) {
      return value;
    }

    await sleep(delayMs);
  }

  return null;
};

type Lead360 = {
  ok: boolean;
  refusal?: string;
  lead?: { id: string; lvLeadId: string | null; ownerId: string | null; status: string | null; owner?: { displayName: string | null } | null };
  caller?: { lens: string; isAdmin: boolean; isOwner: boolean; workspaceMemberId: string };
  capabilities?: Record<string, boolean>;
  nextAction?: { task: { id: string; title: string | null } | null; suggestion: unknown };
  openTasks?: { id: string }[];
  timeline?: { kind: string; title: string }[];
  onboarding?: { id: string; documents: { id: string }[] } | null;
  members?: unknown[];
  settableStatuses?: string[];
  intelligence?: { opportunity: { available: boolean }; dataQuality: { issues: unknown[] } };
};

const TAG = '[D7]';

describeIfLive('Day 7 — Lead 360 and relationship operations (live)', () => {
  const tokens = { admin: '', hunter: '', reviewer: '', coordinator: '' };
  const members = { admin: '', hunter: '', reviewer: '', coordinator: '' };
  const fixtures = { leads: [] as string[], onboardings: [] as string[], documents: [] as string[] };
  let hunterLead = '';
  let coordinatorLead = '';
  let onboardingId = '';

  const createLead = async (name: string, ownerId: string | null): Promise<string> => {
    const data = await gql<{ createLvLead: { id: string } }>(
      `mutation($data: LvLeadCreateInput!) { createLvLead(data: $data) { id } }`,
      tokens.admin,
      { data: { name: `${TAG} ${name}`, organisationName: `${TAG} ${name} Org`, location: 'Lonavala', category: 'STAY', source: 'WEBSITE', captureMode: 'MANUAL', status: 'NEW', priority: 'HIGH', ownerId, emails: { primaryEmail: `${name.toLowerCase().replace(/\s+/g, '')}@d7.test` } } },
    );

    fixtures.leads.push(data.createLvLead.id);

    // The hook allocates the LV ID and records the assignment a moment later.
    await waitFor(async () => {
      const read = await gql<{ lvLead?: { lvLeadId: string | null } | null }>(`query($id: UUID!) { lvLead(filter: { id: { eq: $id } }) { lvLeadId } }`, tokens.admin, { id: data.createLvLead.id });

      return read.lvLead?.lvLeadId ? true : null;
    });

    return data.createLvLead.id;
  };

  beforeAll(async () => {
    tokens.admin = await signIn(USERS.admin);
    tokens.hunter = await signIn(USERS.hunter);
    tokens.reviewer = await signIn(USERS.reviewer);
    tokens.coordinator = await signIn(USERS.coordinator);
    members.admin = await memberIdOf(tokens.admin, USERS.admin.email);
    members.hunter = await memberIdOf(tokens.admin, USERS.hunter.email);
    members.reviewer = await memberIdOf(tokens.admin, USERS.reviewer.email);
    members.coordinator = await memberIdOf(tokens.admin, USERS.coordinator.email);

    hunterLead = await createLead('Hilltop Retreat', members.hunter);
    coordinatorLead = await createLead('River Camp', members.coordinator);

    const onboarding = await gql<{ createLvOnboarding: { id: string } }>(`mutation($data: LvOnboardingCreateInput!) { createLvOnboarding(data: $data) { id } }`, tokens.admin, { data: { name: `${TAG} Hilltop onboarding`, leadId: hunterLead, status: 'INTERNAL_REVIEW', reviewerId: members.reviewer, currentStep: 'DOCUMENTS' } });

    onboardingId = onboarding.createLvOnboarding.id;
    fixtures.onboardings.push(onboardingId);

    const document = await gql<{ createLvOnboardingDocument: { id: string } }>(`mutation($data: LvOnboardingDocumentCreateInput!) { createLvOnboardingDocument(data: $data) { id } }`, tokens.admin, { data: { name: `${TAG} ID proof`, onboardingId, documentType: 'IDENTITY', verificationState: 'PENDING' } });

    fixtures.documents.push(document.createLvOnboardingDocument.id);
  }, 120_000);

  afterAll(async () => {
    const admin = tokens.admin;
    const list = async (query: string, variables: Json): Promise<string[]> => {
      const data = await gql<Record<string, { edges?: { node: { id: string } }[] }>>(query, admin, variables);
      const key = Object.keys(data)[0];

      return key ? (data[key]?.edges ?? []).map((edge) => edge.node.id) : [];
    };

    for (const documentId of fixtures.documents) {
      for (const sla of await list(`query($f: LvSlaFilterInput) { lvSlas(filter: $f, first: 50) { edges { node { id } } } }`, { f: { documentId: { eq: documentId } } })) {
        await gql(`mutation($id: UUID!) { destroyLvSla(id: $id) { id } }`, admin, { id: sla });
      }

      await gql(`mutation($id: UUID!) { destroyLvOnboardingDocument(id: $id) { id } }`, admin, { id: documentId });
    }

    for (const id of fixtures.onboardings) {
      for (const sla of await list(`query($f: LvSlaFilterInput) { lvSlas(filter: $f, first: 50) { edges { node { id } } } }`, { f: { onboardingId: { eq: id } } })) {
        await gql(`mutation($id: UUID!) { destroyLvSla(id: $id) { id } }`, admin, { id: sla });
      }

      await gql(`mutation($id: UUID!) { destroyLvOnboarding(id: $id) { id } }`, admin, { id });
    }

    for (const leadId of fixtures.leads) {
      for (const id of await list(`query($f: LvInteractionFilterInput) { lvInteractions(filter: $f, first: 50) { edges { node { id } } } }`, { f: { leadId: { eq: leadId } } })) {
        await gql(`mutation($id: UUID!) { destroyLvInteraction(id: $id) { id } }`, admin, { id });
      }

      for (const id of await list(`query($f: LvSlaFilterInput) { lvSlas(filter: $f, first: 50) { edges { node { id } } } }`, { f: { leadId: { eq: leadId } } })) {
        await gql(`mutation($id: UUID!) { destroyLvSla(id: $id) { id } }`, admin, { id });
      }

      for (const id of await list(`query($f: LvNotificationFilterInput) { lvNotifications(filter: $f, first: 100) { edges { node { id } } } }`, { f: { leadId: { eq: leadId } } })) {
        await gql(`mutation($id: UUID!) { destroyLvNotification(id: $id) { id } }`, admin, { id });
      }

      for (const id of await list(`query($f: LvAssignmentHistoryFilterInput) { lvAssignmentHistories(filter: $f, first: 50) { edges { node { id } } } }`, { f: { leadId: { eq: leadId } } })) {
        await gql(`mutation($id: UUID!) { destroyLvAssignmentHistory(id: $id) { id } }`, admin, { id });
      }

      for (const id of await list(`query($f: LvAuditEventFilterInput) { lvAuditEvents(filter: $f, first: 100) { edges { node { id } } } }`, { f: { targetRecordId: { eq: leadId } } })) {
        await gql(`mutation($id: UUID!) { destroyLvAuditEvent(id: $id) { id } }`, admin, { id });
      }

      const targets = await gql<{ taskTargets: { edges: { node: { id: string; taskId: string | null } }[] } }>(`query($f: TaskTargetFilterInput) { taskTargets(filter: $f, first: 50) { edges { node { id taskId } } } }`, admin, { f: { targetLvLeadId: { eq: leadId } } });

      for (const edge of targets.taskTargets?.edges ?? []) {
        for (const id of await list(`query($f: LvAuditEventFilterInput) { lvAuditEvents(filter: $f, first: 20) { edges { node { id } } } }`, { f: { targetRecordId: { eq: edge.node.taskId } } })) {
          await gql(`mutation($id: UUID!) { destroyLvAuditEvent(id: $id) { id } }`, admin, { id });
        }

        await gql(`mutation($id: UUID!) { destroyTaskTarget(id: $id) { id } }`, admin, { id: edge.node.id });

        if (edge.node.taskId) {
          await gql(`mutation($id: UUID!) { destroyTask(id: $id) { id } }`, admin, { id: edge.node.taskId });
        }
      }

      const notes = await gql<{ noteTargets: { edges: { node: { id: string; noteId: string | null } }[] } }>(`query($f: NoteTargetFilterInput) { noteTargets(filter: $f, first: 50) { edges { node { id noteId } } } }`, admin, { f: { targetLvLeadId: { eq: leadId } } });

      for (const edge of notes.noteTargets?.edges ?? []) {
        await gql(`mutation($id: UUID!) { destroyNoteTarget(id: $id) { id } }`, admin, { id: edge.node.id });

        if (edge.node.noteId) {
          await gql(`mutation($id: UUID!) { destroyNote(id: $id) { id } }`, admin, { id: edge.node.noteId });
        }
      }

      for (const id of await list(`query($f: LvAiInsightFilterInput) { lvAiInsights(filter: $f, first: 50) { edges { node { id } } } }`, { f: { leadId: { eq: leadId } } })) {
        await gql(`mutation($id: UUID!) { destroyLvAiInsight(id: $id) { id } }`, admin, { id });
      }

      await gql(`mutation($id: UUID!) { destroyLvLead(id: $id) { id } }`, admin, { id: leadId });
    }
  }, 120_000);

  it('composes Lead 360 for the owner (hunter lens) with capabilities the platform grants', async () => {
    const model = (await route('/leads/360', { leadId: hunterLead }, tokens.hunter)) as Lead360;

    expect(model.ok).toBe(true);
    expect(model.lead?.lvLeadId).toMatch(/^LV-\d{6}$/);
    expect(model.caller).toMatchObject({ lens: 'HUNTER', isAdmin: false, isOwner: true, workspaceMemberId: members.hunter });
    expect(model.capabilities).toMatchObject({ canLogInteraction: true, canCreateTask: true, canAddNote: true, canChangeStatus: true, canChangeOwner: true, canClaim: false, canWorkOnboarding: false });
    expect(model.timeline?.some((entry) => entry.kind === 'LEAD_CREATED')).toBe(true);
    // Created with an owner: the engine records no assignment event (nothing changed), so the owner shows on the lead itself.
    expect(model.lead?.ownerId).toBe(members.hunter);
    expect(model.intelligence?.dataQuality.issues).toBeDefined();
    expect(model.settableStatuses).not.toContain('LOST');
  });

  it('CM-004: a hunter cannot compose another owner’s lead, and an API key has no actor', async () => {
    const foreign = (await route('/leads/360', { leadId: coordinatorLead }, tokens.hunter)) as Lead360;

    expect(foreign.ok).toBe(false);
    expect(foreign.refusal).toBe('NOT_FOUND');

    const apiKey = (await route('/leads/360', { leadId: hunterLead }, API_KEY)) as Lead360;

    expect(apiKey.ok).toBe(false);
    expect(apiKey.refusal).toBe('NOT_AUTHENTICATED');
  });

  it('logs an interaction with the SESSION actor — a spoofed actorId in the body is ignored — and audits it', async () => {
    const result = (await route('/interactions/log', { leadId: hunterLead, channel: 'PHONE', direction: 'INBOUND', outcome: 'INTERESTED', summary: 'Owner keen; wants pricing first.', durationMinutes: 12, nextAction: 'Send pricing sheet', nextFollowUpAt: new Date(Date.now() + 86_400_000).toISOString(), actorId: members.coordinator, workspaceMemberId: members.coordinator }, tokens.hunter)) as { ok: boolean; interactionId?: string; error?: string };

    expect(result.ok, result.error).toBe(true);

    const row = await gql<{ lvInteraction?: { actorId: string | null; channel: string; direction: string } | null }>(`query($id: UUID!) { lvInteraction(filter: { id: { eq: $id } }) { actorId channel direction } }`, tokens.admin, { id: result.interactionId });

    expect(row.lvInteraction).toMatchObject({ actorId: members.hunter, channel: 'PHONE', direction: 'INBOUND' });

    const audit = await waitFor(async () => {
      const data = await gql<{ lvAuditEvents: { edges: { node: { action: string; actorId: string | null; outcome: string } }[] } }>(`query($f: LvAuditEventFilterInput) { lvAuditEvents(filter: $f, first: 10) { edges { node { action actorId outcome } } } }`, tokens.admin, { f: { targetRecordId: { eq: hunterLead }, action: { eq: 'INTERACTION_LOGGED' } } });
      const node = data.lvAuditEvents?.edges?.[0]?.node;

      return node ?? null;
    });

    expect(audit).toMatchObject({ action: 'INTERACTION_LOGGED', actorId: members.hunter, outcome: 'APPLIED' });

    // The existing hook creates the follow-up task from nextFollowUpAt and
    // refreshes the lead summary — nothing in the route duplicates it.
    const followUp = await waitFor(async () => {
      const model = (await route('/leads/360', { leadId: hunterLead }, tokens.hunter)) as Lead360;

      return model.nextAction?.task ?? null;
    });

    expect(followUp?.title).toContain('Send pricing');
    const refreshed = (await route('/leads/360', { leadId: hunterLead }, tokens.hunter)) as Lead360;

    expect(refreshed.timeline?.some((entry) => entry.kind === 'INTERACTION')).toBe(true);
    expect(refreshed.lead?.status).toBe('NEW');
  });

  it('refuses an interaction dated in the future and an interaction on a lead the hunter cannot see', async () => {
    const future = await route('/interactions/log', { leadId: hunterLead, channel: 'PHONE', direction: 'OUTBOUND', summary: 'x', occurredAt: new Date(Date.now() + 3_600_000 * 5).toISOString() }, tokens.hunter);

    expect(future.ok).toBe(false);
    expect(future.refusal).toBe('INVALID_INPUT');

    const foreign = await route('/interactions/log', { leadId: coordinatorLead, channel: 'PHONE', direction: 'OUTBOUND', summary: 'x' }, tokens.hunter);

    expect(foreign.ok).toBe(false);
    expect(foreign.refusal).toBe('NOT_FOUND');
  });

  it('creates a quick-action task, completes it, reschedules another — each audited, each bound to the lead', async () => {
    const created = (await route('/tasks/create', { leadId: hunterLead, quickAction: 'CALL_TOMORROW', timezoneOffsetMinutes: -330 }, tokens.hunter)) as { ok: boolean; taskId?: string; title?: string; dueAt?: string; priority?: string; assigneeId?: string };

    expect(created.ok).toBe(true);
    expect(created).toMatchObject({ title: 'Call the lead', priority: 'HIGH', assigneeId: members.hunter });
    expect(created.dueAt?.slice(11, 16)).toBe('05:30');

    const model = (await route('/leads/360', { leadId: hunterLead }, tokens.hunter)) as Lead360;

    expect(model.openTasks?.some((task) => task.id === created.taskId)).toBe(true);

    const rescheduled = await route('/tasks/update', { leadId: hunterLead, taskId: created.taskId, action: 'RESCHEDULE', dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), title: 'Call the lead (moved)' }, tokens.hunter);

    expect(rescheduled.ok).toBe(true);

    const completed = await route('/tasks/update', { leadId: hunterLead, taskId: created.taskId, action: 'COMPLETE' }, tokens.hunter);

    expect(completed.ok).toBe(true);

    const task = await gql<{ task?: { status: string; title: string } | null }>(`query($id: UUID!) { task(filter: { id: { eq: $id } }) { status title } }`, tokens.admin, { id: created.taskId });

    expect(task.task).toMatchObject({ status: 'DONE', title: 'Call the lead (moved)' });

    // A task id guessed from another lead cannot be completed through this lead.
    const foreign = await route('/tasks/update', { leadId: coordinatorLead, taskId: created.taskId, action: 'COMPLETE' }, tokens.hunter);

    expect(foreign.ok).toBe(false);

    const audits = await gql<{ lvAuditEvents: { edges: { node: { action: string; actorId: string | null } }[] } }>(`query($f: LvAuditEventFilterInput) { lvAuditEvents(filter: $f, first: 20) { edges { node { action actorId } } } }`, tokens.admin, { f: { targetRecordId: { in: [hunterLead, created.taskId] } } });
    const actions = audits.lvAuditEvents.edges.map((edge) => edge.node.action);

    expect(actions).toContain('TASK_CREATED');
    expect(actions).toContain('TASK_RESCHEDULED');
    expect(actions).toContain('TASK_COMPLETED');
    expect(audits.lvAuditEvents.edges.every((edge) => edge.node.actorId === members.hunter)).toBe(true);
  });

  it('adds an internal note as a Twenty note attached to the lead, audited, visible in the timeline', async () => {
    const note = (await route('/notes/create', { leadId: hunterLead, body: 'Spoke with owner. Wants pricing discussion before onboarding.' }, tokens.hunter)) as { ok: boolean; noteId?: string };

    expect(note.ok).toBe(true);

    const model = (await route('/leads/360', { leadId: hunterLead }, tokens.hunter)) as Lead360;

    expect(model.timeline?.some((entry) => entry.kind === 'NOTE' && entry.title.includes('Spoke with owner'))).toBe(true);

    const audit = await gql<{ lvAuditEvents: { edges: { node: { action: string; actorId: string | null } }[] } }>(`query($f: LvAuditEventFilterInput) { lvAuditEvents(filter: $f, first: 5) { edges { node { action actorId } } } }`, tokens.admin, { f: { targetRecordId: { eq: hunterLead }, action: { eq: 'NOTE_CREATED' } } });

    expect(audit.lvAuditEvents.edges[0]?.node).toMatchObject({ action: 'NOTE_CREATED', actorId: members.hunter });
  });

  it('progresses the lifecycle only through the governed route: SET_STATUS forward, closing refused, audited', async () => {
    const forward = await route('/leads/lifecycle', { leadId: hunterLead, action: 'SET_STATUS', status: 'CONTACTED' }, tokens.hunter);

    expect(forward.ok).toBe(true);
    expect(forward.to).toBe('CONTACTED');

    const closing = await route('/leads/lifecycle', { leadId: hunterLead, action: 'SET_STATUS', status: 'LOST', reason: 'trying the back door' }, tokens.hunter);

    expect(closing.ok).toBe(false);
    expect(closing.refusal).toBe('POLICY');

    const mirrored = await route('/leads/lifecycle', { leadId: hunterLead, action: 'SET_STATUS', status: 'LIVE_ACTIVE' }, tokens.hunter);

    expect(mirrored.ok).toBe(false);

    const foreign = await route('/leads/lifecycle', { leadId: coordinatorLead, action: 'SET_STATUS', status: 'CONTACTED' }, tokens.hunter);

    expect(foreign.ok).toBe(false);
    expect(foreign.refusal).toBe('NOT_FOUND');

    const model = (await route('/leads/360', { leadId: hunterLead }, tokens.hunter)) as Lead360;

    expect(model.lead?.status).toBe('CONTACTED');
    expect(model.timeline?.some((entry) => entry.kind === 'STATUS' && entry.title.startsWith('Status → Contacted'))).toBe(true);
  });

  it('assignment policy: hunter hands over own lead (history + audit), cannot take it back; admin reassigns', async () => {
    const handover = (await route('/leads/assign', { leadId: hunterLead, newOwnerId: members.coordinator, reason: 'coordinator takes it from here' }, tokens.hunter)) as { ok: boolean; kind?: string; refusal?: string; error?: string };

    expect(handover.ok, handover.error).toBe(true);
    expect(handover.kind).toBe('HANDOVER');

    const history = await waitFor(async () => {
      const data = await gql<{ lvAssignmentHistories: { edges: { node: { strategy: string; toOwnerId: string | null; fromOwnerId: string | null } }[] } }>(`query($f: LvAssignmentHistoryFilterInput) { lvAssignmentHistories(filter: $f, first: 10, orderBy: [{ assignedAt: DescNullsLast }]) { edges { node { strategy toOwnerId fromOwnerId } } } }`, tokens.admin, { f: { leadId: { eq: hunterLead }, strategy: { eq: 'MANUAL' } } });

      return data.lvAssignmentHistories?.edges?.[0]?.node ?? null;
    });

    expect(history).toMatchObject({ strategy: 'MANUAL', fromOwnerId: members.hunter, toOwnerId: members.coordinator });

    // The hunter no longer owns the lead; CM-004 now hides it entirely.
    const takeBack = await route('/leads/assign', { leadId: hunterLead, newOwnerId: members.hunter }, tokens.hunter);

    expect(takeBack.ok).toBe(false);

    // The coordinator (new owner) sees it with the coordinator lens and the follow-up produced earlier.
    const coordinatorView = (await route('/leads/360', { leadId: hunterLead }, tokens.coordinator)) as Lead360;

    expect(coordinatorView.ok).toBe(true);
    expect(coordinatorView.caller?.lens).toBe('COORDINATOR');
    expect(coordinatorView.caller?.isOwner).toBe(true);

    const back = (await route('/leads/assign', { leadId: hunterLead, newOwnerId: members.hunter, reason: 'admin returns it' }, tokens.admin)) as { ok: boolean; kind?: string };

    expect(back.ok).toBe(true);
    expect(back.kind).toBe('REASSIGN');

    const audits = await gql<{ lvAuditEvents: { edges: { node: { action: string; outcome: string; actorId: string | null } }[] } }>(`query($f: LvAuditEventFilterInput) { lvAuditEvents(filter: $f, first: 10) { edges { node { action outcome actorId } } } }`, tokens.admin, { f: { targetRecordId: { eq: hunterLead }, action: { eq: 'OWNER_CHANGE' } } });
    const applied = audits.lvAuditEvents.edges.filter((edge) => edge.node.outcome === 'APPLIED').map((edge) => edge.node.actorId);

    expect(applied).toContain(members.hunter);
    expect(applied).toContain(members.admin);
  });

  it('an onboarding expert sees the onboarding and its documents through Lead 360 only where CM-004 allows', async () => {
    // The reviewer is not the lead's owner: the lead itself is out of scope,
    // so Lead 360 is refused for them — the onboarding record page is their
    // entry point, reached from notifications and the Onboarding list.
    const reviewerView = (await route('/leads/360', { leadId: hunterLead }, tokens.reviewer)) as Lead360;

    expect(reviewerView.ok).toBe(false);
    expect(reviewerView.refusal).toBe('NOT_FOUND');

    // But the reviewer can read the onboarding and its document directly.
    const onboarding = await gql<{ lvOnboarding?: { id: string; documents: { edges: { node: { id: string } }[] } } | null }>(`query($id: UUID!) { lvOnboarding(filter: { id: { eq: $id } }) { id documents { edges { node { id } } } } }`, tokens.reviewer, { id: onboardingId });

    expect(onboarding.lvOnboarding?.id).toBe(onboardingId);
    expect(onboarding.lvOnboarding?.documents.edges.map((edge) => edge.node.id)).toEqual(fixtures.documents);

    // The admin sees onboarding, documents and review capability on the lead.
    const adminView = (await route('/leads/360', { leadId: hunterLead }, tokens.admin)) as Lead360;

    expect(adminView.ok).toBe(true);
    expect(adminView.caller?.lens).toBe('ADMIN');
    expect(adminView.onboarding?.id).toBe(onboardingId);
    expect(adminView.onboarding?.documents.map((document) => document.id)).toEqual(fixtures.documents);
    expect(adminView.capabilities).toMatchObject({ canChangeOwner: true, canReviewDocuments: true, canWorkOnboarding: true });
    expect((adminView.members ?? []).length).toBeGreaterThan(0);

    // The reviewer cannot log an interaction or create a task on a lead they cannot see.
    const interaction = await route('/interactions/log', { leadId: hunterLead, channel: 'EMAIL', direction: 'OUTBOUND', summary: 'x' }, tokens.reviewer);

    expect(interaction.ok).toBe(false);
    const task = await route('/tasks/create', { leadId: hunterLead, title: 'x' }, tokens.reviewer);

    expect(task.ok).toBe(false);
  });
});
