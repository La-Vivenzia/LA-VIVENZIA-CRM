import { describe, expect, it } from 'vitest';

import {
  addHours,
  deriveFollowUp,
  FOLLOW_UP_HOURS_BY_PRIORITY,
  shouldCreateFollowUp,
  suggestedPriority,
  type InteractionForFollowUp,
} from 'src/modules/lv-followups/utils/derive-follow-up';

const OCCURRED_AT = '2026-09-09T10:00:00.000Z';

const anInteraction = (
  overrides: Partial<InteractionForFollowUp> = {},
): InteractionForFollowUp => ({
  id: 'int-1',
  leadId: 'lead-1',
  leadName: 'Forest Table',
  channel: 'PHONE',
  occurredAt: OCCURRED_AT,
  ...overrides,
});

describe('addHours', () => {
  it('advances the timestamp', () => {
    expect(addHours(OCCURRED_AT, 24)).toBe('2026-09-10T10:00:00.000Z');
  });

  it('rejects an unparseable timestamp rather than silently producing NaN', () => {
    expect(() => addHours('not-a-date', 1)).toThrow();
  });
});

describe('suggestedPriority', () => {
  it('raises priority when the lead committed or objected', () => {
    expect(suggestedPriority('COMMITMENT_MADE')).toBe('HIGH');
    expect(suggestedPriority('INTERESTED')).toBe('HIGH');
    expect(suggestedPriority('OBJECTION_RAISED')).toBe('HIGH');
  });

  it('defaults to medium for ordinary outcomes', () => {
    expect(suggestedPriority('CONNECTED')).toBe('MEDIUM');
    expect(suggestedPriority('NO_ANSWER')).toBe('MEDIUM');
  });

  it('defaults to medium when no outcome was recorded', () => {
    expect(suggestedPriority(null)).toBe('MEDIUM');
    expect(suggestedPriority(undefined)).toBe('MEDIUM');
  });
});

describe('shouldCreateFollowUp', () => {
  it('creates one by default', () => {
    expect(shouldCreateFollowUp(anInteraction())).toBe(true);
  });

  it('stays silent after "not interested"', () => {
    expect(shouldCreateFollowUp(anInteraction({ outcome: 'NOT_INTERESTED' }))).toBe(
      false,
    );
  });

  it('still creates one after "not interested" if a human asked for it', () => {
    expect(
      shouldCreateFollowUp(
        anInteraction({ outcome: 'NOT_INTERESTED', nextAction: 'Try again in Q2' }),
      ),
    ).toBe(true);

    expect(
      shouldCreateFollowUp(
        anInteraction({
          outcome: 'NOT_INTERESTED',
          nextFollowUpAt: '2026-12-01T10:00:00.000Z',
        }),
      ),
    ).toBe(true);
  });

  it('ignores a blank next action', () => {
    expect(
      shouldCreateFollowUp(
        anInteraction({ outcome: 'NOT_INTERESTED', nextAction: '   ' }),
      ),
    ).toBe(false);
  });
});

describe('deriveFollowUp', () => {
  it('returns null when no follow-up is warranted', () => {
    expect(deriveFollowUp(anInteraction({ outcome: 'NOT_INTERESTED' }))).toBeNull();
  });

  it('uses the stated next action as the task title', () => {
    const followUp = deriveFollowUp(
      anInteraction({ nextAction: 'Send the villa pricing sheet' }),
    );

    expect(followUp?.title).toBe('Send the villa pricing sheet');
  });

  it('falls back to a readable default title', () => {
    expect(deriveFollowUp(anInteraction())?.title).toBe(
      'Follow up with Forest Table',
    );
  });

  it('trims a padded next action', () => {
    expect(deriveFollowUp(anInteraction({ nextAction: '  Call back  ' }))?.title).toBe(
      'Call back',
    );
  });

  describe('due date', () => {
    it('honours an explicit follow-up date', () => {
      const followUp = deriveFollowUp(
        anInteraction({ nextFollowUpAt: '2026-09-20T09:00:00.000Z' }),
      );

      expect(followUp?.dueAt).toBe('2026-09-20T09:00:00.000Z');
    });

    it('derives from priority when no date was given', () => {
      const followUp = deriveFollowUp(anInteraction({ priority: 'HIGH' }));

      expect(followUp?.dueAt).toBe(
        addHours(OCCURRED_AT, FOLLOW_UP_HOURS_BY_PRIORITY.HIGH),
      );
    });

    it('gives critical work the shortest window', () => {
      const critical = deriveFollowUp(anInteraction({ priority: 'CRITICAL' }));
      const low = deriveFollowUp(anInteraction({ priority: 'LOW' }));

      expect(Date.parse(critical?.dueAt ?? '')).toBeLessThan(
        Date.parse(low?.dueAt ?? ''),
      );
    });

    it('derives priority from the outcome when none was chosen', () => {
      const followUp = deriveFollowUp(anInteraction({ outcome: 'INTERESTED' }));

      expect(followUp?.priority).toBe('HIGH');
      expect(followUp?.dueAt).toBe(
        addHours(OCCURRED_AT, FOLLOW_UP_HOURS_BY_PRIORITY.HIGH),
      );
    });
  });

  describe('assignee', () => {
    it('assigns to the lead owner, not whoever logged the call', () => {
      const followUp = deriveFollowUp(
        anInteraction({
          actorWorkspaceMemberId: 'stand-in',
          leadOwnerWorkspaceMemberId: 'owner',
        }),
      );

      expect(followUp?.assigneeWorkspaceMemberId).toBe('owner');
    });

    it('falls back to the actor when the lead has no owner', () => {
      const followUp = deriveFollowUp(
        anInteraction({ actorWorkspaceMemberId: 'stand-in' }),
      );

      expect(followUp?.assigneeWorkspaceMemberId).toBe('stand-in');
    });

    it('leaves it unassigned when neither is known', () => {
      expect(deriveFollowUp(anInteraction())?.assigneeWorkspaceMemberId).toBeNull();
    });
  });

  it('links back to the interaction that produced it', () => {
    const followUp = deriveFollowUp(anInteraction());

    expect(followUp?.sourceInteractionId).toBe('int-1');
    expect(followUp?.leadId).toBe('lead-1');
  });

  it('records the originating channel in the body', () => {
    expect(deriveFollowUp(anInteraction({ channel: 'WHATSAPP' }))?.body).toContain(
      'whatsapp',
    );
  });
});
