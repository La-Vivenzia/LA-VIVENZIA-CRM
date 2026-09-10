import { describe, expect, it } from 'vitest';

import {
  formatLeadId,
  hasLeadId,
  isValidLeadId,
  LV_LEAD_ID_LEXICOGRAPHIC_CEILING,
  nextLeadId,
  parseLeadId,
} from 'src/modules/lv-core/utils/lead-id';

describe('formatLeadId', () => {
  it('zero-pads to six digits', () => {
    expect(formatLeadId(1)).toBe('LV-000001');
    expect(formatLeadId(42)).toBe('LV-000042');
    expect(formatLeadId(999_999)).toBe('LV-999999');
  });

  it('refuses a non-positive or fractional sequence', () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => formatLeadId(bad)).toThrow();
    }
  });
});

describe('parseLeadId', () => {
  it('round-trips every formatted id', () => {
    for (const n of [1, 2, 99, 100_000, 999_999]) {
      expect(parseLeadId(formatLeadId(n))).toBe(n);
    }
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseLeadId('  LV-000007  ')).toBe(7);
  });

  it.each([
    null,
    undefined,
    '',
    '   ',
    'LV-1',
    'LV-abcdef',
    'lv-000001',
    'XX-000001',
    'LV-000000',
    '000001',
  ])('rejects %p', (value) => {
    expect(parseLeadId(value as string | null | undefined)).toBeNull();
  });

  it('agrees with isValidLeadId and hasLeadId', () => {
    for (const value of ['LV-000001', '', null, 'nonsense']) {
      const valid = parseLeadId(value as string | null) !== null;

      expect(isValidLeadId(value as string | null)).toBe(valid);
      expect(hasLeadId(value as string | null)).toBe(valid);
    }
  });
});

describe('lexicographic ordering matches numeric ordering', () => {
  it('sorts as strings the same way it sorts as numbers, below the ceiling', () => {
    const numbers = [1, 2, 9, 10, 11, 99, 100, 1000, 12_345, 999_999];
    const byNumber = [...numbers].sort((a, b) => a - b).map(formatLeadId);
    const byString = numbers.map(formatLeadId).sort();

    expect(byString).toEqual(byNumber);
  });
});

describe('nextLeadId', () => {
  it('starts at LV-000001 when nothing has been issued', () => {
    expect(nextLeadId(null)).toEqual({
      ok: true,
      leadId: 'LV-000001',
      sequence: 1,
    });
  });

  it('treats an unparseable highest value as nothing issued', () => {
    expect(nextLeadId('garbage')).toMatchObject({ leadId: 'LV-000001' });
    expect(nextLeadId('')).toMatchObject({ leadId: 'LV-000001' });
  });

  it('increments the highest issued id', () => {
    expect(nextLeadId('LV-000011')).toEqual({
      ok: true,
      leadId: 'LV-000012',
      sequence: 12,
    });
  });

  it('is pure, so a retry with fresher data yields the newer number', () => {
    expect(nextLeadId('LV-000005').ok && nextLeadId('LV-000005')).toMatchObject({
      leadId: 'LV-000006',
    });
    expect(nextLeadId('LV-000006')).toMatchObject({ leadId: 'LV-000007' });
  });

  it('refuses rather than wrapping past the ordering ceiling', () => {
    expect(nextLeadId(formatLeadId(LV_LEAD_ID_LEXICOGRAPHIC_CEILING))).toEqual({
      ok: false,
      reason: 'CEILING_REACHED',
    });
  });
});
