import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordCreateEvent,
} from 'twenty-sdk/define';

import { FN_ON_LEAD_CREATED_ID } from 'src/constants/universal-identifiers';
import { createCoreApiAssignmentPort } from 'src/modules/lv-assignment/services/core-api-assignment-port';
import {
  assignLead,
  type AssignmentTarget,
} from 'src/modules/lv-assignment/services/assignment-orchestrator';
import { isLeadStatus, type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { allocateLeadId } from 'src/modules/lv-core/services/lead-id-allocator';
import { createCoreApiLeadIdPort } from 'src/modules/lv-core/services/core-api-lead-id-port';
import { assignmentEventKey } from 'src/modules/lv-assignment/utils/build-assignment-history';

// Routes every newly created lead. Fires once per lead on lvLead.created.
//
// The decision itself is pure (selectAssignee); this function only supplies the
// workspace data and writes the result back, so a failure here can never
// produce a *different* owner than the engine chose — only no owner at all,
// which is recorded as such.

type LeadRecord = {
  id: string;
  lvLeadId?: string | null;
  name?: string | null;
  organisationName?: string | null;
  category?: string | null;
  subcategory?: string | null;
  location?: string | null;
  languages?: readonly string[] | null;
  source?: string | null;
  status?: string | null;
  priority?: string | null;
  ownerId?: string | null;
  duplicateKeys?: readonly string[] | null;
};

const toAssignmentTarget = (record: LeadRecord): AssignmentTarget => ({
  id: record.id,
  name: record.name ?? 'Unnamed lead',
  currentOwnerWorkspaceMemberId: record.ownerId ?? null,
  status:
    record.status && isLeadStatus(record.status) ? record.status : 'NEW',
  priority: (record.priority as LeadPriority | null) ?? 'MEDIUM',
  organisationName: record.organisationName ?? null,
  category: record.category ?? null,
  subcategory: record.subcategory ?? null,
  location: record.location ?? null,
  languages: record.languages ?? null,
  source: record.source ?? null,
  duplicateKeys: record.duplicateKeys ?? null,
});

export const handler = async (
  payload: DatabaseEventPayload<ObjectRecordCreateEvent<LeadRecord>>,
): Promise<Record<string, unknown>> => {
  const event = payload.properties.after;

  if (!event?.id) {
    return { assigned: false, reason: 'Event carried no lead id.' };
  }

  const client = new CoreApiClient();

  // The event says *which* lead changed; it does not say what that lead looks
  // like now. A redelivered message still carries the record as it was at
  // creation — no owner, no identifier — so trusting it would re-allocate an
  // identifier the lead already has and re-run routing that already happened.
  // Current state is therefore read back before any decision is made.
  const current = await client.query({
    lvLead: {
      __args: { filter: { id: { eq: event.id } } },
      id: true,
      lvLeadId: true,
      ownerId: true,
      status: true,
    },
  });

  const live = (current as {
    lvLead?: { lvLeadId?: string | null; ownerId?: string | null; status?: string | null };
  }).lvLead;

  if (!live) {
    // Deleted between the event and its delivery. Nothing to do, and saying so
    // is better than routing a lead that no longer exists.
    return { assigned: false, reason: 'Lead no longer exists.' };
  }

  const record: LeadRecord = {
    ...event,
    lvLeadId: live.lvLeadId ?? null,
    ownerId: live.ownerId ?? null,
    status: live.status ?? event.status,
  };

  // The identifier is allocated first and independently. A lead that nobody
  // can be assigned to must still be identifiable — losing the business key
  // because routing failed would be the worse of the two failures.
  const identifier = await allocateLeadId({
    lead: { id: record.id, lvLeadId: record.lvLeadId },
    port: createCoreApiLeadIdPort(client),
  });

  const port = createCoreApiAssignmentPort(client);

  const outcome = await assignLead({
    lead: toAssignmentTarget(record),
    port,
    now: new Date().toISOString(),
    // Derived from the event, so a replay is rejected by the unique index
    // rather than appending a second history row.
    eventKey: assignmentEventKey({
      eventName: payload.name,
      leadId: record.id,
    }),
  });

  return {
    lvLeadId: identifier.ok ? identifier.leadId : null,
    lvLeadIdAllocated: identifier.ok ? identifier.allocated : false,
    lvLeadIdFailure: identifier.ok ? null : identifier.reason,
    assigned: outcome.decision.assigneeWorkspaceMemberId !== null,
    ownerId: outcome.decision.assigneeWorkspaceMemberId,
    strategy: outcome.decision.strategy,
    score: outcome.decision.score,
    reasons: outcome.decision.reasons,
    unassignedReason: outcome.decision.unassignedReason,
    notificationsSent: outcome.notificationsSent,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_ON_LEAD_CREATED_ID,
  name: 'lv-on-lead-created',
  description:
    'Routes a newly created lead to an owner, records assignment history and notifies the owner',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: { eventName: 'lvLead.created' },
});
