import { useNavigate } from 'react-router-dom';

import { useCapture, type CapturePhase } from 'src/api/capture';
import { ErrorState, isForbiddenMessage, LvButton, LvCard, LvStageWait, LvSteps, type LvStep } from 'src/design/kit';
import { LvContextualActions, LvPageHeader } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';
import { ChooseStep, DecideStep, ExtractingStep, InputStep, ReviewStep, SuccessStep } from 'src/screens/capture/steps';

// Capture — INPUT → UNDERSTAND → VERIFY → CREATE.
//
// The whole point of the screen is that La Vivenzia does the hard part while
// the person stays in charge: nothing is created until they have seen every
// field, every duplicate and who will own it. The three routes behind it
// create nothing until the last one.

const PHASE_ORDER: CapturePhase[] = ['CHOOSE', 'INPUT', 'EXTRACTING', 'REVIEW', 'CHECKING', 'DECIDE', 'CREATING', 'SUCCESS'];

// The stages a person recognises. Extracting and checking are waits inside a
// stage, not stages of their own, so the stepper does not flicker through
// them.
const STAGES: { key: string; label: string; phases: CapturePhase[] }[] = [
  { key: 'source', label: 'Source', phases: ['CHOOSE'] },
  { key: 'input', label: 'Input', phases: ['INPUT', 'EXTRACTING'] },
  { key: 'review', label: 'Review', phases: ['REVIEW', 'CHECKING'] },
  { key: 'decide', label: 'Confirm', phases: ['DECIDE', 'CREATING'] },
  { key: 'done', label: 'Created', phases: ['SUCCESS'] },
];

export const CaptureScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const capture = useCapture();
  const { phase, method, error } = capture;
  const position = PHASE_ORDER.indexOf(phase);

  const steps: LvStep[] = STAGES.map((stage) => {
    const current = stage.phases.includes(phase);
    const passed = Math.min(...stage.phases.map((candidate) => PHASE_ORDER.indexOf(candidate))) < position && !current;

    return { key: stage.key, label: stage.label, state: current ? 'current' : passed ? 'done' : 'todo' };
  });

  const busy = phase === 'EXTRACTING' || phase === 'CHECKING' || phase === 'CREATING';

  const header = (
    <LvPageHeader
      theme={theme}
      variant={phase === 'CHOOSE' ? 'hero' : 'panel'}
      title={phase === 'CHOOSE' ? 'Capture a lead' : (method?.label ?? 'Capture a lead')}
      subtitle={
        phase === 'CHOOSE'
          ? 'Photograph it, paste a link, or type it in. La Vivenzia reads what it can and shows you everything before anything is created.'
          : undefined
      }
      onBack={phase === 'CHOOSE' || phase === 'SUCCESS' ? undefined : () => capture.setPhase(phase === 'REVIEW' && method?.input !== 'FORM' ? 'INPUT' : 'CHOOSE')}
      backLabel="Back a step"
      actions={
        phase !== 'CHOOSE' && phase !== 'SUCCESS' ? (
          <LvButton theme={theme} variant="ghost" onClick={capture.reset}>
            Start again
          </LvButton>
        ) : undefined
      }
    />
  );

  return (
    <>
      {header}

      {phase !== 'CHOOSE' && (
        <LvCard theme={theme} padding={4}>
          <LvSteps theme={theme} label="Capture progress" steps={steps} />
        </LvCard>
      )}

      {/* A refusal from any of the three routes, in the server's own words. */}
      {error !== null && (
        <ErrorState
          theme={theme}
          title={isForbiddenMessage(error) ? 'Your role cannot capture leads' : 'That did not go through'}
          text={error}
          onRetry={
            isForbiddenMessage(error)
              ? undefined
              : phase === 'DECIDE'
                ? () => void capture.create()
                : phase === 'REVIEW'
                  ? () => void capture.check()
                  : undefined
          }
        />
      )}

      {phase === 'CHOOSE' && <ChooseStep theme={theme} capture={capture} onImport={() => navigate('/capture/import')} />}
      {phase === 'INPUT' && method && <InputStep theme={theme} capture={capture} method={method} />}
      {phase === 'EXTRACTING' && method && <ExtractingStep theme={theme} method={method} />}
      {phase === 'REVIEW' && method && <ReviewStep theme={theme} capture={capture} method={method} />}
      {phase === 'CHECKING' && (
        <LvCard theme={theme} padding={7}>
          <LvStageWait
            theme={theme}
            icon="search"
            tint="blue"
            title="Checking the CRM"
            detail="Looking for anyone who already looks like this, suggesting a category, and working out who should own it. Still nothing created."
            announce="Checking for duplicates"
          />
        </LvCard>
      )}
      {phase === 'DECIDE' && <DecideStep theme={theme} capture={capture} onOpenLead={(leadId) => navigate(`/leads/${leadId}`)} />}
      {phase === 'CREATING' && (
        <LvCard theme={theme} padding={7}>
          <LvStageWait
            theme={theme}
            icon="capture"
            tint="mint"
            title="Creating the lead"
            detail="Saving the record, routing it to an owner and setting the first follow-up."
            announce="Creating"
          />
        </LvCard>
      )}
      {phase === 'SUCCESS' && <SuccessStep theme={theme} capture={capture} onOpenLead={(leadId) => navigate(`/leads/${leadId}`)} />}

      {/* The one action that moves the workflow on, pinned to the foot of a
          phone. Choosing a source and the success screen carry their own. */}
      {(phase === 'REVIEW' || phase === 'DECIDE') && (
        <LvContextualActions theme={theme}>
          {phase === 'REVIEW' ? (
            <LvButton theme={theme} variant="primary" busy={busy} disabled={!capture.canReview} onClick={() => void capture.check()}>
              Check for duplicates
            </LvButton>
          ) : (
            <LvButton
              theme={theme}
              variant="primary"
              busy={busy}
              disabled={
                ((capture.preflight?.duplicates ?? []).length > 0 && capture.duplicateDecision === 'NONE') ||
                (capture.method?.requiresConfirmation === true && !capture.confirmed)
              }
              onClick={() => {
                if (capture.duplicateDecision === 'MERGE_EXISTING') {
                  void capture.merge();
                } else {
                  void capture.create();
                }
              }}
            >
              {capture.duplicateDecision === 'MERGE_EXISTING'
                ? 'Merge Existing'
                : capture.duplicateDecision === 'CREATE_NEW'
                  ? 'Create New'
                  : 'Create the lead'}
            </LvButton>
          )}
        </LvContextualActions>
      )}
    </>
  );
};
