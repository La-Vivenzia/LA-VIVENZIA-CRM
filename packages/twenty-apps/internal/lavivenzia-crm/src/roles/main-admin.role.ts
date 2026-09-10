import { defineRole } from 'twenty-sdk/define';

import {
  ROLE_MAIN_ADMIN_ID,
} from 'src/constants/universal-identifiers';

export default defineRole({
  universalIdentifier: ROLE_MAIN_ADMIN_ID,
  label: 'Main Admin',
  description:
    'Full system access, including the permanently destructive actions SECURITY-RBAC.md reserves for this role alone.',
  canUpdateAllSettings: true,
  canAccessAllTools: true,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: true,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: true,
});
