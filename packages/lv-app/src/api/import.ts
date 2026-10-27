import { useCallback, useMemo, useState } from 'react';

import { callRoute } from 'src/api/client';
import { uploadToFilesField } from 'src/api/files';
import { PUNE_PILOT_SANDBOX_IMPORT_KEY, punePilotSandboxRows } from 'src/fixtures/pune-pilot-sandbox';

// Bringing in a spreadsheet of leads.
//
//   SELECT ─▶ UPLOADING ─▶ ANALYSING ─▶ MAP ─▶ VALIDATING ─▶ REVIEW ─▶ IMPORTING ─▶ RESULT
//
// Three routes stand behind it and only the last one writes a lead:
//   /capture/import/inspect   reads the uploaded file back, parses it and
//                             proposes a column mapping — writes no leads;
//   /capture/import/validate  runs every row through the same draft builder a
//                             single capture uses, checks the taxonomy, the
//                             owners and the duplicates, and returns a report
//                             — writes no leads;
//   /capture/import/commit    creates the rows that were accepted, one lead
//                             each, idempotent by importKey and row number.
//
// The file itself never reaches a route as bytes. It is uploaded into the
// import batch's own FILES field and each route reads it back from this
// server, so every step sees exactly the same rows.

/** Mirrors `utils/import-mapping.ts` on the server, labels included. */
export const IMPORT_TARGETS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'organisationName', label: 'Organisation', required: false },
  { key: 'jobTitle', label: 'Job title', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'websiteUrl', label: 'Website', required: false },
  { key: 'instagramHandle', label: 'Instagram', required: false },
  { key: 'socialProfileUrl', label: 'Social profile', required: false },
  { key: 'location', label: 'Location', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'subcategory', label: 'Subcategory', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'languages', label: 'Languages', required: false },
  { key: 'owner', label: 'Owner (email or name)', required: false },
  { key: 'notes', label: 'Notes', required: false },
] as const;

export type ImportTargetKey = (typeof IMPORT_TARGETS)[number]['key'];

export const TARGET_LABEL: Record<string, string> = Object.fromEntries(IMPORT_TARGETS.map((target) => [target.key, target.label]));

/** `MAX_IMPORT_BYTES` in `services/import-batch.ts`. The route reads no further. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** `MAX_IMPORT_ROWS` in `services/import-batch.ts`. Rows past it are not read. */
export const MAX_IMPORT_ROWS = 2_000;

/**
 * What the file picker offers. The parser detects its delimiter from the
 * header line — comma, semicolon, tab or pipe — so a tab-separated export
 * reads as well as a comma-separated one. Nothing here is a rule: the server
 * judges the contents, not the extension.
 */
export const IMPORT_ACCEPT = '.csv,.tsv,.txt,text/csv,text/tab-separated-values';

export type ImportPhase = 'SELECT' | 'UPLOADING' | 'ANALYSING' | 'MAP' | 'VALIDATING' | 'REVIEW' | 'IMPORTING' | 'RESULT';

export type ImportRowStatus = 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE';

export type ImportDraft = {
  name: string;
  organisationName: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  location: string | null;
  category: string | null;
  subcategory: string | null;
  source: string | null;
  priority: string | null;
  completeness: number | null;
};

export type ImportRow = {
  rowNumber: number;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  draft: ImportDraft | null;
  ownerId: string | null;
  /** An earlier row in the same file carrying the same identity. */
  duplicateOfRow: number | null;
  /** A lead already in the CRM that this row looks like. */
  duplicateOf: { leadId: string; lvLeadId: string | null; name: string | null; percent: number; matchingFields: string[] } | null;
};

export type ImportSummary = { total: number; valid: number; warnings: number; errors: number; duplicates: number };

export type ImportReportRow = {
  rowNumber: number;
  status: 'CREATED' | 'SKIPPED' | 'EXISTS' | 'ERROR';
  leadId: string | null;
  lvLeadId: string | null;
  error: string | null;
  ownerApplied: boolean;
};

export type ImportReportSummary = { total: number; created: number; skipped: number; existing: number; errors: number; ownerWarnings: number };

export type ImportDecision = 'CREATE' | 'SKIP';

export type ColumnMapping = Record<number, ImportTargetKey | null>;

const uuid = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = (Math.random() * 16) | 0;

        return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
      });

export const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * What stops the mapping step going forward. The server needs enough of an
 * identity to build a lead out of a row; the same rule runs there, so this is
 * early feedback rather than a second opinion.
 */
export const mappingProblems = (mapping: ColumnMapping): string[] => {
  const targets = Object.values(mapping).filter((target): target is ImportTargetKey => target !== null);
  const identifies = targets.some(
    (target) => target === 'name' || target === 'organisationName' || target === 'websiteUrl' || target === 'instagramHandle' || target === 'email',
  );

  return identifies ? [] : ['Map at least a Name, Organisation, Website, Instagram or Email column so each row can be identified.'];
};

export const useImport = () => {
  // One key for the whole import. Every lead created carries the import key
  // and its row number, so a retried commit returns what already exists
  // rather than a second copy of it.
  const [importKey, setImportKey] = useState(uuid);
  const [phase, setPhase] = useState<ImportPhase>('SELECT');
  const [error, setError] = useState<string | null>(null);
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);

  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  /** The real fraction of bytes sent, from the browser. Null until it reports. */
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [sample, setSample] = useState<string[][]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [skippedEmptyRows, setSkippedEmptyRows] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [mapping, setMappingState] = useState<ColumnMapping>({});

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [decisions, setDecisions] = useState<Record<number, ImportDecision>>({});

  const [report, setReport] = useState<ImportReportRow[]>([]);
  const [reportSummary, setReportSummary] = useState<ImportReportSummary | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const reset = useCallback(() => {
    setImportKey(uuid());
    setPhase('SELECT');
    setError(null);
    setIsSandboxLoading(false);
    setFileName(null);
    setFileSize(null);
    setUploadFraction(null);
    setHeaders([]);
    setSample([]);
    setRowCount(0);
    setSkippedEmptyRows(0);
    setTruncated(false);
    setMappingState({});
    setRows([]);
    setSummary(null);
    setDuplicateError(null);
    setMembers([]);
    setDecisions({});
    setReport([]);
    setReportSummary(null);
    setNote(null);
  }, []);

  /** Upload the file, then have the server read it back and propose a mapping. */
  const selectFile = useCallback(
    async (file: File) => {
      if (file.size === 0) {
        setError('That file is empty.');

        return;
      }

      if (file.size > MAX_IMPORT_BYTES) {
        setError(
          `That file is ${formatBytes(file.size)}. The import reads up to ${formatBytes(MAX_IMPORT_BYTES)}, so split it and bring it in as more than one file.`,
        );

        return;
      }

      setError(null);
      setFileName(file.name);
      setFileSize(file.size);
      setUploadFraction(null);
      setPhase('UPLOADING');

      try {
        const uploaded = await uploadToFilesField(file, {
          objectNameSingular: 'lvImportBatch',
          fieldName: 'file',
          onProgress: setUploadFraction,
        });

        setPhase('ANALYSING');

        const inspected = await callRoute<{
          fileName?: string;
          headers?: string[];
          sample?: string[][];
          rowCount?: number;
          skippedEmptyRows?: number;
          truncated?: boolean;
          mapping?: ColumnMapping;
        }>('/capture/import/inspect', {
          importKey,
          file: { fileId: uploaded.fileId, url: uploaded.url, name: uploaded.name, mimeType: uploaded.mimeType, size: uploaded.size },
        });

        setFileName(inspected.fileName ?? file.name);
        setHeaders(inspected.headers ?? []);
        setSample(inspected.sample ?? []);
        setRowCount(inspected.rowCount ?? 0);
        setSkippedEmptyRows(inspected.skippedEmptyRows ?? 0);
        setTruncated(inspected.truncated === true);
        setMappingState(inspected.mapping ?? {});
        setPhase('MAP');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'That file could not be read.');
        setPhase('SELECT');
      }
    },
    [importKey],
  );

  /** One target per column: taking a target from another column frees it. */
  const setColumn = useCallback((column: number, target: ImportTargetKey | null) => {
    setMappingState((current) => {
      const next: ColumnMapping = { ...current };

      for (const [other, assigned] of Object.entries(next)) {
        if (target !== null && assigned === target && Number(other) !== column) {
          next[Number(other)] = null;
        }
      }

      next[column] = target;

      return next;
    });
    setError(null);
  }, []);

  const validate = useCallback(async () => {
    const problems = mappingProblems(mapping);

    if (problems.length > 0) {
      setError(problems[0]);

      return;
    }

    setPhase('VALIDATING');
    setError(null);

    try {
      const result = await callRoute<{
        rows?: ImportRow[];
        summary?: ImportSummary;
        duplicateError?: string | null;
        members?: { id: string; name: string }[];
      }>('/capture/import/validate', { importKey, mapping });

      const validated = result.rows ?? [];

      setRows(validated);
      setSummary(result.summary ?? null);
      setDuplicateError(result.duplicateError ?? null);
      setMembers(result.members ?? []);
      // Anything the server could not build, and anything that looks like a
      // lead already here, starts as "do not create". Nothing arrives by
      // accident; a duplicate comes in only by saying so.
      setDecisions(
        Object.fromEntries(validated.map((row) => [row.rowNumber, row.status === 'ERROR' || row.status === 'DUPLICATE' ? 'SKIP' : 'CREATE'])),
      );
      setPhase('REVIEW');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The rows could not be checked.');
      setPhase('MAP');
    }
  }, [importKey, mapping]);

  // A row the server refused cannot be forced through: the commit route would
  // refuse it again, row by row, so the decision is not offered.
  const decide = useCallback(
    (rowNumber: number, decision: ImportDecision) => {
      if (rows.find((row) => row.rowNumber === rowNumber)?.status === 'ERROR') {
        return;
      }

      setDecisions((existing) => ({ ...existing, [rowNumber]: decision }));
    },
    [rows],
  );

  /** Applies one decision to every row of a status, for a long file. */
  const decideAll = useCallback(
    (status: ImportRowStatus, decision: ImportDecision) => {
      if (status === 'ERROR') {
        return;
      }

      setDecisions((existing) => {
        const next = { ...existing };

        for (const row of rows) {
          if (row.status === status) {
            next[row.rowNumber] = decision;
          }
        }

        return next;
      });
    },
    [rows],
  );

  const commit = useCallback(async () => {
    setPhase('IMPORTING');
    setError(null);

    try {
      // A decision is sent for every validated row. The commit route creates
      // a row it was told nothing about, so silence is never an option.
      const payload = rows.map((row) => ({
        rowNumber: row.rowNumber,
        decision: row.status === 'ERROR' ? 'SKIP' : (decisions[row.rowNumber] ?? 'SKIP'),
      }));

      const result = await callRoute<{ report?: ImportReportRow[]; summary?: ImportReportSummary; note?: string | null }>('/capture/import/commit', {
        importKey,
        mapping,
        decisions: payload,
      });

      setReport(result.report ?? []);
      setReportSummary(result.summary ?? null);
      setNote(result.note ?? null);
      setPhase('RESULT');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import did not run.');
      setPhase('REVIEW');
    }
  }, [decisions, importKey, mapping, rows]);

  /**
   * One-action load of the Pune Pilot Sandbox dataset.
   *
   * Submits the 12 deterministic fictional records directly to the commit endpoint
   * using the deterministic PUNE_PILOT_SANDBOX_IMPORT_KEY to guarantee idempotency.
   */
  const loadSandbox = useCallback(async () => {
    if (isSandboxLoading) {
      return;
    }

    setIsSandboxLoading(true);
    setError(null);
    setFileName('Pune Pilot Sandbox');
    setPhase('IMPORTING');

    try {
      const sandboxRows = punePilotSandboxRows();
      const payload = sandboxRows.map((row) => ({
        rowNumber: row.rowNumber,
        fields: row.fields,
        decision: 'CREATE' as ImportDecision,
      }));

      const result = await callRoute<{
        report?: ImportReportRow[];
        summary?: ImportReportSummary;
        note?: string | null;
      }>('/capture/import/commit', {
        importKey: PUNE_PILOT_SANDBOX_IMPORT_KEY,
        rows: payload,
      });

      setImportKey(PUNE_PILOT_SANDBOX_IMPORT_KEY);
      setRowCount(sandboxRows.length);
      setReport(result.report ?? []);
      setReportSummary(
        result.summary ?? {
          total: sandboxRows.length,
          created: (result.report ?? []).filter((r) => r.status === 'CREATED').length,
          skipped: (result.report ?? []).filter((r) => r.status === 'SKIPPED').length,
          existing: (result.report ?? []).filter((r) => r.status === 'EXISTS').length,
          errors: (result.report ?? []).filter((r) => r.status === 'ERROR').length,
          ownerWarnings: 0,
        },
      );
      setNote(result.note ?? null);
      setPhase('RESULT');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The sandbox import did not run.');
      setPhase('SELECT');
    } finally {
      setIsSandboxLoading(false);
    }
  }, [isSandboxLoading]);

  /** How many leads the button is about to create — the real number, always. */
  const willCreate = useMemo(() => {
    if (rows.length > 0) {
      return rows.filter((row) => row.status !== 'ERROR' && decisions[row.rowNumber] === 'CREATE').length;
    }
    return rowCount;
  }, [decisions, rowCount, rows]);

  const mappedTargets = useMemo(() => Object.values(mapping).filter((target): target is ImportTargetKey => target !== null), [mapping]);

  return {
    importKey,
    phase,
    error,
    isSandboxLoading,
    fileName,
    fileSize,
    uploadFraction,
    headers,
    sample,
    rowCount,
    skippedEmptyRows,
    truncated,
    mapping,
    mappedTargets,
    rows,
    summary,
    duplicateError,
    members,
    decisions,
    report,
    reportSummary,
    note,
    willCreate,
    problems: mappingProblems(mapping),
    setPhase,
    selectFile,
    setColumn,
    validate,
    decide,
    decideAll,
    commit,
    loadSandbox,
    reset,
    dismissError: () => setError(null),
  };
};

export type ImportState = ReturnType<typeof useImport>;
