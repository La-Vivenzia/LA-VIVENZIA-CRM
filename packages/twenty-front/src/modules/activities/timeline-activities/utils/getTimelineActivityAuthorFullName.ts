import { type TimelineActivity } from '@/activities/timeline-activities/types/TimelineActivity';
import { type CurrentWorkspaceMember } from '@/auth/states/currentWorkspaceMemberState';
import { isDefined } from 'twenty-shared/utils';

export const getTimelineActivityAuthorFullName = (
  event: TimelineActivity,
  currentWorkspaceMember: CurrentWorkspaceMember,
) => {
  if (isDefined(event.workspaceMember)) {
    return currentWorkspaceMember.id === event.workspaceMember.id
      ? 'You'
      : `${event.workspaceMember?.name.firstName} ${event.workspaceMember?.name.lastName}`;
  }
  // System-authored events (automations, logic functions) are attributed to
  // the product, not to the upstream vendor (CM-005).
  return 'La Vivenzia CRM';
};
