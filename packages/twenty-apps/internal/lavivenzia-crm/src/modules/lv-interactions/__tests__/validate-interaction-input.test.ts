import { describe, expect, it } from 'vitest';

import { validateInteractionInput } from 'src/modules/lv-interactions/utils/validate-interaction-input';

// The interaction form's decision. Identity is never part of it; dates are
// honest (no future contacts); an empty entry is refused.

const NOW = '2026-09-13T10:00:00.000Z';
const LEAD = '11111111-2222-4333-8444-555555555555';

describe('validateInteractionInput', () => {
  it('accepts a minimal outbound call and derives the summary line', () => {
    const result = validateInteractionInput({ leadId: LEAD, channel: 'PHONE', direction: 'OUTBOUND', outcome: 'INTERESTED', durationMinutes: '12' }, NOW);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.input).toMatchObject({ channel: 'PHONE', direction: 'OUTBOUND', outcome: 'INTERESTED', durationMinutes: 12, occurredAt: NOW, name: 'Phone · Interested' });
    }
  });

  it('ignores identity fields entirely — actorId in the body has no effect', () => {
    const result = validateInteractionInput({ leadId: LEAD, channel: 'EMAIL', direction: 'INBOUND', summary: 'Asked for pricing', actorId: 'someone-else', workspaceMemberId: 'x' }, NOW);

    expect(result.ok).toBe(true);
    expect(result.ok && 'actorId' in result.input).toBe(false);
  });

  it('refuses a future-dated interaction, an unknown channel and an empty entry', () => {
    expect(validateInteractionInput({ leadId: LEAD, channel: 'PHONE', direction: 'OUTBOUND', summary: 'x', occurredAt: '2026-09-14T10:00:00.000Z' }, NOW)).toMatchObject({ ok: false });
    expect(validateInteractionInput({ leadId: LEAD, channel: 'CARRIER_PIGEON', direction: 'OUTBOUND', summary: 'x' }, NOW)).toMatchObject({ ok: false });
    expect(validateInteractionInput({ leadId: LEAD, channel: 'PHONE', direction: 'OUTBOUND' }, NOW)).toMatchObject({ ok: false });
    expect(validateInteractionInput({ leadId: 'nope', channel: 'PHONE', direction: 'OUTBOUND', summary: 'x' }, NOW)).toMatchObject({ ok: false });
  });

  it('drops a duration on a channel that has none and rejects an impossible one', () => {
    const email = validateInteractionInput({ leadId: LEAD, channel: 'EMAIL', direction: 'OUTBOUND', summary: 'sent', durationMinutes: 30 }, NOW);

    expect(email.ok && email.input.durationMinutes).toBeNull();
    expect(validateInteractionInput({ leadId: LEAD, channel: 'PHONE', direction: 'OUTBOUND', summary: 'x', durationMinutes: 99999 }, NOW)).toMatchObject({ ok: false });
  });

  it('keeps a back-dated time and a future follow-up, and trims long text', () => {
    const result = validateInteractionInput({ leadId: LEAD, channel: 'WHATSAPP', direction: 'OUTBOUND', occurredAt: '2026-09-10T08:00:00.000Z', nextFollowUpAt: '2026-09-15T09:00:00.000Z', nextAction: 'Send onboarding info', summary: 'a'.repeat(5000) }, NOW);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.input.occurredAt).toBe('2026-09-10T08:00:00.000Z');
      expect(result.input.nextFollowUpAt).toBe('2026-09-15T09:00:00.000Z');
      expect(result.input.summary?.length).toBe(2000);
    }
  });
});
