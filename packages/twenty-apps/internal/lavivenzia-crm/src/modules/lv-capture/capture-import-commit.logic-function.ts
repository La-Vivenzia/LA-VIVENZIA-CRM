import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_CAPTURE_IMPORT_COMMIT_ID } from 'src/constants/universal-identifiers';
import { listMembers, resolveImportRows } from 'src/modules/lv-capture/capture-import.logic-function';
import { upsertBatch } from 'src/modules/lv-capture/services/import-batch';
import { isCaptureKey } from 'src/modules/lv-capture/services/capture-request';
import { type CaptureProvenance, createCapturedLead, findLeadByCaptureKey, notifyOwnerAssignedAtCapture } from 'src/modules/lv-capture/services/capture-service';
import { toCaptureInput } from 'src/modules/lv-capture/services/import-service';
import { buildLeadDraft } from 'src/modules/lv-capture/utils/build-lead-draft';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';
import { resolveCaller } from 'src/modules/lv-dashboard/services/caller-context';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// POST /capture/import/commit { importKey, mapping, decisions: [{ rowNumber, decision }] }   ← the screen
// POST /capture/import/commit { importKey, rows: [{ rowNumber, fields, decision: 'CREATE' | 'SKIP' }] }  ← API / tests
//
// IMPORT: creates the rows the employee accepted, one lead each, as the
// caller. Every lead carries captureKey `${importKey}:${rowNumber}`, so a
// retried commit creates nothing twice. Owners named in the file are applied
// only when the caller is an administrator (the manual-assignment policy);
// otherwise the assignment engine routes each lead through the ordinary
// lvLead.created path, which also allocates LV IDs, classifies and starts
// SLAs. The report says per row what happened.

type Input = { importKey?: unknown; rows?: unknown; mapping?: unknown; decisions?: unknown; mode?: unknown };

const PUNE_PILOT_SANDBOX_IMPORT_KEY = '7f9c2d18-3a81-4b72-9b04-8e1c64df3310';

const isSandboxFixtureRow = (fields: Record<string, unknown>): boolean => {
  const email = typeof fields.email === 'string' ? fields.email.toLowerCase() : '';
  const name = typeof fields.name === 'string' ? fields.name.toLowerCase() : '';
  const website = typeof fields.websiteUrl === 'string' ? fields.websiteUrl.toLowerCase() : '';
  const org = typeof fields.organisationName === 'string' ? fields.organisationName.toLowerCase() : '';
  const notes = typeof fields.notes === 'string' ? fields.notes.toLowerCase() : '';
  return (
    email.includes('sandbox.lavivenzia.internal') ||
    website.includes('sandbox.lavivenzia.internal') ||
    name.includes('[sandbox]') ||
    name.includes('[pune pilot sandbox]') ||
    org.includes('[sandbox]') ||
    notes.includes('sandbox lead')
  );
};

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can import leads.' };
  }

  if (!isCaptureKey(input.importKey)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'importKey must be a UUID.' };
  }

  // Reject standard imports that supply the reserved sandbox UUID before any database reads or writes
  if (input.importKey === PUNE_PILOT_SANDBOX_IMPORT_KEY && input.mode !== 'SANDBOX') {
    return {
      ok: false,
      refusal: 'INVALID_INPUT',
      error: 'The reserved sandbox import key cannot be used for standard imports.',
    };
  }

  const application = new CoreApiClient({ runAs: 'application' });
  const resolved = await resolveImportRows(application, input.importKey, input);

  if (!resolved.ok) {
    return { ok: false, refusal: 'INVALID_INPUT', error: resolved.error };
  }

  const { rows, mapping } = resolved;

  // Validate sandbox mode requirements against server-side fixture criteria
  if (input.mode === 'SANDBOX') {
    if (input.importKey !== PUNE_PILOT_SANDBOX_IMPORT_KEY) {
      return {
        ok: false,
        refusal: 'INVALID_INPUT',
        error: 'Sandbox import mode requires the designated Pune pilot sandbox import key.',
      };
    }

    if (input.mapping !== undefined || mapping !== null) {
      return {
        ok: false,
        refusal: 'INVALID_INPUT',
        error: 'Sandbox import mode cannot be used with uploaded CSV file mapping.',
      };
    }

    if (rows.length === 0 || !rows.every((row) => isSandboxFixtureRow(row.fields))) {
      return {
        ok: false,
        refusal: 'INVALID_INPUT',
        error: 'Sandbox import mode requires verified sandbox fixture records.',
      };
    }
  }

  // Decisions ride on the rows themselves (API shape) or come as a separate
  // list (screen shape). A row with no decision is skipped — never created
  // by default.
  const decisions = new Map<number, 'CREATE' | 'SKIP'>();
  const decisionSource = Array.isArray(input.decisions) ? input.decisions : Array.isArray(input.rows) ? input.rows : [];

  decisionSource.forEach((row, index) => {
    const source = typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};
    const rowNumber = typeof source.rowNumber === 'number' ? source.rowNumber : index + 2;

    decisions.set(rowNumber, source.decision === 'CREATE' ? 'CREATE' : 'SKIP');
  });

  const delegated = new CoreApiClient();
  const now = new Date().toISOString();
  const caller = await resolveCaller(new DelegatedGraphqlClient());

  const isSandboxImport =
    input.mode === 'SANDBOX' ||
    input.importKey === PUNE_PILOT_SANDBOX_IMPORT_KEY ||
    rows.some((row) => isSandboxFixtureRow(row.fields));

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.LV_ENVIRONMENT === 'production' ||
    process.env.STAGE === 'production' ||
    process.env.STAGE === 'prod';

  if (isSandboxImport && isProduction && !caller.isAdmin) {
    return {
      ok: false,
      refusal: 'FORBIDDEN',
      error: 'Sandbox fixture lead import is restricted to administrators in production environments.',
    };
  }

  const members = await listMembers(delegated);
  const report: { rowNumber: number; status: 'CREATED' | 'SKIPPED' | 'EXISTS' | 'ERROR'; leadId: string | null; lvLeadId: string | null; error: string | null; ownerApplied: boolean }[] = [];
  let ownerWarnings = 0;

  for (const row of rows) {
    if (decisions.get(row.rowNumber) === 'SKIP') {
      report.push({ rowNumber: row.rowNumber, status: 'SKIPPED', leadId: null, lvLeadId: null, error: null, ownerApplied: false });
      continue;
    }

    const { input: captureInput, ownerId, errors } = toCaptureInput(row.fields, members);
    const built = buildLeadDraft(captureInput);

    if (!built.ok || errors.length > 0) {
      report.push({ rowNumber: row.rowNumber, status: 'ERROR', leadId: null, lvLeadId: null, error: [...errors, ...(built.ok ? [] : built.errors)][0] ?? 'Invalid row.', ownerApplied: false });
      continue;
    }

    // A named owner is a manual assignment; only an administrator may make
    // one on a colleague's behalf. Anyone may import into their own name.
    const applyOwner = ownerId !== null && (caller.isAdmin || ownerId === actorWorkspaceMemberId);

    if (ownerId !== null && !applyOwner) {
      ownerWarnings += 1;
    }

    const captureKey = `${input.importKey}:${row.rowNumber}`;
    const provenance: CaptureProvenance = {
      method: 'IMPORT',
      platform: null,
      originalUrl: null,
      originalHandle: null,
      capturedAt: now,
      capturedById: actorWorkspaceMemberId,
      extraction: { status: 'NOT_APPLICABLE', kind: null, runId: null, fieldCount: 0 },
      classification: { status: built.draft.category ? 'MANUAL' : 'NOT_RUN', runId: null },
      verification: 'CONFIRMED_BY_PERSON',
      duplicateDecision: { decision: 'NONE', candidateLeadIds: [] },
      captureKey,
    };

    // Import keys are not UUIDs; the unique column accepts any text.
    const existing = await findLeadByCaptureKey(application, captureKey);

    if (existing) {
      report.push({ rowNumber: row.rowNumber, status: 'EXISTS', leadId: existing.id, lvLeadId: existing.lvLeadId, error: null, ownerApplied: false });
      continue;
    }

    const created = await createCapturedLead({ delegated, application, draft: built.draft, provenance, ownerId: applyOwner ? ownerId : null, attachment: null, actorWorkspaceMemberId, now });

    if (created.ok && !created.replayed && applyOwner && ownerId !== null) {
      await notifyOwnerAssignedAtCapture({ application, leadId: created.leadId, leadName: built.draft.name, ownerId, priority: built.draft.priority, actorWorkspaceMemberId, now, sourceEvent: 'lv-capture-import' }).catch(() => 0);
    }

    report.push(
      created.ok
        ? { rowNumber: row.rowNumber, status: created.replayed ? 'EXISTS' : 'CREATED', leadId: created.leadId, lvLeadId: created.lvLeadId, error: null, ownerApplied: applyOwner }
        : { rowNumber: row.rowNumber, status: 'ERROR', leadId: null, lvLeadId: null, error: created.error, ownerApplied: false },
    );
  }

  const summary = {
    total: rows.length,
    created: report.filter((row) => row.status === 'CREATED').length,
    skipped: report.filter((row) => row.status === 'SKIPPED').length,
    existing: report.filter((row) => row.status === 'EXISTS').length,
    errors: report.filter((row) => row.status === 'ERROR').length,
    ownerWarnings,
  };

  if (mapping !== null) {
    await upsertBatch(application, input.importKey, { status: summary.errors === rows.length ? 'FAILED' : 'IMPORTED', report: { summary, rows: report } }).catch(() => null);
  }

  await writeAuditEvent(application, {
    action: summary.errors === rows.length ? 'IMPORT_FAILED' : 'IMPORT_COMPLETED',
    outcome: summary.errors === rows.length ? 'FAILED' : 'APPLIED',
    targetObject: 'lvImport',
    targetRecordId: input.importKey,
    targetLabel: `CSV import · ${summary.created} created`,
    actorWorkspaceMemberId,
    at: now,
    reason: null,
    metadata: summary,
  });

  return { ok: true, importKey: input.importKey, report, summary, note: ownerWarnings > 0 ? `${ownerWarnings} row(s) named an owner; only an administrator can assign on a colleague's behalf, so the assignment engine routed them.` : null };
};

export default defineLogicFunction({
  universalIdentifier: FN_CAPTURE_IMPORT_COMMIT_ID,
  name: 'lv-capture-import-commit',
  description: 'Creates the accepted rows of a CSV import as the caller, idempotently per row; the created leads flow through the normal ID / assignment / SLA path',
  timeoutSeconds: 300,
  handler,
  httpRouteTriggerSettings: { path: '/capture/import/commit', httpMethod: 'POST', isAuthRequired: true },
});
