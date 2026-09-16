// Column mapping for CSV import: which spreadsheet header feeds which lead
// field. Automatic matching is by normalised header name against a synonym
// table (Twenty's importer does the same for its own fields); the employee
// can change any mapping on the MAP step.

export const IMPORT_TARGETS = [
  { key: 'name', label: 'Name', required: true, synonyms: ['name', 'lead', 'lead name', 'contact', 'contact name', 'full name', 'person'] },
  { key: 'organisationName', label: 'Organisation', required: false, synonyms: ['organisation', 'organization', 'org', 'company', 'business', 'property', 'venue', 'brand'] },
  { key: 'jobTitle', label: 'Job title', required: false, synonyms: ['job title', 'title', 'role', 'designation', 'position'] },
  { key: 'email', label: 'Email', required: false, synonyms: ['email', 'e-mail', 'email address', 'mail'] },
  { key: 'phone', label: 'Phone', required: false, synonyms: ['phone', 'mobile', 'phone number', 'contact number', 'whatsapp', 'tel', 'telephone', 'cell'] },
  { key: 'websiteUrl', label: 'Website', required: false, synonyms: ['website', 'web', 'url', 'site', 'homepage', 'link'] },
  { key: 'instagramHandle', label: 'Instagram', required: false, synonyms: ['instagram', 'insta', 'ig', 'instagram handle', 'instagram url'] },
  { key: 'socialProfileUrl', label: 'Social profile', required: false, synonyms: ['linkedin', 'facebook', 'social', 'profile', 'social profile', 'youtube', 'twitter', 'x'] },
  { key: 'location', label: 'Location', required: false, synonyms: ['location', 'city', 'town', 'place', 'area', 'region', 'address', 'district'] },
  { key: 'category', label: 'Category', required: false, synonyms: ['category', 'type', 'segment', 'lead type', 'partner type'] },
  { key: 'subcategory', label: 'Subcategory', required: false, synonyms: ['subcategory', 'sub category', 'sub-category', 'subtype'] },
  { key: 'source', label: 'Source', required: false, synonyms: ['source', 'lead source', 'channel', 'origin'] },
  { key: 'priority', label: 'Priority', required: false, synonyms: ['priority', 'importance'] },
  { key: 'languages', label: 'Languages', required: false, synonyms: ['language', 'languages', 'lang'] },
  { key: 'owner', label: 'Owner (email or name)', required: false, synonyms: ['owner', 'assigned to', 'assignee', 'hunter', 'account owner', 'handled by'] },
  { key: 'notes', label: 'Notes', required: false, synonyms: ['notes', 'note', 'comment', 'comments', 'remarks', 'description'] },
] as const;

export type ImportTargetKey = (typeof IMPORT_TARGETS)[number]['key'];

export type ColumnMapping = Record<number, ImportTargetKey | null>;

const normaliseHeader = (header: string): string => header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Exact synonym first, then a header that contains a synonym as a word.
// Each target is taken at most once (the first column wins).
export const autoMapColumns = (headers: readonly string[]): ColumnMapping => {
  const mapping: ColumnMapping = {};
  const taken = new Set<ImportTargetKey>();
  const normalised = headers.map(normaliseHeader);

  for (const target of IMPORT_TARGETS) {
    const exact = normalised.findIndex((header, index) => mapping[index] === undefined && (target.synonyms as readonly string[]).includes(header));

    if (exact !== -1) {
      mapping[exact] = target.key;
      taken.add(target.key);
    }
  }

  normalised.forEach((header, index) => {
    if (mapping[index] !== undefined) {
      return;
    }

    const words = header.split(' ');
    const target = IMPORT_TARGETS.find((candidate) => !taken.has(candidate.key) && candidate.synonyms.some((synonym) => synonym.split(' ').every((part) => words.includes(part))));

    mapping[index] = target?.key ?? null;

    if (target) {
      taken.add(target.key);
    }
  });

  return mapping;
};

export const rowToFields = (headers: readonly string[], row: readonly string[], mapping: ColumnMapping): Partial<Record<ImportTargetKey, string>> => {
  const fields: Partial<Record<ImportTargetKey, string>> = {};

  headers.forEach((_, index) => {
    const target = mapping[index];
    const value = row[index]?.trim() ?? '';

    if (target && value.length > 0 && fields[target] === undefined) {
      fields[target] = value;
    }
  });

  return fields;
};
