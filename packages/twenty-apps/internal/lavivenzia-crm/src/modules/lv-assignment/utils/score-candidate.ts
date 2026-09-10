import { locationKey } from 'src/modules/lv-capture/utils/normalize-input';
import {
  type AssignmentCandidate,
  type AssignmentFactor,
  type AssignmentLead,
  type CandidateScore,
  type FactorScore,
} from 'src/modules/lv-assignment/types/assignment.types';

// Weights for the routing factors in ASSIGNMENT-SLA-NOTIFICATIONS.md. They sum
// to 100 so a total reads as a percentage fit.
//
// Workload is deliberately NOT an additive weight. It is applied twice
// elsewhere instead — as a hard capacity filter, and as the primary
// round-robin tie-break — because adding it here would let a merely idle
// member outrank a genuinely expert one, which is the opposite of what a lead
// needs. "Lead value" (priority) is applied as a capacity reservation rather
// than a score, for the same reason.
export const FACTOR_WEIGHTS: Record<AssignmentFactor, number> = {
  EXISTING_RELATIONSHIP: 30,
  CATEGORY: 20,
  GEOGRAPHY: 20,
  EXPERTISE: 15,
  LANGUAGE: 15,
};

export const MAX_FACTOR_SCORE = Object.values(FACTOR_WEIGHTS).reduce(
  (sum, weight) => sum + weight,
  0,
);

const normalizeList = (values: readonly string[] | null | undefined): Set<string> =>
  new Set(
    (values ?? [])
      .map((value) => locationKey(value))
      .filter((value) => value.length > 0),
  );

const hasOverlap = (left: Set<string>, right: Set<string>): boolean => {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }

  return false;
};

// A region matches if either side contains the other: a member covering
// "Maharashtra" should still win a lead in "Lonavala, Maharashtra".
const regionMatches = (leadLocation: string, memberRegion: string): boolean =>
  leadLocation === memberRegion ||
  leadLocation.includes(memberRegion) ||
  memberRegion.includes(leadLocation);

export const scoreCandidate = ({
  lead,
  candidate,
  existingRelationshipOwnerId,
}: {
  lead: AssignmentLead;
  candidate: AssignmentCandidate;
  existingRelationshipOwnerId?: string | null;
}): CandidateScore => {
  const factors: FactorScore[] = [];

  // --- existing relationship ------------------------------------------------
  const isExistingOwner =
    existingRelationshipOwnerId !== null &&
    existingRelationshipOwnerId !== undefined &&
    existingRelationshipOwnerId === candidate.workspaceMemberId;

  factors.push({
    factor: 'EXISTING_RELATIONSHIP',
    weight: FACTOR_WEIGHTS.EXISTING_RELATIONSHIP,
    matched: isExistingOwner,
    detail: isExistingOwner
      ? 'Already owns a lead for this person or organisation'
      : 'No prior relationship with this lead',
  });

  // --- category -------------------------------------------------------------
  const leadCategory = locationKey(lead.category);
  const memberCategories = normalizeList(candidate.categories);
  const categoryMatched =
    leadCategory.length > 0 && memberCategories.has(leadCategory);

  factors.push({
    factor: 'CATEGORY',
    weight: FACTOR_WEIGHTS.CATEGORY,
    matched: categoryMatched,
    detail:
      leadCategory.length === 0
        ? 'Lead has no category yet'
        : categoryMatched
          ? `Covers category ${lead.category}`
          : `Does not cover category ${lead.category}`,
  });

  // --- geography ------------------------------------------------------------
  const leadLocation = locationKey(lead.location);
  const memberRegions = [...normalizeList(candidate.regions)];
  const geographyMatched =
    leadLocation.length > 0 &&
    memberRegions.some((region) => regionMatches(leadLocation, region));

  factors.push({
    factor: 'GEOGRAPHY',
    weight: FACTOR_WEIGHTS.GEOGRAPHY,
    matched: geographyMatched,
    detail:
      leadLocation.length === 0
        ? 'Lead has no location yet'
        : geographyMatched
          ? `Covers ${lead.location}`
          : `Does not cover ${lead.location}`,
  });

  // --- expertise (sub-category) --------------------------------------------
  const leadSubcategory = locationKey(lead.subcategory);
  const memberSubcategories = normalizeList(candidate.subcategories);
  const expertiseMatched =
    leadSubcategory.length > 0 && memberSubcategories.has(leadSubcategory);

  factors.push({
    factor: 'EXPERTISE',
    weight: FACTOR_WEIGHTS.EXPERTISE,
    matched: expertiseMatched,
    detail:
      leadSubcategory.length === 0
        ? 'Lead has no sub-category yet'
        : expertiseMatched
          ? `Has expertise in ${lead.subcategory}`
          : `No stated expertise in ${lead.subcategory}`,
  });

  // --- language -------------------------------------------------------------
  const leadLanguages = normalizeList(lead.languages);
  const memberLanguages = normalizeList(candidate.languages);
  const languageMatched =
    leadLanguages.size > 0 && hasOverlap(leadLanguages, memberLanguages);

  factors.push({
    factor: 'LANGUAGE',
    weight: FACTOR_WEIGHTS.LANGUAGE,
    matched: languageMatched,
    detail:
      leadLanguages.size === 0
        ? 'Lead has no language preference'
        : languageMatched
          ? 'Shares a language with the lead'
          : 'Shares no language with the lead',
  });

  const total = factors.reduce(
    (sum, factor) => (factor.matched ? sum + factor.weight : sum),
    0,
  );

  return {
    workspaceMemberId: candidate.workspaceMemberId,
    total,
    factors,
    openLeadCount: candidate.openLeadCount,
    lastAssignedAt: candidate.lastAssignedAt,
  };
};
