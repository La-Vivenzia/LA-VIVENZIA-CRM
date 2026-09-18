import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_CAPTURE_IMPORT_VALIDATE_ID } from 'src/constants/universal-identifiers';
import { delegatedClient } from 'src/modules/lv-ai/runtime/clients';
import { isCaptureKey } from 'src/modules/lv-capture/services/capture-request';
import { findBatch, readBatchFile, readMapping, rowsFromFile, upsertBatch } from 'src/modules/lv-capture/services/import-batch';
import { type ImportRowInput, type MemberDirectory, matchAgainstCrm, summarise, validateImportRows } from 'src/modules/lv-capture/services/import-service';
import { type ColumnMapping, IMPORT_TARGETS, type ImportTargetKey } from 'src/modules/lv-capture/utils/import-mapping';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';
import { writeAuditEvent } from 'src/modules/lv-governance/services/audit-log';

// POST /capture/import/validate { importKey, mapping }            ← the screen (file on the batch)
// POST /capture/import/validate { importKey, rows: [{ rowNumber, fields }] }  ← API / tests
//
// VALIDATE + DUPLICATE CHECK of a CSV import: every row through the capture
// draft builder, taxonomy and owner checks, duplicates within the file and
// against the leads the caller can see. Returns the report; writes nothing
// but the IMPORT_STARTED audit row. The employee decides per duplicate on
// the review screen; /capture/import/commit does the writing.

export const MAX_IMPORT_ROWS = 2_000;

type Input = { importKey?: unknown; rows?: unknown; mapping?: unknown };

export const listMembers = async (delegated: CoreApiClient): Promise<MemberDirectory> => {
  try {
    const result = await delegated.query({ workspaceMembers: { __args: { first: 200 }, edges: { node: { id: true, userEmail: true, name: { firstName: true, lastName: true } } } } });

    return ((result as { workspaceMembers?: { edges?: { node?: { id: string; userEmail?: string | null; name?: { firstName?: string | null; lastName?: string | null } | null } }[] } }).workspaceMembers?.edges ?? [])
      .map((edge) => edge.node)
      .filter((node): node is NonNullable<typeof node> => Boolean(node?.id))
      .map((node) => ({ id: node.id, name: [node.name?.firstName, node.name?.lastName].filter(Boolean).join(' ') || node.id, email: node.userEmail ?? null }));
  } catch {
    return [];
  }
};

export const readRows = (value: unknown): ImportRowInput[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IMPORT_ROWS) {
    return null;
  }

  const allowed = new Set<string>(IMPORT_TARGETS.map((target) => target.key));

  return value.map((row, index) => {
    const source = typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};
    const fields: Partial<Record<ImportTargetKey, string>> = {};
    const raw = typeof source.fields === 'object' && source.fields !== null ? (source.fields as Record<string, unknown>) : {};

    for (const [key, cell] of Object.entries(raw)) {
      if (allowed.has(key) && typeof cell === 'string' && cell.trim().length > 0) {
        fields[key as ImportTargetKey] = cell.trim().slice(0, 500);
      }
    }

    return { rowNumber: typeof source.rowNumber === 'number' ? source.rowNumber : index + 2, fields };
  });
};

// Rows come either inline (API callers, tests) or from the batch's uploaded
// file plus the mapping the person chose on the screen.
export const resolveImportRows = async (application: CoreApiClient, importKey: string, input: { rows?: unknown; mapping?: unknown }): Promise<{ ok: true; rows: ImportRowInput[]; mapping: ColumnMapping | null } | { ok: false; error: string }> => {
  if (input.rows !== undefined) {
    const rows = readRows(input.rows);

    return rows === null ? { ok: false, error: `rows must hold between 1 and ${MAX_IMPORT_ROWS} entries.` } : { ok: true, rows, mapping: null };
  }

  const mapping = readMapping(input.mapping);

  if (mapping === null) {
    return { ok: false, error: 'Send either rows or a column mapping for the uploaded file.' };
  }

  const batch = await findBatch(application, importKey);

  if (!batch) {
    return { ok: false, error: 'No uploaded file for this import. Upload the CSV first.' };
  }

  const file = await readBatchFile(batch);

  if (!file.ok) {
    return { ok: false, error: file.error };
  }

  const rows = rowsFromFile(file.parsed, mapping);

  return rows.length === 0 ? { ok: false, error: 'The file has no data rows.' } : { ok: true, rows, mapping };
};

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can import leads.' };
  }

  if (!isCaptureKey(input.importKey)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'importKey must be a UUID.' };
  }

  const delegated = new CoreApiClient();
  const application = new CoreApiClient({ runAs: 'application' });
  const now = new Date().toISOString();
  const resolved = await resolveImportRows(application, input.importKey, input);

  if (!resolved.ok) {
    return { ok: false, refusal: 'INVALID_INPUT', error: resolved.error };
  }

  const { rows, mapping } = resolved;
  const members = await listMembers(delegated);
  const { results, drafts } = validateImportRows(rows, members);
  let duplicateError: string | null = null;

  try {
    await matchAgainstCrm(delegatedClient(), results, drafts);
  } catch (error) {
    duplicateError = error instanceof Error ? error.message.slice(0, 160) : 'The duplicate check could not run.';
  }

  const summary = summarise(results);

  if (mapping !== null) {
    await upsertBatch(application, input.importKey, { mapping, status: 'VALIDATED', summary: { ...summary, duplicateError } }).catch(() => null);
  }

  await writeAuditEvent(application, {
    action: 'IMPORT_STARTED',
    outcome: 'APPLIED',
    targetObject: 'lvImport',
    targetRecordId: input.importKey,
    targetLabel: `CSV import · ${rows.length} rows`,
    actorWorkspaceMemberId,
    at: now,
    reason: null,
    metadata: { ...summary, duplicateError },
  });

  return { ok: true, importKey: input.importKey, rows: results, summary, duplicateError, members: members.map((member) => ({ id: member.id, name: member.name })) };
};

export default defineLogicFunction({
  universalIdentifier: FN_CAPTURE_IMPORT_VALIDATE_ID,
  name: 'lv-capture-import-validate',
  description: 'Validates CSV import rows (fields, taxonomy, owners, duplicates in the file and in the CRM) and returns the report; writes nothing',
  timeoutSeconds: 120,
  handler,
  httpRouteTriggerSettings: { path: '/capture/import/validate', httpMethod: 'POST', isAuthRequired: true },
});
