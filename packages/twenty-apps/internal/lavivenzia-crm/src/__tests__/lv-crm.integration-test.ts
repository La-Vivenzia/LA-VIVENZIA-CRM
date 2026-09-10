import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Integration tests against a RUNNING Twenty server with this app installed.
//
//   1. docker compose -f <lv-crm-dev.yml> up -d
//   2. start the server, then install the app:  twenty apply .
//   3. TWENTY_API_URL=http://localhost:3000 TWENTY_API_KEY=<key> \
//        vitest run --project integration
//
// Skipped automatically when TWENTY_API_KEY is absent, so the unit suite and CI
// stay green on a machine with no server.

const API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.TWENTY_API_KEY ?? '';

const describeIfLive = API_KEY.length > 0 ? describe : describe.skip;

type GraphQLResponse<T> = { data?: T; errors?: { message: string }[] };

const graphql = async <T>(
  query: string,
  variables: Record<string, unknown> = {},
  endpoint: 'graphql' | 'metadata' = 'graphql',
): Promise<T> => {
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as GraphQLResponse<T>;

  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join('; '));
  }

  if (body.data === undefined) {
    throw new Error('No data returned');
  }

  return body.data;
};

const createdLeadIds: string[] = [];

describeIfLive('La Vivenzia CRM — installed application', () => {
  describe('metadata', () => {
    it('exposes every La Vivenzia object', async () => {
      const data = await graphql<{
        objects: { edges: { node: { nameSingular: string; isActive: boolean } }[] };
      }>(
        `query { objects(paging: { first: 200 }) { edges { node { nameSingular isActive } } } }`,
        {},
        'metadata',
      );

      const names = data.objects.edges
        .map((edge) => edge.node.nameSingular)
        .filter((name) => name.startsWith('lv'));

      expect(names).toEqual(
        expect.arrayContaining([
          'lvLead',
          'lvInteraction',
          'lvOnboarding',
          'lvOnboardingDocument',
          'lvAssignmentHistory',
          'lvAssignmentRule',
          'lvNotification',
        ]),
      );
    });

    it('adds the routing attributes to workspaceMember', async () => {
      const data = await graphql<{
        objects: {
          edges: {
            node: {
              nameSingular: string;
              fields: { edges: { node: { name: string } }[] };
            };
          }[];
        };
      }>(
        `query { objects(paging: { first: 200 }) { edges { node { nameSingular fields(paging: { first: 100 }) { edges { node { name } } } } } } }`,
        {},
        'metadata',
      );

      const member = data.objects.edges.find(
        (edge) => edge.node.nameSingular === 'workspaceMember',
      );
      const fieldNames = (member?.node.fields.edges ?? []).map(
        (edge) => edge.node.name,
      );

      expect(fieldNames).toEqual(
        expect.arrayContaining([
          'lvRegions',
          'lvCategories',
          'lvExpertise',
          'lvLanguages',
          'lvLeadCapacity',
          'lvAcceptsLeads',
        ]),
      );
    });

    it('extends the standard task into a follow-up rather than adding an object', async () => {
      const data = await graphql<{
        objects: {
          edges: {
            node: {
              nameSingular: string;
              fields: { edges: { node: { name: string } }[] };
            };
          }[];
        };
      }>(
        `query { objects(paging: { first: 200 }) { edges { node { nameSingular fields(paging: { first: 100 }) { edges { node { name } } } } } } }`,
        {},
        'metadata',
      );

      const names = data.objects.edges.map((edge) => edge.node.nameSingular);
      const task = data.objects.edges.find(
        (edge) => edge.node.nameSingular === 'task',
      );
      const taskFields = (task?.node.fields.edges ?? []).map(
        (edge) => edge.node.name,
      );

      // No lvFollowUp object exists: the follow-up IS Twenty's task.
      expect(names).not.toContain('lvFollowUp');
      expect(taskFields).toEqual(
        expect.arrayContaining(['lvPriority', 'lvSourceInteraction']),
      );
    });
  });

  describe('lead records', () => {
    it('creates a lead with the La Vivenzia lifecycle vocabulary', async () => {
      const data = await graphql<{
        createLvLead: { id: string; name: string; status: string; priority: string };
      }>(
        `mutation($data: LvLeadCreateInput!) { createLvLead(data: $data) { id name status priority } }`,
        {
          data: {
            name: 'Integration test lead',
            category: 'STAY',
            subcategory: 'VILLA',
            location: 'Lonavala',
            source: 'INSTAGRAM',
            captureMode: 'INSTAGRAM',
            status: 'NEW',
            priority: 'HIGH',
          },
        },
      );

      createdLeadIds.push(data.createLvLead.id);

      expect(data.createLvLead.status).toBe('NEW');
      expect(data.createLvLead.priority).toBe('HIGH');
    });

    it('rejects a status outside the lifecycle', async () => {
      await expect(
        graphql(
          `mutation($data: LvLeadCreateInput!) { createLvLead(data: $data) { id } }`,
          { data: { name: 'Bad status', status: 'NOT_A_REAL_STATUS' } },
        ),
      ).rejects.toThrow();
    });

    it('stores provenance and duplicate keys captured by the client', async () => {
      const data = await graphql<{
        createLvLead: { id: string; duplicateKeys: string[] };
      }>(
        `mutation($data: LvLeadCreateInput!) { createLvLead(data: $data) { id duplicateKeys } }`,
        {
          data: {
            name: 'Provenance lead',
            status: 'NEW',
            duplicateKeys: ['email:a@b.com', 'name:provenance lead'],
            fieldProvenance: { name: 'USER_ENTERED' },
          },
        },
      );

      createdLeadIds.push(data.createLvLead.id);

      expect(data.createLvLead.duplicateKeys).toContain('email:a@b.com');
    });
  });

  describe('onboarding', () => {
    it('creates an onboarding in the NOT_STARTED state', async () => {
      const data = await graphql<{
        createLvOnboarding: { id: string; status: string };
      }>(
        `mutation($data: LvOnboardingCreateInput!) { createLvOnboarding(data: $data) { id status } }`,
        { data: { name: 'Integration onboarding' } },
      );

      expect(data.createLvOnboarding.status).toBe('NOT_STARTED');
    });

    it('accepts the full ten-step answer payload as JSON', async () => {
      const data = await graphql<{
        createLvOnboarding: { id: string; progressPercentage: number };
      }>(
        `mutation($data: LvOnboardingCreateInput!) { createLvOnboarding(data: $data) { id progressPercentage } }`,
        {
          data: {
            name: 'Answers onboarding',
            progressPercentage: 40,
            answers: {
              BASIC_INFORMATION: { legalName: 'Raj Sharma' },
              PRICING: { basePrice: 2400 },
            },
          },
        },
      );

      expect(data.createLvOnboarding.progressPercentage).toBe(40);
    });
  });

  afterAll(async () => {
    // Leave the workspace as we found it.
    for (const id of createdLeadIds) {
      try {
        await graphql(
          `mutation($id: UUID!) { deleteLvLead(id: $id) { id } }`,
          { id },
        );
      } catch {
        // Best effort: a failed cleanup must not fail the suite.
      }
    }
  });

  beforeAll(() => {
    expect(API_KEY.length).toBeGreaterThan(0);
  });
});
