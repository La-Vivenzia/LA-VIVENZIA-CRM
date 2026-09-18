import 'src/modules/lv-core/runtime/resilient-fetch';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_MARK_ALL_NOTIFICATIONS_READ_ID } from 'src/constants/universal-identifiers';
import { createCoreApiMarkReadPort } from 'src/modules/lv-notifications/services/core-api-mark-read-port';
import { markAllNotificationsRead } from 'src/modules/lv-notifications/services/mark-read';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';

// POST /notifications/mark-all-read
//
// "All" means all of the caller's own unread notifications — the recipient is
// the authenticated member from the event, so there is nothing a body could
// say to widen it.

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { actorWorkspaceMemberId } = readRouteInput<Record<string, never>>(event);

  const result = await markAllNotificationsRead({
    port: createCoreApiMarkReadPort(new CoreApiClient({ runAs: 'application' })),
    actorWorkspaceMemberId,
    now: new Date().toISOString(),
  });

  return result.ok
    ? { ok: true, updated: result.updated }
    : { ok: false, refusal: result.refusal, error: result.error };
};

export default defineLogicFunction({
  universalIdentifier: FN_MARK_ALL_NOTIFICATIONS_READ_ID,
  name: 'lv-mark-all-notifications-read',
  description: 'Marks every unread notification of the caller as read',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/notifications/mark-all-read',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
