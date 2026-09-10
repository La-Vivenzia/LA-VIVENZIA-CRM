import { describe, expect, it } from 'vitest';

import {
  buildDuplicateKeys,
  compareForDuplicate,
  DUPLICATE_REVIEW_THRESHOLD,
  DUPLICATE_STRONG_THRESHOLD,
  findDuplicates,
  type DuplicateCandidateRecord,
} from 'src/modules/lv-core/utils/duplicate-detection';
import {
  diceCoefficient,
  nameSimilarity,
  similarityPercent,
  tokenContainment,
} from 'src/modules/lv-core/utils/similarity';

const record = (
  overrides: Partial<DuplicateCandidateRecord> & Pick<DuplicateCandidateRecord, 'id'>,
): DuplicateCandidateRecord => ({ ...overrides });

describe('similarity primitives', () => {
  it('scores identical strings as 1', () => {
    expect(diceCoefficient('forest table', 'forest table')).toBe(1);
  });

  it('scores disjoint strings as 0', () => {
    expect(diceCoefficient('abc', 'xyz')).toBe(0);
  });

  it('is symmetric', () => {
    expect(diceCoefficient('forest', 'forest table')).toBeCloseTo(
      diceCoefficient('forest table', 'forest'),
    );
  });

  it('measures containment against the shorter token set', () => {
    expect(tokenContainment('forest table', 'forest table pune')).toBe(1);
    expect(tokenContainment('forest table', 'ocean bar')).toBe(0);
  });

  it('renders a percentage', () => {
    expect(similarityPercent(0.886)).toBe(89);
  });
});

describe('nameSimilarity', () => {
  it('treats a name plus a location qualifier as a strong match', () => {
    const score = nameSimilarity('The Forest Table', 'The Forest Table Pune');

    expect(score).toBeGreaterThan(DUPLICATE_STRONG_THRESHOLD);
  });

  it('ignores business suffixes', () => {
    expect(nameSimilarity('Acme Pvt Ltd', 'Acme')).toBe(1);
  });

  it('keeps unrelated businesses well below the review threshold', () => {
    expect(nameSimilarity('The Forest Table', 'Sunset Beach Resort')).toBeLessThan(
      DUPLICATE_REVIEW_THRESHOLD,
    );
  });

  it('returns 0 when either name is missing', () => {
    expect(nameSimilarity(null, 'Acme')).toBe(0);
    expect(nameSimilarity('Acme', undefined)).toBe(0);
  });
});

describe('buildDuplicateKeys', () => {
  it('emits a key per strong identifier', () => {
    const keys = buildDuplicateKeys(
      record({
        id: '1',
        organisationName: 'The Forest Table',
        email: 'Hi@Forest.com',
        phone: '9876543210',
        websiteUrl: 'www.forest.com',
        instagramHandle: '@forest',
        location: 'Pune',
      }),
    );

    expect(keys).toContain('email:hi@forest.com');
    expect(keys).toContain('phone:+919876543210');
    expect(keys).toContain('instagram:forest');
    expect(keys).toContain('domain:forest.com');
    expect(keys).toContain('name:forest table|pune');
  });

  it('omits keys for values it could not parse', () => {
    const keys = buildDuplicateKeys(record({ id: '1', email: 'nope', phone: 'call me' }));

    expect(keys.some((key) => key.startsWith('email:'))).toBe(false);
    expect(keys.some((key) => key.startsWith('phone:'))).toBe(false);
  });

  it('falls back to a name-only key without a location', () => {
    expect(buildDuplicateKeys(record({ id: '1', name: 'Acme' }))).toContain('name:acme');
  });
});

describe('compareForDuplicate', () => {
  it('treats a shared email as certain', () => {
    const match = compareForDuplicate(
      record({ id: 'new', name: 'Totally Different', email: 'a@b.com' }),
      record({ id: 'old', name: 'Nothing Alike', email: 'a@b.com' }),
    );

    expect(match?.score).toBe(1);
    expect(match?.reasons).toContain('EMAIL_EXACT');
  });

  it('treats a shared phone as certain', () => {
    const match = compareForDuplicate(
      record({ id: 'new', name: 'X', phone: '9876543210' }),
      record({ id: 'old', name: 'Y', phone: '+91 98765 43210' }),
    );

    expect(match?.reasons).toContain('PHONE_EXACT');
  });

  it('treats a shared instagram handle as certain', () => {
    const match = compareForDuplicate(
      record({ id: 'new', name: 'X', instagramHandle: '@forest' }),
      record({ id: 'old', name: 'Y', instagramHandle: 'https://instagram.com/forest' }),
    );

    expect(match?.reasons).toContain('INSTAGRAM_EXACT');
  });

  it('surfaces the Forest Table case for human review', () => {
    const match = compareForDuplicate(
      record({ id: 'new', organisationName: 'The Forest Table' }),
      record({ id: 'old', organisationName: 'The Forest Table Pune' }),
    );

    expect(match).not.toBeNull();
    expect(match?.percent).toBeGreaterThanOrEqual(85);
    expect(match?.reasons).toContain('NAME_SIMILAR');
  });

  it('raises confidence when the location also matches', () => {
    const withLocation = compareForDuplicate(
      record({ id: 'new', organisationName: 'Forest Table', location: 'Pune' }),
      record({ id: 'old', organisationName: 'Forest Table Cafe', location: 'Pune' }),
    );
    const withoutLocation = compareForDuplicate(
      record({ id: 'new', organisationName: 'Forest Table', location: 'Pune' }),
      record({ id: 'old', organisationName: 'Forest Table Cafe', location: 'Goa' }),
    );

    expect(withLocation?.score ?? 0).toBeGreaterThan(withoutLocation?.score ?? 0);
    expect(withLocation?.reasons).toContain('NAME_SIMILAR_SAME_LOCATION');
  });

  it('returns null for unrelated records', () => {
    expect(
      compareForDuplicate(
        record({ id: 'new', organisationName: 'The Forest Table' }),
        record({ id: 'old', organisationName: 'Sunset Beach Resort' }),
      ),
    ).toBeNull();
  });
});

describe('findDuplicates', () => {
  it('never matches a record against itself', () => {
    const self = record({ id: 'same', email: 'a@b.com' });

    expect(findDuplicates(self, [self])).toEqual([]);
  });

  it('ranks strongest matches first', () => {
    const matches = findDuplicates(
      record({ id: 'new', organisationName: 'Forest Table', email: 'a@b.com' }),
      [
        record({ id: 'similar-name', organisationName: 'Forest Table Pune' }),
        record({ id: 'same-email', organisationName: 'Unrelated', email: 'a@b.com' }),
      ],
    );

    expect(matches[0]?.recordId).toBe('same-email');
    expect(matches).toHaveLength(2);
  });

  it('returns an empty list when nothing is close enough', () => {
    expect(
      findDuplicates(record({ id: 'new', organisationName: 'Forest Table' }), [
        record({ id: 'other', organisationName: 'Sunset Beach Resort' }),
      ]),
    ).toEqual([]);
  });

  it('orders deterministically when scores tie', () => {
    const candidates = [
      record({ id: 'b', email: 'a@b.com' }),
      record({ id: 'a', email: 'a@b.com' }),
    ];

    const forward = findDuplicates(record({ id: 'new', email: 'a@b.com' }), candidates);
    const reversed = findDuplicates(
      record({ id: 'new', email: 'a@b.com' }),
      [...candidates].reverse(),
    );

    expect(forward.map((match) => match.recordId)).toEqual(
      reversed.map((match) => match.recordId),
    );
  });
});
