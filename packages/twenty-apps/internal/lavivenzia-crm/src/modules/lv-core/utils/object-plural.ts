// Twenty routes list pages by the object's plural name. Most LV objects
// pluralise with an "s"; the exceptions live here so a dashboard tile never
// links to a page that does not exist.
const IRREGULAR: Record<string, string> = {
  lvProperty: 'lvProperties',
  lvAssignmentHistory: 'lvAssignmentHistories',
  lvImportBatch: 'lvImportBatches',
  person: 'people',
  company: 'companies',
};

export const pluralOf = (objectNameSingular: string): string => IRREGULAR[objectNameSingular] ?? `${objectNameSingular}s`;
