import { defineRole } from 'twenty-sdk/define';

import {
  ROLE_MANAGEMENT_ID,
} from 'src/constants/universal-identifiers';

// Grants no update permission at all. Read access is workspace-wide because
// row-level ownership is not enforceable here — see SECURITY-RBAC.md.

export default defineRole({
  universalIdentifier: ROLE_MANAGEMENT_ID,
  label: 'Management',
  description:
    'Read-only oversight of the whole pipeline. Deliberately cannot modify any record.',
  canUpdateAllSettings: false,
  canAccessAllTools: false,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: true,
});
