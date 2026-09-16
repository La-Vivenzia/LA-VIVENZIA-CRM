import { parseCsv } from 'src/modules/lv-capture/utils/csv';
import { autoMapColumns, type ColumnMapping, type ImportTargetKey, rowToFields } from 'src/modules/lv-capture/utils/import-mapping';

// The CSV import branch of capture:
//   UPLOAD ──▶ MAP ──▶ VALIDATING ──▶ REVIEW ──▶ IMPORTING ──▶ REPORT
//
// The file is uploaded through the platform (the sandbox cannot read it —
// CM-006) and parsed by the server (/capture/import/inspect); the screen
// only ever holds the headers, a few sample rows and the mapping.
// `loadCsv` (browser-side parsing) is kept for callers that do have the
// text, and for the unit tests of the mapping logic.

export type ImportPhase = 'UPLOAD' | 'MAP' | 'VALIDATING' | 'REVIEW' | 'IMPORTING' | 'REPORT';

export type ImportRowView = {
  rowNumber: number;
  status: 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE';
  errors: string[];
  warnings: string[];
  draft: { name: string; organisationName: string | null; email: string | null; phone: string | null; location: string | null; category: string | null } | null;
  duplicateOfRow: number | null;
  duplicateOf: { leadId: string; lvLeadId: string | null; name: string | null; percent: number; matchingFields: string[] } | null;
  // What the employee decided for a duplicate / warning row.
  decision: 'CREATE' | 'SKIP';
};

export type ImportState = {
  phase: ImportPhase;
  importKey: string;
  fileName: string | null;
  headers: string[];
  // Sample rows only when the server parsed the file; every row when the
  // text was parsed here.
  rows: string[][];
  rowCount: number;
  skippedEmptyRows: number;
  mapping: ColumnMapping;
  results: ImportRowView[];
  summary: { total: number; valid: number; warnings: number; errors: number; duplicates: number } | null;
  duplicateError: string | null;
  report: { rowNumber: number; status: 'CREATED' | 'SKIPPED' | 'EXISTS' | 'ERROR'; leadId: string | null; lvLeadId: string | null; error: string | null }[];
  reportSummary: { total: number; created: number; skipped: number; existing: number; errors: number; ownerWarnings: number } | null;
  note: string | null;
  error: string | null;
};

// The sandboxed renderer does not always expose crypto.randomUUID; the
// fallback still produces a well-formed v4 UUID (the routes validate the shape).
const hex = (count: number): string => Array.from({ length: count }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const newKey = (): string => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${hex(8)}-${hex(4)}-4${hex(3)}-${['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`);

export const initialImportState = (): ImportState => ({ phase: 'UPLOAD', importKey: newKey(), fileName: null, headers: [], rows: [], rowCount: 0, skippedEmptyRows: 0, mapping: {}, results: [], summary: null, duplicateError: null, report: [], reportSummary: null, note: null, error: null });

export const MAX_IMPORT_ROWS_CLIENT = 2_000;

export const loadCsv = (state: ImportState, fileName: string, text: string): ImportState => {
  const table = parseCsv(text, { maxRows: MAX_IMPORT_ROWS_CLIENT });

  if (table.headers.length === 0 || table.rows.length === 0) {
    return { ...state, error: 'That file has no header row or no data rows.' };
  }

  return { ...state, phase: 'MAP', fileName, headers: table.headers, rows: table.rows, rowCount: table.rows.length, skippedEmptyRows: table.skippedEmptyRows, mapping: autoMapColumns(table.headers), error: null };
};

// What /capture/import/inspect returns for the uploaded file.
export const applyInspect = (state: ImportState, result: { fileName: string; headers: string[]; sample: string[][]; rowCount: number; skippedEmptyRows: number; mapping: ColumnMapping }): ImportState => ({
  ...state,
  phase: 'MAP',
  fileName: result.fileName,
  headers: result.headers,
  rows: result.sample,
  rowCount: result.rowCount,
  skippedEmptyRows: result.skippedEmptyRows,
  mapping: result.mapping,
  error: null,
});

export const setMapping = (state: ImportState, column: number, target: ImportTargetKey | null): ImportState => {
  const mapping: ColumnMapping = { ...state.mapping };

  // One target per column: taking a target from another column frees it.
  for (const [other, current] of Object.entries(mapping)) {
    if (target !== null && current === target && Number(other) !== column) {
      mapping[Number(other)] = null;
    }
  }

  mapping[column] = target;

  return { ...state, mapping, error: null };
};

export const mappingProblems = (state: ImportState): string[] => {
  const targets = Object.values(state.mapping).filter((target): target is ImportTargetKey => target !== null);
  const problems: string[] = [];

  if (!targets.includes('name') && !targets.includes('organisationName') && !targets.includes('websiteUrl') && !targets.includes('instagramHandle') && !targets.includes('email')) {
    problems.push('Map at least a Name, Organisation, Website, Instagram or Email column so each row can be identified.');
  }

  return problems;
};

export const rowsForValidation = (state: ImportState): { rowNumber: number; fields: Partial<Record<ImportTargetKey, string>> }[] =>
  state.rows.map((row, index) => ({ rowNumber: index + 2, fields: rowToFields(state.headers, row, state.mapping) }));

export const applyValidation = (state: ImportState, result: { rows: Omit<ImportRowView, 'decision'>[]; summary: ImportState['summary']; duplicateError: string | null }): ImportState => ({
  ...state,
  phase: 'REVIEW',
  results: result.rows.map((row) => ({ ...row, decision: row.status === 'ERROR' || row.status === 'DUPLICATE' ? 'SKIP' : 'CREATE' })),
  summary: result.summary,
  duplicateError: result.duplicateError,
  error: null,
});

export const decideRow = (state: ImportState, rowNumber: number, decision: 'CREATE' | 'SKIP'): ImportState => ({ ...state, results: state.results.map((row) => (row.rowNumber === rowNumber && row.status !== 'ERROR' ? { ...row, decision } : row)) });

export const rowsForCommit = (state: ImportState): { rowNumber: number; fields: Partial<Record<ImportTargetKey, string>>; decision: 'CREATE' | 'SKIP' }[] => {
  const decisions = new Map(state.results.map((row) => [row.rowNumber, row.status === 'ERROR' ? 'SKIP' : row.decision] as const));

  return rowsForValidation(state).map((row) => ({ ...row, decision: decisions.get(row.rowNumber) ?? 'SKIP' }));
};

// The per-row decisions for the server-parsed path (the server re-reads the
// file and applies these; a row without a decision is skipped).
export const decisionsForCommit = (state: ImportState): { rowNumber: number; decision: 'CREATE' | 'SKIP' }[] => state.results.map((row) => ({ rowNumber: row.rowNumber, decision: row.status === 'ERROR' ? 'SKIP' : row.decision }));

export const applyReport = (state: ImportState, result: { report: ImportState['report']; summary: ImportState['reportSummary']; note: string | null }): ImportState => ({ ...state, phase: 'REPORT', report: result.report, reportSummary: result.summary, note: result.note, error: null });
