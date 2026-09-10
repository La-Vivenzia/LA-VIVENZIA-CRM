import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type LeadIdPort } from 'src/modules/lv-core/services/lead-id-allocator';
import { parseLeadId } from 'src/modules/lv-core/utils/lead-id';

// The CoreApiClient-backed LeadIdPort. All workspace I/O for identifier
// allocation lives here, so the allocator itself stays pure and testable.

// Reading a small window rather than a single row is deliberate: if anything
// ever sorts above the real maximum — a hand-edited value, a legacy import —
// taking only the top row would parse it as "nothing issued" and the allocator
// would collide on LV-000001 until it exhausted its retries. Parsing a handful
// and taking the largest recognisable one degrades gracefully instead.
const HIGHEST_ID_WINDOW = 5;

export const createCoreApiLeadIdPort = (client: CoreApiClient): LeadIdPort => ({
  findHighestIssuedLeadId: async () => {
    const result = await client.query({
      lvLeads: {
        __args: {
          first: HIGHEST_ID_WINDOW,
          filter: { lvLeadId: { ilike: 'LV-%' } },
          orderBy: [{ lvLeadId: 'DescNullsLast' }],
        },
        edges: { node: { lvLeadId: true } },
      },
    });

    const edges =
      (result as { lvLeads?: { edges?: { node?: { lvLeadId?: string | null } }[] } })
        .lvLeads?.edges ?? [];

    const sequences = edges
      .map((edge) => parseLeadId(edge?.node?.lvLeadId))
      .filter((sequence): sequence is number => sequence !== null);

    if (sequences.length === 0) {
      return null;
    }

    const highest = Math.max(...sequences);

    return (
      edges
        .map((edge) => edge?.node?.lvLeadId)
        .find((value) => parseLeadId(value) === highest) ?? null
    );
  },

  claimLeadId: async ({ recordId, value }) => {
    // No try/catch: a unique-constraint rejection is the allocator's retry
    // signal and must propagate untouched.
    await client.mutation({
      updateLvLead: {
        __args: { id: recordId, data: { lvLeadId: value } },
        id: true,
      },
    });
  },
});
