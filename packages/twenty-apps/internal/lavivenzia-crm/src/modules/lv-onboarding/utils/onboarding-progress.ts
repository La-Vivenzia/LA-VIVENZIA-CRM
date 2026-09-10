import {
  DATA_BEARING_STEPS,
  stepSpec,
  type OnboardingStep,
} from 'src/modules/lv-onboarding/constants/onboarding-steps';
import {
  isDocumentAcceptable,
  type DocumentVerificationState,
} from 'src/modules/lv-onboarding/constants/document-verification';
import {
  isStepComplete,
  validateStep,
  type OnboardingData,
} from 'src/modules/lv-onboarding/utils/validate-onboarding';

// Progress percentage and the onboarding health score.
//
// Two deliberately different numbers:
//   progress — how far through the form the partner is (required fields only).
//   health   — how good the submission is (required + optional richness +
//              document verification). ONBOARDING.md's "76% ready" is health.
//
// Both are arithmetic over answers the partner gave. Neither is a prediction and
// neither is described as AI.

export const progressPercentage = (data: OnboardingData): number => {
  const complete = DATA_BEARING_STEPS.filter((step) =>
    isStepComplete(step, data),
  ).length;

  return Math.round((complete / DATA_BEARING_STEPS.length) * 100);
};

export type StepProgress = {
  step: OnboardingStep;
  isComplete: boolean;
  missingCount: number;
  requiredCount: number;
};

export const stepProgress = (data: OnboardingData): readonly StepProgress[] =>
  DATA_BEARING_STEPS.map((step) => {
    const missing = validateStep(step, data);

    return {
      step,
      isComplete: missing.length === 0,
      missingCount: missing.length,
      requiredCount: stepSpec(step).fields.filter((field) => field.isRequired)
        .length,
    };
  });

// Re-exported from the canonical vocabulary so callers have one import site
// and there is never a second, drifting definition of these states.
export type { DocumentVerificationState };

export type HealthInput = {
  data: OnboardingData;
  // Verification state per uploaded document, keyed by document type.
  documents?: Readonly<Record<string, DocumentVerificationState>>;
};

export type HealthBreakdown = {
  label: string;
  weight: number;
  earned: number;
  detail: string;
};

export type OnboardingHealth = {
  score: number;
  breakdown: readonly HealthBreakdown[];
};

// Weights sum to 100 so the score reads as a percentage of readiness.
const WEIGHTS = {
  REQUIRED: 45,
  RICHNESS: 20,
  IMAGES: 15,
  DOCUMENTS: 20,
} as const;

const OPTIONAL_FIELD_KEYS = DATA_BEARING_STEPS.flatMap((step) =>
  stepSpec(step)
    .fields.filter((field) => !field.isRequired)
    .map((field) => ({ step, key: field.key })),
);

const answered = (data: OnboardingData, step: OnboardingStep, key: string): boolean => {
  const value = (data[step] ?? {})[key];

  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
};

const IMAGE_TARGET = 6;

export const onboardingHealth = ({
  data,
  documents = {},
}: HealthInput): OnboardingHealth => {
  // --- required completeness ------------------------------------------------
  const completeSteps = DATA_BEARING_STEPS.filter((step) =>
    isStepComplete(step, data),
  ).length;
  const requiredEarned = Math.round(
    (completeSteps / DATA_BEARING_STEPS.length) * WEIGHTS.REQUIRED,
  );

  // --- optional richness ----------------------------------------------------
  const optionalAnswered = OPTIONAL_FIELD_KEYS.filter(({ step, key }) =>
    answered(data, step, key),
  ).length;
  const richnessEarned =
    OPTIONAL_FIELD_KEYS.length === 0
      ? WEIGHTS.RICHNESS
      : Math.round((optionalAnswered / OPTIONAL_FIELD_KEYS.length) * WEIGHTS.RICHNESS);

  // --- images ---------------------------------------------------------------
  // Three is the minimum to submit; six is what makes a listing look credible,
  // so the score keeps rewarding photographs past the pass mark.
  const imageCount = Array.isArray((data.IMAGES ?? {}).images)
    ? ((data.IMAGES ?? {}).images as unknown[]).length
    : 0;
  const imagesEarned = Math.round(
    Math.min(1, imageCount / IMAGE_TARGET) * WEIGHTS.IMAGES,
  );

  // --- documents ------------------------------------------------------------
  const documentStates = Object.values(documents);
  const verified = documentStates.filter(isDocumentAcceptable).length;
  // Anything a reviewer or an expiry has turned away counts against the score:
  // an expired document is as unusable as a rejected one.
  const problems = documentStates.filter((state) =>
    state === 'REJECTED' || state === 'EXPIRED' || state === 'NEEDS_REPLACEMENT',
  ).length;
  const documentsEarned =
    documentStates.length === 0
      ? 0
      : Math.max(
          0,
          Math.round(
            ((verified - problems) / documentStates.length) * WEIGHTS.DOCUMENTS,
          ),
        );

  const breakdown: HealthBreakdown[] = [
    {
      label: 'Required information',
      weight: WEIGHTS.REQUIRED,
      earned: requiredEarned,
      detail: `${completeSteps} of ${DATA_BEARING_STEPS.length} steps complete`,
    },
    {
      label: 'Additional detail',
      weight: WEIGHTS.RICHNESS,
      earned: richnessEarned,
      detail: `${optionalAnswered} of ${OPTIONAL_FIELD_KEYS.length} optional fields answered`,
    },
    {
      label: 'Photographs',
      weight: WEIGHTS.IMAGES,
      earned: imagesEarned,
      detail: `${imageCount} uploaded`,
    },
    {
      label: 'Documents verified',
      weight: WEIGHTS.DOCUMENTS,
      earned: documentsEarned,
      detail:
        documentStates.length === 0
          ? 'No documents uploaded yet'
          : `${verified} verified, ${problems} needing attention, of ${documentStates.length}`,
    },
  ];

  return {
    score: breakdown.reduce((total, part) => total + part.earned, 0),
    breakdown,
  };
};
