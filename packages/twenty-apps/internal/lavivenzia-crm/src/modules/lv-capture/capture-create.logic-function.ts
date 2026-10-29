import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_CAPTURE_CREATE_ID } from 'src/constants/universal-identifiers';
import { applicationClient, delegatedClient } from 'src/modules/lv-ai/runtime/clients';
import { fingerprintOf, recordDecision, upsertInsight } from 'src/modules/lv-ai/runtime/insight-store';
import { CAPTURE_METHOD_BY_KEY } from 'src/modules/lv-capture/constants/capture-methods';
import { isCaptureKey, readCaptureInput } from 'src/modules/lv-capture/services/capture-request';
import { type CaptureProvenance, createCapturedLead, draftFor, findLeadByCaptureKey, methodProvenance, notifyOwnerAssignedAtCapture, recommendAssignment, scanDraftDuplicates } from 'src/modules/lv-capture/services/capture-service';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { createLeadTask } from 'src/modules/lv-followups/services/create-lead-task';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';
import { scanDuplicates } from 'src/modules/lv-intelligence/engines/duplicate-scan';
import { deriveLeadFacts } from 'src/modules/lv-intelligence/engines/lead-facts';
import { recommendNextBestAction } from 'src/modules/lv-intelligence/engines/next-best-action';
import { loadLeadContext } from 'src/modules/lv-intelligence/services/lead-context';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { describeError } from 'src/modules/lv-core/utils/describe-error';

// POST /capture/create
//   { captureKey, method, fields, assignment: { mode, memberId? },
//     duplicate: { decision, candidateLeadIds? }, classification: { status, runId? },
//     extraction: { status, kind, runId, fieldCount }, attachment? }
//
// The CREATE → ASSIGN → NEXT ACTION half of capture, in one idempotent call:
//
//   1. the reviewed fields become a draft (same builder as preflight);
//   2. the lead is created as the caller (permission and CM-004 bind) with a
//      unique capture key — a repeated call returns the same lead;
//   3. ownership: ENGINE leaves it to the assignment engine (the
//      lvLead.created handler routes and records the strategy), SELF claims
//      it for the caller, MEMBER names a colleague — administrators only,
//      as the manual-assignment policy already says; the body never chooses
//      an owner on a non-admin's behalf;
//   4. the duplicate decision is written as an lvAiInsight DUPLICATE row with
//      the reviewer's decision, so the Intelligence tab does not re-surface
//      the pair the person already judged;
//   5. the first next action is created from Next Best Action, as the caller,
//      assigned to the owner (or the caller until there is one).
//
// If a later step fails the lead still exists and the response says exactly
// what did and did not happen — never "assigned" when it was not.

type Input = {
  captureKey?: unknown;
  method?: unknown;
  fields?: unknown;
  assignment?: unknown;
  duplicate?: unknown;
  classification?: unknown;
  extraction?: unknown;
  attachment?: unknown;
  timezoneOffsetMinutes?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can create leads.' };
  }

  if (!isCaptureKey(input.captureKey)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'captureKey must be a UUID.' };
  }

  const parsed = readCaptureInput(input);

  if (!parsed.ok) {
    return { ok: false, refusal: 'INVALID_INPUT', error: parsed.error };
  }

  const method = CAPTURE_METHOD_BY_KEY[parsed.method];
  const confirmed = parsed.input.isHumanConfirmed === true;

  // Extracted values are proposals until a person confirms them.
  if (method.requiresConfirmation && !confirmed) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'Please review the extracted information before creating the lead.' };
  }

  const built = draftFor({ ...parsed.input, isHumanConfirmed: confirmed });

  if (!built.ok) {
    return { ok: false, refusal: 'INVALID_INPUT', errors: built.errors, error: built.errors[0] };
  }

  const { draft } = built;
  const delegated = new CoreApiClient();
  const application = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const label = draft.name;
  const captureKey = input.captureKey;

  // ---- ownership policy ---------------------------------------------------
  const assignment = record(input.assignment);
  const mode = assignment.mode === 'SELF' || assignment.mode === 'MEMBER' || assignment.mode === 'NONE' ? assignment.mode : 'ENGINE';
  let ownerId: string | null = null;
  let ownerReason: string | null = null;

  if (mode === 'SELF') {
    ownerId = actorWorkspaceMemberId;
  } else if (mode === 'MEMBER') {
    const caller = await resolveCaller(new DelegatedGraphqlClient());
    const memberId = typeof assignment.memberId === 'string' && UUID.test(assignment.memberId) ? assignment.memberId : null;

    if (memberId === null) {
      return { ok: false, refusal: 'INVALID_INPUT', error: 'memberId must be a team member id.' };
    }

    if (memberId === actorWorkspaceMemberId) {
      ownerId = memberId;
    } else if (!caller.isAdmin) {
      // Same rule as Lead 360's manual assignment: a non-admin may claim for
      // themselves or leave it to the engine, never route to a colleague.
      await writeAuditEvent(application, { action: 'ASSIGNMENT_CHANGED', outcome: 'REFUSED', targetObject: 'lvCapture', targetRecordId: captureKey, targetLabel: label, actorWorkspaceMemberId, at: now, reason: null, metadata: { memberId, error: 'policy' } });

      return { ok: false, refusal: 'POLICY', error: 'Only an administrator can assign a new lead to a colleague. Choose the recommended owner, claim it yourself, or leave it to the engine.' };
    } else {
      const member = await delegated.query({ workspaceMember: { __args: { filter: { id: { eq: memberId } } }, id: true } }).catch(() => null);

      if (!(member as { workspaceMember?: { id?: string } | null } | null)?.workspaceMember?.id) {
        return { ok: false, refusal: 'INVALID_INPUT', error: 'That team member does not exist.' };
      }

      ownerId = memberId;
      ownerReason = 'assigned by an administrator at capture';
    }
  }

  // ---- provenance ---------------------------------------------------------
  const extraction = record(input.extraction);
  const classification = record(input.classification);
  const duplicate = record(input.duplicate);
  const duplicateDecision = duplicate.decision === 'CREATE_NEW' || duplicate.decision === 'IGNORED' ? duplicate.decision : 'NONE';
  const candidateLeadIds = Array.isArray(duplicate.candidateLeadIds) ? duplicate.candidateLeadIds.filter((id): id is string => typeof id === 'string' && UUID.test(id)).slice(0, 10) : [];
  const extractionStatus = ['EXTRACTED', 'UNAVAILABLE', 'FAILED', 'SKIPPED'].includes(String(extraction.status)) ? (extraction.status as CaptureProvenance['extraction']['status']) : 'NOT_APPLICABLE';
  const classificationStatus = ['AI_SUGGESTED', 'REVIEW_REQUIRED', 'UNAVAILABLE', 'ACCEPTED', 'EDITED', 'REJECTED', 'MANUAL'].includes(String(classification.status)) ? (classification.status as CaptureProvenance['classification']['status']) : 'NOT_RUN';
  const provenance: CaptureProvenance = {
    ...methodProvenance(method.key, draft),
    capturedAt: now,
    capturedById: actorWorkspaceMemberId,
    extraction: { status: extractionStatus, kind: extraction.kind === 'OCR' || extraction.kind === 'PAGE_METADATA' ? extraction.kind : null, runId: typeof extraction.runId === 'string' && UUID.test(extraction.runId) ? extraction.runId : null, fieldCount: typeof extraction.fieldCount === 'number' ? extraction.fieldCount : 0 },
    classification: { status: classificationStatus, runId: typeof classification.runId === 'string' && UUID.test(classification.runId) ? classification.runId : null },
    verification: confirmed || !method.requiresConfirmation ? 'CONFIRMED_BY_PERSON' : 'UNCONFIRMED',
    duplicateDecision: { decision: duplicateDecision, candidateLeadIds },
    captureKey,
  };

  // The attachment is whatever the upload step handed back for the FILES
  // field; it is stored, not interpreted.
  const attachment = Array.isArray(input.attachment) && input.attachment.length > 0 ? input.attachment.slice(0, 5) : null;

  // ---- duplicate gate ------------------------------------------------------
  // The screen checks before it asks; the server checks again before it
  // writes, so a stale or hand-built request cannot slip a duplicate past the
  // decision. A replay of an already-created capture skips this (the lead it
  // would find is its own).
  let duplicateCheck: 'CLEAR' | 'DECIDED' | 'UNAVAILABLE' | 'REPLAY' = 'DECIDED';

  if (duplicateDecision === 'NONE') {
    const existing = await findLeadByCaptureKey(application, captureKey);

    if (existing) {
      duplicateCheck = 'REPLAY';
    } else {
      try {
        const found = await scanDraftDuplicates(delegatedClient(), draft, now);

        if (found.length > 0) {
          await writeAuditEvent(application, { action: 'DUPLICATE_DETECTED', outcome: 'REFUSED', targetObject: 'lvCapture', targetRecordId: captureKey, targetLabel: draft.name, actorWorkspaceMemberId, at: now, reason: 'Create attempted without a duplicate decision', metadata: { candidates: found.map((candidate) => ({ leadId: candidate.leadId, lvLeadId: candidate.lvLeadId, percent: candidate.percent })) } });

          return { ok: false, refusal: 'DUPLICATE_UNDECIDED', error: `${found.length} possible duplicate${found.length === 1 ? '' : 's'} found. Open the existing lead, or choose to create a new one or ignore the match.`, duplicates: found };
        }

        duplicateCheck = 'CLEAR';
      } catch (error) {
        // The scan failing must not block a real lead — but it is never
        // reported as "no duplicates".
        duplicateCheck = 'UNAVAILABLE';
        console.warn('[lv-capture] duplicate gate unavailable:', describeError(error));
      }
    }
  }

  // ---- create (idempotent) ------------------------------------------------
  const created = await createCapturedLead({ delegated, application, draft, provenance, ownerId, attachment, actorWorkspaceMemberId, now });

  if (!created.ok) {
    return { ok: false, refusal: created.refusal, error: created.error, detail: created.detail };
  }

  const leadId = created.leadId;
  const steps: Record<string, unknown> = { duplicateCheck };

  if (created.replayed) {
    // Everything after creation already happened (or is happening) for the
    // first request; report the lead as it is now rather than redoing it.
    const live = await findLeadByCaptureKey(application, captureKey);
    const context = await loadLeadContext(applicationClient(), applicationClient(), leadId);
    const task = context?.tasks.find((row) => row.status !== 'DONE') ?? null;

    return { ok: true, replayed: true, leadId, lvLeadId: live?.lvLeadId ?? created.lvLeadId, ownerId: live?.ownerId ?? null, ownerName: await memberName(delegated, live?.ownerId ?? null), task: task ? { id: task.id, title: task.title, dueAt: task.dueAt, priority: null } : null, steps: { created: 'REPLAYED' } };
  }

  steps.created = 'DONE';

  // ---- notes persistence --------------------------------------------------
  if (draft.notes && draft.notes.trim().length > 0) {
    try {
      const createdNote = await delegated.mutation({
        createNote: { __args: { data: { title: `Capture notes: ${label}`, bodyV2: { markdown: draft.notes.trim() } } }, id: true },
      });
      const noteId = (createdNote as { createNote?: { id?: string } })?.createNote?.id ?? null;

      if (noteId) {
        await delegated.mutation({ createNoteTarget: { __args: { data: { noteId, targetLvLeadId: leadId } }, id: true } });
      }
    } catch (noteError) {
      console.warn('[lv-capture] capture note creation failed:', describeError(noteError));
    }
  }

  // ---- classification decision trail --------------------------------------
  if (classificationStatus === 'ACCEPTED' || classificationStatus === 'EDITED' || classificationStatus === 'REJECTED') {
    await writeAuditEvent(application, {
      action: classificationStatus === 'ACCEPTED' ? 'CLASSIFICATION_ACCEPTED' : classificationStatus === 'EDITED' ? 'CLASSIFICATION_EDITED' : 'CLASSIFICATION_REJECTED',
      outcome: 'APPLIED',
      targetObject: 'lvLead',
      targetRecordId: leadId,
      targetLabel: label,
      actorWorkspaceMemberId,
      at: now,
      reason: null,
      metadata: { category: draft.category, subcategory: draft.subcategory, runId: provenance.classification.runId, captureKey },
    });
  }

  // ---- duplicate decision trail -------------------------------------------
  if (duplicateDecision !== 'NONE' && candidateLeadIds.length > 0) {
    await writeAuditEvent(application, {
      action: duplicateDecision === 'IGNORED' ? 'DUPLICATE_IGNORED' : 'DUPLICATE_CREATED_NEW',
      outcome: 'APPLIED',
      targetObject: 'lvLead',
      targetRecordId: leadId,
      targetLabel: label,
      actorWorkspaceMemberId,
      at: now,
      reason: null,
      metadata: { candidateLeadIds, captureKey },
    });

    // Persist the judgement where the Intelligence tab looks, with the
    // fingerprint that tab would compute for the same candidates — so the
    // pair the person already decided on is not suggested again.
    try {
      const context = await loadLeadContext(delegatedClient(), applicationClient(), leadId);

      if (context) {
        const scan = await scanDuplicates(delegatedClient(), context.lead, now);
        const row = await upsertInsight(applicationClient(), [], {
          insightType: 'DUPLICATE',
          status: 'AI_SUGGESTED',
          origin: 'RULES',
          targetObject: 'lvLead',
          targetRecordId: leadId,
          leadId,
          provider: 'rules',
          model: null,
          promptVersion: scan.rulesVersion,
          generatedAt: now,
          confidence: scan.candidates[0] ? scan.candidates[0].percent / 100 : null,
          sourceRecordIds: [leadId, ...scan.candidates.map((candidate) => candidate.leadId)],
          payload: scan,
          summary: `${scan.candidates.length} possible duplicate(s) reviewed at capture`,
          fingerprint: fingerprintOf([scan.rulesVersion, scan.candidates.map((candidate) => `${candidate.leadId}:${candidate.percent}`), context.lead.duplicateKeys ?? []]),
        });

        await recordDecision(applicationClient(), row.id, { humanDecision: duplicateDecision === 'IGNORED' ? 'IGNORED' : 'CREATED_NEW', status: 'AI_REJECTED', reviewerId: actorWorkspaceMemberId, note: 'Decided on the capture screen' });
      }
    } catch (error) {
      console.warn('[lv-capture] duplicate decision not persisted:', describeError(error));
    }
  }

  // ---- assignment ---------------------------------------------------------
  // ENGINE: the lvLead.created handler is routing right now (it records the
  // strategy and history). Wait briefly for it so the success screen can say
  // who got the lead; if it has not settled, say so — never claim an owner.
  let finalOwnerId = ownerId;
  let assignmentState: 'ASSIGNED' | 'PENDING' | 'UNASSIGNED' | 'FAILED' = ownerId ? 'ASSIGNED' : 'PENDING';
  let assignmentReason: string | null = ownerReason;

  if (ownerId === null && mode !== 'NONE') {
    for (let attempt = 0; attempt < 8 && finalOwnerId === null; attempt += 1) {
      await wait(500);
      const live = await findLeadByCaptureKey(application, captureKey);

      finalOwnerId = live?.ownerId ?? null;
    }

    if (finalOwnerId === null) {
      // Ask the engine why, so the reason is actionable rather than "no".
      try {
        const recommendation = await recommendAssignment(application, draft, now);

        assignmentState = recommendation.memberId ? 'PENDING' : 'UNASSIGNED';
        assignmentReason = recommendation.memberId ? 'Routing is still running; the owner will appear on the lead in a moment.' : recommendation.noMatchReason;
      } catch {
        assignmentState = 'FAILED';
        assignmentReason = 'The assignment engine could not be reached. The lead is unassigned — assign it manually from Lead 360.';
      }

      if (assignmentState !== 'PENDING') {
        await writeAuditEvent(application, { action: 'ASSIGNMENT_FAILED', outcome: 'FAILED', targetObject: 'lvLead', targetRecordId: leadId, targetLabel: label, actorWorkspaceMemberId, at: now, reason: assignmentReason, metadata: { mode, captureKey } });
      }
    } else {
      assignmentState = 'ASSIGNED';
    }
  } else if (mode === 'NONE') {
    assignmentState = 'UNASSIGNED';
    assignmentReason = 'Left unassigned on purpose.';
  }

  // A colleague assigned at creation is told the same way the engine's
  // assignments are (see notifyOwnerAssignedAtCapture).
  if (ownerId !== null && ownerId !== actorWorkspaceMemberId) {
    try {
      steps.notified = await notifyOwnerAssignedAtCapture({ application, leadId, leadName: label, ownerId, priority: draft.priority, actorWorkspaceMemberId, now, sourceEvent: 'lv-capture-create' });
    } catch (error) {
      steps.notified = `FAILED: ${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}`;
    }
  }

  if (finalOwnerId !== null) {
    await writeAuditEvent(application, {
      action: mode === 'MEMBER' && ownerId !== actorWorkspaceMemberId ? 'ASSIGNMENT_CHANGED' : 'ASSIGNMENT_ACCEPTED',
      outcome: 'APPLIED',
      targetObject: 'lvLead',
      targetRecordId: leadId,
      targetLabel: label,
      actorWorkspaceMemberId,
      at: now,
      reason: assignmentReason,
      metadata: { mode, ownerId: finalOwnerId, captureKey },
    });
  }

  steps.assignment = assignmentState;

  // ---- next action ----------------------------------------------------------
  let task: { id: string; title: string; dueAt: string | null; priority: string } | null = null;
  let taskError: string | null = null;

  try {
    const context = await loadLeadContext(applicationClient(), applicationClient(), leadId);

    if (context) {
      const facts = deriveLeadFacts(context, now);
      const nba = recommendNextBestAction(facts);
      const proposed = nba.primary?.proposedTask ?? { title: `First contact with ${label}`, dueAt: new Date(Date.parse(now) + 24 * 3_600_000).toISOString(), priority: draft.priority === 'CRITICAL' || draft.priority === 'HIGH' ? 'HIGH' : 'MEDIUM' };
      const outcome = await createLeadTask(
        delegated,
        application,
        actorWorkspaceMemberId,
        { leadId, leadLabel: `${created.lvLeadId ?? ''} ${label}`.trim(), title: proposed.title, description: nba.primary ? `${nba.primary.reason}\n\nSuggested by Next Best Action (${nba.rulesVersion}) at capture.` : 'Created at capture.', dueAt: proposed.dueAt, priority: proposed.priority, assigneeId: finalOwnerId ?? actorWorkspaceMemberId, origin: 'CAPTURE' },
        now,
      );

      if (outcome.ok) {
        task = { id: outcome.taskId, title: proposed.title, dueAt: proposed.dueAt, priority: proposed.priority };
        // Mirror onto the lead so the list view and Lead 360 header show it.
        await application.mutation({ updateLvLead: { __args: { id: leadId, data: { nextAction: proposed.title, nextFollowUpAt: proposed.dueAt } }, id: true } }).catch(() => undefined);
      } else {
        taskError = outcome.error;
      }
    }
  } catch (error) {
    taskError = error instanceof Error ? error.message.slice(0, 160) : 'The next action could not be created.';
  }

  steps.nextAction = task ? 'DONE' : 'FAILED';

  return {
    ok: true,
    replayed: false,
    leadId,
    lvLeadId: created.lvLeadId,
    ownerId: finalOwnerId,
    ownerName: await memberName(delegated, finalOwnerId),
    assignment: { state: assignmentState, reason: assignmentReason, mode },
    task,
    taskError,
    steps,
  };
};

const memberName = async (delegated: CoreApiClient, memberId: string | null): Promise<string | null> => {
  if (!memberId) {
    return null;
  }

  try {
    const result = await delegated.query({ workspaceMember: { __args: { filter: { id: { eq: memberId } } }, name: { firstName: true, lastName: true } } });
    const name = (result as { workspaceMember?: { name?: { firstName?: string | null; lastName?: string | null } | null } | null }).workspaceMember?.name;

    return [name?.firstName, name?.lastName].filter(Boolean).join(' ') || null;
  } catch {
    return null;
  }
};

export default defineLogicFunction({
  universalIdentifier: FN_CAPTURE_CREATE_ID,
  name: 'lv-capture-create',
  description: 'Creates the reviewed lead idempotently as the caller, records the duplicate and classification decisions, reports the assignment and creates the first next action',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: { path: '/capture/create', httpMethod: 'POST', isAuthRequired: true },
});
