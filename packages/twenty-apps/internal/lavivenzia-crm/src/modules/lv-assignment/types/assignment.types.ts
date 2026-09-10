import { type LeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';

// A team member who can own a lead, plus the routing attributes an admin
// maintains on their workspace member record.
export type AssignmentCandidate = {
  workspaceMemberId: string;
  displayName: string;
  // Inactive members stay in the list so history renders, but never receive work.
  isActive: boolean;
  // Geography: free-text regions/cities, compared case- and punctuation-insensitively.
  regions: readonly string[];
  // Category-level coverage, e.g. STAY, EXPERIENCE.
  categories: readonly string[];
  // Expertise: finer sub-category coverage, e.g. VILLA, CHEF.
  subcategories: readonly string[];
  languages: readonly string[];
  // Maximum concurrent open leads. 0 disables the member without deactivating them.
  capacity: number;
  // Current open (workload-bearing) leads owned by this member.
  openLeadCount: number;
  // ISO timestamp of their last assignment, for round-robin fairness.
  lastAssignedAt: string | null;
};

// Admin-configured deterministic routing. Evaluated before scoring so an
// explicit business rule always beats a heuristic.
export type AssignmentRule = {
  id: string;
  name: string;
  isActive: boolean;
  // Lower runs first. Ties broken by id for determinism.
  priority: number;
  // All present conditions must match. Absent condition = "any".
  whenCategory?: string | null;
  whenSubcategory?: string | null;
  whenRegion?: string | null;
  whenLanguage?: string | null;
  whenSource?: string | null;
  whenPriority?: LeadPriority | null;
  assigneeWorkspaceMemberId: string;
};

export type AssignmentLead = {
  id?: string;
  category?: string | null;
  subcategory?: string | null;
  location?: string | null;
  languages?: readonly string[] | null;
  source?: string | null;
  priority?: LeadPriority | null;
  organisationName?: string | null;
};

export type AssignmentStrategy =
  | 'MANUAL'
  | 'RULE'
  | 'EXISTING_RELATIONSHIP'
  | 'SCORED'
  | 'ROUND_ROBIN'
  | 'NONE';

export type AssignmentFactor =
  | 'EXISTING_RELATIONSHIP'
  | 'CATEGORY'
  | 'GEOGRAPHY'
  | 'LANGUAGE'
  | 'EXPERTISE';

export type FactorScore = {
  factor: AssignmentFactor;
  weight: number;
  matched: boolean;
  // Human-readable justification. Surfaced in assignment history so a manager
  // can see why the system chose someone.
  detail: string;
};

export type CandidateScore = {
  workspaceMemberId: string;
  total: number;
  factors: readonly FactorScore[];
  openLeadCount: number;
  lastAssignedAt: string | null;
};

export type IneligibilityReason =
  | 'INACTIVE'
  | 'ZERO_CAPACITY'
  | 'AT_CAPACITY'
  | 'CAPACITY_RESERVED_FOR_CRITICAL';

export type AssignmentRequest = {
  lead: AssignmentLead;
  candidates: readonly AssignmentCandidate[];
  rules?: readonly AssignmentRule[];
  // Owner of a previous lead for the same person/organisation. Continuity is
  // the strongest signal we have, so it is the heaviest factor.
  existingRelationshipOwnerId?: string | null;
  // Explicit human choice. Wins over everything when the member can take work.
  manualAssigneeId?: string | null;
  // Injected so results are reproducible in tests and in replayed events.
  now: string;
};

export type AssignmentDecision = {
  assigneeWorkspaceMemberId: string | null;
  strategy: AssignmentStrategy;
  score: number | null;
  reasons: readonly string[];
  scores: readonly CandidateScore[];
  ineligible: ReadonlyArray<{
    workspaceMemberId: string;
    reason: IneligibilityReason;
  }>;
  matchedRuleId: string | null;
  // Set only when assigneeWorkspaceMemberId is null.
  unassignedReason: string | null;
};
