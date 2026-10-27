// Regenerates src/modules/lv-core/constants/select-options.generated.ts from
// the vocabulary in lead-lifecycle.ts and lead-taxonomy.ts.
//
// Option ids are deterministic UUIDv5 values derived from the option name, so
// re-running produces identical ids and never orphans existing records.
//
//   node scripts/generate-select-options.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONSTANTS_DIR = path.join(ROOT, 'src/modules/lv-core/constants');
const NAMESPACE = 'lavivenzia-crm.lv-core';

const uuidFor = (name) => {
  const hash = crypto.createHash('sha1').update(NAMESPACE + ':' + name).digest('hex');
  const chars = hash.slice(0, 32).split('');
  chars[12] = '5';
  chars[16] = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
};

const read = (file) => fs.readFileSync(path.join(CONSTANTS_DIR, file), 'utf8');

const lifecycle = read('lead-lifecycle.ts');
const taxonomy = read('lead-taxonomy.ts');
const onboardingStatus = fs.readFileSync(
  path.join(ROOT, 'src/modules/lv-onboarding/constants/onboarding-status.ts'),
  'utf8',
);
const onboardingSteps = fs.readFileSync(
  path.join(ROOT, 'src/modules/lv-onboarding/constants/onboarding-steps.ts'),
  'utf8',
);
const documentVerification = fs.readFileSync(
  path.join(
    ROOT,
    'src/modules/lv-onboarding/constants/document-verification.ts',
  ),
  'utf8',
);
const interactions = fs.readFileSync(
  path.join(
    ROOT,
    'src/modules/lv-interactions/constants/interaction-vocabulary.ts',
  ),
  'utf8',
);

const IDENT = /'([A-Z0-9_]+)'/g;

const arrayOf = (text, name) => {
  const start = text.indexOf('export const ' + name + ' = [');

  if (start === -1) {
    throw new Error('array not found: ' + name);
  }

  const end = text.indexOf('] as const', start);
  const body = text.slice(start, end);

  return [...body.matchAll(IDENT)].map((match) => match[1]);
};

const labelsOf = (text, name) => {
  const start = text.indexOf('export const ' + name);

  if (start === -1) {
    throw new Error('labels not found: ' + name);
  }

  const end = text.indexOf('\n};', start);
  const labels = {};

  for (const line of text.slice(start, end).split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+):\s*'(.*)',\s*$/);

    if (match) {
      labels[match[1]] = match[2];
    }
  }

  return labels;
};

const COLORS = [
  'blue',
  'turquoise',
  'sky',
  'green',
  'purple',
  'pink',
  'red',
  'orange',
  'yellow',
  'gray',
];

const block = (prefix, values, labels, colorFor) =>
  values
    .map((value, index) => {
      const color = colorFor ? colorFor(value, index) : COLORS[index % COLORS.length];
      const label = JSON.stringify(labels[value] ?? value);

      return [
        '  {',
        "    id: '" + uuidFor(prefix + ':' + value) + "',",
        "    value: '" + value + "',",
        '    label: ' + label + ',',
        '    position: ' + index + ',',
        "    color: '" + color + "',",
        '  },',
      ].join('\n');
    })
    .join('\n');

const mainFlow = arrayOf(lifecycle, 'LEAD_MAIN_FLOW_STATUSES');
const additional = arrayOf(lifecycle, 'LEAD_ADDITIONAL_STATUSES');
const statuses = [...mainFlow, ...additional];
const statusLabels = labelsOf(lifecycle, 'LEAD_STATUS_LABELS');

// Main flow warms blue -> green as the lead advances. Terminal and holding
// states are muted or red so a board reads at a glance.
const TERMINAL_COLORS = {
  NOT_INTERESTED: 'gray',
  FOLLOW_UP_LATER: 'yellow',
  NO_RESPONSE: 'gray',
  WRONG_CONTACT: 'orange',
  DUPLICATE: 'purple',
  NOT_ELIGIBLE: 'gray',
  TEMPORARILY_CLOSED: 'orange',
  LOST: 'red',
  REJECTED: 'red',
  DORMANT: 'gray',
};

const statusColor = (value, index) => {
  if (index >= mainFlow.length) {
    return TERMINAL_COLORS[value] ?? 'gray';
  }

  if (index < 4) return 'blue';
  if (index < 8) return 'turquoise';
  if (index < 12) return 'purple';

  return 'green';
};

const PRIORITY_COLORS = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'yellow',
  LOW: 'gray',
};

const categories = arrayOf(taxonomy, 'LEAD_CATEGORIES');
const pilotZones = arrayOf(taxonomy, 'LEAD_PILOT_ZONES');
const sources = arrayOf(taxonomy, 'LEAD_SOURCES');
const modes = arrayOf(taxonomy, 'LEAD_CAPTURE_MODES');
const provenances = arrayOf(taxonomy, 'FIELD_PROVENANCES');

// Sub-categories live in a Record keyed by category, so collect them from the
// whole block rather than a flat array.
const subcategoryBlockStart = taxonomy.indexOf('LEAD_SUBCATEGORIES_BY_CATEGORY');
// Must match the flat export, not the _BY_CATEGORY one it is a prefix of.
const subcategoryBlockEnd = taxonomy.indexOf('export const LEAD_SUBCATEGORIES =');
const subcategories = [
  ...new Set(
    [...taxonomy.slice(subcategoryBlockStart, subcategoryBlockEnd).matchAll(IDENT)]
      .map((match) => match[1])
      .filter((value) => !categories.includes(value)),
  ),
];

const titleize = (value) =>
  value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

const asLabels = (values) =>
  Object.fromEntries(values.map((value) => [value, titleize(value)]));

const output = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-select-options.mjs
//
// Option ids are deterministic UUIDv5 values derived from the option name, so
// regenerating produces identical ids and never orphans existing records.

// Mirrors TagColor from twenty-shared. Declared locally so this generated file
// has no import, and so a bad colour is a compile error rather than a runtime
// surprise at install time.
export type SelectOptionColor =
  | 'red'
  | 'ruby'
  | 'crimson'
  | 'tomato'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'grass'
  | 'green'
  | 'jade'
  | 'mint'
  | 'turquoise'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'iris'
  | 'violet'
  | 'purple'
  | 'plum'
  | 'pink'
  | 'bronze'
  | 'gold'
  | 'brown'
  | 'gray';

export type SelectOption = {
  id: string;
  value: string;
  label: string;
  position: number;
  color: SelectOptionColor;
};

export const LEAD_STATUS_OPTIONS: SelectOption[] = [
${block('leadStatus', statuses, statusLabels, statusColor)}
];

export const LEAD_PRIORITY_OPTIONS: SelectOption[] = [
${block(
  'leadPriority',
  arrayOf(lifecycle, 'LEAD_PRIORITIES'),
  labelsOf(lifecycle, 'LEAD_PRIORITY_LABELS'),
  (value) => PRIORITY_COLORS[value] ?? 'gray',
)}
];

export const LEAD_CATEGORY_OPTIONS: SelectOption[] = [
${block('leadCategory', categories, labelsOf(taxonomy, 'LEAD_CATEGORY_LABELS'))}
];

export const LEAD_PILOT_ZONE_OPTIONS: SelectOption[] = [
${block(
  'leadPilotZone',
  pilotZones,
  labelsOf(taxonomy, 'LEAD_PILOT_ZONE_LABELS'),
  (value, index) => ['blue', 'turquoise', 'purple', 'amber'][index % 4],
)}
];

export const LEAD_SUBCATEGORY_OPTIONS: SelectOption[] = [
${block('leadSubcategory', subcategories, asLabels(subcategories))}
];

export const LEAD_SOURCE_OPTIONS: SelectOption[] = [
${block('leadSource', sources, labelsOf(taxonomy, 'LEAD_SOURCE_LABELS'))}
];

export const LEAD_CAPTURE_MODE_OPTIONS: SelectOption[] = [
${block('leadCaptureMode', modes, labelsOf(taxonomy, 'LEAD_CAPTURE_MODE_LABELS'))}
];

export const FIELD_PROVENANCE_OPTIONS: SelectOption[] = [
${block('fieldProvenance', provenances, asLabels(provenances))}
];

export const INTERACTION_CHANNEL_OPTIONS: SelectOption[] = [
${block(
  'interactionChannel',
  arrayOf(interactions, 'INTERACTION_CHANNELS'),
  labelsOf(interactions, 'INTERACTION_CHANNEL_LABELS'),
)}
];

export const INTERACTION_SENTIMENT_OPTIONS: SelectOption[] = [
${block(
  'interactionSentiment',
  arrayOf(interactions, 'INTERACTION_SENTIMENTS'),
  labelsOf(interactions, 'INTERACTION_SENTIMENT_LABELS'),
  (value) =>
    ({ POSITIVE: 'green', NEUTRAL: 'gray', NEGATIVE: 'red', MIXED: 'orange' })[
      value
    ] ?? 'gray',
)}
];

export const INTERACTION_PURPOSE_OPTIONS: SelectOption[] = [
${block(
  'interactionPurpose',
  arrayOf(interactions, 'INTERACTION_PURPOSES'),
  labelsOf(interactions, 'INTERACTION_PURPOSE_LABELS'),
)}
];

export const ONBOARDING_STATUS_OPTIONS: SelectOption[] = [
${block(
  'onboardingStatus',
  arrayOf(onboardingStatus, 'ONBOARDING_STATUSES'),
  labelsOf(onboardingStatus, 'ONBOARDING_STATUS_LABELS'),
  (value) =>
    ({
      NOT_STARTED: 'gray',
      INVITED: 'sky',
      INITIATED: 'blue',
      IN_PROGRESS: 'blue',
      WAITING_FOR_PARTNER: 'yellow',
      VERIFICATION: 'purple',
      INTERNAL_REVIEW: 'purple',
      CHANGES_REQUESTED: 'orange',
      APPROVED: 'green',
      REJECTED: 'red',
      ACTIVATED: 'green',
    })[value] ?? 'gray',
)}
];

export const ONBOARDING_STEP_OPTIONS: SelectOption[] = [
${block(
  'onboardingStep',
  arrayOf(onboardingSteps, 'ONBOARDING_STEPS'),
  labelsOf(onboardingSteps, 'ONBOARDING_STEP_LABELS'),
)}
];

export const DOCUMENT_VERIFICATION_OPTIONS: SelectOption[] = [
${block(
  'documentVerification',
  arrayOf(documentVerification, 'DOCUMENT_VERIFICATION_STATES'),
  labelsOf(documentVerification, 'DOCUMENT_VERIFICATION_STATE_LABELS'),
  (value) =>
    ({
      PENDING: 'yellow',
      UNDER_REVIEW: 'purple',
      VERIFIED: 'green',
      REJECTED: 'red',
      EXPIRED: 'orange',
      NEEDS_REPLACEMENT: 'orange',
    })[value] ?? 'gray',
)}
];

export const DOCUMENT_FLAG_OPTIONS: SelectOption[] = [
${block(
  'documentFlag',
  arrayOf(documentVerification, 'DOCUMENT_VERIFICATION_FLAGS'),
  labelsOf(documentVerification, 'DOCUMENT_VERIFICATION_FLAG_LABELS'),
  () => 'orange',
)}
];

export const DOCUMENT_TYPE_OPTIONS: SelectOption[] = [
${block(
  'documentType',
  ['IDENTITY', 'ADDRESS_PROOF', 'BUSINESS_REGISTRATION', 'INSURANCE', 'CERTIFICATION', 'OTHER'],
  {
    IDENTITY: 'Identity proof',
    ADDRESS_PROOF: 'Address proof',
    BUSINESS_REGISTRATION: 'Business registration',
    INSURANCE: 'Insurance',
    CERTIFICATION: 'Certification',
    OTHER: 'Other',
  },
)}
];

export const INTERACTION_OUTCOME_OPTIONS: SelectOption[] = [
${block(
  'interactionOutcome',
  arrayOf(interactions, 'INTERACTION_OUTCOMES'),
  labelsOf(interactions, 'INTERACTION_OUTCOME_LABELS'),
  (value) =>
    ({
      CONNECTED: 'green',
      INTERESTED: 'green',
      COMMITMENT_MADE: 'green',
      DOCUMENT_RECEIVED: 'turquoise',
      INFORMATION_SHARED: 'blue',
      AWAITING_RESPONSE: 'yellow',
      RESCHEDULED: 'yellow',
      NO_ANSWER: 'orange',
      OBJECTION_RAISED: 'orange',
      NOT_INTERESTED: 'red',
      NO_OUTCOME: 'gray',
    })[value] ?? 'gray',
)}
];
`;

fs.writeFileSync(
  path.join(CONSTANTS_DIR, 'select-options.generated.ts'),
  output,
  'utf8',
);

process.stdout.write(
  [
    'statuses: ' + statuses.length,
    'subcategories: ' + subcategories.length,
    'sources: ' + sources.length,
    'captureModes: ' + modes.length,
    'provenances: ' + provenances.length,
  ].join(', ') + '\n',
);
