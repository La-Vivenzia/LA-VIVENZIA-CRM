import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type MarkReadPort } from 'src/modules/lv-notifications/services/mark-read';

// CoreApiClient-backed MarkReadPort. Constructed with the application role by
// the routes; the recipient check in mark-read.ts is what keeps it honest.

export const createCoreApiMarkReadPort = (client: CoreApiClient): MarkReadPort => ({
  findRecipient: async (notificationId) => {
    const result = await client.query({
      lvNotification: {
        __args: { filter: { id: { eq: notificationId } } },
        recipientId: true,
      },
    });

    return (
      (result as { lvNotification?: { recipientId?: string | null } | null }).lvNotification
        ?.recipientId ?? null
    );
  },

  markRead: async ({ notificationIds, readAt }) => {
    let updated = 0;

    for (const id of notificationIds) {
      const result = await client.mutation({
        updateLvNotification: {
          __args: { id, data: { isRead: true, readAt } },
          id: true,
        },
      });

      if ((result as { updateLvNotification?: { id?: string } }).updateLvNotification?.id) {
        updated += 1;
      }
    }

    return updated;
  },

  listUnreadIds: async (recipientWorkspaceMemberId) => {
    const result = await client.query({
      lvNotifications: {
        __args: {
          first: 200,
          filter: {
            recipientId: { eq: recipientWorkspaceMemberId },
            isRead: { eq: false },
          },
        },
        edges: { node: { id: true } },
      },
    });

    return (
      (result as { lvNotifications?: { edges?: { node?: { id?: string } }[] } }).lvNotifications
        ?.edges?.map((edge) => edge.node?.id)
        .filter((id): id is string => typeof id === 'string') ?? []
    );
  },
});
