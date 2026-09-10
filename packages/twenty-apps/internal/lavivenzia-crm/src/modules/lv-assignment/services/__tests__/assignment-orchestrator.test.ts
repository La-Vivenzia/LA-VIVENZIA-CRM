import { describe, expect, it, vi } from 'vitest';

import {
  assignLead,
  type AssignmentPort,
  type AssignmentTarget,
} from 'src/modules/lv-assignment/services/assignment-orchestrator';
import {
  aCandidate,
  NOW,
} from 'src/modules/lv-assignment/utils/__tests__/test-helpers';

const aLead = (overrides: Partial<AssignmentTarget> = {}): AssignmentTarget => ({
  id: 'lead-1',
  name: 'Forest Table',
  currentOwnerWorkspaceMemberId: null,
  status: 'NEW',
  priority: 'MEDIUM',
  category: 'STAY',
  location: 'Lonavala',
  ...overrides,
});

const aPort = (overrides: Partial<AssignmentPort> = {}): AssignmentPort => ({
  listAssignableMembers: vi.fn(async () => [
    aCandidate({ workspaceMemberId: 'a', categories: ['STAY'] }),
    aCandidate({ workspaceMemberId: 'b' }),
  ]),
  listActiveRules: vi.fn(async () => []),
  findExistingRelationshipOwnerId: vi.fn(async () => null),
  applyOwner: vi.fn(async () => undefined),
  recordHistory: vi.fn(async () => true),
  upsertNotifications: vi.fn(async () => undefined),
  ...overrides,
});

describe('assignLead', () => {
  it('assigns, records history and notifies in one pass', async () => {
    const port = aPort();

    const outcome = await assignLead({ lead: aLead(), port, now: NOW });

    expect(outcome.decision.assigneeWorkspaceMemberId).toBe('a');
    expect(outcome.ownerChanged).toBe(true);
    expect(outcome.historyRecorded).toBe(true);
    expect(outcome.notificationsSent).toBe(1);
    expect(port.applyOwner).toHaveBeenCalledOnce();
    expect(port.recordHistory).toHaveBeenCalledOnce();
    expect(port.upsertNotifications).toHaveBeenCalledOnce();
  });

  it('advances a new lead to ASSIGNED', async () => {
    const port = aPort();

    await assignLead({ lead: aLead({ status: 'NEW' }), port, now: NOW });

    expect(port.applyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ASSIGNED', assignedAt: NOW }),
    );
  });

  it('does not rewind the funnel when reassigning a worked lead', async () => {
    const port = aPort();

    await assignLead({
      lead: aLead({ status: 'INTERESTED', currentOwnerWorkspaceMemberId: 'b' }),
      port,
      now: NOW,
    });

    expect(port.applyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'INTERESTED' }),
    );
  });

  it('writes nothing when the owner does not change', async () => {
    const port = aPort({
      listAssignableMembers: vi.fn(async () => [
        aCandidate({ workspaceMemberId: 'a', categories: ['STAY'] }),
      ]),
    });

    const outcome = await assignLead({
      lead: aLead({ currentOwnerWorkspaceMemberId: 'a' }),
      port,
      now: NOW,
    });

    expect(outcome.ownerChanged).toBe(false);
    expect(port.applyOwner).not.toHaveBeenCalled();
    expect(port.recordHistory).not.toHaveBeenCalled();
    expect(port.upsertNotifications).not.toHaveBeenCalled();
  });

  it('records history for an explicit human re-run even when nothing changed', async () => {
    const port = aPort({
      listAssignableMembers: vi.fn(async () => [
        aCandidate({ workspaceMemberId: 'a', categories: ['STAY'] }),
      ]),
    });

    const outcome = await assignLead({
      lead: aLead({ currentOwnerWorkspaceMemberId: 'a' }),
      port,
      now: NOW,
      isExplicitAction: true,
      actorWorkspaceMemberId: 'admin',
    });

    expect(outcome.historyRecorded).toBe(true);
    expect(port.recordHistory).toHaveBeenCalledOnce();
  });

  it('honours a manual assignee', async () => {
    const port = aPort();

    const outcome = await assignLead({
      lead: aLead(),
      port,
      now: NOW,
      manualAssigneeId: 'b',
      actorWorkspaceMemberId: 'admin',
      actorDisplayName: 'Tim Apple',
    });

    expect(outcome.decision.strategy).toBe('MANUAL');
    expect(outcome.decision.assigneeWorkspaceMemberId).toBe('b');
  });

  it('keeps the prior owner when a relationship already exists', async () => {
    const port = aPort({
      findExistingRelationshipOwnerId: vi.fn(async () => 'b'),
    });

    const outcome = await assignLead({ lead: aLead(), port, now: NOW });

    expect(outcome.decision.strategy).toBe('EXISTING_RELATIONSHIP');
    expect(outcome.decision.assigneeWorkspaceMemberId).toBe('b');
  });

  it('applies a matching rule', async () => {
    const port = aPort({
      listActiveRules: vi.fn(async () => [
        {
          id: 'r1',
          name: 'Stay leads to B',
          isActive: true,
          priority: 0,
          whenCategory: 'STAY',
          assigneeWorkspaceMemberId: 'b',
        },
      ]),
    });

    const outcome = await assignLead({ lead: aLead(), port, now: NOW });

    expect(outcome.decision.strategy).toBe('RULE');
    expect(outcome.decision.assigneeWorkspaceMemberId).toBe('b');
  });

  describe('when no one can take the lead', () => {
    it('leaves it unowned but still records why', async () => {
      const port = aPort({ listAssignableMembers: vi.fn(async () => []) });

      const outcome = await assignLead({ lead: aLead(), port, now: NOW });

      expect(outcome.decision.assigneeWorkspaceMemberId).toBeNull();
      expect(port.applyOwner).not.toHaveBeenCalled();
      expect(port.recordHistory).toHaveBeenCalledOnce();
      expect(outcome.notificationsSent).toBe(0);
    });

    it('explains the reason in history', async () => {
      const port = aPort({ listAssignableMembers: vi.fn(async () => []) });

      await assignLead({ lead: aLead(), port, now: NOW });

      expect(port.recordHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          toWorkspaceMemberId: null,
          reason: expect.stringContaining('No team members'),
        }),
      );
    });
  });

  it('passes a stable clock through to every write', async () => {
    const port = aPort();

    await assignLead({ lead: aLead(), port, now: NOW });

    expect(port.recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ assignedAt: NOW }),
    );
  });

  it('attributes an automatic assignment to no one', async () => {
    const port = aPort();

    await assignLead({ lead: aLead(), port, now: NOW });

    expect(port.upsertNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ body: expect.stringContaining('automatically') }),
    ]);
  });
});

describe('idempotency', () => {
  it('passes the event key through to the history entry', async () => {
    const port = aPort();

    await assignLead({
      lead: aLead(),
      port,
      now: NOW,
      eventKey: 'lvLead.created:lead-1',
    });

    expect(port.recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: 'lvLead.created:lead-1' }),
    );
  });

  it('reports historyRecorded=false when the port rejects a replay', async () => {
    // What the real port does when the unique index on eventKey fires.
    const port = aPort({ recordHistory: vi.fn(async () => false) });

    const outcome = await assignLead({
      lead: aLead(),
      port,
      now: NOW,
      eventKey: 'lvLead.created:lead-1',
    });

    expect(outcome.historyRecorded).toBe(false);
    // The owner is still applied: replaying must converge on the same state,
    // not skip the work.
    expect(port.applyOwner).toHaveBeenCalledOnce();
  });

  it('defaults the event key to null so explicit actions always append', async () => {
    const port = aPort();

    await assignLead({
      lead: aLead(),
      port,
      now: NOW,
      isExplicitAction: true,
      actorWorkspaceMemberId: 'admin',
    });

    expect(port.recordHistory).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: null }),
    );
  });
});
