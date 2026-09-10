import {
  DATA_BEARING_STEPS,
  ONBOARDING_STEP_SPECS,
  stepSpec,
  type OnboardingFieldSpec,
  type OnboardingStep,
} from 'src/modules/lv-onboarding/constants/onboarding-steps';
import {
  normalizeEmail,
  normalizePhone,
  nullIfBlank,
} from 'src/modules/lv-capture/utils/normalize-input';

// Per-step validation and the "missing information" report ONBOARDING.md asks
// for. Deterministic and side-effect free: the same answers always produce the
// same list, which is what lets the partner-facing checklist and the reviewer's
// view agree without talking to each other.

export type OnboardingAnswers = Record<string, unknown>;

// Answers are stored per step, so a partner can complete steps out of order.
export type OnboardingData = Partial<Record<OnboardingStep, OnboardingAnswers>>;

export type MissingField = {
  step: OnboardingStep;
  fieldKey: string;
  label: string;
  reason: 'EMPTY' | 'TOO_SHORT' | 'TOO_FEW' | 'INVALID';
};

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const isBlank = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return nullIfBlank(value) === null;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
};

const validateField = (
  step: OnboardingStep,
  field: OnboardingFieldSpec,
  value: unknown,
): MissingField | null => {
  const missing = (reason: MissingField['reason']): MissingField => ({
    step,
    fieldKey: field.key,
    label: field.label,
    reason,
  });

  // A required boolean must be explicitly true — an unticked terms box is not
  // "answered", it is refused.
  if (field.kind === 'BOOLEAN') {
    if (field.isRequired && value !== true) {
      return missing('EMPTY');
    }

    return null;
  }

  if (isBlank(value)) {
    return field.isRequired ? missing('EMPTY') : null;
  }

  if (field.kind === 'EMAIL' && normalizeEmail(String(value)) === null) {
    return missing('INVALID');
  }

  if (field.kind === 'PHONE' && normalizePhone(String(value)) === null) {
    return missing('INVALID');
  }

  if (field.kind === 'NUMBER') {
    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
      return missing('INVALID');
    }
  }

  if (
    field.minLength !== undefined &&
    typeof value === 'string' &&
    (nullIfBlank(value) ?? '').length < field.minLength
  ) {
    return missing('TOO_SHORT');
  }

  if (field.minItems !== undefined && asList(value).length < field.minItems) {
    return missing('TOO_FEW');
  }

  return null;
};

export const validateStep = (
  step: OnboardingStep,
  data: OnboardingData,
): readonly MissingField[] => {
  const answers = data[step] ?? {};

  return stepSpec(step)
    .fields.map((field) => validateField(step, field, answers[field.key]))
    .filter((issue): issue is MissingField => issue !== null);
};

export const isStepComplete = (
  step: OnboardingStep,
  data: OnboardingData,
): boolean => validateStep(step, data).length === 0;

// Everything still outstanding, in step order — the partner's checklist and the
// reviewer's "what is missing" panel are the same list.
export const missingInformation = (
  data: OnboardingData,
): readonly MissingField[] =>
  ONBOARDING_STEP_SPECS.flatMap((spec) => validateStep(spec.step, data));

// Whether the partner may submit for review at all.
export const canSubmitForReview = (
  data: OnboardingData,
): { ok: true } | { ok: false; missing: readonly MissingField[] } => {
  const missing = missingInformation(data);

  return missing.length === 0 ? { ok: true } : { ok: false, missing };
};

export const completedSteps = (
  data: OnboardingData,
): readonly OnboardingStep[] =>
  DATA_BEARING_STEPS.filter((step) => isStepComplete(step, data));

// The step a partner should land on when they resume: the first incomplete one,
// or FINAL_REVIEW when everything is done.
export const resumeStep = (data: OnboardingData): OnboardingStep =>
  DATA_BEARING_STEPS.find((step) => !isStepComplete(step, data)) ?? 'FINAL_REVIEW';
