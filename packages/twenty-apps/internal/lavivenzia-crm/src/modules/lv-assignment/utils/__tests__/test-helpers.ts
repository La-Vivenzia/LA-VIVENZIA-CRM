import {
  type AssignmentCandidate,
  type AssignmentRule,
} from 'src/modules/lv-assignment/types/assignment.types';

export const NOW = '2026-09-09T10:00:00.000Z';

export const aCandidate = (
  overrides: Partial<AssignmentCandidate> & Pick<AssignmentCandidate, 'workspaceMemberId'>,
): AssignmentCandidate => ({
  displayName: overrides.workspaceMemberId,
  isActive: true,
  regions: [],
  categories: [],
  subcategories: [],
  languages: [],
  capacity: 20,
  openLeadCount: 0,
  lastAssignedAt: null,
  ...overrides,
});

export const aRule = (
  overrides: Partial<AssignmentRule> &
    Pick<AssignmentRule, 'id' | 'assigneeWorkspaceMemberId'>,
): AssignmentRule => ({
  name: `rule-${overrides.id}`,
  isActive: true,
  priority: 0,
  ...overrides,
});
