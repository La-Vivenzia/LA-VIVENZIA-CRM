// The ten partner onboarding steps from PRODUCT-REQUIREMENTS.md / ONBOARDING.md.
//
// This is EXTERNAL partner onboarding — a villa owner or chef completing their
// own profile. It is unrelated to Twenty's `core-modules/onboarding`, which
// walks a new *workspace user* through creating a workspace. Nothing here
// extends that module; the two never meet.

export const ONBOARDING_STEPS = [
  'BASIC_INFORMATION',
  'ABOUT_YOU',
  'EXPERIENCE',
  'LOCATION',
  'PRICING',
  'AVAILABILITY',
  'IMAGES',
  'DOCUMENTS',
  'POLICIES',
  'FINAL_REVIEW',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  BASIC_INFORMATION: 'Basic information',
  ABOUT_YOU: 'About you',
  EXPERIENCE: 'Experience',
  LOCATION: 'Location',
  PRICING: 'Pricing',
  AVAILABILITY: 'Availability',
  IMAGES: 'Images',
  DOCUMENTS: 'Documents',
  POLICIES: 'Policies',
  FINAL_REVIEW: 'Final review',
};

export type OnboardingFieldKind =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'EMAIL'
  | 'PHONE'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'LIST'
  | 'FILES';

export type OnboardingFieldSpec = {
  key: string;
  label: string;
  kind: OnboardingFieldKind;
  isRequired: boolean;
  // Shown under the input. Plain guidance, never a pre-filled answer.
  help?: string;
  minLength?: number;
  minItems?: number;
};

export type OnboardingStepSpec = {
  step: OnboardingStep;
  label: string;
  description: string;
  fields: readonly OnboardingFieldSpec[];
};

// FINAL_REVIEW carries no inputs of its own: it is where the partner confirms
// what they already entered and submits. Keeping it in the list means progress
// and navigation treat it like any other step.
export const ONBOARDING_STEP_SPECS: readonly OnboardingStepSpec[] = [
  {
    step: 'BASIC_INFORMATION',
    label: ONBOARDING_STEP_LABELS.BASIC_INFORMATION,
    description: 'How we reach you and what to call you.',
    fields: [
      { key: 'legalName', label: 'Full legal name', kind: 'TEXT', isRequired: true },
      { key: 'displayName', label: 'Display name', kind: 'TEXT', isRequired: true, help: 'How guests will see you' },
      { key: 'email', label: 'Email', kind: 'EMAIL', isRequired: true },
      { key: 'phone', label: 'Phone', kind: 'PHONE', isRequired: true },
      { key: 'organisationName', label: 'Business name', kind: 'TEXT', isRequired: false },
      { key: 'languages', label: 'Languages you speak', kind: 'LIST', isRequired: false },
    ],
  },
  {
    step: 'ABOUT_YOU',
    label: ONBOARDING_STEP_LABELS.ABOUT_YOU,
    description: 'Your story, in your own words.',
    fields: [
      { key: 'bio', label: 'About you', kind: 'LONG_TEXT', isRequired: true, minLength: 80, help: 'What should a guest know about you?' },
      { key: 'yearsOfExperience', label: 'Years of experience', kind: 'NUMBER', isRequired: false },
      { key: 'website', label: 'Website', kind: 'TEXT', isRequired: false },
      { key: 'instagram', label: 'Instagram', kind: 'TEXT', isRequired: false },
    ],
  },
  {
    step: 'EXPERIENCE',
    label: ONBOARDING_STEP_LABELS.EXPERIENCE,
    description: 'What you offer.',
    fields: [
      { key: 'title', label: 'Experience or property name', kind: 'TEXT', isRequired: true },
      { key: 'description', label: 'Description', kind: 'LONG_TEXT', isRequired: true, minLength: 120 },
      { key: 'category', label: 'Category', kind: 'TEXT', isRequired: true },
      { key: 'durationMinutes', label: 'Typical duration (minutes)', kind: 'NUMBER', isRequired: false },
      { key: 'capacity', label: 'Maximum guests', kind: 'NUMBER', isRequired: true },
      { key: 'inclusions', label: "What's included", kind: 'LIST', isRequired: false },
    ],
  },
  {
    step: 'LOCATION',
    label: ONBOARDING_STEP_LABELS.LOCATION,
    description: 'Where this happens.',
    fields: [
      { key: 'addressLine', label: 'Address', kind: 'TEXT', isRequired: true },
      { key: 'city', label: 'City', kind: 'TEXT', isRequired: true },
      { key: 'state', label: 'State', kind: 'TEXT', isRequired: true },
      { key: 'country', label: 'Country', kind: 'TEXT', isRequired: true },
      { key: 'pincode', label: 'PIN code', kind: 'TEXT', isRequired: false },
      { key: 'directions', label: 'How to find it', kind: 'LONG_TEXT', isRequired: false },
    ],
  },
  {
    step: 'PRICING',
    label: ONBOARDING_STEP_LABELS.PRICING,
    description: 'What it costs.',
    fields: [
      { key: 'basePrice', label: 'Base price (INR)', kind: 'NUMBER', isRequired: true },
      { key: 'priceUnit', label: 'Priced per', kind: 'TEXT', isRequired: true, help: 'Per person, per night, per group' },
      { key: 'minimumGuests', label: 'Minimum guests', kind: 'NUMBER', isRequired: false },
      { key: 'additionalCharges', label: 'Additional charges', kind: 'LONG_TEXT', isRequired: false },
    ],
  },
  {
    step: 'AVAILABILITY',
    label: ONBOARDING_STEP_LABELS.AVAILABILITY,
    description: 'When you can host.',
    fields: [
      { key: 'availableDays', label: 'Available days', kind: 'LIST', isRequired: true, minItems: 1 },
      { key: 'noticePeriodHours', label: 'Notice needed (hours)', kind: 'NUMBER', isRequired: true },
      { key: 'seasonalNotes', label: 'Seasonal notes', kind: 'LONG_TEXT', isRequired: false },
    ],
  },
  {
    step: 'IMAGES',
    label: ONBOARDING_STEP_LABELS.IMAGES,
    description: 'Show it. Photographs matter more than words here.',
    fields: [
      { key: 'images', label: 'Photographs', kind: 'FILES', isRequired: true, minItems: 3, help: 'At least three' },
      { key: 'coverImage', label: 'Cover photograph', kind: 'FILES', isRequired: false, minItems: 1 },
    ],
  },
  {
    step: 'DOCUMENTS',
    label: ONBOARDING_STEP_LABELS.DOCUMENTS,
    description: 'Verification documents. Only a reviewer sees these.',
    fields: [
      { key: 'identityDocument', label: 'Identity proof', kind: 'FILES', isRequired: true, minItems: 1 },
      { key: 'addressProof', label: 'Address proof', kind: 'FILES', isRequired: false, minItems: 1 },
      { key: 'businessRegistration', label: 'Business registration', kind: 'FILES', isRequired: false, minItems: 1 },
      { key: 'insurance', label: 'Insurance', kind: 'FILES', isRequired: false, minItems: 1 },
    ],
  },
  {
    step: 'POLICIES',
    label: ONBOARDING_STEP_LABELS.POLICIES,
    description: 'The rules guests agree to.',
    fields: [
      { key: 'cancellationPolicy', label: 'Cancellation policy', kind: 'LONG_TEXT', isRequired: true, minLength: 40 },
      { key: 'houseRules', label: 'House rules', kind: 'LONG_TEXT', isRequired: false },
      { key: 'safetyMeasures', label: 'Safety measures', kind: 'LONG_TEXT', isRequired: false },
      { key: 'agreesToTerms', label: 'I accept the La Vivenzia partner terms', kind: 'BOOLEAN', isRequired: true },
    ],
  },
  {
    step: 'FINAL_REVIEW',
    label: ONBOARDING_STEP_LABELS.FINAL_REVIEW,
    description: 'Check everything, then submit for review.',
    fields: [],
  },
];

export const stepSpec = (step: OnboardingStep): OnboardingStepSpec => {
  const spec = ONBOARDING_STEP_SPECS.find((candidate) => candidate.step === step);

  if (spec === undefined) {
    throw new Error(`Unknown onboarding step: ${step}`);
  }

  return spec;
};

export const stepIndex = (step: OnboardingStep): number =>
  ONBOARDING_STEPS.indexOf(step);

export const isOnboardingStep = (value: string): value is OnboardingStep =>
  (ONBOARDING_STEPS as readonly string[]).includes(value);

// Steps a partner fills in. FINAL_REVIEW has no inputs, so progress and health
// are measured against the nine data-bearing steps.
export const DATA_BEARING_STEPS = ONBOARDING_STEPS.filter(
  (step) => step !== 'FINAL_REVIEW',
);
