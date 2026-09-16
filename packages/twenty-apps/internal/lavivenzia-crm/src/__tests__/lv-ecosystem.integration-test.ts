import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Day 9 — the Founder V1 ecosystem chain, live against a RUNNING server:
//
//   lead → onboarding → verified document → human APPROVAL
//        → partner (LVP-…) + property (LVR-…) created by the event handler
//        → lead status mirrored → Partner 360 / Property 360 compose
//        → lifecycle transitions with permission, self-approval, readiness
//          and actor guards → activation → lead LIVE_ACTIVE, onboarding ACTIVATED
//
// Real sessions (Main Admin, Experience Hunter, Onboarding Expert, Lead
// Coordinator) so CM-004 scoping, object permissions and session-derived
// identity are exercised exactly as a person hits them. Fixtures are stamped
// and destroyed afterwards; LV-000003/4/5 are never touched.

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
  const response = await fetch(`${API_URL}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

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
const waitFor = async <T>(probe: () => Promise<T | null>, attempts = 30, delayMs = 1000): Promise<T | null> => {
  for (let index = 0; index < attempts; index += 1) {
    const value = await probe();

    if (value !== null) {
      return value;
    }

    await sleep(delayMs);
  }

  return null;
};


// A real file through the platform's direct-upload flow (createFileUpload →
// PUT → completeFileUpload), because a FILES field refuses a fileId that does
// not exist — exactly the guarantee the readiness check relies on.
const uploadImage = async (token: string, objectNameSingular: string, fieldName: string): Promise<{ fileId: string; label: string }> => {
  const meta = (await post('metadata', { query: 'query { objects(paging: { first: 200 }) { edges { node { nameSingular fields(paging: { first: 200 }) { edges { node { id name } } } } } } }' }, token)) as { data?: { objects?: { edges?: { node?: { nameSingular?: string; fields?: { edges?: { node?: { id?: string; name?: string } }[] } } }[] } } };
  const object = meta.data?.objects?.edges?.find((edge) => edge.node?.nameSingular === objectNameSingular)?.node;
  const fieldMetadataId = object?.fields?.edges?.find((edge) => edge.node?.name === fieldName)?.node?.id;

  if (!fieldMetadataId) {
    throw new Error(`No FILES field ${objectNameSingular}.${fieldName}`);
  }

  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const created = (await post('metadata', { query: 'mutation($filename: String!, $size: Float!, $fileFolder: FileFolder!, $fieldMetadataId: String) { createFileUpload(filename: $filename, size: $size, fileFolder: $fileFolder, fieldMetadataId: $fieldMetadataId) { fileId uploadUrl contentType } }', variables: { filename: 'd9t.png', size: bytes.byteLength, fileFolder: 'FilesField', fieldMetadataId } }, token)) as { data?: { createFileUpload?: { fileId: string; uploadUrl: string; contentType: string } }; errors?: { message: string }[] };
  const target = created.data?.createFileUpload;

  if (!target) {
    throw new Error(`createFileUpload failed: ${created.errors?.[0]?.message ?? 'unknown'}`);
  }

  const put = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': target.contentType }, body: bytes });

  if (!put.ok) {
    throw new Error(`upload PUT failed: ${put.status}`);
  }

  const completed = (await post('metadata', { query: 'mutation($fileId: String!) { completeFileUpload(fileId: $fileId) { id } }', variables: { fileId: target.fileId } }, token)) as { data?: { completeFileUpload?: { id: string } } };

  return { fileId: completed.data?.completeFileUpload?.id ?? target.fileId, label: 'd9t.png' };
};

const STAMP = Date.now().toString(36);
const TIM_ID = '20202020-0687-4c41-b707-ed1bfca972a7';

type PartnerRow = { id: string; partnerCode: string | null; status: string | null; leadId: string | null; onboardingId: string | null; ownerId: string | null; contactId: string | null; organisationId: string | null; sourceKey: string | null };

describeIfLive('Day 9 · ecosystem chain (live)', () => {
  let admin = '';
  let hunter = '';
  let reviewer = '';
  let coordinator = '';
  let reviewerId = '';
  let adminId = '';
  const fx = { leads: [] as string[], onboardings: [] as string[], documents: [] as string[], partners: [] as string[], experiences: [] as string[], properties: [] as string[], people: [] as string[], companies: [] as string[] };
  let leadId = '';
  let onboardingId = '';
  let partner: PartnerRow | null = null;
  let propertyId = '';

  beforeAll(async () => {
    [admin, hunter, reviewer, coordinator] = await Promise.all([signIn(USERS.admin), signIn(USERS.hunter), signIn(USERS.reviewer), signIn(USERS.coordinator)]);
    [reviewerId, adminId] = await Promise.all([memberIdOf(admin, USERS.reviewer.email), memberIdOf(admin, USERS.admin.email)]);

    const lead = await gql<{ createLvLead: { id: string } }>(`mutation($data: LvLeadCreateInput!) { createLvLead(data: $data) { id } }`, API_KEY, { data: { name: `[D9T] Villa ${STAMP}`, organisationName: `D9T Org ${STAMP}`, source: 'WEBSITE', status: 'INTERESTED', priority: 'HIGH', location: 'Goa', category: 'STAY', subcategory: 'VILLA', captureMode: 'MANUAL', ownerId: TIM_ID, emails: { primaryEmail: `d9t-${STAMP}@example.com` }, phones: { primaryPhoneNumber: '+91 90000 00077' } } });

    leadId = lead.createLvLead.id;
    fx.leads.push(leadId);
    await sleep(3000);

    const answers = {
      BASIC_INFORMATION: { legalName: 'Meera Test', displayName: `D9T Villa ${STAMP}`, email: `d9t-${STAMP}@example.com`, phone: '+91 90000 00077', organisationName: `D9T Org ${STAMP}`, languages: ['English'] },
      ABOUT_YOU: { bio: 'B'.repeat(90) },
      EXPERIENCE: { title: `D9T Villa ${STAMP}`, description: 'D'.repeat(130), category: 'Villa', capacity: 6 },
      LOCATION: { addressLine: '1 Test Lane', city: 'Anjuna', state: 'Goa', country: 'India' },
      PRICING: { basePrice: 9000, priceUnit: 'Per night' },
      AVAILABILITY: { availableDays: ['Sat'], noticePeriodHours: 24 },
      IMAGES: { images: [] },
      DOCUMENTS: {},
      POLICIES: { cancellationPolicy: 'Free cancellation up to 7 days before check-in.', agreesToTerms: true },
    };
    const onboarding = await gql<{ createLvOnboarding: { id: string } }>(`mutation($data: LvOnboardingCreateInput!) { createLvOnboarding(data: $data) { id } }`, API_KEY, { data: { name: `[D9T] onboarding ${STAMP}`, status: 'INTERNAL_REVIEW', reviewerId, leadId, currentStep: 'FINAL_REVIEW', answers } });

    onboardingId = onboarding.createLvOnboarding.id;
    fx.onboardings.push(onboardingId);

    const document = await gql<{ createLvOnboardingDocument: { id: string } }>(`mutation($data: LvOnboardingDocumentCreateInput!) { createLvOnboardingDocument(data: $data) { id } }`, API_KEY, { data: { name: '[D9T] ID proof', onboardingId, documentType: 'IDENTITY', verificationState: 'VERIFIED', verifiedAt: new Date().toISOString() } });

    fx.documents.push(document.createLvOnboardingDocument.id);
    await sleep(1500);
  }, 90_000);

  afterAll(async () => {
    const destroy = async (mutation: string, ids: string[]) => {
      for (const id of ids) {
        await gql(`mutation($id: UUID!) { ${mutation}(id: $id) { id } }`, API_KEY, { id }).catch(() => null);
      }
    };

    const insights = await gql<{ lvAiInsights: { edges: { node: { id: string } }[] } }>(`query($ids: [UUID!]) { lvAiInsights(first: 100, filter: { targetRecordId: { in: $ids } }) { edges { node { id } } } }`, API_KEY, { ids: fx.leads }).catch(() => ({ lvAiInsights: { edges: [] } }));

    await destroy('destroyLvAiInsight', (insights.lvAiInsights?.edges ?? []).map((edge) => edge.node.id));
    await destroy('destroyLvProperty', fx.properties);
    await destroy('destroyLvExperience', fx.experiences);
    await destroy('destroyLvPartner', fx.partners);
    await destroy('destroyLvOnboardingDocument', fx.documents);

    for (const id of fx.onboardings) {
      const slas = await gql<{ lvSlas: { edges: { node: { id: string } }[] } }>(`query($id: UUID!) { lvSlas(filter: { onboardingId: { eq: $id } }) { edges { node { id } } } }`, API_KEY, { id }).catch(() => ({ lvSlas: { edges: [] } }));

      await destroy('destroyLvSla', (slas.lvSlas?.edges ?? []).map((edge) => edge.node.id));
    }

    await destroy('destroyLvOnboarding', fx.onboardings);

    for (const id of fx.leads) {
      const slas = await gql<{ lvSlas: { edges: { node: { id: string } }[] } }>(`query($id: UUID!) { lvSlas(filter: { leadId: { eq: $id } }) { edges { node { id } } } }`, API_KEY, { id }).catch(() => ({ lvSlas: { edges: [] } }));

      await destroy('destroyLvSla', (slas.lvSlas?.edges ?? []).map((edge) => edge.node.id));
      const tasks = await gql<{ taskTargets: { edges: { node: { taskId: string } }[] } }>(`query($id: UUID!) { taskTargets(filter: { targetLvLeadId: { eq: $id } }) { edges { node { taskId } } } }`, API_KEY, { id }).catch(() => ({ taskTargets: { edges: [] } }));

      await destroy('destroyTask', (tasks.taskTargets?.edges ?? []).map((edge) => edge.node.taskId));
    }

    await destroy('destroyLvLead', fx.leads);
    await destroy('destroyPerson', fx.people);
    await destroy('destroyCompany', fx.companies);
  }, 120_000);

  it('the ecosystem routes refuse API keys (no session member)', async () => {
    const results = await Promise.all([route('/partners/360', { partnerId: crypto.randomUUID() }, API_KEY), route('/ecosystem/transition', { kind: 'partner', id: crypto.randomUUID(), to: 'ACTIVE' }, API_KEY), route('/ecosystem/create', { kind: 'partner', fields: { name: 'x' } }, API_KEY), route('/ecosystem/readiness', { kind: 'partner', id: crypto.randomUUID() }, API_KEY)]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(result.refusal).toBe('NOT_AUTHENTICATED');
    }
  });

  it('the reviewer approves the onboarding → the event handler creates the partner (LVP-…) and the property (LVR-…), links lead / person / organisation, mirrors the lead status and audits', async () => {
    const approve = (await route('/onboarding/transition', { onboardingId, to: 'APPROVED', note: 'Verified' }, reviewer)) as { ok: boolean; status?: string };

    expect(approve).toMatchObject({ ok: true, status: 'APPROVED' });

    partner = await waitFor(async () => {
      const data = await gql<{ lvPartners: { edges: { node: PartnerRow }[] } }>(`query($id: UUID!) { lvPartners(filter: { onboardingId: { eq: $id } }) { edges { node { id partnerCode status leadId onboardingId ownerId contactId organisationId sourceKey } } } }`, API_KEY, { id: onboardingId });
      const row = data.lvPartners?.edges?.[0]?.node;

      return row && row.partnerCode ? row : null;
    });

    expect(partner).not.toBeNull();
    fx.partners.push(partner!.id);
    expect(partner!.partnerCode).toMatch(/^LVP-\d{6}$/);
    expect(partner).toMatchObject({ status: 'APPROVED', leadId, onboardingId, ownerId: TIM_ID, sourceKey: `onboarding:${onboardingId}` });
    expect(partner!.contactId).toBeTruthy();
    expect(partner!.organisationId).toBeTruthy();
    fx.people.push(partner!.contactId!);
    fx.companies.push(partner!.organisationId!);

    const property = await waitFor(async () => {
      const data = await gql<{ lvProperties: { edges: { node: { id: string; propertyCode: string | null; status: string; propertyType: string; partnerId: string; capacity: number | null } }[] } }>(`query($id: UUID!) { lvProperties(filter: { onboardingId: { eq: $id } }) { edges { node { id propertyCode status propertyType partnerId capacity } } } }`, API_KEY, { id: onboardingId });
      const row = data.lvProperties?.edges?.[0]?.node;

      return row && row.propertyCode ? row : null;
    });

    expect(property).not.toBeNull();
    propertyId = property!.id;
    fx.properties.push(propertyId);
    expect(property!.propertyCode).toMatch(/^LVR-\d{6}$/);
    expect(property).toMatchObject({ status: 'DRAFT', propertyType: 'VILLA', partnerId: partner!.id, capacity: 6 });

    const experiences = await gql<{ lvExperiences: { totalCount: number } }>(`query($id: UUID!) { lvExperiences(filter: { onboardingId: { eq: $id } }) { totalCount } }`, API_KEY, { id: onboardingId });

    expect(experiences.lvExperiences.totalCount).toBe(0);

    const lead = await gql<{ lvLead: { status: string; onboardingStatus: string } }>(`query($id: UUID!) { lvLead(filter: { id: { eq: $id } }) { status onboardingStatus } }`, API_KEY, { id: leadId });

    expect(lead.lvLead).toEqual({ status: 'APPROVED', onboardingStatus: 'APPROVED' });

    const audit = await gql<{ lvAuditEvents: { edges: { node: { action: string; targetObject: string; actorId: string | null } }[] } }>(`query($ids: [String!]) { lvAuditEvents(filter: { targetRecordId: { in: $ids } }) { edges { node { action targetObject actorId } } } }`, API_KEY, { ids: [partner!.id, propertyId] });
    const actions = audit.lvAuditEvents.edges.map((edge) => edge.node);

    expect(actions).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'PARTNER_CREATED', targetObject: 'lvPartner', actorId: reviewerId }), expect.objectContaining({ action: 'PROPERTY_CREATED', targetObject: 'lvProperty' })]));
  }, 90_000);

  it('a replayed approval (any further update of the approved onboarding) creates no second partner or property', async () => {
    await gql(`mutation($id: UUID!) { updateLvOnboarding(id: $id, data: { internalNotes: "replay probe" }) { id } }`, API_KEY, { id: onboardingId });
    await sleep(6000);
    const partners = await gql<{ lvPartners: { totalCount: number } }>(`query($id: UUID!) { lvPartners(filter: { leadId: { eq: $id } }) { totalCount } }`, API_KEY, { id: leadId });
    const properties = await gql<{ lvProperties: { totalCount: number } }>(`query($id: UUID!) { lvProperties(filter: { onboardingId: { eq: $id } }) { totalCount } }`, API_KEY, { id: onboardingId });

    expect(partners.lvPartners.totalCount).toBe(1);
    expect(properties.lvProperties.totalCount).toBe(1);
  }, 30_000);

  it('Partner 360 composes as admin and as hunter; the readiness engine explains itself; the lead 360 shows the ecosystem', async () => {
    const asAdmin = (await route('/partners/360', { partnerId: partner!.id }, admin)) as { ok: boolean; readiness: { status: string; reasons: unknown[] }; properties: unknown[]; experiences: unknown[]; onboarding: { progressPercentage: number; completedSteps: string[] } | null; capabilities: Record<string, boolean>; partnerHealth: { value: number | null; reason: string }; contact: { id: string } | null; organisation: { id: string } | null; timeline: unknown[] };

    expect(asAdmin.ok).toBe(true);
    expect(asAdmin.readiness.status).toBe('READY');
    expect(asAdmin.properties).toHaveLength(1);
    expect(asAdmin.experiences).toHaveLength(0);
    expect(asAdmin.onboarding?.progressPercentage).toBeGreaterThan(50);
    expect(asAdmin.capabilities).toMatchObject({ canEdit: true, canGovern: true, canChangeOwner: true, canCreateListing: true });
    expect(asAdmin.partnerHealth.value).toBeNull();
    expect(asAdmin.partnerHealth.reason).toMatch(/not available/i);
    expect(asAdmin.contact?.id).toBe(partner!.contactId);
    expect(asAdmin.organisation?.id).toBe(partner!.organisationId);
    expect(asAdmin.timeline.length).toBeGreaterThanOrEqual(3);

    // The hunter owns the lead and the partner: may view, may not govern.
    const asHunter = (await route('/partners/360', { partnerId: partner!.id }, hunter)) as { ok: boolean; capabilities: Record<string, boolean> };

    expect(asHunter.ok).toBe(true);
    expect(asHunter.capabilities).toMatchObject({ canEdit: false, canGovern: false, canChangeStatus: false, canCreateListing: false });

    const lead360 = (await route('/leads/360', { leadId }, admin)) as { ok: boolean; ecosystem: { partner: { partnerCode: string; status: string; readiness: { status: string } } | null; properties: { code: string | null }[] } };

    expect(lead360.ok).toBe(true);
    expect(lead360.ecosystem.partner).toMatchObject({ partnerCode: partner!.partnerCode, status: 'APPROVED', readiness: { status: 'READY' } });
    expect(lead360.ecosystem.properties[0]?.code).toMatch(/^LVR-/);
  }, 60_000);

  it('security: actor spoof, IDOR-style guesses, unauthorised mutation, approval and activation are all refused and audited', async () => {
    // Hunter (lvLead write only) cannot change partner status, even with a body naming the admin as actor.
    const spoof = (await route('/ecosystem/transition', { kind: 'partner', id: partner!.id, action: 'STATUS', to: 'ACTIVE', actorWorkspaceMemberId: adminId, workspaceMemberId: adminId }, hunter)) as { ok: boolean; refusal?: string };

    expect(spoof).toMatchObject({ ok: false, refusal: 'NOT_PERMITTED' });

    // Hunter cannot approve the property (lvProperty write is Operations / Admin).
    const approveAsHunter = (await route('/ecosystem/transition', { kind: 'property', id: propertyId, action: 'STATUS', to: 'IN_REVIEW' }, hunter)) as { ok: boolean; refusal?: string };

    expect(approveAsHunter).toMatchObject({ ok: false, refusal: 'NOT_PERMITTED' });

    // Onboarding Expert cannot mutate a partner or create listings.
    const createAsReviewer = (await route('/ecosystem/create', { kind: 'experience', partnerId: partner!.id, fields: { name: `D9T sneaky ${STAMP}` } }, reviewer)) as { ok: boolean; refusal?: string };

    expect(createAsReviewer).toMatchObject({ ok: false, refusal: 'NOT_PERMITTED' });

    // Coordinator: lead writer, no ecosystem write.
    const ownerAsCoordinator = (await route('/ecosystem/transition', { kind: 'partner', id: partner!.id, action: 'OWNER', ownerId: adminId }, coordinator)) as { ok: boolean; refusal?: string };

    expect(ownerAsCoordinator).toMatchObject({ ok: false, refusal: 'NOT_PERMITTED' });

    // A guessed id is NOT_FOUND, never a hint.
    const guessed = (await route('/partners/360', { partnerId: crypto.randomUUID() }, hunter)) as { ok: boolean; refusal?: string };

    expect(guessed).toMatchObject({ ok: false, refusal: 'NOT_FOUND' });

    // Illegal transition for an admin: DRAFT → LIVE bypasses approval.
    const bypass = (await route('/ecosystem/transition', { kind: 'property', id: propertyId, action: 'STATUS', to: 'LIVE' }, admin)) as { ok: boolean; refusal?: string };

    expect(bypass).toMatchObject({ ok: false, refusal: 'NOT_ALLOWED' });

    const refused = await gql<{ lvAuditEvents: { edges: { node: { action: string; outcome: string } }[] } }>(`query($ids: [String!]) { lvAuditEvents(filter: { targetRecordId: { in: $ids }, outcome: { eq: REFUSED } }) { edges { node { action outcome } } } }`, API_KEY, { ids: [partner!.id, propertyId] });

    expect(refused.lvAuditEvents.edges.length).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it('property lifecycle: admin submits, approves, then activation is refused until readiness passes (images, availability…), and passes once the record is complete', async () => {
    const submit = (await route('/ecosystem/transition', { kind: 'property', id: propertyId, action: 'STATUS', to: 'IN_REVIEW' }, admin)) as { ok: boolean };

    expect(submit.ok).toBe(true);

    const approve = (await route('/ecosystem/transition', { kind: 'property', id: propertyId, action: 'STATUS', to: 'READY' }, admin)) as { ok: boolean; status?: string };

    expect(approve).toMatchObject({ ok: true, status: 'READY' });

    const notReady = (await route('/ecosystem/transition', { kind: 'property', id: propertyId, action: 'STATUS', to: 'LIVE' }, admin)) as { ok: boolean; refusal?: string; readiness?: { status: string; reasons: { code: string }[] } };

    expect(notReady).toMatchObject({ ok: false, refusal: 'NOT_READY' });
    expect(notReady.readiness?.reasons.map((reason) => reason.code)).toEqual(['PROFILE_IMAGES']);

    // Complete the record the way an operator would (Details tab / API): a real image (the platform refuses a fileId that does not exist). The owner came from the lead.
    const image = await uploadImage(admin, 'lvProperty', 'images');
    const updated = (await post('graphql', { query: `mutation($id: UUID!, $data: LvPropertyUpdateInput!) { updateLvProperty(id: $id, data: $data) { id images } }`, variables: { id: propertyId, data: { images: [image] } } }, API_KEY)) as { data?: { updateLvProperty?: { images: unknown[] } }; errors?: { message: string }[] };

    expect(updated.errors ?? []).toEqual([]);
    expect(updated.data?.updateLvProperty?.images).toHaveLength(1);

    const readiness = (await route('/ecosystem/readiness', { kind: 'property', id: propertyId }, admin)) as { ok: boolean; readiness: { status: string; reasons: { code: string }[] } };

    expect(readiness.ok).toBe(true);
    expect(readiness.readiness.status).toBe('READY');

    // The owner may not activate their own record unless admin — the admin is; a non-admin owner would be refused (covered by capabilities in Partner 360 test).
    const live = (await route('/ecosystem/transition', { kind: 'property', id: propertyId, action: 'STATUS', to: 'LIVE' }, admin)) as { ok: boolean; status?: string };

    expect(live).toMatchObject({ ok: true, status: 'LIVE' });

    const row = await gql<{ lvProperty: { status: string; activatedAt: string | null; approvedAt: string | null; reviewerId: string | null } }>(`query($id: UUID!) { lvProperty(filter: { id: { eq: $id } }) { status activatedAt approvedAt reviewerId } }`, API_KEY, { id: propertyId });

    expect(row.lvProperty.status).toBe('LIVE');
    expect(row.lvProperty.activatedAt).toBeTruthy();
    expect(row.lvProperty.reviewerId).toBe(adminId);
  }, 90_000);

  it('partner activation: readiness-gated, human, audited; the lead goes LIVE_ACTIVE and the onboarding ACTIVATED', async () => {
    const activate = (await route('/ecosystem/transition', { kind: 'partner', id: partner!.id, action: 'STATUS', to: 'ACTIVE' }, admin)) as { ok: boolean; status?: string };

    expect(activate).toMatchObject({ ok: true, status: 'ACTIVE' });

    const after = await waitFor(async () => {
      const data = await gql<{ lvPartner: { status: string; activatedAt: string | null }; lvLead: { status: string }; lvOnboarding: { status: string; activatedAt: string | null } }>(`query($p: UUID!, $l: UUID!, $o: UUID!) { lvPartner(filter: { id: { eq: $p } }) { status activatedAt } lvLead(filter: { id: { eq: $l } }) { status } lvOnboarding(filter: { id: { eq: $o } }) { status activatedAt } }`, API_KEY, { p: partner!.id, l: leadId, o: onboardingId });

      return data.lvLead.status === 'LIVE_ACTIVE' && data.lvOnboarding.status === 'ACTIVATED' ? data : null;
    }, 20, 1000);

    expect(after).not.toBeNull();
    expect(after!.lvPartner).toMatchObject({ status: 'ACTIVE' });
    expect(after!.lvPartner.activatedAt).toBeTruthy();

    // A second activation is refused as SAME_STATUS; an offboard without a reason is refused.
    const again = (await route('/ecosystem/transition', { kind: 'partner', id: partner!.id, action: 'STATUS', to: 'ACTIVE' }, admin)) as { ok: boolean; refusal?: string };

    expect(again).toMatchObject({ ok: false, refusal: 'SAME_STATUS' });

    const noReason = (await route('/ecosystem/transition', { kind: 'partner', id: partner!.id, action: 'STATUS', to: 'SUSPENDED' }, admin)) as { ok: boolean; refusal?: string };

    expect(noReason).toMatchObject({ ok: false, refusal: 'REASON_REQUIRED' });
  }, 60_000);

  it('creating an experience by hand under the partner: duplicate check before the write, code allocated, audited; a second identical name needs CREATE_NEW', async () => {
    const first = (await route('/ecosystem/create', { kind: 'experience', partnerId: partner!.id, fields: { name: `D9T Sunrise Walk ${STAMP}`, location: 'Anjuna', capacity: 8, durationMinutes: 90, basePrice: 1500, priceUnit: 'Per person' } }, admin)) as { ok: boolean; id?: string; code?: string | null };

    expect(first.ok).toBe(true);
    fx.experiences.push(first.id!);
    expect(first.code).toMatch(/^LVE-\d{6}$/);

    const dup = (await route('/ecosystem/create', { kind: 'experience', partnerId: partner!.id, fields: { name: `D9T Sunrise Walk ${STAMP}`, location: 'Anjuna' } }, admin)) as { ok: boolean; refusal?: string; duplicates?: { id: string; percent: number }[] };

    expect(dup).toMatchObject({ ok: false, refusal: 'DUPLICATE_UNDECIDED' });
    expect(dup.duplicates?.[0]?.id).toBe(first.id);

    const anyway = (await route('/ecosystem/create', { kind: 'experience', partnerId: partner!.id, duplicateDecision: 'CREATE_NEW', fields: { name: `D9T Sunrise Walk ${STAMP}`, location: 'Anjuna' } }, admin)) as { ok: boolean; id?: string };

    expect(anyway.ok).toBe(true);
    fx.experiences.push(anyway.id!);

    const experience360 = (await route('/experiences/360', { experienceId: first.id }, admin)) as { ok: boolean; listing: { code: string | null; status: string }; partner: { partnerCode: string | null } | null; readiness: { status: string } };

    expect(experience360.ok).toBe(true);
    expect(experience360.listing).toMatchObject({ code: first.code, status: 'DRAFT' });
    expect(experience360.partner?.partnerCode).toBe(partner!.partnerCode);
    expect(experience360.readiness.status).toBe('NOT_READY');
  }, 60_000);

  it('soft-deleted records cannot be activated or composed', async () => {
    const created = (await route('/ecosystem/create', { kind: 'property', partnerId: partner!.id, fields: { name: `D9T Deleted Cottage ${STAMP}`, location: 'Anjuna' } }, admin)) as { ok: boolean; id?: string };

    expect(created.ok).toBe(true);
    fx.properties.push(created.id!);
    await gql(`mutation($id: UUID!) { deleteLvProperty(id: $id) { id } }`, API_KEY, { id: created.id });

    const composed = (await route('/properties/360', { propertyId: created.id }, admin)) as { ok: boolean; refusal?: string };
    const transition = (await route('/ecosystem/transition', { kind: 'property', id: created.id, action: 'STATUS', to: 'IN_REVIEW' }, admin)) as { ok: boolean; refusal?: string };

    expect(composed).toMatchObject({ ok: false, refusal: 'NOT_FOUND' });
    expect(transition).toMatchObject({ ok: false, refusal: 'NOT_FOUND' });
  }, 30_000);
});
