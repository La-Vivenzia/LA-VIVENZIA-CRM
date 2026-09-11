// Read-state changes for the notification centre.
//
// Why routes rather than the front end updating the row directly: the LV team
// roles deliberately have no write permission on lvNotification (a Hunter
// cannot edit notifications), and granting it would let a user edit any
// field of any notification CM-004 lets them see. Instead the route takes the
// actor from the authenticated session, and the application role flips
// isRead only on rows whose recipient IS that actor. The client says which
// notification; the server decides whose.

export type MarkReadPort = {
  // Returns the recipient of the notification, or null when it does not exist.
  findRecipient(notificationId: string): Promise<string | null>;
  markRead(input: { notificationIds: string[]; readAt: string }): Promise<number>;
  listUnreadIds(recipientWorkspaceMemberId: string): Promise<string[]>;
};

export type MarkReadResult =
  | { ok: true; updated: number }
  | { ok: false; refusal: 'NOT_AUTHENTICATED' | 'NOT_FOUND' | 'NOT_THE_RECIPIENT'; error: string };

export const markNotificationRead = async ({
  port,
  notificationId,
  actorWorkspaceMemberId,
  now,
}: {
  port: MarkReadPort;
  notificationId: string;
  actorWorkspaceMemberId: string | null;
  now: string;
}): Promise<MarkReadResult> => {
  if (actorWorkspaceMemberId === null) {
    return {
      ok: false,
      refusal: 'NOT_AUTHENTICATED',
      error: 'Only a signed-in team member can mark a notification read.',
    };
  }

  const recipient = await port.findRecipient(notificationId);

  if (recipient === null) {
    // Indistinguishable from "not yours" on purpose: the existence of someone
    // else's notification is itself information.
    return { ok: false, refusal: 'NOT_FOUND', error: 'That notification does not exist.' };
  }

  if (recipient !== actorWorkspaceMemberId) {
    return {
      ok: false,
      refusal: 'NOT_THE_RECIPIENT',
      error: 'That notification does not exist.',
    };
  }

  const updated = await port.markRead({ notificationIds: [notificationId], readAt: now });

  return { ok: true, updated };
};

export const markAllNotificationsRead = async ({
  port,
  actorWorkspaceMemberId,
  now,
}: {
  port: MarkReadPort;
  actorWorkspaceMemberId: string | null;
  now: string;
}): Promise<MarkReadResult> => {
  if (actorWorkspaceMemberId === null) {
    return {
      ok: false,
      refusal: 'NOT_AUTHENTICATED',
      error: 'Only a signed-in team member can mark notifications read.',
    };
  }

  const ids = await port.listUnreadIds(actorWorkspaceMemberId);

  if (ids.length === 0) {
    return { ok: true, updated: 0 };
  }

  const updated = await port.markRead({ notificationIds: ids, readAt: now });

  return { ok: true, updated };
};
