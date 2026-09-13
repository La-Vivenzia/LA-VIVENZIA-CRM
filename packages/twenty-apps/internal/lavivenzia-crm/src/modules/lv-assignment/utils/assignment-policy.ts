// Who may change a lead's owner by hand. Pure, so the rule is testable and
// the route and the page cannot disagree about it.
//
//   - an administrator may reassign any lead they can see;
//   - the current owner may hand their own lead to a colleague or release it;
//   - anyone who may edit leads may CLAIM an unassigned lead for themselves —
//     and only for themselves, so a hunter cannot route stray leads to a
//     friend.
// The assignment engine's automatic decisions are unaffected: this is the
// manual path only, and it records history with strategy MANUAL.

export type OwnerChangeDecision =
  | { ok: true; kind: 'REASSIGN' | 'HANDOVER' | 'RELEASE' | 'CLAIM' }
  | { ok: false; error: string };

export const decideOwnerChange = ({
  actorWorkspaceMemberId,
  isAdmin,
  canEditLead,
  currentOwnerId,
  newOwnerId,
}: {
  actorWorkspaceMemberId: string;
  isAdmin: boolean;
  canEditLead: boolean;
  currentOwnerId: string | null;
  newOwnerId: string | null;
}): OwnerChangeDecision => {
  if (!canEditLead && !isAdmin) {
    return { ok: false, error: 'Your role cannot change lead ownership.' };
  }

  if (currentOwnerId === newOwnerId) {
    return { ok: false, error: newOwnerId === null ? 'The lead is already unassigned.' : 'That member already owns this lead.' };
  }

  if (isAdmin) {
    return { ok: true, kind: newOwnerId === null ? 'RELEASE' : currentOwnerId === null ? 'CLAIM' : 'REASSIGN' };
  }

  if (currentOwnerId === actorWorkspaceMemberId) {
    return { ok: true, kind: newOwnerId === null ? 'RELEASE' : 'HANDOVER' };
  }

  if (currentOwnerId === null && newOwnerId === actorWorkspaceMemberId) {
    return { ok: true, kind: 'CLAIM' };
  }

  return {
    ok: false,
    error: currentOwnerId === null ? 'You can claim an unassigned lead for yourself only.' : 'Only the current owner or an administrator can reassign this lead.',
  };
};
