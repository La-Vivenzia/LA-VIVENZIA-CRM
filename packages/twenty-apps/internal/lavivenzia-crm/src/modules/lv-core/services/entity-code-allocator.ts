import { type CoreApiClient } from 'twenty-client-sdk/core';

import { isUniqueViolation } from 'src/modules/lv-core/services/lead-id-allocator';
import { type EntityKind, hasEntityCode, nextEntityCode, parseEntityCode } from 'src/modules/lv-core/utils/entity-code';

// Allocates LVP- / LVE- / LVR- codes with exactly the rule that makes the LV
// Lead ID safe (lead-id-allocator.ts): the unique index on the code column is
// the arbiter. Two writers may compute the same next number; only one can
// write it, the other re-reads the highest issued code and tries again. An
// entity that already has a code keeps it — a replayed event never renumbers.

export type EntityCodePort = {
  findHighestIssuedCode(): Promise<string | null>;
  // Must reject (not swallow) the unique-constraint error.
  claimCode(input: { recordId: string; code: string }): Promise<void>;
};

export type AllocateEntityCodeResult = { ok: true; code: string; allocated: boolean } | { ok: false; reason: 'CEILING_REACHED' | 'CONTENTION' };

export const allocateEntityCode = async ({ kind, record, port, maxAttempts = 8 }: { kind: EntityKind; record: { id: string; code?: string | null }; port: EntityCodePort; maxAttempts?: number }): Promise<AllocateEntityCodeResult> => {
  if (hasEntityCode(kind, record.code)) {
    return { ok: true, code: record.code as string, allocated: false };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = nextEntityCode(kind, await port.findHighestIssuedCode());

    if (!candidate.ok) {
      return { ok: false, reason: 'CEILING_REACHED' };
    }

    try {
      await port.claimCode({ recordId: record.id, code: candidate.code });

      return { ok: true, code: candidate.code, allocated: true };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  return { ok: false, reason: 'CONTENTION' };
};

// The CoreApiClient-backed port for one object. Reads a small window of live
// AND soft-deleted rows so a deleted record's code is never reissued (a
// business key must not come back on a different partner) and a stray value
// sorting above the true maximum cannot wedge allocation.
const OBJECTS: Record<EntityKind, { plural: string; update: string; codeField: string }> = {
  partner: { plural: 'lvPartners', update: 'updateLvPartner', codeField: 'partnerCode' },
  experience: { plural: 'lvExperiences', update: 'updateLvExperience', codeField: 'experienceCode' },
  property: { plural: 'lvProperties', update: 'updateLvProperty', codeField: 'propertyCode' },
};

const WINDOW = 5;

export const createCoreApiEntityCodePort = (client: CoreApiClient, kind: EntityKind): EntityCodePort => {
  const meta = OBJECTS[kind];

  return {
    findHighestIssuedCode: async () => {
      const page = async (onlyDeleted: boolean): Promise<(string | null)[]> => {
        const result = (await client.query({
          [meta.plural]: {
            __args: { first: WINDOW, filter: { [meta.codeField]: { ilike: `${kind === 'partner' ? 'LVP' : kind === 'experience' ? 'LVE' : 'LVR'}-%` }, ...(onlyDeleted ? { deletedAt: { is: 'NOT_NULL' } } : {}) }, orderBy: [{ [meta.codeField]: 'DescNullsLast' }] },
            edges: { node: { [meta.codeField]: true } },
          },
        } as never)) as Record<string, { edges?: { node?: Record<string, string | null> }[] }>;

        return (result[meta.plural]?.edges ?? []).map((edge) => edge?.node?.[meta.codeField] ?? null);
      };

      const candidates = [...(await page(false)), ...(await page(true))];
      const sequences = candidates.map((value) => parseEntityCode(kind, value)).filter((sequence): sequence is number => sequence !== null);

      if (sequences.length === 0) {
        return null;
      }

      const highest = Math.max(...sequences);

      return candidates.find((value) => parseEntityCode(kind, value) === highest) ?? null;
    },
    claimCode: async ({ recordId, code }) => {
      await client.mutation({ [meta.update]: { __args: { id: recordId, data: { [meta.codeField]: code } }, id: true } } as never);
    },
  };
};
