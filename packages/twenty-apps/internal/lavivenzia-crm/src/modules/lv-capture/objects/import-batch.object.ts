import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  IMPORT_BATCH_FILE_ID,
  IMPORT_BATCH_IMPORTED_BY_ID,
  IMPORT_BATCH_KEY_ID,
  IMPORT_BATCH_MAPPING_ID,
  IMPORT_BATCH_NAME_ID,
  IMPORT_BATCH_OBJECT_ID,
  IMPORT_BATCH_REPORT_ID,
  IMPORT_BATCH_ROW_COUNT_ID,
  IMPORT_BATCH_STATUS_ID,
  IMPORT_BATCH_SUMMARY_ID,
} from 'src/constants/universal-identifiers';

// One CSV import: the uploaded file, the column mapping the person chose,
// the validation summary and the final report. It exists for two reasons —
// the sandboxed capture screen cannot read file bytes (CM-006), so the file
// is uploaded here and parsed by the server; and an import is something an
// administrator will want to look back at.
//
// Written only by the capture import routes (application role). Read by
// administrators through the standard record UI.

export const IMPORT_BATCH_STATUSES = ['UPLOADED', 'VALIDATED', 'IMPORTED', 'FAILED'] as const;

export default defineObject({
  universalIdentifier: IMPORT_BATCH_OBJECT_ID,
  nameSingular: 'lvImportBatch',
  namePlural: 'lvImportBatches',
  labelSingular: 'Import batch',
  labelPlural: 'Import batches',
  description: 'A CSV lead import: file, mapping, validation summary and report',
  icon: 'IconFileImport',
  isSearchable: false,
  labelIdentifierFieldMetadataUniversalIdentifier: IMPORT_BATCH_NAME_ID,
  fields: [
    { universalIdentifier: IMPORT_BATCH_NAME_ID, type: FieldType.TEXT, name: 'name', label: 'Import', icon: 'IconFileImport', defaultValue: "''" },
    { universalIdentifier: IMPORT_BATCH_KEY_ID, type: FieldType.TEXT, name: 'importKey', label: 'Import key', description: 'Client-minted idempotency key; each row derives its capture key from it', icon: 'IconKey', isNullable: true, isUnique: true },
    { universalIdentifier: IMPORT_BATCH_FILE_ID, type: FieldType.FILES, name: 'file', label: 'File', icon: 'IconPaperclip', isNullable: true, universalSettings: { maxNumberOfValues: 1 } },
    {
      universalIdentifier: IMPORT_BATCH_STATUS_ID,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconCircleDot',
      isNullable: true,
      options: [
        { id: 'c1d2e3f4-0001-4b00-8000-000000000001', value: 'UPLOADED', label: 'Uploaded', color: 'gray', position: 0 },
        { id: 'c1d2e3f4-0001-4b00-8000-000000000002', value: 'VALIDATED', label: 'Validated', color: 'blue', position: 1 },
        { id: 'c1d2e3f4-0001-4b00-8000-000000000003', value: 'IMPORTED', label: 'Imported', color: 'green', position: 2 },
        { id: 'c1d2e3f4-0001-4b00-8000-000000000004', value: 'FAILED', label: 'Failed', color: 'red', position: 3 },
      ],
    },
    { universalIdentifier: IMPORT_BATCH_ROW_COUNT_ID, type: FieldType.NUMBER, name: 'rowCount', label: 'Rows', icon: 'IconListNumbers', isNullable: true },
    { universalIdentifier: IMPORT_BATCH_MAPPING_ID, type: FieldType.RAW_JSON, name: 'mapping', label: 'Column mapping', icon: 'IconArrowsExchange', isNullable: true },
    { universalIdentifier: IMPORT_BATCH_SUMMARY_ID, type: FieldType.RAW_JSON, name: 'summary', label: 'Validation summary', icon: 'IconChecklist', isNullable: true },
    { universalIdentifier: IMPORT_BATCH_REPORT_ID, type: FieldType.RAW_JSON, name: 'report', label: 'Report', icon: 'IconReport', isNullable: true },
    { universalIdentifier: IMPORT_BATCH_IMPORTED_BY_ID, type: FieldType.TEXT, name: 'importedById', label: 'Imported by', description: 'Workspace member id, from the session', icon: 'IconUser', isNullable: true },
  ],
});
