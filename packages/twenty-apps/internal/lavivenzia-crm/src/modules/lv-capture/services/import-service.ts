import { normalizePilotZoneInput } from 'src/modules/lv-capture/services/capture-request';
import { type CaptureInput, type LeadDraft } from 'src/modules/lv-capture/types/capture.types';
import { buildLeadDraft } from 'src/modules/lv-capture/utils/build-lead-draft';
import { type ImportTargetKey } from 'src/modules/lv-capture/utils/import-mapping';
import { isLeadPriority } from 'src/modules/lv-core/constants/lead-lifecycle';
import { isLeadCategory, isLeadSource, LEAD_CATEGORIES, LEAD_SUBCATEGORIES_BY_CATEGORY, LEAD_SOURCES, type LeadPilotZone } from 'src/modules/lv-core/constants/lead-taxonomy';
import { type GraphqlClient } from 'src/modules/lv-ai/runtime/clients';
import { findDuplicates } from 'src/modules/lv-core/utils/duplicate-detection';
import { escapeLike } from 'src/modules/lv-intelligence/engines/duplicate-scan';

// CSV import validation. Every row goes through the same draft builder a
// single capture uses, then through the import-only checks (category and
// owner values, duplicates within the file, duplicates against the CRM).
// Nothing is written; the result is the report the employee reviews.

export type ImportRowInput = { rowNumber: number; fields: Partial<Record<ImportTargetKey, string>> };

export type ImportRowResult = {
  rowNumber: number;
  status: 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE';
  errors: string[];
  warnings: string[];
  draft: Pick<LeadDraft, 'name' | 'organisationName' | 'email' | 'phone' | 'websiteUrl' | 'instagramHandle' | 'location' | 'pilotZone' | 'category' | 'subcategory' | 'source' | 'priority' | 'completeness'> | null;
  ownerId: string | null;
  duplicateOfRow: number | null;
  duplicateOf: { leadId: string; lvLeadId: string | null; name: string | null; percent: number; matchingFields: string[] } | null;
};

export type ImportValidation = {
  rows: ImportRowResult[];
  summary: { total: number; valid: number; warnings: number; errors: number; duplicates: number };
};

export type MemberDirectory = { id: string; name: string; email: string | null }[];

// Category / source values are matched loosely (case, spaces, plural "s")
// against the dynamic taxonomy so a spreadsheet saying "villa" or
// "Restaurants" still lands.
const canon = (value: string): string => value.trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/S$/, '');

const matchOption = (value: string, options: readonly string[]): string | null => {
  const wanted = canon(value);

  return options.find((option) => canon(option) === wanted) ?? options.find((option) => option.replace(/_/g, ' ').toLowerCase() === value.trim().toLowerCase()) ?? null;
};

export const toCaptureInput = (row: ImportRowInput['fields'], members: MemberDirectory): { input: CaptureInput; ownerId: string | null; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let pilotZone: LeadPilotZone | null = null;

  if (row.pilotZone) {
    const parsedZone = normalizePilotZoneInput(row.pilotZone);

    if (parsedZone.valid) {
      pilotZone = parsedZone.value;
    } else {
      warnings.push(`Pilot zone "${row.pilotZone}" is not one of the Pune pilot zones; left empty.`);
    }
  }

  let category: string | null = null;
  let subcategory: string | null = null;

  if (row.category) {
    category = matchOption(row.category, LEAD_CATEGORIES);

    // A spreadsheet often says "Villa" or "Restaurant" where the CRM wants
    // the category: a sub-category value names its parent for it.
    if (category === null) {
      for (const parent of LEAD_CATEGORIES) {
        const child = matchOption(row.category, LEAD_SUBCATEGORIES_BY_CATEGORY[parent] ?? []);

        if (child !== null) {
          category = parent;
          subcategory = child;
          break;
        }
      }
    }

    if (category === null) {
      errors.push(`Category "${row.category}" is not one of the CRM categories.`);
    } else if (subcategory === null && row.subcategory) {
      subcategory = matchOption(row.subcategory, LEAD_SUBCATEGORIES_BY_CATEGORY[category as keyof typeof LEAD_SUBCATEGORIES_BY_CATEGORY] ?? []);

      if (subcategory === null) {
        warnings.push(`Subcategory "${row.subcategory}" is not under ${category}; left empty.`);
      }
    }
  } else if (row.subcategory) {
    warnings.push('Subcategory given without a category; left empty.');
  }

  let source: string | null = null;

  if (row.source) {
    source = matchOption(row.source, LEAD_SOURCES);

    if (source === null) {
      warnings.push(`Source "${row.source}" is not a CRM source; recorded as Imported.`);
    }
  }

  let priority: string | null = null;

  if (row.priority) {
    const upper = row.priority.trim().toUpperCase();

    if (isLeadPriority(upper)) {
      priority = upper;
    } else {
      warnings.push(`Priority "${row.priority}" is not Critical / High / Medium / Low; left as Medium.`);
    }
  }

  let ownerId: string | null = null;

  if (row.owner) {
    const wanted = row.owner.trim().toLowerCase();
    const member = members.find((candidate) => candidate.email?.toLowerCase() === wanted || candidate.name.toLowerCase() === wanted || candidate.name.toLowerCase().split(' ')[0] === wanted);

    if (member) {
      ownerId = member.id;
    } else {
      errors.push(`Owner "${row.owner}" is not a team member.`);
    }
  }

  const input: CaptureInput = {
    captureMode: 'IMPORT',
    name: row.name ?? null,
    organisationName: row.organisationName ?? null,
    jobTitle: row.jobTitle ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    websiteUrl: row.websiteUrl ?? null,
    instagramHandle: row.instagramHandle ?? null,
    socialProfileUrl: row.socialProfileUrl ?? null,
    location: row.location ?? null,
    pilotZone,
    category: category && isLeadCategory(category) ? category : null,
    subcategory,
    languages: row.languages ? row.languages.split(/[,;/]/).map((part) => part.trim()).filter((part) => part.length > 0) : null,
    source: source && isLeadSource(source) ? source : 'IMPORTED',
    priority: priority && isLeadPriority(priority) ? priority : null,
    rawInput: row.notes ?? null,
    isHumanConfirmed: true,
  };

  return { input, ownerId, errors, warnings };
};

export const validateImportRows = (rows: ImportRowInput[], members: MemberDirectory): { results: ImportRowResult[]; drafts: Map<number, LeadDraft> } => {
  const results: ImportRowResult[] = [];
  const drafts = new Map<number, LeadDraft>();
  const seenKeys = new Map<string, number>();

  for (const row of rows) {
    const { input, ownerId, errors, warnings } = toCaptureInput(row.fields, members);
    const built = buildLeadDraft(input);

    if (!built.ok) {
      results.push({ rowNumber: row.rowNumber, status: 'ERROR', errors: [...errors, ...built.errors], warnings, draft: null, ownerId, duplicateOfRow: null, duplicateOf: null });
      continue;
    }

    const draft = built.draft;

    if (input.email && !draft.email) {
      errors.push(`Email "${input.email}" is not valid.`);
    }

    if (input.phone && !draft.phone) {
      errors.push(`Phone "${input.phone}" is not valid.`);
    }

    if (input.websiteUrl && !draft.websiteUrl) {
      errors.push(`Website "${input.websiteUrl}" is not a valid address.`);
    }

    // Duplicate within the file: the first row with a shared identity key
    // wins, later ones are reported against it.
    let duplicateOfRow: number | null = null;

    for (const key of draft.duplicateKeys.filter((candidate) => !candidate.startsWith('name:'))) {
      const earlier = seenKeys.get(key);

      if (earlier !== undefined && earlier !== row.rowNumber) {
        duplicateOfRow = earlier;
        break;
      }
    }

    if (duplicateOfRow === null) {
      for (const key of draft.duplicateKeys) {
        if (!seenKeys.has(key)) {
          seenKeys.set(key, row.rowNumber);
        }
      }
    }

    warnings.push(...draft.warnings);
    drafts.set(row.rowNumber, draft);

    const status: ImportRowResult['status'] = errors.length > 0 ? 'ERROR' : duplicateOfRow !== null ? 'DUPLICATE' : warnings.length > 0 ? 'WARNING' : 'VALID';

    results.push({
      rowNumber: row.rowNumber,
      status,
      errors,
      warnings,
      draft: { name: draft.name, organisationName: draft.organisationName, email: draft.email, phone: draft.phone, websiteUrl: draft.websiteUrl, instagramHandle: draft.instagramHandle, location: draft.location, pilotZone: draft.pilotZone, category: draft.category, subcategory: draft.subcategory, source: draft.source, priority: draft.priority, completeness: draft.completeness },
      ownerId,
      duplicateOfRow,
      duplicateOf: null,
    });
  }

  return { results, drafts };
};

// Duplicates against the CRM: one shortlist query per batch of keys (the
// same duplicate-key shortlist the Day 6 scan uses), then the Day 1 matcher
// per row. Runs under the caller's token — a Hunter is compared against
// what they can see.
export const matchAgainstCrm = async (delegated: GraphqlClient, results: ImportRowResult[], drafts: Map<number, LeadDraft>): Promise<void> => {
  const keys = new Set<string>();

  for (const draft of drafts.values()) {
    draft.duplicateKeys.filter((key) => !key.startsWith('name:')).forEach((key) => keys.add(key));
  }

  type Row = { id: string; lvLeadId: string | null; name: string | null; organisationName: string | null; location: string | null; emails: { primaryEmail?: string | null } | null; phones: { primaryPhoneNumber?: string | null } | null; website: { primaryLinkUrl?: string | null } | null; instagram: { primaryLinkUrl?: string | null } | null; duplicateKeys: string[] | null };
  const existing: Row[] = [];
  const keyList = [...keys];

  // ARRAY fields take one `containsIlike` pattern per clause (see
  // duplicate-scan.ts), so keys go up in OR-batches of 40.
  for (let index = 0; index < keyList.length; index += 40) {
    const chunk = keyList.slice(index, index + 40);
    const { data, errors } = await delegated.query<{ lvLeads?: { edges: { node: Row }[] } }>(
      `query($filter: LvLeadFilterInput) { lvLeads(first: 200, filter: $filter) { edges { node { id lvLeadId name organisationName location emails { primaryEmail } phones { primaryPhoneNumber } website { primaryLinkUrl } instagram { primaryLinkUrl } duplicateKeys } } } }`,
      { filter: { or: chunk.map((key) => ({ duplicateKeys: { containsIlike: escapeLike(key) } })) } },
    );

    if (errors.length > 0) {
      throw new Error(`Duplicate shortlist query failed: ${errors[0]?.message ?? 'unknown error'}`);
    }

    existing.push(...(data.lvLeads?.edges ?? []).map(({ node }) => node));
  }

  if (existing.length === 0) {
    return;
  }

  const candidates = existing.map((row) => ({ id: row.id, name: row.name, organisationName: row.organisationName, email: row.emails?.primaryEmail ?? null, phone: row.phones?.primaryPhoneNumber ?? null, websiteUrl: row.website?.primaryLinkUrl ?? null, instagramHandle: row.instagram?.primaryLinkUrl ?? null, location: row.location }));
  const byId = new Map(existing.map((row) => [row.id, row]));

  for (const result of results) {
    const draft = drafts.get(result.rowNumber);

    if (!draft || result.status === 'ERROR') {
      continue;
    }

    const [best] = findDuplicates({ id: '', name: draft.name, organisationName: draft.organisationName, email: draft.email, phone: draft.phone, websiteUrl: draft.websiteUrl, instagramHandle: draft.instagramHandle, location: draft.location }, candidates);

    if (best) {
      const row = byId.get(best.recordId)!;

      result.duplicateOf = { leadId: row.id, lvLeadId: row.lvLeadId, name: row.name, percent: best.percent, matchingFields: best.reasons.map((reason) => reason.toLowerCase().replace(/_exact|_same_location/g, '').replace(/_/g, ' ')) };
      result.status = 'DUPLICATE';
    }
  }
};

export const summarise = (results: ImportRowResult[]): ImportValidation['summary'] => ({
  total: results.length,
  valid: results.filter((row) => row.status === 'VALID').length,
  warnings: results.filter((row) => row.status === 'WARNING').length,
  errors: results.filter((row) => row.status === 'ERROR').length,
  duplicates: results.filter((row) => row.status === 'DUPLICATE').length,
});
