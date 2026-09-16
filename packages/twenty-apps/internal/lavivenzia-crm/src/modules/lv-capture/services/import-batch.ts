import { type CoreApiClient } from 'twenty-client-sdk/core';

import { fetchOwnFile } from 'src/modules/lv-capture/services/extraction';
import { type ImportRowInput } from 'src/modules/lv-capture/services/import-service';
import { parseCsv } from 'src/modules/lv-capture/utils/csv';
import { type ColumnMapping, IMPORT_TARGETS, type ImportTargetKey, rowToFields } from 'src/modules/lv-capture/utils/import-mapping';

// The server side of a CSV import. The capture screen cannot read the file
// it was handed (CM-006), so it uploads the CSV into an lvImportBatch's FILES
// field and every step here reads the file back from this server's own
// signed URL, parses it, and applies the mapping the person chose. The batch
// row is the durable record of the import (file, mapping, summary, report).

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2_000;

export type ImportBatch = {
  id: string;
  name: string | null;
  importKey: string | null;
  status: string | null;
  rowCount: number | null;
  mapping: ColumnMapping | null;
  summary: Record<string, unknown> | null;
  report: Record<string, unknown> | null;
  file: { fileId: string; label?: string | null; url?: string | null }[] | null;
  importedById: string | null;
};

const BATCH_FIELDS = { id: true, name: true, importKey: true, status: true, rowCount: true, mapping: true, summary: true, report: true, file: true, importedById: true } as const;

export const findBatch = async (application: CoreApiClient, importKey: string): Promise<ImportBatch | null> => {
  const result = await application.query({ lvImportBatches: { __args: { first: 1, filter: { importKey: { eq: importKey } } }, edges: { node: BATCH_FIELDS } } });
  const node = (result as { lvImportBatches?: { edges?: { node?: ImportBatch }[] } }).lvImportBatches?.edges?.[0]?.node;

  return node ?? null;
};

export const upsertBatch = async (application: CoreApiClient, importKey: string, data: Partial<Omit<ImportBatch, 'id'>>): Promise<ImportBatch> => {
  const existing = await findBatch(application, importKey);

  if (existing) {
    const updated = await application.mutation({ updateLvImportBatch: { __args: { id: existing.id, data }, ...BATCH_FIELDS } });

    return (updated as { updateLvImportBatch: ImportBatch }).updateLvImportBatch;
  }

  const created = await application.mutation({ createLvImportBatch: { __args: { data: { importKey, ...data } }, ...BATCH_FIELDS } });

  return (created as { createLvImportBatch: ImportBatch }).createLvImportBatch;
};

// The column mapping as the screen sends it: { "<column index>": "<target>" | null }.
export const readMapping = (value: unknown): ColumnMapping | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const allowed = new Set<string>(IMPORT_TARGETS.map((target) => target.key));
  const mapping: ColumnMapping = {};
  const seen = new Set<string>();

  for (const [column, target] of Object.entries(value as Record<string, unknown>)) {
    const index = Number(column);

    if (!Number.isInteger(index) || index < 0 || index > 200) {
      continue;
    }

    if (target === null) {
      mapping[index] = null;
    } else if (typeof target === 'string' && allowed.has(target) && !seen.has(target)) {
      mapping[index] = target as ImportTargetKey;
      seen.add(target);
    }
  }

  return mapping;
};

export type ParsedImportFile = { headers: string[]; rows: string[][]; skippedEmptyRows: number };

// Reads the batch's CSV back from this server and parses it.
export const readBatchFile = async (batch: ImportBatch): Promise<{ ok: true; parsed: ParsedImportFile } | { ok: false; error: string }> => {
  const url = batch.file?.[0]?.url ?? null;

  if (!url) {
    return { ok: false, error: 'The import file is no longer attached to this batch.' };
  }

  const fetched = await fetchOwnFile(url, { maxBytes: MAX_IMPORT_BYTES });

  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }

  const text = fetched.bytes.toString('utf8');
  const parsed = parseCsv(text, { maxRows: MAX_IMPORT_ROWS });

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { ok: false, error: 'That file has no header row or no data rows.' };
  }

  return { ok: true, parsed };
};

// Rows numbered as in the spreadsheet (header = 1), mapped to capture fields.
export const rowsFromFile = (parsed: ParsedImportFile, mapping: ColumnMapping): ImportRowInput[] =>
  parsed.rows.map((row, index) => ({ rowNumber: index + 2, fields: rowToFields(parsed.headers, row, mapping) }));
