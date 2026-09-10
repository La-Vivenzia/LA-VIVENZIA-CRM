import {
  DATA_BEARING_STEPS,
  ONBOARDING_STEPS,
  stepIndex,
  stepSpec,
  type OnboardingStep,
} from 'src/modules/lv-onboarding/constants/onboarding-steps';
import {
  isPartnerEditable,
  isUnderReview,
  type OnboardingStatus,
} from 'src/modules/lv-onboarding/constants/onboarding-status';
import {
  onboardingHealth,
  progressPercentage,
  stepProgress,
} from 'src/modules/lv-onboarding/utils/onboarding-progress';
import {
  canSubmitForReview,
  resumeStep,
  validateStep,
  type MissingField,
  type OnboardingData,
} from 'src/modules/lv-onboarding/utils/validate-onboarding';

// View model for the partner-facing wizard. Kept out of the React component so
// every state the form can be in is unit-testable without a DOM.

export type SaveState = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';

export type WizardState = {
  status: OnboardingStatus;
  step: OnboardingStep;
  data: OnboardingData;
  saveState: SaveState;
  saveError: string | null;
  // Set once the partner tries to advance, so errors are not shown while they
  // are still typing their first answer.
  hasAttemptedAdvance: boolean;
  submitError: string | null;
};

export const initialWizardState = ({
  status,
  data,
}: {
  status: OnboardingStatus;
  data: OnboardingData;
}): WizardState => ({
  status,
  // Resume where they left off — ONBOARDING.md requires save/resume.
  step: resumeStep(data),
  data,
  saveState: 'IDLE',
  saveError: null,
  hasAttemptedAdvance: false,
  submitError: null,
});

export const isReadOnly = (state: WizardState): boolean =>
  !isPartnerEditable(state.status);

export const readOnlyReason = (status: OnboardingStatus): string | null => {
  if (isUnderReview(status)) {
    return 'Your submission is with our team for review. You will hear from us shortly.';
  }

  if (status === 'APPROVED') {
    return 'You have been approved. Welcome to La Vivenzia.';
  }

  if (status === 'ACTIVATED') {
    return 'You are live.';
  }

  if (status === 'REJECTED') {
    return 'This application was not accepted. See the reason below.';
  }

  if (status === 'NOT_STARTED' || status === 'INVITED') {
    return null;
  }

  return null;
};

export const setAnswer = (
  state: WizardState,
  fieldKey: string,
  value: unknown,
): WizardState => ({
  ...state,
  data: {
    ...state.data,
    [state.step]: { ...(state.data[state.step] ?? {}), [fieldKey]: value },
  },
  // Editing invalidates a previous "saved" badge without claiming an error.
  saveState: state.saveState === 'SAVED' ? 'IDLE' : state.saveState,
});

export const currentIssues = (state: WizardState): readonly MissingField[] =>
  state.hasAttemptedAdvance ? validateStep(state.step, state.data) : [];

export const canAdvance = (state: WizardState): boolean =>
  validateStep(state.step, state.data).length === 0;

export const isFirstStep = (state: WizardState): boolean =>
  stepIndex(state.step) === 0;

export const isFinalStep = (state: WizardState): boolean =>
  state.step === 'FINAL_REVIEW';

export const goToStep = (
  state: WizardState,
  step: OnboardingStep,
): WizardState => ({ ...state, step, hasAttemptedAdvance: false });

// Advancing is blocked while the current step is incomplete, but the partner
// can always move BACKWARD — being trapped on a step you cannot finish is the
// fastest way to lose an application.
export const goNext = (state: WizardState): WizardState => {
  if (!canAdvance(state)) {
    return { ...state, hasAttemptedAdvance: true };
  }

  const next = ONBOARDING_STEPS[stepIndex(state.step) + 1];

  return next === undefined ? state : goToStep(state, next);
};

export const goBack = (state: WizardState): WizardState => {
  const previous = ONBOARDING_STEPS[stepIndex(state.step) - 1];

  return previous === undefined ? state : goToStep(state, previous);
};

export const withSaveState = (
  state: WizardState,
  saveState: SaveState,
  saveError: string | null = null,
): WizardState => ({ ...state, saveState, saveError });

export const withSubmitError = (
  state: WizardState,
  submitError: string,
): WizardState => ({ ...state, submitError });

export type WizardSummary = {
  progress: number;
  health: number;
  steps: ReturnType<typeof stepProgress>;
  canSubmit: boolean;
  blockingCount: number;
};

export const summarise = (state: WizardState): WizardSummary => {
  const submission = canSubmitForReview(state.data);

  return {
    progress: progressPercentage(state.data),
    health: onboardingHealth({ data: state.data }).score,
    steps: stepProgress(state.data),
    canSubmit: submission.ok,
    blockingCount: submission.ok ? 0 : submission.missing.length,
  };
};

export const stepTitle = (step: OnboardingStep): string => stepSpec(step).label;

export const stepNumber = (step: OnboardingStep): string =>
  step === 'FINAL_REVIEW'
    ? 'Review'
    : `Step ${stepIndex(step) + 1} of ${DATA_BEARING_STEPS.length}`;
