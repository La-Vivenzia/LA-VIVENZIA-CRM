import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_CAPTURE_IMPORT_INSPECT_ID } from 'src/constants/universal-identifiers';
import { isCaptureKey } from 'src/modules/lv-capture/services/capture-request';
import { fetchOwnFile } from 'src/modules/lv-capture/services/extraction';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, upsertBatch } from 'src/modules/lv-capture/services/import-batch';
import { parseCsv } from 'src/modules/lv-capture/utils/csv';
import { autoMapColumns } from 'src/modules/lv-capture/utils/import-mapping';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';

// POST /capture/import/inspect { importKey, file: { fileId, url, name, mimeType, size } }
//
// UPLOAD → MAP: the CSV the person just uploaded (into lvImportBatch.file) is
// read back from this server, parsed, and its columns auto-mapped so the
// screen can show the mapping step. Creates (or refreshes) the batch record
// so the file has a home and the import can be looked back at. Writes no
// leads.

type Input = { importKey?: unknown; file?: unknown };

const SAMPLE_ROWS = 3;

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (actorWorkspaceMemberId === null) {
    return { ok: false, refusal: 'NOT_AUTHENTICATED', error: 'Only a signed-in team member can import leads.' };
  }

  if (!isCaptureKey(input.importKey)) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'importKey must be a UUID.' };
  }

  const file = typeof input.file === 'object' && input.file !== null ? (input.file as Record<string, unknown>) : null;
  const fileId = file && typeof file.fileId === 'string' ? file.fileId : null;
  const url = file && typeof file.url === 'string' ? file.url : null;
  const name = file && typeof file.name === 'string' && file.name.trim().length > 0 ? file.name.trim().slice(0, 120) : 'import.csv';

  if (!fileId || !url) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'file must carry the fileId and url of a CSV uploaded through the CRM.' };
  }

  const fetched = await fetchOwnFile(url, { maxBytes: MAX_IMPORT_BYTES });

  if (!fetched.ok) {
    return { ok: false, refusal: 'INVALID_INPUT', error: fetched.error };
  }

  const parsed = parseCsv(fetched.bytes.toString('utf8'), { maxRows: MAX_IMPORT_ROWS });

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { ok: false, refusal: 'INVALID_INPUT', error: 'That file has no header row or no data rows.' };
  }

  const application = new CoreApiClient({ runAs: 'application' });
  const mapping = autoMapColumns(parsed.headers);

  try {
    await upsertBatch(application, input.importKey, { name, file: [{ fileId, label: name }], status: 'UPLOADED', rowCount: parsed.rows.length, mapping, importedById: actorWorkspaceMemberId });
  } catch (error) {
    return { ok: false, refusal: 'INVALID_INPUT', error: `The import could not be recorded (${error instanceof Error ? error.message.slice(0, 120) : 'unknown error'}).` };
  }

  return {
    ok: true,
    importKey: input.importKey,
    fileName: name,
    headers: parsed.headers,
    sample: parsed.rows.slice(0, SAMPLE_ROWS),
    rowCount: parsed.rows.length,
    skippedEmptyRows: parsed.skippedEmptyRows,
    truncated: parsed.rows.length >= MAX_IMPORT_ROWS,
    mapping,
  };
};

export default defineLogicFunction({
  universalIdentifier: FN_CAPTURE_IMPORT_INSPECT_ID,
  name: 'lv-capture-import-inspect',
  description: 'Reads an uploaded CSV back from this server, parses it and proposes a column mapping; records the import batch; writes no leads',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: { path: '/capture/import/inspect', httpMethod: 'POST', isAuthRequired: true },
});
