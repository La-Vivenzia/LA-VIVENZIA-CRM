import { type OnboardingData } from 'src/modules/lv-onboarding/utils/validate-onboarding';

// A submission with every REQUIRED field satisfied and nothing optional filled
// in. Tests that need a valid submission start here and remove or add fields,
// so a new required field breaks the fixture loudly rather than silently
// weakening every guard test.
export const completeAnswers = (): OnboardingData => ({
  BASIC_INFORMATION: {
    legalName: 'Raj Sharma',
    displayName: 'Raj at Forest Table',
    email: 'raj@forest-table.com',
    phone: '9876543210',
  },
  ABOUT_YOU: {
    bio: 'I have cooked for travellers in the Sahyadris for eleven years, mostly slow food over wood fire, using what the valley grows that week.',
  },
  EXPERIENCE: {
    title: 'Wood-fire valley table',
    description:
      'A long lunch cooked over wood in an open kitchen, built around whatever the valley farms brought in that morning. Guests eat together at one table, and the menu is decided the day before.',
    category: 'EXPERIENCE',
    capacity: 12,
  },
  LOCATION: {
    addressLine: 'Survey 44, Tiger Valley Road',
    city: 'Lonavala',
    state: 'Maharashtra',
    country: 'India',
  },
  PRICING: {
    basePrice: 2400,
    priceUnit: 'per person',
  },
  AVAILABILITY: {
    availableDays: ['FRI', 'SAT', 'SUN'],
    noticePeriodHours: 48,
  },
  IMAGES: {
    images: ['files/1.jpg', 'files/2.jpg', 'files/3.jpg'],
  },
  DOCUMENTS: {
    identityDocument: ['files/id.pdf'],
  },
  POLICIES: {
    cancellationPolicy:
      'Free cancellation up to 72 hours before the booking; half refunded after that.',
    agreesToTerms: true,
  },
});

// The same submission with one required field removed, for guard tests.
export const answersMissing = (
  step: keyof OnboardingData,
  fieldKey: string,
): OnboardingData => {
  const data = completeAnswers();
  const stepAnswers = { ...(data[step] ?? {}) };

  delete stepAnswers[fieldKey];

  return { ...data, [step]: stepAnswers };
};
