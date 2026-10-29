import { useMemo, useState } from 'react';

import {
  formatBytes,
  IMPORT_ACCEPT,
  IMPORT_TARGETS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  SAMPLE_CSV_TEMPLATE,
  TARGET_LABEL,
  type ImportRow,
  type ImportRowStatus,
  type ImportState,
  type ImportTargetKey,
} from 'src/api/import';
import { PUNE_PILOT_SANDBOX_RECORDS, punePilotSandboxCsv } from 'src/fixtures/pune-pilot-sandbox';
import { PILOT_ZONE_LABELS } from 'src/domain/pilot-zones';
import { LvUploadItem, LvUploadZone } from 'src/design/documents';
import { LvBanner } from 'src/design/feedback';
import { LvIcon } from 'src/design/icons';
import {
  Disclosure,
  EmptyState,
  Field,
  InlineNotice,
  KpiTile,
  LvBadge,
  LvButton,
  LvCard,
  LvSelect,
  LvStageWait,
  Segmented,
  VisuallyHidden,
  type Tone,
} from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// The steps of a CSV import. Each is a real state of the three routes behind
// it; none invents a number, and the only percentage anywhere is the fraction
// of bytes the browser has actually sent.

const STATUS_TONE: Record<ImportRowStatus, Tone> = { VALID: 'success', WARNING: 'warning', DUPLICATE: 'info', ERROR: 'danger' };

const STATUS_LABEL: Record<ImportRowStatus, string> = { VALID: 'Ready', WARNING: 'Needs a look', DUPLICATE: 'Already here', ERROR: 'Cannot import' };

const sentence = (value: string | null | undefined): string => (value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '');

const plural = (count: number, one: string, many: string): string => `${count.toLocaleString()} ${count === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// 6.1 SELECT FILE — and the two waits that follow it
// ---------------------------------------------------------------------------

export const SelectStep = ({ theme, state }: { theme: LvTheme; state: ImportState }) => {
  const download = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'la-vivenzia-leads-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadSandboxCsv = () => {
    const blob = new Blob([punePilotSandboxCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'pune-pilot-sandbox-leads.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
  const isSandboxImportAllowed = !isProduction || import.meta.env.VITE_ENABLE_SANDBOX_IMPORT === 'true';

  return (
    <>
      {/* ------------------------------------------------------------------
          Pune Pilot Sandbox Card (hidden for ordinary production environments)
          ------------------------------------------------------------------ */}
      {isSandboxImportAllowed && (
        <LvSectionCard theme={theme} title="Pune Pilot Sandbox" icon="leads">
          <p style={{ ...theme.type.bodySmall, color: theme.color.text, margin: `0 0 ${theme.space(3)}px` }}>
            Evaluating the Pune pilot? Load 12 fictional sandbox venues across Amanora Mall, Seasons Mall,
            Magarpatta City, and Hadapsar with pre-classified pilot vibes (Gaming & Arcade, Brewery & Nightlife,
            Work Cafe, Luxury Spa, and Fine Dining).
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(3), marginBottom: theme.space(3) }}>
            <LvButton
              theme={theme}
              variant="primary"
              onClick={() => void state.loadSandbox()}
              disabled={state.isSandboxLoading}
              icon={<LvIcon name="leads" size={16} />}
            >
              {state.isSandboxLoading ? 'Loading sandbox leads…' : 'Load Pune Pilot Sandbox'}
            </LvButton>

            <LvButton
              theme={theme}
              variant="secondary"
              onClick={downloadSandboxCsv}
              icon={<LvIcon name="download" size={16} />}
            >
              Download Sandbox CSV
            </LvButton>
          </div>

          <InlineNotice theme={theme} tone="neutral">
            <strong>Fictional demo data only:</strong> All names, phone numbers, and emails are synthetic test records
            and will not contact real venues or overwrite existing customer records.
          </InlineNotice>

          <div style={{ marginTop: theme.space(3) }}>
            <Disclosure theme={theme} label="View the 12 sandbox venues" hint="4 zones · 5 vibes · 12 records">
              <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: `${theme.space(2)}px 0 0`, padding: 0, listStyle: 'none' }}>
                {PUNE_PILOT_SANDBOX_RECORDS.map((venue) => (
                  <li
                    key={venue.rowNumber}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.space(2),
                      padding: `${theme.space(2)}px 0`,
                      borderTop: `1px solid ${theme.color.border}`,
                      fontFamily: theme.font.body,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: theme.color.heading }}>{venue.name}</span>
                    <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
                      <LvBadge theme={theme} tone="info">{PILOT_ZONE_LABELS[venue.pilotZone]}</LvBadge>
                      <LvBadge theme={theme} tone="neutral">{sentence(venue.subcategory)}</LvBadge>
                    </div>
                  </li>
                ))}
              </ul>
            </Disclosure>
          </div>
        </LvSectionCard>
      )}

      <LvSectionCard theme={theme} title="Choose the file" icon="upload">
        <LvUploadZone
          theme={theme}
          label="Drop a spreadsheet here, or choose one"
          accept={IMPORT_ACCEPT}
          camera={false}
          onFiles={(files) => files[0] && void state.selectFile(files[0])}
          hint={`Comma, semicolon, tab or pipe separated. Up to ${formatBytes(MAX_IMPORT_BYTES)} and ${MAX_IMPORT_ROWS.toLocaleString()} rows in one file.`}
        />

        {/* Said before anything is picked, because the reassurance is only
            worth something while there is still a decision to make. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: theme.space(3),
            marginTop: theme.space(3),
          }}
        >
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0, flex: '1 1 280px' }}>
            Nothing is created by choosing a file. You will see every column, every row and every lead that already looks like one of them before anything is
            written.
          </p>
          <LvButton theme={theme} variant="secondary" size="sm" onClick={download} icon={<LvIcon name="download" size={16} />}>
            Download Sample CSV Template
          </LvButton>
        </div>
      </LvSectionCard>

      <LvCard theme={theme} padding={5}>
        <Disclosure theme={theme} label="What the file can hold" hint={`${IMPORT_TARGETS.length} columns are recognised by name`}>
          <p style={{ ...theme.type.bodySmall, color: theme.color.text, margin: `0 0 ${theme.space(3)}px` }}>
            Column order does not matter and extra columns are ignored. Headers are matched by name — anything not recognised can be pointed at the right
            field on the next step.
          </p>
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
            {IMPORT_TARGETS.map((target) => (
              <li key={target.key}>
                <LvBadge theme={theme} tone={target.required ? 'info' : 'neutral'}>
                  {target.label}
                  {target.required ? ' · required' : ''}
                </LvBadge>
              </li>
            ))}
          </ul>
        </Disclosure>
      </LvCard>
    </>
  );
};

export const UploadingStep = ({ theme, state }: { theme: LvTheme; state: ImportState }) => (
  <LvCard theme={theme} padding={5}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
      <p style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: 0 }}>Sending the file</p>
      {/* The one honest percentage in the whole import: bytes the browser has
          confirmed leaving this machine. */}
      <LvUploadItem
        theme={theme}
        name={`${state.fileName ?? 'file'}${state.fileSize !== null ? ` · ${formatBytes(state.fileSize)}` : ''}`}
        percentage={state.uploadFraction === null ? null : Math.round(state.uploadFraction * 100)}
      />
      <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>The file is stored against this import so every step reads the same rows.</p>
    </div>
  </LvCard>
);

export const AnalysingStep = ({ theme, state }: { theme: LvTheme; state: ImportState }) => (
  <LvCard theme={theme} padding={7}>
    <LvStageWait
      theme={theme}
      icon="document"
      tint="blue"
      title="Reading the file"
      detail={`Finding the header row, counting the rows and working out which column is which. ${state.fileName ?? 'The file'} has not created anything.`}
      announce="Reading the file"
    />
  </LvCard>
);

// ---------------------------------------------------------------------------
// 6.2 MAP FIELDS
// ---------------------------------------------------------------------------
export const MapStep = ({ theme, state }: { theme: LvTheme; state: ImportState }) => {
  const taken = useMemo(() => new Set(state.mappedTargets), [state.mappedTargets]);
  const ignored = state.headers.filter((_, column) => (state.mapping[column] ?? null) === null).length;

  return (
    <>
      <LvSectionCard
        theme={theme}
        title={state.fileName ?? 'The file'}
        icon="document"
        action={
          <div style={{ display: 'flex', gap: theme.space(2) }}>
            <LvButton theme={theme} variant="secondary" size="sm" onClick={state.autoMap}>
              Auto-map columns
            </LvButton>
            <LvButton theme={theme} variant="ghost" size="sm" onClick={state.reset}>
              Choose another file
            </LvButton>
          </div>
        }
      >
        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(5), margin: 0 }}>
          {[
            { label: 'Rows found', value: state.rowCount.toLocaleString() },
            { label: 'Columns', value: state.headers.length.toLocaleString() },
            { label: 'Mapped', value: `${state.mappedTargets.length} of ${state.headers.length}` },
          ].map((fact) => (
            <div key={fact.label}>
              <dt style={{ ...theme.type.caption, color: theme.color.textMuted }}>{fact.label}</dt>
              <dd style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: 0 }}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {state.skippedEmptyRows > 0 && (
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(3)}px 0 0` }}>
            {plural(state.skippedEmptyRows, 'blank row was', 'blank rows were')} skipped while reading the file.
          </p>
        )}
      </LvSectionCard>

      {state.truncated && (
        <LvBanner theme={theme} tone="warning" title={`Only the first ${MAX_IMPORT_ROWS.toLocaleString()} rows were read`}>
          One import reads {MAX_IMPORT_ROWS.toLocaleString()} rows. Anything after that is not in this file as far as the CRM is concerned — split the
          spreadsheet and bring the rest in as a second import.
        </LvBanner>
      )}

      {state.problems.length > 0 && (
        <InlineNotice theme={theme} tone="warning">
          {state.problems[0]}
        </InlineNotice>
      )}

      <LvSectionCard theme={theme} title="Which column is which" icon="filter">
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `0 0 ${theme.space(2)}px` }}>
          Matched by header name where the name was recognised. Change anything that is wrong; a column set to <em>Do not import</em> is left out entirely.
        </p>

        <div role="list">
          {state.headers.map((header, column) => {
            const selectId = `lv-map-${column}`;
            const value = state.mapping[column] ?? null;
            const samples = state.sample.map((row) => row[column]).filter((cell) => cell !== undefined && cell !== '');

            return (
              <div key={`${header}-${column}`} role="listitem" className="lv-map-row">
                <div style={{ minWidth: 0 }}>
                  <span style={{ ...theme.type.caption, color: theme.color.textMuted, display: 'block' }}>Column {column + 1}</span>
                  <span style={{ ...theme.type.subheading, fontSize: 15, color: theme.color.heading, overflowWrap: 'anywhere' }}>{header || '(no header)'}</span>
                  {/* States what happened, not what to do: the header was not
                      one the server recognises, and the decision is still the
                      person's. */}
                  {value === null && (
                    <span style={{ display: 'inline-flex', marginTop: 4 }}>
                      <LvBadge theme={theme} tone="neutral">Not matched by name</LvBadge>
                    </span>
                  )}
                </div>

                {/* The values themselves, because "Contact" means nothing
                    until you see that it holds phone numbers. */}
                <div style={{ minWidth: 0 }}>
                  <span style={{ ...theme.type.caption, color: theme.color.textMuted, display: 'block' }}>In the file</span>
                  {samples.length === 0 ? (
                    <span style={{ ...theme.type.bodySmall, color: theme.color.textSubtle }}>Empty in the first rows</span>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {samples.map((cell, index) => (
                        <li key={index} style={{ ...theme.type.bodySmall, color: theme.color.text, overflowWrap: 'anywhere' }}>
                          {cell}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="lv-map-target">
                  <Field theme={theme} label="Becomes" htmlFor={selectId}>
                    <LvSelect
                      theme={theme}
                      id={selectId}
                      value={value ?? ''}
                      onChange={(event) => state.setColumn(column, event.target.value === '' ? null : (event.target.value as ImportTargetKey))}
                    >
                      <option value="">Do not import</option>
                      {IMPORT_TARGETS.map((target) => (
                        <option key={target.key} value={target.key} disabled={taken.has(target.key) && target.key !== value}>
                          {target.label}
                          {taken.has(target.key) && target.key !== value ? ' — already used' : ''}
                        </option>
                      ))}
                    </LvSelect>
                  </Field>
                </div>
              </div>
            );
          })}
        </div>

        {ignored > 0 && (
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(3)}px 0 0` }}>
            {plural(ignored, 'column is', 'columns are')} set to not import.
          </p>
        )}
      </LvSectionCard>
    </>
  );
};

// ---------------------------------------------------------------------------
// 6.3 VALIDATE — the wait, named
// ---------------------------------------------------------------------------
export const ValidatingStep = ({ theme, state }: { theme: LvTheme; state: ImportState }) => (
  <LvCard theme={theme} padding={7}>
    <LvStageWait
      theme={theme}
      icon="search"
      tint="lavender"
      title={`Checking ${plural(state.rowCount, 'row', 'rows')}`}
      detail="Building each row into a lead, checking the categories and the owners named in the file, and looking for anyone who is already in the CRM. Nothing is created by this step."
      announce="Checking the rows"
    />
  </LvCard>
);

// ---------------------------------------------------------------------------
// 6.4 REVIEW — the decisions, then the one irreversible step
// ---------------------------------------------------------------------------

const RowCard = ({
  theme,
  row,
  decision,
  onDecide,
  onOpenLead,
  ownerName,
}: {
  theme: LvTheme;
  row: ImportRow;
  decision: 'CREATE' | 'SKIP';
  onDecide: (next: 'CREATE' | 'SKIP') => void;
  onOpenLead: (leadId: string) => void;
  ownerName: string | null;
}) => {
  const blocked = row.status === 'ERROR';
  const facts = row.draft
    ? ([
        ['Organisation', row.draft.organisationName],
        ['Email', row.draft.email],
        ['Phone', row.draft.phone],
        ['Location', row.draft.location],
        ['Category', sentence(row.draft.category)],
        ['Owner', ownerName],
      ] as const
    ).filter(([, value]) => Boolean(value))
    : [];

  return (
    <li className="lv-import-row" style={{ background: theme.color.surface, listStyle: 'none' }}>
      <div className="lv-import-row-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' }}>
          <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>Row {row.rowNumber}</span>
          <LvBadge theme={theme} tone={STATUS_TONE[row.status]}>
            {STATUS_LABEL[row.status]}
          </LvBadge>
        </div>

        <p style={{ ...theme.type.subheading, fontSize: 16, color: theme.color.heading, margin: `${theme.space(1)}px 0 0`, overflowWrap: 'anywhere' }}>
          {row.draft?.name ?? 'Could not be read as a lead'}
        </p>

        {facts.length > 0 && (
          <dl style={{ display: 'flex', flexWrap: 'wrap', gap: `2px ${theme.space(4)}px`, margin: `${theme.space(2)}px 0 0` }}>
            {facts.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: theme.space(1), minWidth: 0 }}>
                <dt style={{ ...theme.type.caption, color: theme.color.textMuted }}>{label}</dt>
                <dd style={{ ...theme.type.bodySmall, color: theme.color.text, margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Every message the server gave, word for word: it says what is
            wrong and what was done about it. */}
        {row.errors.length > 0 && (
          <ul style={{ margin: `${theme.space(2)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {row.errors.map((message) => (
              <li key={message} style={{ display: 'flex', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.danger }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 auto' }}>
                  <LvIcon name="warning" size={15} />
                </span>
                <span style={{ overflowWrap: 'anywhere' }}>{message}</span>
              </li>
            ))}
          </ul>
        )}

        {row.warnings.length > 0 && (
          <ul style={{ margin: `${theme.space(2)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {row.warnings.map((message) => (
              <li key={message} style={{ display: 'flex', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.textMuted }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 auto', color: theme.color.warning }}>
                  <LvIcon name="info" size={15} />
                </span>
                <span style={{ overflowWrap: 'anywhere' }}>{message}</span>
              </li>
            ))}
          </ul>
        )}

        {row.duplicateOfRow !== null && (
          <p style={{ ...theme.type.bodySmall, color: theme.color.text, margin: `${theme.space(2)}px 0 0` }}>
            The same details appear earlier in this file, on row {row.duplicateOfRow}. Importing both would create two leads for one contact.
          </p>
        )}

        {row.duplicateOf && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.space(2),
              marginTop: theme.space(2),
              padding: theme.space(3),
              borderRadius: theme.radius.md,
              background: theme.color.surfaceSunken,
            }}
          >
            <span style={{ ...theme.type.bodySmall, color: theme.color.text, minWidth: 0, flex: '1 1 220px' }}>
              Looks like <strong style={{ color: theme.color.heading }}>{row.duplicateOf.name ?? 'a lead already here'}</strong>
              {row.duplicateOf.lvLeadId ? ` (${row.duplicateOf.lvLeadId})` : ''} — {Math.round(row.duplicateOf.percent)}% match on{' '}
              {row.duplicateOf.matchingFields.join(', ')}.
            </span>
            <LvButton theme={theme} variant="secondary" size="sm" onClick={() => onOpenLead(row.duplicateOf!.leadId)}>
              Open it
            </LvButton>
          </div>
        )}
      </div>

      <div className="lv-import-decision">
        {blocked ? (
          <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
            Not imported. Fix the row in the spreadsheet and bring the file in again.
          </span>
        ) : (
          <Segmented
            theme={theme}
            label={`Row ${row.rowNumber}: import or skip`}
            value={decision}
            onChange={(next) => onDecide(next as 'CREATE' | 'SKIP')}
            options={[
              { key: 'CREATE', label: 'Import' },
              { key: 'SKIP', label: 'Skip' },
            ]}
          />
        )}
      </div>
    </li>
  );
};

export const ReviewStep = ({ theme, state, onOpenLead }: { theme: LvTheme; state: ImportState; onOpenLead: (leadId: string) => void }) => {
  const [filter, setFilter] = useState<'ALL' | ImportRowStatus>('ALL');
  const summary = state.summary;
  const memberName = useMemo(() => new Map(state.members.map((member) => [member.id, member.name])), [state.members]);
  const visible = filter === 'ALL' ? state.rows : state.rows.filter((row) => row.status === filter);

  return (
    <>
      <LvSectionCard theme={theme} title="What the file holds" icon="chart">
        <div className="lv-kpi-grid">
          <KpiTile theme={theme} label="Rows" value={summary?.total ?? state.rows.length} emptyText="None" />
          <KpiTile theme={theme} label="Ready" value={summary?.valid ?? 0} emptyText="None" tone="success" />
          <KpiTile theme={theme} label="Needs a look" value={summary?.warnings ?? 0} emptyText="None" tone="warning" />
          <KpiTile theme={theme} label="Already here" value={summary?.duplicates ?? 0} emptyText="None" tone="info" />
          <KpiTile theme={theme} label="Cannot import" value={summary?.errors ?? 0} emptyText="None" tone="danger" />
          <KpiTile theme={theme} label="Will be created" value={state.willCreate} emptyText="None" hint="What the button below will do" />
        </div>
      </LvSectionCard>

      {/* The duplicate check is the one part of validation that can fail on
          its own. Saying so matters: without it a row marked Ready has not
          been compared with anything. */}
      {state.duplicateError && (
        <LvBanner theme={theme} tone="warning" title="The duplicate check did not run">
          {state.duplicateError} Rows below were checked against each other but not against the leads already in the CRM, so importing may create a second
          copy of someone.
        </LvBanner>
      )}

      {summary && summary.duplicates > 0 && (
        <LvCard theme={theme} padding={4}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(3) }}>
            <span style={{ ...theme.type.bodySmall, color: theme.color.text, flex: '1 1 240px' }}>
              {plural(summary.duplicates, 'row looks', 'rows look')} like someone already in the CRM. They are set to skip.
            </span>
            <LvButton theme={theme} variant="secondary" size="sm" onClick={() => state.decideAll('DUPLICATE', 'CREATE')}>
              Import them anyway
            </LvButton>
            <LvButton theme={theme} variant="ghost" size="sm" onClick={() => state.decideAll('DUPLICATE', 'SKIP')}>
              Keep them skipped
            </LvButton>
          </div>
        </LvCard>
      )}

      <LvSectionCard theme={theme} title="Row by row" icon="leads">
        {/* What each state means for the row, said once rather than repeated
            under every message: the server says what is wrong, this says what
            happens about it. */}
        <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `0 0 ${theme.space(3)}px` }}>
          A row marked <strong style={{ color: theme.color.heading }}>needs a look</strong> still imports — the message says what was done with the value
          it could not use. A row marked <strong style={{ color: theme.color.heading }}>cannot import</strong> is never created; correct it in the
          spreadsheet and bring that file in again.
        </p>
        <div style={{ marginBottom: theme.space(3) }}>
          <Segmented
            theme={theme}
            label="Show which rows"
            value={filter}
            onChange={(next) => setFilter(next as 'ALL' | ImportRowStatus)}
            options={[
              { key: 'ALL', label: 'All', count: state.rows.length },
              { key: 'VALID', label: 'Ready', count: summary?.valid ?? 0 },
              { key: 'WARNING', label: 'Needs a look', count: summary?.warnings ?? 0 },
              { key: 'DUPLICATE', label: 'Already here', count: summary?.duplicates ?? 0 },
              { key: 'ERROR', label: 'Cannot import', count: summary?.errors ?? 0 },
            ]}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState theme={theme} text="No rows of that kind in this file." icon="check" tint="mint" />
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0 }}>
            {visible.map((row) => (
              <RowCard
                key={row.rowNumber}
                theme={theme}
                row={row}
                decision={row.status === 'ERROR' ? 'SKIP' : (state.decisions[row.rowNumber] ?? 'SKIP')}
                onDecide={(next) => state.decide(row.rowNumber, next)}
                onOpenLead={onOpenLead}
                ownerName={row.ownerId ? (memberName.get(row.ownerId) ?? null) : null}
              />
            ))}
          </ul>
        )}
      </LvSectionCard>
    </>
  );
};

export const ImportingStep = ({ theme, state }: { theme: LvTheme; state: ImportState }) => (
  <LvCard theme={theme} padding={7}>
    <LvStageWait
      theme={theme}
      icon="capture"
      tint="mint"
      title={state.willCreate === 0 ? 'Closing the import' : `Creating ${plural(state.willCreate, 'lead', 'leads')}`}
      detail={
        state.willCreate === 0
          ? 'Every row was set to skip, so the import is being recorded with nothing created.'
          : 'Each one is saved, given its LV number, routed to an owner and given its first follow-up — the same path a single capture takes.'
      }
      announce="Importing"
    />
  </LvCard>
);

// ---------------------------------------------------------------------------
// 6.5 RESULT
// ---------------------------------------------------------------------------
export const ResultStep = ({
  theme,
  state,
  onOpenLead,
  onSeeLeads,
}: {
  theme: LvTheme;
  state: ImportState;
  onOpenLead: (leadId: string) => void;
  onSeeLeads: () => void;
}) => {
  const summary = state.reportSummary;
  const created = state.report.filter((row) => row.status === 'CREATED');
  const existing = state.report.filter((row) => row.status === 'EXISTS');
  const failed = state.report.filter((row) => row.status === 'ERROR');
  const nothing = (summary?.created ?? created.length) === 0;

  return (
    <>
      <LvCard theme={theme} padding={6}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: theme.space(3) }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: theme.radius.pill,
              background: nothing ? theme.color.surfaceSunken : theme.tint.mint.wash,
              color: nothing ? theme.color.textMuted : theme.tint.mint.ink,
            }}
          >
            <LvIcon name={nothing ? 'info' : 'check'} size={26} />
          </span>
          <h2 style={{ ...theme.type.heading, fontSize: 22, color: theme.color.heading, margin: 0 }}>
            {nothing ? 'Nothing was created' : `${plural(summary?.created ?? created.length, 'lead', 'leads')} imported`}
          </h2>
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0, maxWidth: 460 }}>
            {nothing
              ? `${state.fileName ?? 'The file'} was read and checked, and every row was set to skip. The import is on record and the CRM is unchanged.`
              : `From ${state.fileName ?? 'the file'}. Each one has its LV number, an owner and a first follow-up.`}
          </p>
        </div>
      </LvCard>

      <div className="lv-kpi-grid">
        <KpiTile theme={theme} label="Created" value={summary?.created ?? created.length} emptyText="None" tone="success" />
        <KpiTile theme={theme} label="Skipped" value={summary?.skipped ?? 0} emptyText="None" />
        <KpiTile theme={theme} label="Already imported" value={summary?.existing ?? existing.length} emptyText="None" tone="info" />
        <KpiTile theme={theme} label="Failed" value={summary?.errors ?? failed.length} emptyText="None" tone="danger" />
      </div>

      {/* The server's own words about owners it could not apply. */}
      {state.note && (
        <LvBanner theme={theme} tone="info" title="Owners named in the file">
          {state.note}
        </LvBanner>
      )}

      {existing.length > 0 && (
        <LvBanner theme={theme} tone="info" title={`${plural(existing.length, 'row was', 'rows were')} imported before`}>
          This import had already created them, so they were left as they are rather than duplicated.
        </LvBanner>
      )}

      {created.length > 0 && (
        <LvSectionCard theme={theme} title="What came in" icon="leads">
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: 0, padding: 0, listStyle: 'none' }}>
            {created.map((row) => (
              <li key={row.rowNumber} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                <button
                  type="button"
                  onClick={() => row.leadId && onOpenLead(row.leadId)}
                  disabled={!row.leadId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.space(3),
                    width: '100%',
                    minHeight: 44,
                    padding: `${theme.space(3)}px 0`,
                    background: 'transparent',
                    border: '1px solid transparent',
                    textAlign: 'left',
                    cursor: row.leadId ? 'pointer' : 'default',
                    fontFamily: theme.font.body,
                  }}
                >
                  <span style={{ ...theme.type.caption, color: theme.color.textSubtle, flex: '0 0 auto' }}>Row {row.rowNumber}</span>
                  <span style={{ ...theme.type.body, color: theme.color.heading, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                    {row.lvLeadId ?? 'Created'}
                  </span>
                  {row.ownerApplied && <LvBadge theme={theme} tone="neutral">Owner from the file</LvBadge>}
                  <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex' }}>
                    <LvIcon name="chevronRight" size={18} />
                  </span>
                  <VisuallyHidden>Open the lead from row {row.rowNumber}</VisuallyHidden>
                </button>
              </li>
            ))}
          </ul>
        </LvSectionCard>
      )}

      {failed.length > 0 && (
        <LvSectionCard theme={theme} title="What did not come in" icon="warning">
          <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
            {failed.map((row) => (
              <li key={row.rowNumber} style={{ ...theme.type.bodySmall, color: theme.color.text, display: 'flex', gap: theme.space(2) }}>
                <span style={{ color: theme.color.textSubtle, flex: '0 0 auto' }}>Row {row.rowNumber}</span>
                <span style={{ overflowWrap: 'anywhere' }}>{row.error ?? 'The row could not be created.'}</span>
              </li>
            ))}
          </ul>
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(3)}px 0 0` }}>
            Fix these rows in the spreadsheet and import that file on its own — the rows that came in this time will not be created twice.
          </p>
        </LvSectionCard>
      )}

      <LvCard theme={theme} padding={4}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
          {created.length > 0 && (
            <LvButton theme={theme} variant="primary" onClick={onSeeLeads} icon={<LvIcon name="leads" size={16} />}>
              See them in Leads
            </LvButton>
          )}
          <LvButton theme={theme} variant={created.length > 0 ? 'secondary' : 'primary'} onClick={state.reset} icon={<LvIcon name="upload" size={16} />}>
            Import another file
          </LvButton>
        </div>
      </LvCard>
    </>
  );
};

export { STATUS_LABEL, TARGET_LABEL };
