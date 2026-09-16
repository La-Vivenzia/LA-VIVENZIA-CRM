import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { AppPath, navigate, uploadFile } from 'twenty-sdk/front-component';

import {
  applyInspect,
  applyReport,
  applyValidation,
  decideRow,
  decisionsForCommit,
  type ImportRowView,
  type ImportState,
  initialImportState,
  mappingProblems,
  setMapping,
} from 'src/modules/lv-capture/front-components/capture-lead/import-state';
import { IMPORT_TARGETS, type ImportTargetKey } from 'src/modules/lv-capture/utils/import-mapping';
import { ActionBar, ErrorState, Eyebrow, Field, InlineNotice, KpiTile, LoadingState, LvBadge, LvButton, LvCard, LvSelect, LvTable, Segmented } from 'src/modules/lv-core/ui/kit';
import { type LvTheme } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { resolveFilesFieldMetadataId } from 'src/modules/lv-onboarding/front-components/onboarding-wizard/document-upload-field';

// CSV import: UPLOAD → MAP → VALIDATING → REVIEW → IMPORTING → REPORT.
// The file is uploaded through the platform into an import batch (the
// sandbox cannot read file bytes — CM-006) and parsed by the server; the
// person maps columns, decides duplicates and warnings row by row, and the
// commit route creates each accepted row through the same capture path a
// single lead uses (LV ID, assignment, audit, idempotent by import key +
// row).

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const STATUS_TONE: Record<ImportRowView['status'], 'success' | 'warning' | 'danger' | 'info'> = { VALID: 'success', WARNING: 'warning', ERROR: 'danger', DUPLICATE: 'info' };

const STATUS_LABEL: Record<ImportRowView['status'], string> = { VALID: 'Valid', WARNING: 'Warning', ERROR: 'Error', DUPLICATE: 'Duplicate' };

type Filter = 'ALL' | ImportRowView['status'];

export const ImportLeads = ({ theme }: { theme: LvTheme }) => {
  const [state, setState] = useState<ImportState>(initialImportState);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [uploading, setUploading] = useState(false);
  const [filesFieldId, setFilesFieldId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    void resolveFilesFieldMetadataId('lvImportBatch', 'file').then((id) => active && setFilesFieldId(id));

    return () => {
      active = false;
    };
  }, []);

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];

    if (!file) {
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setState((current) => ({ ...current, error: 'The file is larger than 2 MB. Split it and import in parts.' }));

      return;
    }

    setUploading(true);
    setState((current) => ({ ...current, error: null }));

    try {
      if (!filesFieldId) {
        throw new Error('The upload is not ready yet. Try again in a moment.');
      }

      const uploaded = await uploadFile(file, { fieldMetadataId: filesFieldId, fileName: file.name });

      if (uploaded.status !== 'uploaded') {
        throw new Error(`The upload did not complete (${uploaded.reason}). Check your connection and try again.`);
      }

      const inspected = (await callRoute('/capture/import/inspect', { importKey: state.importKey, file: { fileId: uploaded.file.fileId, url: uploaded.file.url, name: file.name, mimeType: file.type, size: file.size } })) as { ok: boolean; fileName?: string; headers?: string[]; sample?: string[][]; rowCount?: number; skippedEmptyRows?: number; mapping?: Record<number, ImportTargetKey | null> };

      setState((current) => applyInspect(current, { fileName: inspected.fileName ?? file.name, headers: inspected.headers ?? [], sample: inspected.sample ?? [], rowCount: inspected.rowCount ?? 0, skippedEmptyRows: inspected.skippedEmptyRows ?? 0, mapping: inspected.mapping ?? {} }));
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof Error ? error.message : 'The file could not be read.' }));
    } finally {
      setUploading(false);

      if (fileInput.current) {
        fileInput.current.value = '';
      }
    }
  };

  const validate = async () => {
    const problems = mappingProblems(state);

    if (problems.length > 0) {
      setState((current) => ({ ...current, error: problems[0]! }));

      return;
    }

    setState((current) => ({ ...current, phase: 'VALIDATING', error: null }));

    try {
      const result = (await callRoute('/capture/import/validate', { importKey: state.importKey, mapping: state.mapping })) as { ok: boolean; error?: string; rows?: Omit<ImportRowView, 'decision'>[]; summary?: ImportState['summary']; duplicateError?: string | null };

      if (!result.ok || !result.rows) {
        throw new Error(result.error ?? 'The rows could not be validated.');
      }

      setState((current) => applyValidation(current, { rows: result.rows!, summary: result.summary ?? null, duplicateError: result.duplicateError ?? null }));
      setFilter('ALL');
    } catch (error) {
      setState((current) => ({ ...current, phase: 'MAP', error: error instanceof Error ? error.message : 'The rows could not be validated.' }));
    }
  };

  const commit = async () => {
    setState((current) => ({ ...current, phase: 'IMPORTING', error: null }));

    try {
      const result = (await callRoute('/capture/import/commit', { importKey: state.importKey, mapping: state.mapping, decisions: decisionsForCommit(state) })) as { ok: boolean; error?: string; report?: ImportState['report']; summary?: ImportState['reportSummary']; note?: string | null };

      if (!result.ok || !result.report) {
        throw new Error(result.error ?? 'The import did not complete.');
      }

      setState((current) => applyReport(current, { report: result.report!, summary: result.summary ?? null, note: result.note ?? null }));
    } catch (error) {
      setState((current) => ({ ...current, phase: 'REVIEW', error: error instanceof Error ? error.message : 'The import did not complete.' }));
    }
  };

  const openLead = (leadId: string) => void navigate(AppPath.RecordShowPage, { objectNameSingular: 'lvLead', objectRecordId: leadId });

  const errorBlock = state.error ? (
    <div style={{ marginBottom: theme.space(3) }}>
      <ErrorState theme={theme} title="Could not continue" text={state.error} />
    </div>
  ) : null;

  // ---- UPLOAD ---------------------------------------------------------------
  if (state.phase === 'UPLOAD') {
    return (
      <>
        {errorBlock}
        <LvCard theme={theme}>
          <input ref={fileInput} id="lv-import-file" type="file" accept=".csv,text/csv,text/plain" onChange={(event: ChangeEvent<HTMLInputElement>) => void onFile(event.target.files)} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
          <label htmlFor="lv-import-file" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: theme.space(2), minHeight: 200, padding: theme.space(4), borderRadius: theme.radius.md, border: `2px dashed ${theme.color.borderStrong}`, background: theme.color.surfaceSunken, cursor: 'pointer', textAlign: 'center' }}>
            <span style={{ ...theme.type.subheading, color: theme.color.heading }}>Choose a CSV file</span>
            <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>First row = column names · up to 2,000 rows · 2 MB · comma, semicolon or tab separated</span>
          </label>
          <div style={{ marginTop: theme.space(3), display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
            <LvButton theme={theme} variant="primary" onClick={() => fileInput.current?.click()} busy={uploading}>
              Choose file
            </LvButton>
          </div>
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(3)}px 0 0` }}>
            Recognised columns: {IMPORT_TARGETS.map((target) => target.label).join(', ')}. Anything else can be mapped by hand on the next step.
          </p>
        </LvCard>
      </>
    );
  }

  // ---- MAP ---------------------------------------------------------------------
  if (state.phase === 'MAP' || state.phase === 'VALIDATING') {
    const problems = mappingProblems(state);
    const sample = state.rows[0] ?? [];

    return (
      <>
        {errorBlock}
        <LvCard theme={theme}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'baseline', marginBottom: theme.space(3) }}>
            <Eyebrow theme={theme}>Map columns</Eyebrow>
            <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>
              {state.fileName} · {state.rowCount} row{state.rowCount === 1 ? '' : 's'}
              {state.skippedEmptyRows > 0 ? ` · ${state.skippedEmptyRows} empty skipped` : ''}
            </span>
          </div>
          {state.phase === 'VALIDATING' ? (
            <LoadingState theme={theme} rows={4} label="Validating rows" />
          ) : (
            <div className="lv-field-grid">
              {state.headers.map((header, column) => (
                <Field key={`${header}-${column}`} theme={theme} label={header || `Column ${column + 1}`} htmlFor={`lv-import-map-${column}`} help={sample[column] ? `e.g. ${sample[column]!.slice(0, 40)}` : undefined}>
                  <LvSelect theme={theme} id={`lv-import-map-${column}`} value={state.mapping[column] ?? ''} onChange={(event) => setState((current) => setMapping(current, column, (event.target.value || null) as ImportTargetKey | null))}>
                    <option value="">Skip this column</option>
                    {IMPORT_TARGETS.map((target) => (
                      <option key={target.key} value={target.key}>
                        {target.label}
                      </option>
                    ))}
                  </LvSelect>
                </Field>
              ))}
            </div>
          )}
          {problems.length > 0 && state.phase === 'MAP' && (
            <div style={{ marginTop: theme.space(3) }}>
              <InlineNotice theme={theme} tone="warning">{problems[0]}</InlineNotice>
            </div>
          )}
          <div style={{ marginTop: theme.space(4) }}>
            <ActionBar theme={theme}>
              <LvButton theme={theme} variant="primary" onClick={() => void validate()} busy={state.phase === 'VALIDATING'} disabled={problems.length > 0}>
                Validate rows
              </LvButton>
              <LvButton theme={theme} variant="ghost" onClick={() => setState(initialImportState())} disabled={state.phase === 'VALIDATING'}>
                Choose another file
              </LvButton>
            </ActionBar>
          </div>
        </LvCard>
      </>
    );
  }

  // ---- REVIEW / IMPORTING ---------------------------------------------------------
  if (state.phase === 'REVIEW' || state.phase === 'IMPORTING') {
    const summary = state.summary ?? { total: 0, valid: 0, warnings: 0, errors: 0, duplicates: 0 };
    const visible = state.results.filter((row) => filter === 'ALL' || row.status === filter);
    const toCreate = state.results.filter((row) => row.status !== 'ERROR' && row.decision === 'CREATE').length;

    return (
      <>
        {errorBlock}
        {state.duplicateError && <InlineNotice theme={theme} tone="warning">Duplicate check against the CRM was skipped: {state.duplicateError}. Rows were still checked against each other.</InlineNotice>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: theme.space(2), margin: `${theme.space(3)}px 0` }}>
          <KpiTile theme={theme} label="Rows" value={summary.total} emptyText="0" />
          <KpiTile theme={theme} label="Valid" value={summary.valid} emptyText="0" tone="success" />
          <KpiTile theme={theme} label="Warnings" value={summary.warnings} emptyText="0" tone={summary.warnings > 0 ? 'warning' : undefined} />
          <KpiTile theme={theme} label="Errors" value={summary.errors} emptyText="0" tone={summary.errors > 0 ? 'danger' : undefined} />
          <KpiTile theme={theme} label="Duplicates" value={summary.duplicates} emptyText="0" tone={summary.duplicates > 0 ? 'info' : undefined} />
        </div>
        <LvCard theme={theme}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center', marginBottom: theme.space(3) }}>
            <Segmented theme={theme} label="Show rows" value={filter} onChange={(key) => setFilter(key as Filter)} options={[{ key: 'ALL', label: 'All', count: summary.total }, { key: 'VALID', label: 'Valid', count: summary.valid }, { key: 'WARNING', label: 'Warnings', count: summary.warnings }, { key: 'DUPLICATE', label: 'Duplicates', count: summary.duplicates }, { key: 'ERROR', label: 'Errors', count: summary.errors }]} />
            <div style={{ display: 'flex', gap: theme.space(1) }}>
              <LvButton theme={theme} size="sm" variant="ghost" onClick={() => setState((current) => current.results.reduce((acc, row) => (row.status === 'DUPLICATE' ? decideRow(acc, row.rowNumber, 'SKIP') : acc), current))}>
                Skip all duplicates
              </LvButton>
              <LvButton theme={theme} size="sm" variant="ghost" onClick={() => setState((current) => current.results.reduce((acc, row) => (row.status === 'DUPLICATE' ? decideRow(acc, row.rowNumber, 'CREATE') : acc), current))}>
                Create all duplicates
              </LvButton>
            </div>
          </div>
          {state.phase === 'IMPORTING' ? (
            <LoadingState theme={theme} rows={4} label="Importing" />
          ) : (
            <LvTable
              theme={theme}
              rows={visible}
              rowKey={(row) => String(row.rowNumber)}
              caption="Import rows"
              emptyText="No rows in this group."
              columns={[
                { key: 'row', label: '#', render: (row) => <span style={{ ...theme.type.mono }}>{row.rowNumber}</span>, width: '48px' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => (
                    <LvBadge theme={theme} tone={STATUS_TONE[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </LvBadge>
                  ),
                  width: '100px',
                },
                {
                  key: 'lead',
                  label: 'Lead',
                  render: (row) => (
                    <span style={{ display: 'block', minWidth: 0 }}>
                      <span style={{ display: 'block', color: theme.color.heading, fontWeight: theme.font.weight.medium }}>{row.draft?.name ?? '—'}</span>
                      <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{[row.draft?.organisationName, row.draft?.location, row.draft?.category].filter(Boolean).join(' · ')}</span>
                    </span>
                  ),
                },
                {
                  key: 'detail',
                  label: 'Detail',
                  render: (row) => (
                    <span style={{ ...theme.type.bodySmall, display: 'block', minWidth: 0 }}>
                      {row.errors.map((text) => (
                        <span key={text} style={{ display: 'block', color: theme.color.danger }}>
                          {text}
                        </span>
                      ))}
                      {row.warnings.map((text) => (
                        <span key={text} style={{ display: 'block', color: theme.color.warning }}>
                          {text}
                        </span>
                      ))}
                      {row.duplicateOfRow !== null && <span style={{ display: 'block', color: theme.color.info }}>Same as row {row.duplicateOfRow} in this file.</span>}
                      {row.duplicateOf && (
                        <span style={{ display: 'block', color: theme.color.info }}>
                          {row.duplicateOf.percent}% match with {row.duplicateOf.lvLeadId ?? 'an existing lead'} ({row.duplicateOf.name ?? 'unnamed'}; {row.duplicateOf.matchingFields.join(', ')}){' '}
                          <button type="button" onClick={() => openLead(row.duplicateOf!.leadId)} style={{ ...theme.type.bodySmall, background: 'none', border: 0, padding: 0, color: theme.color.brand, textDecoration: 'underline', cursor: 'pointer', fontFamily: theme.font.body }}>
                            Open
                          </button>
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  key: 'decision',
                  label: 'Action',
                  render: (row) =>
                    row.status === 'ERROR' ? (
                      <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>Skipped</span>
                    ) : (
                      <Segmented theme={theme} label={`Row ${row.rowNumber}`} value={row.decision} onChange={(key) => setState((current) => decideRow(current, row.rowNumber, key as 'CREATE' | 'SKIP'))} options={[{ key: 'CREATE', label: row.status === 'DUPLICATE' ? 'Create anyway' : 'Create' }, { key: 'SKIP', label: 'Skip' }]} />
                    ),
                  width: '220px',
                },
              ]}
            />
          )}
          <div style={{ marginTop: theme.space(4) }}>
            <ActionBar theme={theme}>
              <LvButton theme={theme} variant="primary" onClick={() => void commit()} busy={state.phase === 'IMPORTING'} disabled={toCreate === 0}>
                Import {toCreate} lead{toCreate === 1 ? '' : 's'}
              </LvButton>
              <LvButton theme={theme} variant="ghost" onClick={() => setState((current) => ({ ...current, phase: 'MAP', error: null }))} disabled={state.phase === 'IMPORTING'}>
                Back to mapping
              </LvButton>
            </ActionBar>
          </div>
        </LvCard>
      </>
    );
  }

  // ---- REPORT ------------------------------------------------------------------------
  const report = state.reportSummary ?? { total: 0, created: 0, skipped: 0, existing: 0, errors: 0, ownerWarnings: 0 };

  return (
    <>
      <LvCard theme={theme} tone={report.errors > 0 ? 'warning' : 'success'} as="section" ariaLabel="Import report">
        <Eyebrow theme={theme} tone={report.errors > 0 ? 'warning' : 'success'}>Import complete</Eyebrow>
        <p style={{ ...theme.type.title, margin: `${theme.space(1)}px 0 ${theme.space(3)}px`, color: theme.color.heading }}>
          {report.created} lead{report.created === 1 ? '' : 's'} created
          {report.existing > 0 ? `, ${report.existing} already existed` : ''}
          {report.skipped > 0 ? `, ${report.skipped} skipped` : ''}
          {report.errors > 0 ? `, ${report.errors} failed` : ''}.
        </p>
        {state.note && <InlineNotice theme={theme} tone="info">{state.note}</InlineNotice>}
        {report.ownerWarnings > 0 && (
          <div style={{ marginTop: theme.space(2) }}>
            <InlineNotice theme={theme} tone="warning">
              {report.ownerWarnings} row{report.ownerWarnings === 1 ? '' : 's'} named an owner you cannot assign to; those leads went through the assignment engine instead.
            </InlineNotice>
          </div>
        )}
        <div style={{ marginTop: theme.space(3) }}>
          <LvTable
            theme={theme}
            rows={state.report.filter((row) => row.status !== 'SKIPPED')}
            rowKey={(row) => String(row.rowNumber)}
            caption="Import report"
            emptyText="Nothing was imported."
            columns={[
              { key: 'row', label: '#', render: (row) => <span style={{ ...theme.type.mono }}>{row.rowNumber}</span>, width: '48px' },
              { key: 'status', label: 'Result', render: (row) => <LvBadge theme={theme} tone={row.status === 'CREATED' ? 'success' : row.status === 'EXISTS' ? 'info' : row.status === 'ERROR' ? 'danger' : 'neutral'}>{row.status === 'CREATED' ? 'Created' : row.status === 'EXISTS' ? 'Existing' : row.status === 'ERROR' ? 'Failed' : 'Skipped'}</LvBadge>, width: '100px' },
              { key: 'id', label: 'Lead', render: (row) => (row.leadId ? <button type="button" onClick={() => openLead(row.leadId!)} style={{ ...theme.type.bodySmall, background: 'none', border: 0, padding: 0, color: theme.color.brand, textDecoration: 'underline', cursor: 'pointer', fontFamily: theme.font.body }}>{row.lvLeadId ?? 'Open'}</button> : <span style={{ color: theme.color.textMuted }}>—</span>) },
              { key: 'error', label: 'Detail', render: (row) => <span style={{ ...theme.type.bodySmall, color: row.error ? theme.color.danger : theme.color.textMuted }}>{row.error ?? ''}</span> },
            ]}
          />
        </div>
        <div style={{ marginTop: theme.space(4), display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
          <LvButton theme={theme} variant="primary" onClick={() => void navigate(AppPath.RecordIndexPage, { objectNamePlural: 'lvLeads' })}>
            Open leads
          </LvButton>
          <LvButton theme={theme} variant="secondary" onClick={() => setState(initialImportState())}>
            Import another file
          </LvButton>
        </div>
      </LvCard>
    </>
  );
};
