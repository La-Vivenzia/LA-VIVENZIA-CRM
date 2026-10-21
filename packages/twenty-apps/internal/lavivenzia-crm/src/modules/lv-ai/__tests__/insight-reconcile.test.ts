import { describe, expect, it, vi } from 'vitest';

import { type AiInsightType } from 'src/modules/lv-ai/objects/ai-insight.object';
import { duplicatesOf, matchesInsightKey, reconcileDuplicates, type InsightRow } from 'src/modules/lv-ai/runtime/insight-store';

// One current insight per (lead, type).
//
// `upsertInsight` was already correct for one request at a time: an
// AI_SUGGESTED row is updated in place. What it could not survive was two
// overlapping generations, which both read the same snapshot, both found no
// current row, and both created one. The database showed it exactly: 26
// distinct (leadId, insightType) pairs across 31 rows, with all five extras
// on the one lead whose Intelligence tab was opened twice in five minutes.

const LEAD = 'lead-1';

const row = (over: Partial<InsightRow> = {}): InsightRow =>
  ({
    id: 'row-' + Math.random().toString(16).slice(2, 8),
    insightType: 'OPPORTUNITY_SCORE' as AiInsightType,
    status: 'AI_SUGGESTED',
    origin: 'MODEL',
    targetObject: 'lvLead',
    targetRecordId: LEAD,
    leadId: LEAD,
    provider: 'rules',
    model: null,
    promptVersion: 'rules-v1',
    generatedAt: '2026-10-06T10:56:00.000Z',
    confidence: null,
    sourceRecordIds: [],
    payload: {},
    summary: null,
    fingerprint: 'aaaa:39',
    reviewerId: null,
    reviewedAt: null,
    humanDecision: null,
    decisionNote: null,
    errorCode: null,
    ...over,
  }) as InsightRow;

describe('what belongs to one insight key', () => {
  it('matches on type and target record', () => {
    expect(matchesInsightKey(row(), 'OPPORTUNITY_SCORE' as AiInsightType, LEAD)).toBe(true);
    expect(matchesInsightKey(row(), 'DATA_QUALITY' as AiInsightType, LEAD)).toBe(false);
    expect(matchesInsightKey(row(), 'OPPORTUNITY_SCORE' as AiInsightType, 'other-lead')).toBe(false);
  });

  it('excludes a rejected row from the key entirely', () => {
    // A rejection is a human decision. It must never be overwritten by a
    // regeneration, nor counted as the current row.
    expect(matchesInsightKey(row({ status: 'AI_REJECTED' }), 'OPPORTUNITY_SCORE' as AiInsightType, LEAD)).toBe(false);
  });

  it('separates the types that legitimately have several rows, by discriminator', () => {
    const draftA = row({ insightType: 'DRAFT' as AiInsightType, fingerprint: 'EMAIL|aaa' });
    const draftB = row({ insightType: 'DRAFT' as AiInsightType, fingerprint: 'WHATSAPP|bbb' });

    expect(matchesInsightKey(draftA, 'DRAFT' as AiInsightType, LEAD, 'EMAIL')).toBe(true);
    expect(matchesInsightKey(draftB, 'DRAFT' as AiInsightType, LEAD, 'EMAIL')).toBe(false);
  });
});

describe('finding the duplicates', () => {
  it('finds none when there is one row', () => {
    expect(duplicatesOf([row()], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD)).toEqual([]);
  });

  it('keeps the newest and returns the rest', () => {
    const older = row({ id: 'older', generatedAt: '2026-10-06T10:56:00.000Z' });
    const newer = row({ id: 'newer', generatedAt: '2026-10-06T11:01:00.000Z' });
    const extra = duplicatesOf([older, newer], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD);

    expect(extra).toHaveLength(1);
    expect(extra[0].id).toBe('older');
  });

  it('is not fooled by the order it is given them in', () => {
    const older = row({ id: 'older', generatedAt: '2026-10-06T10:56:00.000Z' });
    const newer = row({ id: 'newer', generatedAt: '2026-10-06T11:01:00.000Z' });

    expect(duplicatesOf([newer, older], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD)[0].id).toBe('older');
  });

  it('does not re-stale a row that is already stale', () => {
    const stale = row({ id: 'stale', status: 'AI_STALE', generatedAt: '2026-10-06T10:00:00.000Z' });
    const current = row({ id: 'current', generatedAt: '2026-10-06T11:01:00.000Z' });

    expect(duplicatesOf([stale, current], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD)).toEqual([]);
  });

  it('leaves a rejected row alone even beside a newer suggestion', () => {
    const rejected = row({ id: 'rejected', status: 'AI_REJECTED', generatedAt: '2026-10-06T10:00:00.000Z' });
    const current = row({ id: 'current', generatedAt: '2026-10-06T11:01:00.000Z' });

    expect(duplicatesOf([rejected, current], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD)).toEqual([]);
  });

  it('does not mix two different types up', () => {
    const score = row({ id: 'score', insightType: 'OPPORTUNITY_SCORE' as AiInsightType });
    const quality = row({ id: 'quality', insightType: 'DATA_QUALITY' as AiInsightType });

    expect(duplicatesOf([score, quality], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD)).toEqual([]);
  });

  it('handles the real shape that was found: five types, two rows each', () => {
    const types = ['OPPORTUNITY_SCORE', 'RELATIONSHIP_HEALTH', 'NEXT_BEST_ACTION', 'DATA_QUALITY', 'DUPLICATE'] as AiInsightType[];
    const rows = types.flatMap((insightType) => [
      row({ insightType, generatedAt: '2026-10-06T10:56:00.000Z' }),
      row({ insightType, generatedAt: '2026-10-06T11:01:00.000Z' }),
    ]);

    for (const insightType of types) {
      expect(duplicatesOf(rows, insightType, LEAD), insightType).toHaveLength(1);
    }
  });
});

describe('reconciling', () => {
  const client = () => ({ query: vi.fn().mockResolvedValue({ data: {}, errors: [] }) });

  it('marks the extras stale and leaves the newest current', async () => {
    const older = row({ id: 'older', generatedAt: '2026-10-06T10:56:00.000Z' });
    const newer = row({ id: 'newer', generatedAt: '2026-10-06T11:01:00.000Z' });
    const application = client();

    const staled = await reconcileDuplicates(application as never, [older, newer], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD);

    expect(staled).toBe(1);
    expect(older.status).toBe('AI_STALE');
    expect(newer.status).toBe('AI_SUGGESTED');
    expect(application.query).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when there is nothing to reconcile', async () => {
    const application = client();

    expect(await reconcileDuplicates(application as never, [row()], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD)).toBe(0);
    expect(application.query).not.toHaveBeenCalled();
  });

  it('never deletes anything', async () => {
    const application = client();
    await reconcileDuplicates(
      application as never,
      [row({ id: 'a', generatedAt: '2026-10-06T10:00:00.000Z' }), row({ id: 'b', generatedAt: '2026-10-06T11:00:00.000Z' })],
      'OPPORTUNITY_SCORE' as AiInsightType,
      LEAD,
    );

    // History and decision provenance must survive; superseding is a status
    // change, never a removal.
    for (const call of application.query.mock.calls) {
      expect(String(call[0])).not.toMatch(/delete/i);
    }
  });

  it('survives a failure without failing the insight', async () => {
    const broken = { query: vi.fn().mockRejectedValue(new Error('update refused')) };
    const older = row({ id: 'older', generatedAt: '2026-10-06T10:00:00.000Z' });

    await expect(
      reconcileDuplicates(broken as never, [older, row({ generatedAt: '2026-10-06T11:00:00.000Z' })], 'OPPORTUNITY_SCORE' as AiInsightType, LEAD),
    ).resolves.toBe(1);

    // It stayed as it was rather than being reported as reconciled in memory.
    expect(older.status).toBe('AI_SUGGESTED');
  });
});
