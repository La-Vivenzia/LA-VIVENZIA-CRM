import { normalizeNameForMatching } from 'src/modules/lv-capture/utils/normalize-input';

// Deterministic string similarity. This is the Phase 1 foundation for
// PRODUCT-REQUIREMENTS.md "Duplicate detection" — a real algorithm with stable,
// explainable output, not a model. Phase 2 may add an embedding pass on top;
// nothing here needs to change when it does.

const bigrams = (value: string): string[] => {
  if (value.length < 2) {
    return value.length === 1 ? [value] : [];
  }

  const result: string[] = [];

  for (let index = 0; index < value.length - 1; index += 1) {
    result.push(value.slice(index, index + 2));
  }

  return result;
};

// Sørensen-Dice over character bigrams. Multiset-aware, so repeated bigrams do
// not inflate the score.
export const diceCoefficient = (left: string, right: string): number => {
  if (left === right) {
    return left.length === 0 ? 0 : 1;
  }

  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);

  if (leftBigrams.length === 0 || rightBigrams.length === 0) {
    return 0;
  }

  const remaining = new Map<string, number>();

  for (const bigram of rightBigrams) {
    remaining.set(bigram, (remaining.get(bigram) ?? 0) + 1);
  }

  let matches = 0;

  for (const bigram of leftBigrams) {
    const available = remaining.get(bigram) ?? 0;

    if (available > 0) {
      matches += 1;
      remaining.set(bigram, available - 1);
    }
  }

  return (2 * matches) / (leftBigrams.length + rightBigrams.length);
};

const tokenSet = (value: string): Set<string> =>
  new Set(value.split(' ').filter((token) => token.length > 0));

// Share of the SHORTER name's words that also appear in the longer one. This is
// what catches "The Forest Table" vs "The Forest Table Pune": one name is the
// other plus a location qualifier, which Dice alone under-scores.
export const tokenContainment = (left: string, right: string): number => {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const [smaller, larger] =
    leftTokens.size <= rightTokens.size
      ? [leftTokens, rightTokens]
      : [rightTokens, leftTokens];

  let shared = 0;

  for (const token of smaller) {
    if (larger.has(token)) {
      shared += 1;
    }
  }

  return shared / smaller.size;
};

// Blend chosen so a name that is a strict extension of another scores high
// without collapsing to 1.0 — a reviewer still has to decide, which is what
// PRODUCT-REQUIREMENTS.md asks for (Merge / Create New / Ignore).
const DICE_WEIGHT = 0.6;
const CONTAINMENT_WEIGHT = 0.4;

export const nameSimilarity = (
  left: string | null | undefined,
  right: string | null | undefined,
): number => {
  const normalizedLeft = normalizeNameForMatching(left);
  const normalizedRight = normalizeNameForMatching(right);

  if (normalizedLeft.length === 0 || normalizedRight.length === 0) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const score =
    DICE_WEIGHT * diceCoefficient(normalizedLeft, normalizedRight) +
    CONTAINMENT_WEIGHT * tokenContainment(normalizedLeft, normalizedRight);

  return Math.min(1, Math.max(0, score));
};

// Percentage as shown in the UI ("91%"). Rounded, never fabricated precision.
export const similarityPercent = (score: number): number =>
  Math.round(score * 100);
