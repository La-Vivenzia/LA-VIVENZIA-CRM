import { hasLeadId, nextLeadId } from 'src/modules/lv-core/utils/lead-id';

// Allocates the universal LV Lead ID.
//
// Twenty has no sequence or auto-increment field type, and no synchronous
// pre-create hook, so the id cannot be produced by the database default that
// would be the obvious answer elsewhere. What makes this safe instead is the
// unique index on lvLead.lvLeadId: two workers may well compute the same next
// number, but only one of them can write it. The loser sees the constraint
// fire, re-reads the highest issued id and tries again.
//
// The database is therefore the arbiter of uniqueness, not this code. That is
// the only design that stays correct under concurrency without a lock.

export type LeadIdPort = {
  // The largest id already issued, or null when none has been. Implementations
  // must order on the stored string, which is safe because the format is
  // fixed-width (see lead-id.ts).
  findHighestIssuedLeadId(): Promise<string | null>;
  // Must reject if another writer already holds `value`. Implementations must
  // not swallow the unique-constraint error — it is the signal to retry.
  claimLeadId(input: { recordId: string; value: string }): Promise<void>;
};

export type AllocateLeadIdResult =
  | { ok: true; leadId: string; allocated: boolean }
  | { ok: false; reason: 'CEILING_REACHED' | 'CONTENTION' };

const UNIQUE_VIOLATION = /duplicate key|unique constraint|already exists|duplicate value/i;

export const isUniqueViolation = (error: unknown): boolean => {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  return UNIQUE_VIOLATION.test(message);
};

export const DEFAULT_MAX_ALLOCATION_ATTEMPTS = 8;

export const allocateLeadId = async ({
  lead,
  port,
  maxAttempts = DEFAULT_MAX_ALLOCATION_ATTEMPTS,
}: {
  lead: { id: string; lvLeadId?: string | null };
  port: LeadIdPort;
  maxAttempts?: number;
}): Promise<AllocateLeadIdResult> => {
  // Idempotency: an id, once issued, is never recomputed. A replayed event or a
  // retried job must observe exactly the id the first run assigned.
  if (hasLeadId(lead.lvLeadId)) {
    return { ok: true, leadId: lead.lvLeadId as string, allocated: false };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = nextLeadId(await port.findHighestIssuedLeadId());

    if (!candidate.ok) {
      return { ok: false, reason: 'CEILING_REACHED' };
    }

    try {
      await port.claimLeadId({ recordId: lead.id, value: candidate.leadId });

      return { ok: true, leadId: candidate.leadId, allocated: true };
    } catch (error) {
      // Anything that is not the unique index firing is a real failure and
      // must surface — swallowing it here would hand back a lead with no id
      // and no explanation.
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  return { ok: false, reason: 'CONTENTION' };
};
