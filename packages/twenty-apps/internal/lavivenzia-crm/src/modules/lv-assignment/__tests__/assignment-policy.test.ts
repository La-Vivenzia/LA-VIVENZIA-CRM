import { describe, expect, it } from 'vitest';

import { decideOwnerChange } from 'src/modules/lv-assignment/utils/assignment-policy';
import { dueAtFor, QUICK_ACTIONS, quickAction } from 'src/modules/lv-followups/utils/quick-actions';

// Manual ownership changes: administrators reassign; owners hand over or
// release; anyone with lead write may claim an unassigned lead for
// themselves only.

const ME = 'member-me';
const OTHER = 'member-other';

describe('decideOwnerChange', () => {
  it('lets an administrator reassign, claim on behalf and release', () => {
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: true, canEditLead: true, currentOwnerId: OTHER, newOwnerId: ME })).toEqual({ ok: true, kind: 'REASSIGN' });
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: true, canEditLead: false, currentOwnerId: null, newOwnerId: OTHER })).toEqual({ ok: true, kind: 'CLAIM' });
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: true, canEditLead: true, currentOwnerId: OTHER, newOwnerId: null })).toEqual({ ok: true, kind: 'RELEASE' });
  });

  it('lets the owner hand over or release their own lead', () => {
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: false, canEditLead: true, currentOwnerId: ME, newOwnerId: OTHER })).toEqual({ ok: true, kind: 'HANDOVER' });
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: false, canEditLead: true, currentOwnerId: ME, newOwnerId: null })).toEqual({ ok: true, kind: 'RELEASE' });
  });

  it('a hunter may claim an unassigned lead only for themselves', () => {
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: false, canEditLead: true, currentOwnerId: null, newOwnerId: ME })).toEqual({ ok: true, kind: 'CLAIM' });
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: false, canEditLead: true, currentOwnerId: null, newOwnerId: OTHER })).toMatchObject({ ok: false });
  });

  it('refuses reassigning someone else’s lead, a role without lead write, and a no-op', () => {
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: false, canEditLead: true, currentOwnerId: OTHER, newOwnerId: ME })).toMatchObject({ ok: false });
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: false, canEditLead: false, currentOwnerId: ME, newOwnerId: OTHER })).toMatchObject({ ok: false });
    expect(decideOwnerChange({ actorWorkspaceMemberId: ME, isAdmin: true, canEditLead: true, currentOwnerId: ME, newOwnerId: ME })).toMatchObject({ ok: false });
  });
});

describe('quick actions', () => {
  it('every quick action has a title, priority and a due date at its working hour', () => {
    const now = '2026-09-13T10:00:00.000Z';

    for (const action of QUICK_ACTIONS) {
      expect(quickAction(action.key)).toBe(action);
      const due = dueAtFor(action, now, 0);

      expect(Date.parse(due)).toBeGreaterThan(Date.parse(now));
      expect(new Date(due).getUTCHours()).toBe(action.dueHourLocal);
    }

    expect(quickAction('NOT_A_KEY')).toBeNull();
  });

  it('snaps to the working hour in the browser’s zone (IST = -330 minutes)', () => {
    const due = dueAtFor(QUICK_ACTIONS[0], '2026-09-13T10:00:00.000Z', -330);

    // 11:00 IST is 05:30 UTC.
    expect(due.slice(11, 16)).toBe('05:30');
  });
});
