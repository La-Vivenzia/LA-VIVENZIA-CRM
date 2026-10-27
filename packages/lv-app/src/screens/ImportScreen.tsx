import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useImport, type ImportPhase } from 'src/api/import';
import { LvConfirm } from 'src/design/overlay';
import { ErrorState, isForbiddenMessage, LvButton, LvCard, LvSteps, type LvStep } from 'src/design/kit';
import { LvContextualActions, LvPageHeader } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';
import { AnalysingStep, ImportingStep, MapStep, ResultStep, ReviewStep, SelectStep, UploadingStep, ValidatingStep } from 'src/screens/import/steps';

// CSV import — SELECT → ANALYSE → MAP → VALIDATE → REVIEW → IMPORT → RESULT.
//
// It is the same promise as a single capture, made about a whole spreadsheet:
// La Vivenzia does the reading, the person stays in charge, and nothing is
// created until they have seen what every row will become and what it might
// duplicate. Only the last step writes, and what it writes is exactly what
// the button said it would.

const PHASE_ORDER: ImportPhase[] = ['SELECT', 'UPLOADING', 'ANALYSING', 'MAP', 'VALIDATING', 'REVIEW', 'IMPORTING', 'RESULT'];

// The stages a person recognises. Uploading, analysing, validating and
// importing are waits inside a stage rather than stages of their own, so the
// stepper does not flicker through them.
const STAGES: { key: string; label: string; phases: ImportPhase[] }[] = [
  { key: 'file', label: 'File', phases: ['SELECT', 'UPLOADING', 'ANALYSING'] },
  { key: 'map', label: 'Columns', phases: ['MAP', 'VALIDATING'] },
  { key: 'review', label: 'Review', phases: ['REVIEW', 'IMPORTING'] },
  { key: 'done', label: 'Imported', phases: ['RESULT'] },
];

export const ImportScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const state = useImport();
  const { phase, error } = state;
  const position = PHASE_ORDER.indexOf(phase);
  const [confirming, setConfirming] = useState(false);

  const steps: LvStep[] = STAGES.map((stage) => {
    const current = stage.phases.includes(phase);
    const passed = Math.min(...stage.phases.map((candidate) => PHASE_ORDER.indexOf(candidate))) < position && !current;

    return { key: stage.key, label: stage.label, state: current ? 'current' : passed ? 'done' : 'todo' };
  });

  const busy = phase === 'UPLOADING' || phase === 'ANALYSING' || phase === 'VALIDATING' || phase === 'IMPORTING';
  const openLead = (leadId: string) => navigate(`/leads/${leadId}`);

  return (
    <>
      <LvPageHeader
        theme={theme}
        variant={phase === 'SELECT' ? 'hero' : 'panel'}
        title={phase === 'SELECT' ? 'Import leads from a spreadsheet' : (state.fileName ?? 'Import leads')}
        subtitle={
          phase === 'SELECT'
            ? 'Bring in a CSV. Every row is read, checked against the CRM and shown to you before a single lead is created.'
            : undefined
        }
        onBack={phase === 'SELECT' ? () => navigate('/capture') : phase === 'MAP' ? () => state.reset() : undefined}
        backLabel={phase === 'SELECT' ? 'Back to capture' : 'Start with another file'}
        actions={
          phase !== 'SELECT' && phase !== 'RESULT' && !busy ? (
            <LvButton theme={theme} variant="ghost" onClick={state.reset}>
              Start again
            </LvButton>
          ) : undefined
        }
      />

      {phase !== 'SELECT' && (
        <LvCard theme={theme} padding={4}>
          <LvSteps theme={theme} label="Import progress" steps={steps} />
        </LvCard>
      )}

      {/* A refusal from any of the three routes, in the server's own words. */}
      {error !== null && (
        <ErrorState
          theme={theme}
          title={isForbiddenMessage(error) ? 'Your role cannot import leads' : 'That did not go through'}
          text={error}
          onRetry={
            isForbiddenMessage(error)
              ? undefined
              : phase === 'MAP'
                ? () => void state.validate()
                : phase === 'REVIEW'
                  ? () => void state.commit()
                  : state.fileName === 'Pune Pilot Sandbox'
                    ? () => void state.loadSandbox()
                    : undefined
          }
        />
      )}

      {phase === 'SELECT' && <SelectStep theme={theme} state={state} />}
      {phase === 'UPLOADING' && <UploadingStep theme={theme} state={state} />}
      {phase === 'ANALYSING' && <AnalysingStep theme={theme} state={state} />}
      {phase === 'MAP' && <MapStep theme={theme} state={state} />}
      {phase === 'VALIDATING' && <ValidatingStep theme={theme} state={state} />}
      {phase === 'REVIEW' && <ReviewStep theme={theme} state={state} onOpenLead={openLead} />}
      {phase === 'IMPORTING' && <ImportingStep theme={theme} state={state} />}
      {phase === 'RESULT' && <ResultStep theme={theme} state={state} onOpenLead={openLead} onSeeLeads={() => navigate('/leads')} />}

      {/* The one action that moves the workflow on, pinned to the foot of a
          phone. Its label is the outcome, counted from the decisions above. */}
      {(phase === 'MAP' || phase === 'REVIEW') && (
        <LvContextualActions theme={theme}>
          {phase === 'MAP' ? (
            <LvButton theme={theme} variant="primary" disabled={state.problems.length > 0 || state.rowCount === 0} onClick={() => void state.validate()}>
              {state.rowCount === 1 ? 'Check 1 row' : `Check ${state.rowCount.toLocaleString()} rows`}
            </LvButton>
          ) : (
            <LvButton theme={theme} variant="primary" onClick={() => setConfirming(true)}>
              {state.willCreate === 0 ? 'Finish without importing' : state.willCreate === 1 ? 'Import 1 lead' : `Import ${state.willCreate.toLocaleString()} leads`}
            </LvButton>
          )}
        </LvContextualActions>
      )}

      {/* Creating leads cannot be undone from here, so the consequence is
          stated in full — including the rows that will be left behind. */}
      {confirming && (
        <LvConfirm
          theme={theme}
          tone={state.willCreate === 0 ? 'primary' : 'danger'}
          title={state.willCreate === 0 ? 'Finish with nothing created?' : `Import ${state.willCreate.toLocaleString()} ${state.willCreate === 1 ? 'lead' : 'leads'}?`}
          consequence={
            state.willCreate === 0
              ? `Every one of the ${state.rows.length.toLocaleString()} rows is set to skip, so no lead will be created. The import is recorded and the file stays attached to it.`
              : `${state.willCreate.toLocaleString()} ${state.willCreate === 1 ? 'lead is' : 'leads are'} created, each given an LV number, an owner and a first follow-up. ${(state.rows.length - state.willCreate).toLocaleString()} of the ${state.rows.length.toLocaleString()} rows are skipped. Creating leads cannot be undone from this screen.`
          }
          confirmLabel={state.willCreate === 0 ? 'Finish the import' : `Import ${state.willCreate.toLocaleString()} ${state.willCreate === 1 ? 'lead' : 'leads'}`}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void state.commit();
          }}
        />
      )}
    </>
  );
};
