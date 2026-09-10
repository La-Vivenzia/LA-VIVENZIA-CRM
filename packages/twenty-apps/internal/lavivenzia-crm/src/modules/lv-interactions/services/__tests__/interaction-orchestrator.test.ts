import { describe, expect, it, vi } from 'vitest';

import {
  applyInteraction,
  computeLeadPatch,
  type InteractionPort,
  type InteractionRecord,
} from 'src/modules/lv-interactions/services/interaction-orchestrator';

const OCCURRED_AT = '2026-09-09T10:00:00.000Z';

const anInteraction = (
  overrides: Partial<InteractionRecord> = {},
): InteractionRecord => ({
  id: 'int-1',
  leadId: 'lead-1',
  leadName: 'Forest Table',
  channel: 'PHONE',
  occurredAt: OCCURRED_AT,
  ...overrides,
});

const aPort = (overrides: Partial<InteractionPort> = {}): InteractionPort => ({
  getLead: vi.fn(async () => ({
    id: 'lead-1',
    ownerWorkspaceMemberId: 'owner',
    lastInteractionAt: null,
  })),
  updateLeadSummary: vi.fn(async () => undefined),
  createFollowUpTask: vi.fn(async () => ({ id: 'task-1' })),
  ...overrides,
});

describe('computeLeadPatch', () => {
  it('advances last interaction for outward contact', () => {
    const patch = computeLeadPatch({
      interaction: anInteraction({ channel: 'PHONE' }),
      currentLastInteractionAt: null,
      followUp: null,
    });

    expect(patch.lastInteractionAt).toBe(OCCURRED_AT);
  });

  it('does NOT advance last interaction for an internal note', () => {
    const patch = computeLeadPatch({
      interaction: anInteraction({ channel: 'INTERNAL_NOTE' }),
      currentLastInteractionAt: null,
      followUp: null,
    });

    expect(patch.lastInteractionAt).toBeUndefined();
  });

  it('does not advance for a form submission either', () => {
    expect(
      computeLeadPatch({
        interaction: anInteraction({ channel: 'FORM' }),
        currentLastInteractionAt: null,
        followUp: null,
      }).lastInteractionAt,
    ).toBeUndefined();
  });

  it('does not rewind on a back-dated entry', () => {
    const patch = computeLeadPatch({
      interaction: anInteraction({ occurredAt: '2026-01-01T10:00:00.000Z' }),
      currentLastInteractionAt: '2026-09-01T10:00:00.000Z',
      followUp: null,
    });

    expect(patch.lastInteractionAt).toBeUndefined();
  });

  it('advances when the interaction is newer than the stored value', () => {
    const patch = computeLeadPatch({
      interaction: anInteraction(),
      currentLastInteractionAt: '2026-09-01T10:00:00.000Z',
      followUp: null,
    });

    expect(patch.lastInteractionAt).toBe(OCCURRED_AT);
  });

  it('mirrors the follow-up onto the lead next-action fields', () => {
    const patch = computeLeadPatch({
      interaction: anInteraction(),
      currentLastInteractionAt: null,
      followUp: {
        title: 'Send pricing',
        body: '',
        dueAt: '2026-09-11T10:00:00.000Z',
        priority: 'HIGH',
        assigneeWorkspaceMemberId: 'owner',
        leadId: 'lead-1',
        sourceInteractionId: 'int-1',
      },
    });

    expect(patch.nextAction).toBe('Send pricing');
    expect(patch.nextFollowUpAt).toBe('2026-09-11T10:00:00.000Z');
  });

  it('clears the next action when the conversation closed', () => {
    const patch = computeLeadPatch({
      interaction: anInteraction({ outcome: 'NOT_INTERESTED' }),
      currentLastInteractionAt: null,
      followUp: null,
    });

    expect(patch.nextAction).toBeNull();
    expect(patch.nextFollowUpAt).toBeNull();
  });
});

describe('applyInteraction', () => {
  it('updates the lead and creates the follow-up task', async () => {
    const port = aPort();

    const outcome = await applyInteraction({ interaction: anInteraction(), port });

    expect(port.updateLeadSummary).toHaveBeenCalledOnce();
    expect(port.createFollowUpTask).toHaveBeenCalledOnce();
    expect(outcome.followUpTaskId).toBe('task-1');
    expect(outcome.skippedReason).toBeNull();
  });

  it('assigns the follow-up to the lead owner', async () => {
    const port = aPort();

    await applyInteraction({
      interaction: anInteraction({ actorWorkspaceMemberId: 'stand-in' }),
      port,
    });

    expect(port.createFollowUpTask).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeWorkspaceMemberId: 'owner' }),
    );
  });

  it('creates no task after a closing outcome, but still updates the lead', async () => {
    const port = aPort();

    const outcome = await applyInteraction({
      interaction: anInteraction({ outcome: 'NOT_INTERESTED' }),
      port,
    });

    expect(port.createFollowUpTask).not.toHaveBeenCalled();
    expect(port.updateLeadSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ nextAction: null }),
      }),
    );
    expect(outcome.followUp).toBeNull();
  });

  it('stops cleanly when the lead has gone', async () => {
    const port = aPort({ getLead: vi.fn(async () => null) });

    const outcome = await applyInteraction({ interaction: anInteraction(), port });

    expect(outcome.skippedReason).toContain('no longer exists');
    expect(port.updateLeadSummary).not.toHaveBeenCalled();
    expect(port.createFollowUpTask).not.toHaveBeenCalled();
  });

  it('reports when the task could not be created', async () => {
    const port = aPort({ createFollowUpTask: vi.fn(async () => null) });

    const outcome = await applyInteraction({ interaction: anInteraction(), port });

    expect(outcome.followUp).not.toBeNull();
    expect(outcome.followUpTaskId).toBeNull();
  });

  it('logs an internal note without touching last interaction', async () => {
    const port = aPort();

    await applyInteraction({
      interaction: anInteraction({ channel: 'INTERNAL_NOTE' }),
      port,
    });

    const call = vi.mocked(port.updateLeadSummary).mock.calls[0]?.[0];

    expect(call?.patch.lastInteractionAt).toBeUndefined();
  });
});
