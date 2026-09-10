import { describe, expect, it, vi } from 'vitest';

import {
  allocateLeadId,
  isUniqueViolation,
  type LeadIdPort,
} from 'src/modules/lv-core/services/lead-id-allocator';

// A fake workspace that enforces the unique index the real database enforces.
const createStore = (issued: string[] = []) => {
  const taken = new Set(issued);

  const port: LeadIdPort = {
    findHighestIssuedLeadId: async () => [...taken].sort().at(-1) ?? null,
    claimLeadId: async ({ value }) => {
      if (taken.has(value)) {
        throw new Error(
          `duplicate key value violates unique constraint "lvLead_lvLeadId_key"`,
        );
      }
      taken.add(value);
    },
  };

  return { port, taken };
};

describe('allocateLeadId', () => {
  it('issues LV-000001 into an empty workspace', async () => {
    const { port } = createStore();

    await expect(allocateLeadId({ lead: { id: 'a' }, port })).resolves.toEqual({
      ok: true,
      leadId: 'LV-000001',
      allocated: true,
    });
  });

  it('continues the sequence from the highest issued id', async () => {
    const { port } = createStore(['LV-000001', 'LV-000002', 'LV-000003']);

    await expect(allocateLeadId({ lead: { id: 'a' }, port })).resolves.toMatchObject(
      { leadId: 'LV-000004', allocated: true },
    );
  });

  it('never recomputes an id a lead already has', async () => {
    const { port } = createStore(['LV-000009']);
    const claim = vi.spyOn(port, 'claimLeadId');

    const result = await allocateLeadId({
      lead: { id: 'a', lvLeadId: 'LV-000009' },
      port,
    });

    expect(result).toEqual({ ok: true, leadId: 'LV-000009', allocated: false });
    expect(claim).not.toHaveBeenCalled();
  });

  it('treats a blank id as unallocated, because that is what the rows hold', async () => {
    const { port } = createStore();

    await expect(
      allocateLeadId({ lead: { id: 'a', lvLeadId: '' }, port }),
    ).resolves.toMatchObject({ leadId: 'LV-000001', allocated: true });
  });

  it('retries when another writer takes the id first, and still succeeds', async () => {
    const { port, taken } = createStore(['LV-000001']);
    const original = port.claimLeadId;
    let first = true;

    port.claimLeadId = async (input) => {
      if (first) {
        // Simulate a racing worker winning LV-000002 between our read and write.
        first = false;
        taken.add('LV-000002');
      }

      return original(input);
    };

    await expect(allocateLeadId({ lead: { id: 'a' }, port })).resolves.toEqual({
      ok: true,
      leadId: 'LV-000003',
      allocated: true,
    });
  });

  it('gives up with CONTENTION rather than looping forever', async () => {
    const port: LeadIdPort = {
      findHighestIssuedLeadId: async () => null,
      claimLeadId: async () => {
        throw new Error('duplicate key value violates unique constraint');
      },
    };

    await expect(
      allocateLeadId({ lead: { id: 'a' }, port, maxAttempts: 3 }),
    ).resolves.toEqual({ ok: false, reason: 'CONTENTION' });
  });

  it('rethrows a real failure instead of masking it as contention', async () => {
    const port: LeadIdPort = {
      findHighestIssuedLeadId: async () => null,
      claimLeadId: async () => {
        throw new Error('connection refused');
      },
    };

    await expect(allocateLeadId({ lead: { id: 'a' }, port })).rejects.toThrow(
      'connection refused',
    );
  });

  it('refuses at the ordering ceiling instead of issuing a duplicate', async () => {
    const { port } = createStore(['LV-999999']);

    await expect(allocateLeadId({ lead: { id: 'a' }, port })).resolves.toEqual({
      ok: false,
      reason: 'CEILING_REACHED',
    });
  });

  it('allocates distinct ids for concurrent callers sharing one store', async () => {
    const { port } = createStore();

    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        allocateLeadId({ lead: { id: `lead-${i}` }, port, maxAttempts: 50 }),
      ),
    );

    const ids = results.map((r) => (r.ok ? r.leadId : 'FAILED'));

    expect(new Set(ids).size).toBe(25);
    expect(ids).not.toContain('FAILED');
  });
});

describe('isUniqueViolation', () => {
  it.each([
    'duplicate key value violates unique constraint',
    'Unique constraint failed',
    'Value already exists',
  ])('recognises %p', (message) => {
    expect(isUniqueViolation(new Error(message))).toBe(true);
  });

  it.each(['connection refused', 'timeout', ''])('does not claim %p', (message) => {
    expect(isUniqueViolation(new Error(message))).toBe(false);
  });
});
