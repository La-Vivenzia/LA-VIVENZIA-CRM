import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { FN_MARK_NOTIFICATION_READ_ID } from 'src/constants/universal-identifiers';
import { createCoreApiMarkReadPort } from 'src/modules/lv-notifications/services/core-api-mark-read-port';
import { markNotificationRead } from 'src/modules/lv-notifications/services/mark-read';
import { readRouteInput } from 'src/modules/lv-core/utils/route-event';

// POST /notifications/mark-read  { notificationId }
//
// The actor is the authenticated workspace member from the event — a body
// cannot name a recipient. The write runs as the application role (the team
// roles cannot edit notifications) and is confined to the actor's own row by
// the recipient check in mark-read.ts.

type Input = { notificationId?: string };

export const handler = async (event: unknown): Promise<Record<string, unknown>> => {
  const { input, actorWorkspaceMemberId } = readRouteInput<Input>(event);

  if (!input.notificationId) {
    return { ok: false, error: 'notificationId is required.' };
  }

  const result = await markNotificationRead({
    port: createCoreApiMarkReadPort(new CoreApiClient({ runAs: 'application' })),
    notificationId: input.notificationId,
    actorWorkspaceMemberId,
    now: new Date().toISOString(),
  });

  return result.ok
    ? { ok: true, updated: result.updated }
    : { ok: false, refusal: result.refusal, error: result.error };
};

export default defineLogicFunction({
  universalIdentifier: FN_MARK_NOTIFICATION_READ_ID,
  name: 'lv-mark-notification-read',
  description: 'Marks one of the caller’s own notifications as read',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/notifications/mark-read',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
