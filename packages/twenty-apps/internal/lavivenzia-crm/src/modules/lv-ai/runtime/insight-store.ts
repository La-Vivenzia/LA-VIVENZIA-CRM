import { type AiInsightOrigin, type AiInsightStatus, type AiInsightType, type HumanDecision } from 'src/modules/lv-ai/objects/ai-insight.object';
import { boundedJson, type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';

// Persistence for lvAiInsight, always through the application role. One
// current row per (type, target record) for the "singleton" insight types;
// suggestions that can legitimately coexist (drafts, problem suggestions,
// duplicate pairs) key on an extra discriminator.

export type InsightRow = {
  id: string;
  insightType: AiInsightType;
  status: AiInsightStatus;
  origin: AiInsightOrigin | null;
  targetObject: string | null;
  targetRecordId: string | null;
  leadId: string | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  generatedAt: string | null;
  confidence: number | null;
  sourceRecordIds: unknown;
  payload: unknown;
  summary: string | null;
  fingerprint: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  humanDecision: HumanDecision | null;
  decisionNote: string | null;
  errorCode: string | null;
};

const FIELDS =
  'id insightType status origin targetObject targetRecordId leadId provider model promptVersion generatedAt confidence sourceRecordIds payload summary fingerprint reviewerId reviewedAt humanDecision decisionNote errorCode';

export type InsightWrite = {
  insightType: AiInsightType;
  status: AiInsightStatus;
  origin: AiInsightOrigin;
  targetObject: string;
  targetRecordId: string;
  leadId: string | null;
  provider: string;
  model: string | null;
  promptVersion: string;
  generatedAt: string;
  confidence: number | null;
  sourceRecordIds: string[];
  payload: unknown;
  summary: string | null;
  fingerprint: string | null;
  errorCode?: string | null;
  // For types that allow several live rows per target (DRAFT, DUPLICATE,
  // PROBLEM_SUGGESTION), a discriminator folded into the fingerprint.
  discriminator?: string;
};

export const listInsightsForLead = async (application: GraphqlClient, leadId: string, types?: AiInsightType[]): Promise<InsightRow[]> => {
  const filter: Record<string, unknown> = { leadId: { eq: leadId } };

  if (types && types.length > 0) {
    filter.insightType = { in: types };
  }

  const { data } = await application.query<{ lvAiInsights?: { edges: { node: InsightRow }[] } }>(
    `query($filter: LvAiInsightFilterInput) { lvAiInsights(first: 100, filter: $filter, orderBy: [{ generatedAt: DescNullsLast }]) { edges { node { ${FIELDS} } } } }`,
    { filter },
  );

  return (data.lvAiInsights?.edges ?? []).map((edge) => edge.node);
};

export const findInsight = async (application: GraphqlClient, id: string): Promise<InsightRow | null> => {
  const { data } = await application.query<{ lvAiInsights?: { edges: { node: InsightRow }[] } }>(
    `query($filter: LvAiInsightFilterInput) { lvAiInsights(first: 1, filter: $filter) { edges { node { ${FIELDS} } } } }`,
    { filter: { id: { eq: id } } },
  );

  return data.lvAiInsights?.edges?.[0]?.node ?? null;
};

const currentRow = (rows: InsightRow[], type: AiInsightType, targetRecordId: string, discriminator?: string): InsightRow | null =>
  rows.find(
    (row) =>
      row.insightType === type &&
      row.targetRecordId === targetRecordId &&
      (discriminator === undefined || (row.fingerprint ?? '').startsWith(`${discriminator}|`)) &&
      row.status !== 'AI_REJECTED',
  ) ?? null;

export const matchesInsightKey = (row: InsightRow, type: AiInsightType, targetRecordId: string, discriminator?: string): boolean =>
  row.insightType === type &&
  row.targetRecordId === targetRecordId &&
  (discriminator === undefined || (row.fingerprint ?? '').startsWith(`${discriminator}|`)) &&
  row.status !== 'AI_REJECTED';

/** Newest first, so reconciliation keeps the freshest row. */
const byGeneratedAtDesc = (a: InsightRow, b: InsightRow): number => Date.parse(b.generatedAt ?? '') - Date.parse(a.generatedAt ?? '');

/**
 * Pick the duplicates for one insight key: everything after the newest.
 *
 * The upsert below has always been correct for one request at a time — an
 * AI_SUGGESTED row is updated in place, never appended to. What it could not
 * survive was two requests at once. The caller reads `existing` once and
 * reuses it, so two overlapping generations both looked at the same snapshot,
 * both found no current row, and both created one. The lead whose Intelligence
 * tab was opened twice within five minutes ended up with two rows for each of
 * its five insight types: invisible in the UI, which keys by type, and growing
 * in the table.
 */
export const duplicatesOf = (rows: readonly InsightRow[], type: AiInsightType, targetRecordId: string, discriminator?: string): InsightRow[] => {
  const live = rows.filter((row) => matchesInsightKey(row, type, targetRecordId, discriminator)).sort(byGeneratedAtDesc);

  return live.slice(1).filter((row) => row.status !== 'AI_STALE');
};

/**
 * Collapse accidental duplicates down to one current row, newest kept, the
 * rest marked AI_STALE.
 *
 * This uses the status the schema already has for a superseded row. Nothing is
 * deleted, so a decision recorded against an older row keeps its history, and
 * AI_REJECTED rows are excluded from the key entirely and never touched.
 * Reconciliation is housekeeping: a failure here must not fail the insight.
 */
export const reconcileDuplicates = async (
  application: GraphqlClient,
  rows: InsightRow[],
  type: AiInsightType,
  targetRecordId: string,
  discriminator?: string,
): Promise<number> => {
  const stale = duplicatesOf(rows, type, targetRecordId, discriminator);

  for (const row of stale) {
    try {
      await application.query(`mutation($id: UUID!, $data: LvAiInsightUpdateInput!) { updateLvAiInsight(id: $id, data: $data) { id } }`, { id: row.id, data: { status: 'AI_STALE' } });
      row.status = 'AI_STALE';
    } catch (caught) {
      console.warn('[lv-ai] duplicate insight not reconciled:', caught instanceof Error ? caught.message : String(caught));
    }
  }

  return stale.length;
};

// Insert or refresh the current row for an insight. A human decision is never
// overwritten by a regeneration: a confirmed or rejected row is left alone
// and a new suggestion row is written next to it only when the source
// fingerprint changed (the old one becomes AI_STALE).
export const upsertInsight = async (application: GraphqlClient, existing: InsightRow[], write: InsightWrite): Promise<InsightRow> => {
  const fingerprint = write.discriminator ? `${write.discriminator}|${write.fingerprint ?? ''}` : write.fingerprint;

  // Heal anything an earlier overlap left behind before choosing the current
  // row, so a key that already has two rows converges instead of staying split.
  await reconcileDuplicates(application, existing, write.insightType, write.targetRecordId, write.discriminator);

  const current = currentRow(existing, write.insightType, write.targetRecordId, write.discriminator);
  const data = {
    name: `${write.insightType} · ${write.summary?.slice(0, 80) ?? write.targetRecordId}`.slice(0, 120),
    insightType: write.insightType,
    status: write.status,
    origin: write.origin,
    targetObject: write.targetObject,
    targetRecordId: write.targetRecordId,
    leadId: write.leadId,
    provider: write.provider,
    model: write.model,
    promptVersion: write.promptVersion,
    generatedAt: write.generatedAt,
    confidence: write.confidence,
    sourceRecordIds: boundedJson(write.sourceRecordIds.slice(0, 200)),
    payload: boundedJson(write.payload),
    summary: write.summary?.slice(0, 2_000) ?? null,
    fingerprint,
    errorCode: write.errorCode ?? null,
  };

  if (current && current.status === 'AI_SUGGESTED') {
    const { data: updated } = await application.query<{ updateLvAiInsight?: InsightRow }>(
      `mutation($id: UUID!, $data: LvAiInsightUpdateInput!) { updateLvAiInsight(id: $id, data: $data) { ${FIELDS} } }`,
      { id: current.id, data },
    );

    return updated.updateLvAiInsight ?? { ...current, ...data, sourceRecordIds: data.sourceRecordIds, payload: data.payload } as InsightRow;
  }

  if (current && current.status === 'UNAVAILABLE') {
    const { data: updated } = await application.query<{ updateLvAiInsight?: InsightRow }>(
      `mutation($id: UUID!, $data: LvAiInsightUpdateInput!) { updateLvAiInsight(id: $id, data: $data) { ${FIELDS} } }`,
      { id: current.id, data },
    );

    return updated.updateLvAiInsight ?? ({ ...current, ...data } as InsightRow);
  }

  if (current && current.status === 'AI_CONFIRMED' && current.fingerprint !== fingerprint) {
    await application.query(`mutation($id: UUID!, $data: LvAiInsightUpdateInput!) { updateLvAiInsight(id: $id, data: $data) { id } }`, { id: current.id, data: { status: 'AI_STALE' } });
  }

  // Last look before inserting. `existing` was read by the caller before any
  // of this request's work, so a concurrent generation may have created the
  // row in between. Re-reading here closes most of that window; the
  // reconciliation above closes whatever still slips through on the next pass.
  if (current === null && write.leadId !== null) {
    let fresh: InsightRow[] = [];

    try {
      fresh = await listInsightsForLead(application, write.leadId, [write.insightType]);
    } catch {
      // Treated as "nothing found": the insert below is still correct, and a
      // duplicate it creates will be reconciled rather than kept.
    }

    const appeared = currentRow(fresh, write.insightType, write.targetRecordId, write.discriminator);

    if (appeared !== null && appeared.status === 'AI_SUGGESTED') {
      const { data: updated } = await application.query<{ updateLvAiInsight?: InsightRow }>(
        `mutation($id: UUID!, $data: LvAiInsightUpdateInput!) { updateLvAiInsight(id: $id, data: $data) { ${FIELDS} } }`,
        { id: appeared.id, data },
      );

      return updated.updateLvAiInsight ?? ({ ...appeared, ...data } as InsightRow);
    }
  }

  const { data: created, errors } = await application.query<{ createLvAiInsight?: InsightRow }>(
    `mutation($data: LvAiInsightCreateInput!) { createLvAiInsight(data: $data) { ${FIELDS} } }`,
    { data },
  );

  if (!created.createLvAiInsight) {
    throw new Error(errors[0]?.message ?? 'Insight could not be stored.');
  }

  return created.createLvAiInsight;
};

export const recordDecision = async (
  application: GraphqlClient,
  insightId: string,
  decision: { humanDecision: HumanDecision; status: AiInsightStatus; reviewerId: string; note: string | null; payload?: unknown },
): Promise<void> => {
  const data: Record<string, unknown> = {
    humanDecision: decision.humanDecision,
    status: decision.status,
    reviewerId: decision.reviewerId,
    reviewedAt: new Date().toISOString(),
    decisionNote: decision.note?.slice(0, 500) ?? null,
  };

  if (decision.payload !== undefined) {
    data.payload = boundedJson(decision.payload);
  }

  await application.query(`mutation($id: UUID!, $data: LvAiInsightUpdateInput!) { updateLvAiInsight(id: $id, data: $data) { id } }`, { id: insightId, data });
};

// A stable fingerprint of the facts an insight was computed from. Same facts
// → same fingerprint → the insight is still current.
export const fingerprintOf = (parts: unknown[]): string => {
  const text = JSON.stringify(parts);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `${hash.toString(16).padStart(8, '0')}:${text.length}`;
};
