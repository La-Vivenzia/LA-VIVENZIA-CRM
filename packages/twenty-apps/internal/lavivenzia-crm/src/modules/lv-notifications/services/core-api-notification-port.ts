import { type CoreApiClient } from 'twenty-client-sdk/core';

import { isUniqueViolation } from 'src/modules/lv-core/services/lead-id-allocator';
import {
  type NotificationPort,
  type NotificationRecord,
  type NotificationWriteResult,
} from 'src/modules/lv-notifications/services/notification-service';

// CoreApiClient-backed NotificationPort. The only place lvNotification rows are
// inserted. Producers construct the client with `runAs: 'application'` — the
// automation role can write a notification for anyone, whereas the delegated
// token of, say, a reviewer approving an onboarding cannot write a row whose
// recipient is the lead's owner.

export const createCoreApiNotificationPort = (
  client: CoreApiClient,
): NotificationPort => ({
  createIfAbsent: async (record: NotificationRecord): Promise<NotificationWriteResult> => {
    try {
      const result = await client.mutation({
        createLvNotification: {
          __args: { data: record },
          id: true,
        },
      });

      const id = (result as { createLvNotification?: { id?: string } }).createLvNotification
        ?.id;

      if (!id) {
        throw new Error('createLvNotification returned no id');
      }

      return { outcome: 'CREATED', id };
    } catch (error) {
      // The unique index on dedupeKey refusing the insert IS the idempotency
      // guarantee. Anything else is a real failure and must surface.
      if (isUniqueViolation(error)) {
        return { outcome: 'DUPLICATE' };
      }

      throw error;
    }
  },
});
