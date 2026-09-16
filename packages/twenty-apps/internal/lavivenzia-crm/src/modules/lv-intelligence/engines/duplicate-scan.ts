import { type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';
import { PROMPT_VERSIONS } from 'src/modules/lv-ai/prompts/prompt-registry';
import { type DuplicateCandidateRecord, type DuplicateMatch, DUPLICATE_STRONG_THRESHOLD, findDuplicates } from 'src/modules/lv-core/utils/duplicate-detection';
import { normalizeNameForMatching } from 'src/modules/lv-capture/utils/normalize-input';
import { type LeadRecord } from 'src/modules/lv-intelligence/services/lead-context';

// Duplicate intelligence v1 — the Day 1 similarity engine (exact identifiers
// + name similarity) run server-side for an EXISTING lead, over candidates
// the caller can see. Candidates are shortlisted cheaply — any shared
// duplicate key, or the same normalised first word of the name — then ranked
// by `findDuplicates`; the result is evidence for a human decision (MERGE /
// CREATE NEW / IGNORE), never an automatic merge.
//
// Runs under the caller's token, so a Hunter is only compared against leads
// CM-004 lets them read. That is a deliberate limit: a duplicate that lives in
// another Hunter's private pipeline is an administrator's finding.

export const DUPLICATE_RULES_VERSION = PROMPT_VERSIONS.duplicate;

export type DuplicateCandidate = {
  leadId: string;
  lvLeadId: string | null;
  name: string | null;
  organisationName: string | null;
  location: string | null;
  status: string | null;
  ownerId: string | null;
  percent: number;
  strength: 'STRONG' | 'POSSIBLE';
  matchingFields: string[];
  explanation: string;
  suggestedMergeTarget: 'THIS' | 'CANDIDATE';
};

export type DuplicateScanResult = { candidates: DuplicateCandidate[]; scanned: number; rulesVersion: string; generatedAt: string };

type CandidateRow = DuplicateCandidateRecord & { lvLeadId: string | null; status: string | null; ownerId: string | null; createdAt: string; emailsRaw?: unknown };

const REASON_LABEL: Record<DuplicateMatch['reasons'][number], string> = {
  EMAIL_EXACT: 'email',
  PHONE_EXACT: 'phone',
  INSTAGRAM_EXACT: 'Instagram handle',
  WEBSITE_DOMAIN_EXACT: 'website domain',
  NAME_SIMILAR: 'similar name',
  NAME_SIMILAR_SAME_LOCATION: 'similar name in the same location',
};

// LIKE wildcards escaped with a backslash so a key can only match itself.
export const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const toCandidate = (lead: LeadRecord): DuplicateCandidateRecord => ({
  id: lead.id,
  name: lead.name,
  organisationName: lead.organisationName,
  email: lead.emails?.primaryEmail ?? null,
  phone: lead.phones?.primaryPhoneNumber ?? null,
  websiteUrl: lead.website?.primaryLinkUrl ?? null,
  instagramHandle: lead.instagram?.primaryLinkUrl ?? null,
  location: lead.location,
});

export const scanDuplicates = async (delegated: GraphqlClient, lead: LeadRecord, now = new Date().toISOString()): Promise<DuplicateScanResult> => {
  const keys = (lead.duplicateKeys ?? []).filter((key) => !key.startsWith('name:'));
  // The most distinctive word of the name (longest, ≥ 4 chars) — "[IT] The
  // Riverside Villa" shortlists on "riverside", not on "the".
  const tokens = normalizeNameForMatching(lead.organisationName ?? lead.name ?? '').split(' ').filter((token) => token.length >= 4);
  const keyword = tokens.sort((a, b) => b.length - a.length)[0] ?? '';
  const email = lead.emails?.primaryEmail?.trim().toLowerCase() ?? '';
  const phone = lead.phones?.primaryPhoneNumber?.trim() ?? '';
  const or: Record<string, unknown>[] = [];

  // ARRAY fields accept only `containsIlike` (one pattern each) on this
  // platform version — `containsAny` is refused for them — so each key is
  // its own exact-match clause. Keys are normalised at capture time, and the
  // LIKE wildcards are escaped so a key can only match itself.
  for (const key of keys.slice(0, 20)) {
    or.push({ duplicateKeys: { containsIlike: escapeLike(key) } });
  }

  // Exact identifiers are matched directly too, so a lead created through
  // the API (which carries no capture-time duplicate keys) is still found.
  if (email.length > 0) {
    or.push({ emails: { primaryEmail: { ilike: email.replace(/[%_]/g, '') } } });
  }

  if (phone.length > 0) {
    or.push({ phones: { primaryPhoneNumber: { eq: phone } } });
  }

  if (keyword.length >= 4) {
    or.push({ name: { ilike: `%${keyword}%` } });
    or.push({ organisationName: { ilike: `%${keyword}%` } });
  }

  if (or.length === 0) {
    return { candidates: [], scanned: 0, rulesVersion: DUPLICATE_RULES_VERSION, generatedAt: now };
  }

  const { data, errors } = await delegated.query<{ lvLeads?: { edges: { node: { id: string; lvLeadId: string | null; name: string | null; organisationName: string | null; location: string | null; status: string | null; ownerId: string | null; createdAt: string; emails: { primaryEmail?: string | null } | null; phones: { primaryPhoneNumber?: string | null } | null; website: { primaryLinkUrl?: string | null } | null; instagram: { primaryLinkUrl?: string | null } | null } }[] } }>(
    `query($filter: LvLeadFilterInput) { lvLeads(first: 50, filter: $filter) { edges { node { id lvLeadId name organisationName location status ownerId createdAt emails { primaryEmail } phones { primaryPhoneNumber } website { primaryLinkUrl } instagram { primaryLinkUrl } } } } }`,
    { filter: { and: [{ id: { neq: lead.id } }, { or }] } },
  );

  // A refused filter would otherwise read as "no duplicates" — the one
  // answer this scan must never give by accident.
  if (errors.length > 0) {
    throw new Error(`Duplicate shortlist query failed: ${errors[0]?.message ?? 'unknown error'}`);
  }

  const rows: CandidateRow[] = (data.lvLeads?.edges ?? []).map(({ node }) => ({
    id: node.id,
    lvLeadId: node.lvLeadId,
    name: node.name,
    organisationName: node.organisationName,
    email: node.emails?.primaryEmail ?? null,
    phone: node.phones?.primaryPhoneNumber ?? null,
    websiteUrl: node.website?.primaryLinkUrl ?? null,
    instagramHandle: node.instagram?.primaryLinkUrl ?? null,
    location: node.location,
    status: node.status,
    ownerId: node.ownerId,
    createdAt: node.createdAt,
  }));

  const matches = findDuplicates(toCandidate(lead), rows);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const candidates: DuplicateCandidate[] = matches.slice(0, 5).map((match) => {
    const row = byId.get(match.recordId)!;
    const fields = match.reasons.map((reason) => REASON_LABEL[reason]);
    // The older record is the natural merge target: it carries the history.
    const candidateIsOlder = Date.parse(row.createdAt) < Date.parse(lead.createdAt);

    return {
      leadId: row.id,
      lvLeadId: row.lvLeadId,
      name: row.name ?? null,
      organisationName: row.organisationName ?? null,
      location: row.location ?? null,
      status: row.status,
      ownerId: row.ownerId,
      percent: match.percent,
      strength: match.score >= DUPLICATE_STRONG_THRESHOLD ? 'STRONG' : 'POSSIBLE',
      matchingFields: fields,
      explanation: `${match.percent}% similarity — matches on ${fields.join(', ')}.`,
      suggestedMergeTarget: candidateIsOlder ? 'CANDIDATE' : 'THIS',
    };
  });

  return { candidates, scanned: rows.length, rulesVersion: DUPLICATE_RULES_VERSION, generatedAt: now };
};
