import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Live verification of Day 8 universal lead capture against a RUNNING
// server with this application installed: the extract / preflight / create
// routes and the CSV import routes, hit with real sessions so CM-004
// scoping, object permissions and session-derived identity are exercised
// exactly as a person hits them.
//
// Requirements (all skipped when absent): the same as
// lv-lead-360.integration-test.ts — an admin API key for fixtures/cleanup
// and credentials for a Main Admin, an Experience Hunter (tim@apple.dev)
// and an Onboarding Expert, locally from the gitignored
// .notes/lv-dev-users.env.
//
// Provider-dependent behaviour (vision OCR, AI classification) is asserted
// as UNAVAILABLE when no provider key is configured and as EXTRACTED /
// AI_SUGGESTED-or-REVIEW_REQUIRED when one is — never mocked.

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
};
const API_KEY = process.env.TWENTY_API_KEY ?? '';
const canRun = API_KEY.length > 0 && USERS.admin.email.length > 0 && USERS.reviewer.email.length > 0;
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

const key = () => crypto.randomUUID();
const STAMP = Date.now().toString(36);
// A second marker for import rows so their names do not resemble the other fixtures.
const IMP = `imp${STAMP.split('').reverse().join('')}`;
// And a third for the duplicate pair: the name matcher treats a shared long token as a similar name.
const DUP = `dup${STAMP.replace(/[aeiou0-9]/g, 'q')}`;

type CreateResult = { ok: boolean; refusal?: string; error?: string; leadId?: string; lvLeadId?: string | null; ownerId?: string | null; assignment?: { state: string; mode: string; reason: string | null }; task?: { id: string; title: string } | null; replayed?: boolean; steps?: Record<string, string> };

type PreflightResult = { ok: boolean; error?: string; draft?: { name: string; source: string; category: string | null }; quality?: { code: string }[]; duplicates?: { leadId: string; lvLeadId: string | null; percent: number }[]; classification?: { status: string } | null; ai?: { available: boolean }; recommendation?: { memberId: string | null; strategy: string; noMatchReason: string | null; candidates: { memberId: string }[] } | null };

describeIfLive('Day 8 · universal lead capture (live)', () => {
  let admin = '';
  let hunter = '';
  let reviewer = '';
  let adminId = '';
  let hunterId = '';
  const createdLeadIds: string[] = [];
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    [admin, hunter, reviewer] = await Promise.all([signIn(USERS.admin), signIn(USERS.hunter), signIn(USERS.reviewer)]);
    [adminId, hunterId] = await Promise.all([memberIdOf(admin, USERS.admin.email), memberIdOf(admin, USERS.hunter.email)]);
  }, 60_000);

  afterAll(async () => {
    // Fixtures only — every lead here carries the run stamp in its name.
    // Insights point at leads, so they go first.
    const insights = await gql<{ lvAiInsights: { edges: { node: { id: string; targetRecordId: string } }[] } }>(`query($ids: [UUID!]) { lvAiInsights(first: 200, filter: { targetRecordId: { in: $ids } }) { edges { node { id targetRecordId } } } }`, API_KEY, { ids: createdLeadIds }).catch(() => ({ lvAiInsights: { edges: [] } }));

    for (const edge of insights.lvAiInsights?.edges ?? []) {
      await gql(`mutation($id: UUID!) { destroyLvAiInsight(id: $id) { id } }`, API_KEY, { id: edge.node.id }).catch(() => null);
    }

    for (const id of createdTaskIds) {
      await gql(`mutation($id: UUID!) { destroyTask(id: $id) { id } }`, API_KEY, { id }).catch(() => null);
    }

    for (const id of createdLeadIds) {
      await gql(`mutation($id: UUID!) { destroyLvLead(id: $id) { id } }`, API_KEY, { id }).catch(() => null);
    }
  }, 60_000);

  const track = (result: CreateResult) => {
    if (result.leadId && !createdLeadIds.includes(result.leadId)) {
      createdLeadIds.push(result.leadId);
    }

    if (result.task?.id) {
      createdTaskIds.push(result.task.id);
    }
  };

  it('refuses every capture route without a session (API keys are not people)', async () => {
    const results = await Promise.all([route('/capture/preflight', { captureKey: key(), method: 'MANUAL', fields: { name: 'x' } }, API_KEY), route('/capture/extract', { captureKey: key(), method: 'WEBSITE_URL', url: 'https://example.com' }, API_KEY), route('/capture/create', { captureKey: key(), method: 'MANUAL', fields: { name: 'x' } }, API_KEY), route('/capture/import/validate', { importKey: key(), rows: [] }, API_KEY)]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(result.refusal).toBe('NOT_AUTHENTICATED');
    }
  });

  it('manual capture: preflight → create allocates a server LV ID, assigns, creates the next action, audits; replay is idempotent', async () => {
    const captureKey = key();
    const fields = { name: `Capture Manual ${STAMP}`, organisationName: `Manual Org ${STAMP}`, phone: '+91 98765 00001', location: 'Goa', category: 'STAY', subcategory: 'VILLA', notes: 'met at the counter' };

    const preflight = (await route('/capture/preflight', { captureKey, method: 'MANUAL', fields, stage: 'START', classify: false, recommend: true }, hunter)) as PreflightResult;

    expect(preflight.ok).toBe(true);
    expect(preflight.draft?.name).toBe(fields.name);
    // The source taxonomy has no "manual" entry: typed-in leads default to OTHER until the person picks one.
    expect(preflight.draft?.source).toBe('OTHER');
    expect(preflight.quality?.some((hint) => hint.code === 'MISSING_EMAIL')).toBe(true);
    expect(preflight.duplicates).toEqual([]);
    expect(preflight.recommendation).not.toBeNull();

    const created = (await route('/capture/create', { captureKey, method: 'MANUAL', fields: { ...fields, isHumanConfirmed: true }, assignment: { mode: 'ENGINE' }, duplicate: { decision: 'NONE' }, classification: { status: 'MANUAL' }, extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, fieldCount: 0 } }, hunter)) as CreateResult;

    track(created);
    expect(created.ok).toBe(true);
    expect(created.leadId).toBeTruthy();
    expect(created.lvLeadId).toMatch(/^LV-\d{6}$/);
    expect(['ASSIGNED', 'PENDING', 'UNASSIGNED']).toContain(created.assignment?.state);
    expect(created.task?.title).toMatch(/contact|Find contact/i);

    // Second press of the same button: same lead, nothing duplicated.
    const replay = (await route('/capture/create', { captureKey, method: 'MANUAL', fields: { ...fields, isHumanConfirmed: true }, assignment: { mode: 'ENGINE' }, duplicate: { decision: 'NONE' }, classification: { status: 'MANUAL' }, extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, fieldCount: 0 } }, hunter)) as CreateResult;

    expect(replay.ok).toBe(true);
    expect(replay.leadId).toBe(created.leadId);
    expect(replay.replayed).toBe(true);

    const leads = await gql<{ lvLeads: { edges: { node: { id: string; captureKey: string | null; captureProvenance: Record<string, unknown> | null; source: string } }[] } }>(`query($k: String!) { lvLeads(filter: { captureKey: { eq: $k } }) { edges { node { id captureKey captureProvenance source } } } }`, API_KEY, { k: captureKey });

    expect(leads.lvLeads.edges).toHaveLength(1);
    expect(leads.lvLeads.edges[0]!.node.captureProvenance).toMatchObject({ method: 'MANUAL', capturedById: hunterId });

    const audit = await gql<{ lvAuditEvents: { edges: { node: { action: string; outcome: string } }[] } }>(`query($id: String!) { lvAuditEvents(first: 50, filter: { targetRecordId: { eq: $id } }) { edges { node { action outcome } } } }`, API_KEY, { id: created.leadId! });
    const actions = audit.lvAuditEvents.edges.map((edge) => edge.node.action);

    expect(actions).toContain('LEAD_CREATED');
  }, 60_000);

  it('security: a Hunter cannot assign a captured lead to a colleague (owner spoof refused, audited), but may claim it', async () => {
    const captureKey = key();
    const fields = { name: `Capture Spoof ${STAMP}`, phone: '+91 98765 00002', location: 'Goa', isHumanConfirmed: true };
    const base = { captureKey, method: 'MANUAL', fields, duplicate: { decision: 'NONE' }, classification: { status: 'NOT_RUN' }, extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, fieldCount: 0 } };

    const spoof = (await route('/capture/create', { ...base, assignment: { mode: 'MEMBER', memberId: adminId } }, hunter)) as CreateResult;

    expect(spoof.ok).toBe(false);
    expect(spoof.refusal).toBe('POLICY');
    expect(spoof.leadId).toBeUndefined();

    // ownerId / actor fields in the body are ignored outright.
    const claim = (await route('/capture/create', { ...base, fields: { ...fields, ownerId: adminId, actorWorkspaceMemberId: adminId }, assignment: { mode: 'SELF' } }, hunter)) as CreateResult;

    track(claim);
    expect(claim.ok).toBe(true);
    expect(claim.ownerId).toBe(hunterId);
    expect(claim.assignment?.state).toBe('ASSIGNED');
  }, 60_000);

  it('security: a role without lead create permission is refused by the API (CM-004 / object permissions)', async () => {
    const result = (await route('/capture/create', { captureKey: key(), method: 'MANUAL', fields: { name: `Capture Forbidden ${STAMP}`, isHumanConfirmed: true }, assignment: { mode: 'SELF' }, duplicate: { decision: 'NONE' }, classification: { status: 'NOT_RUN' }, extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, fieldCount: 0 } }, reviewer)) as CreateResult;

    track(result);
    expect(result.ok).toBe(false);
    expect(result.leadId).toBeUndefined();
  }, 30_000);

  it('image capture: an unconfirmed OCR draft is never created silently', async () => {
    const result = (await route('/capture/create', { captureKey: key(), method: 'VISITING_CARD', fields: { name: `Capture Card ${STAMP}`, isHumanConfirmed: false }, assignment: { mode: 'SELF' }, duplicate: { decision: 'NONE' }, classification: { status: 'NOT_RUN' }, extraction: { status: 'EXTRACTED', kind: 'OCR', runId: null, fieldCount: 1 } }, hunter)) as CreateResult;

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('INVALID_INPUT');
    expect(result.leadId).toBeUndefined();
  });

  it('image extraction is honest about the provider: UNAVAILABLE without a key, EXTRACTED (with an audited run) with one', async () => {
    // A 1×1 PNG: the smallest valid image, enough to exercise the path.
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const extracted = (await route('/capture/extract', { captureKey: key(), method: 'VISITING_CARD', image: { mimeType: 'image/png', base64: png } }, hunter)) as { ok: boolean; status: string; kind: string | null; runId: string | null; reason: string | null; fields: unknown[] };

    expect(extracted.ok).toBe(true);
    expect(['EXTRACTED', 'UNAVAILABLE', 'FAILED']).toContain(extracted.status);

    if (extracted.status === 'UNAVAILABLE') {
      expect(extracted.reason).toBeTruthy();
      expect(extracted.fields).toEqual([]);
    } else {
      expect(extracted.runId).toBeTruthy();
    }
  }, 60_000);

  it('URL capture reads public page metadata, refuses private addresses and never scrapes social platforms', async () => {
    const page = (await route('/capture/extract', { captureKey: key(), method: 'WEBSITE_URL', url: 'https://example.com' }, hunter)) as { ok: boolean; status: string; kind: string | null; fields: { field: string; value: string | null }[]; reason: string | null };

    expect(page.ok).toBe(true);
    expect(['EXTRACTED', 'FAILED']).toContain(page.status);

    if (page.status === 'EXTRACTED') {
      expect(page.kind).toBe('PAGE_METADATA');
      expect(page.fields.some((field) => field.field === 'organisationName' && field.value)).toBe(true);
    }

    const local = (await route('/capture/extract', { captureKey: key(), method: 'WEBSITE_URL', url: 'http://127.0.0.1:3000/healthz' }, hunter)) as { ok: boolean; status?: string; refusal?: string };

    expect(local.ok === false || local.status === 'FAILED').toBe(true);

    const social = (await route('/capture/extract', { captureKey: key(), method: 'INSTAGRAM', handle: '@lavivenzia.goa' }, hunter)) as { ok: boolean; status: string; fields: { field: string; value: string | null }[]; reason: string | null };

    expect(social.ok).toBe(true);
    expect(social.status).toBe('UNAVAILABLE');
    expect(social.fields.find((field) => field.field === 'instagramHandle')?.value).toBe('lavivenzia.goa');
    expect(social.reason).toMatch(/do not scrape|not scraped|by hand/i);
  }, 60_000);

  it('duplicate check runs before creation and the decision is recorded', async () => {
    const first = (await route('/capture/create', { captureKey: key(), method: 'MANUAL', fields: { name: `Capture Dup ${DUP}`, organisationName: `Dup Org ${DUP}`, email: `dup-${DUP}@example.com`, phone: '+91 98765 00003', location: 'Goa', isHumanConfirmed: true }, assignment: { mode: 'SELF' }, duplicate: { decision: 'NONE' }, classification: { status: 'NOT_RUN' }, extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, fieldCount: 0 } }, admin)) as CreateResult;

    track(first);
    expect(first.ok).toBe(true);

    const captureKey = key();
    const fields = { name: `Capture Dup ${DUP}`, email: `dup-${DUP}@example.com`, location: 'Goa', isHumanConfirmed: true };
    const preflight = (await route('/capture/preflight', { captureKey, method: 'MANUAL', fields, stage: 'REVIEW', classify: false, recommend: false }, admin)) as PreflightResult;

    expect(preflight.ok).toBe(true);
    expect(preflight.duplicates?.some((candidate) => candidate.leadId === first.leadId)).toBe(true);

    // Creating without a decision is refused; with CREATE_NEW it goes ahead and the decision is on record.
    const undecided = (await route('/capture/create', { captureKey, method: 'MANUAL', fields, assignment: { mode: 'SELF' }, duplicate: { decision: 'NONE', candidateLeadIds: [first.leadId] }, classification: { status: 'NOT_RUN' }, extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, fieldCount: 0 } }, admin)) as CreateResult;

    expect(undecided.ok).toBe(false);
    expect(undecided.refusal).toBe('DUPLICATE_UNDECIDED');

    const decided = (await route('/capture/create', { captureKey, method: 'MANUAL', fields, assignment: { mode: 'SELF' }, duplicate: { decision: 'CREATE_NEW', candidateLeadIds: [first.leadId] }, classification: { status: 'NOT_RUN' }, extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, fieldCount: 0 } }, admin)) as CreateResult;

    track(decided);
    expect(decided.ok).toBe(true);
    expect(decided.leadId).not.toBe(first.leadId);

    const audit = await gql<{ lvAuditEvents: { edges: { node: { action: string } }[] } }>(`query($id: String!) { lvAuditEvents(first: 50, filter: { targetRecordId: { eq: $id } }) { edges { node { action } } } }`, API_KEY, { id: decided.leadId! });
    const actions = audit.lvAuditEvents.edges.map((edge) => edge.node.action);

    expect(actions).toContain('DUPLICATE_CREATED_NEW');

    const insights = await gql<{ lvAiInsights: { edges: { node: { insightType: string; humanDecision: string | null } }[] } }>(`query($id: String!) { lvAiInsights(filter: { targetRecordId: { eq: $id }, insightType: { eq: DUPLICATE } }) { edges { node { insightType humanDecision } } } }`, API_KEY, { id: decided.leadId! });

    expect(insights.lvAiInsights.edges[0]?.node.humanDecision).toBe('CREATED_NEW');
  }, 90_000);

  it('CSV import: validate reports valid / warning / error / duplicate rows; commit creates only accepted rows through the capture path', async () => {
    const importKey = key();
    const rows = [
      { rowNumber: 2, fields: { name: `Import One ${IMP}`, organisationName: `Import Org ${IMP}`, email: `import-one-${IMP}@example.com`, phone: '+91 98765 00004', location: 'Goa', category: 'Villa' } },
      { rowNumber: 3, fields: { name: `Import Two ${IMP}`, email: `import-one-${IMP}@example.com`, location: 'Goa' } },
      { rowNumber: 4, fields: { name: `Import Three ${IMP}`, email: 'not-an-email', location: 'Goa' } },
      { rowNumber: 5, fields: { name: `Import Four ${IMP}`, source: 'carrier pigeon', location: 'Goa' } },
      { rowNumber: 6, fields: { name: `Capture Dup ${DUP}`, email: `dup-${DUP}@example.com` } },
    ];

    const validation = (await route('/capture/import/validate', { importKey, rows }, admin)) as { ok: boolean; rows: { rowNumber: number; status: string; duplicateOfRow: number | null; duplicateOf: { leadId: string } | null }[]; summary: { total: number; valid: number; warnings: number; errors: number; duplicates: number } };

    expect(validation.ok).toBe(true);
    expect(validation.summary.total).toBe(5);
    expect(validation.rows.find((row) => row.rowNumber === 2)?.status).toBe('VALID');
    expect(validation.rows.find((row) => row.rowNumber === 3)?.duplicateOfRow).toBe(2);
    expect(validation.rows.find((row) => row.rowNumber === 4)?.status).toBe('ERROR');
    expect(validation.rows.find((row) => row.rowNumber === 5)?.status).toBe('WARNING');
    expect(validation.rows.find((row) => row.rowNumber === 6)?.status).toBe('DUPLICATE');
    expect(validation.rows.find((row) => row.rowNumber === 6)?.duplicateOf?.leadId).toBeTruthy();

    const commit = (await route('/capture/import/commit', { importKey, rows: rows.map((row) => ({ ...row, decision: row.rowNumber === 2 || row.rowNumber === 5 ? 'CREATE' : 'SKIP' })) }, admin)) as { ok: boolean; report: { rowNumber: number; status: string; leadId: string | null; lvLeadId: string | null }[]; summary: { created: number; skipped: number; errors: number } };

    expect(commit.ok).toBe(true);

    for (const line of commit.report) {
      if (line.leadId) {
        createdLeadIds.push(line.leadId);
      }
    }

    expect(commit.summary.created).toBe(2);
    expect(commit.summary.skipped).toBe(3);
    expect(commit.report.find((line) => line.rowNumber === 2)?.lvLeadId).toMatch(/^LV-\d{6}$/);

    // Same import key again: rows already imported come back as EXISTS, nothing is duplicated.
    const again = (await route('/capture/import/commit', { importKey, rows: rows.map((row) => ({ ...row, decision: row.rowNumber === 2 ? 'CREATE' : 'SKIP' })) }, admin)) as { ok: boolean; report: { rowNumber: number; status: string; leadId: string | null }[] };

    expect(again.report.find((line) => line.rowNumber === 2)?.status).toBe('EXISTS');
    expect(again.report.find((line) => line.rowNumber === 2)?.leadId).toBe(commit.report.find((line) => line.rowNumber === 2)?.leadId);

    const tasks = await gql<{ taskTargets: { edges: { node: { taskId: string } }[] } }>(`query($ids: [UUID!]) { taskTargets(first: 50, filter: { targetLvLeadId: { in: $ids } }) { edges { node { taskId } } } }`, API_KEY, { ids: createdLeadIds });

    createdTaskIds.push(...(tasks.taskTargets?.edges ?? []).map((edge) => edge.node.taskId));
  }, 120_000);

  it('the lead 360 timeline shows how the lead was captured', async () => {
    const leadId = createdLeadIds[0]!;
    const result = (await route('/leads/360', { leadId }, admin)) as { ok: boolean; capture?: { method: string; capturedBy: string | null } | null; timeline?: { kind: string; title: string; detail?: string | null }[] };

    expect(result.ok).toBe(true);
    expect(result.capture?.method).toBe('MANUAL');

    const created = result.timeline?.find((entry) => entry.kind === 'LEAD_CREATED');

    expect(created?.detail ?? created?.title).toMatch(/manual/i);
  }, 30_000);
});
