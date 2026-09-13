import { describe, expect, it } from 'vitest';

import {
  decideLifecycleAction,
  isClosedOrArchived,
  isDeletableObject,
  isLifecycleAction,
  LIFECYCLE_TARGET_STATUS,
} from 'src/modules/lv-governance/services/governance';

describe('lifecycle actions (the non-destructive alternatives to delete)', () => {
  it('maps each action to a real lifecycle status', () => {
    expect(LIFECYCLE_TARGET_STATUS).toEqual({ ARCHIVE: 'DORMANT', CLOSE: 'LOST', MARK_DUPLICATE: 'DUPLICATE', REOPEN: 'QUALIFYING' });
    expect(isLifecycleAction('ARCHIVE')).toBe(true);
    expect(isLifecycleAction('DELETE')).toBe(false);
  });

  it('archive needs no reason; close and mark-duplicate do', () => {
    expect(decideLifecycleAction({ action: 'ARCHIVE', currentStatus: 'NEW', reason: null })).toEqual({ ok: true, toStatus: 'DORMANT', auditAction: 'ARCHIVE' });
    expect(decideLifecycleAction({ action: 'CLOSE', currentStatus: 'NEW', reason: '' })).toMatchObject({ ok: false });
    expect(decideLifecycleAction({ action: 'MARK_DUPLICATE', currentStatus: 'NEW', reason: 'ab' })).toMatchObject({ ok: false });
    expect(decideLifecycleAction({ action: 'MARK_DUPLICATE', currentStatus: 'NEW', reason: 'same partner as LV-000003' })).toEqual({ ok: true, toStatus: 'DUPLICATE', auditAction: 'MARK_DUPLICATE' });
  });

  it('close accepts a specific closing status and rejects a non-closing one', () => {
    expect(decideLifecycleAction({ action: 'CLOSE', currentStatus: 'ENGAGED', requestedStatus: 'NOT_INTERESTED', reason: 'said no' })).toMatchObject({ ok: true, toStatus: 'NOT_INTERESTED' });
    expect(decideLifecycleAction({ action: 'CLOSE', currentStatus: 'ENGAGED', requestedStatus: 'LIVE_ACTIVE', reason: 'said no' })).toMatchObject({ ok: true, toStatus: 'LOST' });
  });

  it('only a closed, archived or duplicate lead can be reopened', () => {
    expect(decideLifecycleAction({ action: 'REOPEN', currentStatus: 'DORMANT', reason: null })).toMatchObject({ ok: true, toStatus: 'QUALIFYING' });
    expect(decideLifecycleAction({ action: 'REOPEN', currentStatus: 'DUPLICATE', reason: null })).toMatchObject({ ok: true });
    expect(decideLifecycleAction({ action: 'REOPEN', currentStatus: 'ENGAGED', reason: null })).toMatchObject({ ok: false });
    expect(isClosedOrArchived('LOST')).toBe(true);
    expect(isClosedOrArchived('NEW')).toBe(false);
  });

  it('refuses a no-op', () => {
    expect(decideLifecycleAction({ action: 'ARCHIVE', currentStatus: 'DORMANT', reason: null })).toMatchObject({ ok: false });
  });
});

describe('permanent delete', () => {
  it('only lead, onboarding and document have a delete-impact pre-flight', () => {
    expect(isDeletableObject('lvLead')).toBe(true);
    expect(isDeletableObject('lvOnboarding')).toBe(true);
    expect(isDeletableObject('lvOnboardingDocument')).toBe(true);
    expect(isDeletableObject('lvNotification')).toBe(false);
    expect(isDeletableObject('workspaceMember')).toBe(false);
  });
});

describe('SET_STATUS — the governed forward step (Day 7)', () => {
  it('moves along the main flow and into the holding states, audited as STATUS_CHANGE', () => {
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'CONTACTED', requestedStatus: 'ENGAGED', reason: null })).toEqual({ ok: true, toStatus: 'ENGAGED', auditAction: 'STATUS_CHANGE' });
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'ENGAGED', requestedStatus: 'FOLLOW_UP_LATER', reason: null })).toMatchObject({ ok: true, toStatus: 'FOLLOW_UP_LATER' });
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'INTERESTED', requestedStatus: 'CONTACTED', reason: null })).toMatchObject({ ok: true });
  });

  it('refuses closing, duplicate, dormant and onboarding-mirrored targets, no-ops and closed leads', () => {
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'ENGAGED', requestedStatus: 'LOST', reason: 'x' })).toMatchObject({ ok: false });
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'ENGAGED', requestedStatus: 'DUPLICATE', reason: 'x' })).toMatchObject({ ok: false });
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'ENGAGED', requestedStatus: 'LIVE_ACTIVE', reason: null })).toMatchObject({ ok: false });
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'ENGAGED', requestedStatus: 'ENGAGED', reason: null })).toMatchObject({ ok: false });
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'LOST', requestedStatus: 'ENGAGED', reason: null })).toMatchObject({ ok: false });
    expect(decideLifecycleAction({ action: 'SET_STATUS', currentStatus: 'ENGAGED', requestedStatus: undefined, reason: null })).toMatchObject({ ok: false });
  });
});
