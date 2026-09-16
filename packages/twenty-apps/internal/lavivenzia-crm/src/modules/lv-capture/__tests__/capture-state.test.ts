import { describe, expect, it } from 'vitest';

import {
  acceptClassification,
  applyExtraction,
  applyPreflight,
  canCreate,
  chooseAssignment,
  chooseMethod,
  decideDuplicates,
  editClassification,
  initialCaptureState,
  rejectClassification,
  setField,
  toRequestFields,
} from 'src/modules/lv-capture/front-components/capture-lead/capture-state';
import { applyReport, applyValidation, decideRow, initialImportState, loadCsv, mappingProblems, rowsForCommit, rowsForValidation, setMapping } from 'src/modules/lv-capture/front-components/capture-lead/import-state';
import { summariseCapture } from 'src/modules/lv-core/services/lead-360';

const preflightBase = { draft: { name: '', category: null, subcategory: null, source: 'MANUAL', completeness: 20 }, quality: [], duplicates: [], classification: null, recommendation: null };

describe('capture screen state machine', () => {
  it('starts on CHOOSE, keeps one capture key across method changes and resets when a method is chosen', () => {
    const state = initialCaptureState();

    expect(state.phase).toBe('CHOOSE');
    expect(state.captureKey).toMatch(/^[0-9a-f-]{36}$/);

    const chosen = chooseMethod(setField(state, 'name', 'typed before choosing'), 'VISITING_CARD');

    expect(chosen.phase).toBe('INPUT');
    expect(chosen.method).toBe('VISITING_CARD');
    expect(chosen.captureKey).toBe(state.captureKey);
    expect(chosen.fields.name?.value).toBe('');
  });

  it('extraction fills only empty fields, marks them with confidence, and editing one makes it the person’s own', () => {
    let state = chooseMethod(initialCaptureState(), 'VISITING_CARD');

    state = setField(state, 'name', 'Typed Name');
    state = applyExtraction(state, { status: 'EXTRACTED', kind: 'OCR', runId: 'run-1', fields: [{ field: 'name', value: 'OCR Name', confidence: 0.9, label: 'HIGH' }, { field: 'phone', value: '+91 98765 43210', confidence: 0.55, label: 'MEDIUM' }, { field: 'email', value: null, confidence: 0, label: 'LOW' }] });

    expect(state.phase).toBe('REVIEW');
    expect(state.fields.name?.value).toBe('Typed Name');
    expect(state.fields.phone).toEqual({ value: '+91 98765 43210', extracted: true, confidence: 'MEDIUM' });
    expect(state.extraction.fieldCount).toBe(1);

    const edited = setField(state, 'phone', '+91 98765 43211');

    expect(edited.fields.phone?.extracted).toBe(false);
    expect(edited.fields.phone?.confidence).toBeNull();

    const request = toRequestFields({ ...state, confirmed: true });

    expect(request.extractedFields).toEqual(['phone']);
    expect(request.extractionKind).toBe('OCR');
    expect(request.isHumanConfirmed).toBe(true);
    expect(request).not.toHaveProperty('ownerId');
  });

  it('preflight surfaces a derived name, the default source and a confident classification; a weak one stays a suggestion', () => {
    const state = chooseMethod(initialCaptureState(), 'WEBSITE_URL');
    const confident = applyPreflight(state, { ...preflightBase, draft: { ...preflightBase.draft, name: 'Example', source: 'WEBSITE' }, classification: { status: 'AI_SUGGESTED', category: 'BUSINESS', subcategory: 'RESTAURANT', confidence: 0.9, reasoning: 'menu on site', runId: 'run-2' } });

    expect(confident.fields.name).toEqual({ value: 'Example', extracted: true, confidence: 'LOW' });
    expect(confident.fields.source?.value).toBe('WEBSITE');
    expect(confident.fields.category?.value).toBe('BUSINESS');
    expect(confident.classificationDecision).toBe('ACCEPTED');

    const weak = applyPreflight(state, { ...preflightBase, classification: { status: 'REVIEW_REQUIRED', category: 'BUSINESS', subcategory: null, confidence: 0.4, reasoning: null, runId: 'run-3' } });

    expect(weak.fields.category?.value).toBe('');
    expect(weak.classificationDecision).toBe('NOT_RUN');

    const accepted = acceptClassification(weak);

    expect(accepted.fields.category?.value).toBe('BUSINESS');
    expect(accepted.classificationDecision).toBe('ACCEPTED');
    expect(editClassification(accepted, 'BUSINESS', 'HOTEL').classificationDecision).toBe('EDITED');
    expect(rejectClassification(accepted).fields.category?.value).toBe('');
    expect(rejectClassification(accepted).classificationDecision).toBe('REJECTED');

    const unavailable = applyPreflight(state, { ...preflightBase, classification: { status: 'UNAVAILABLE', category: null, subcategory: null, confidence: null, reasoning: null, runId: null } });

    expect(unavailable.classificationDecision).toBe('UNAVAILABLE');
  });

  it('falls back to "assign to me" when the engine has no match and requires a duplicate decision before create', () => {
    let state = chooseMethod(initialCaptureState(), 'MANUAL');

    state = setField(state, 'name', 'Someone');
    state = applyPreflight({ ...state, confirmed: true, phase: 'CHECKING' }, { ...preflightBase, duplicates: [{ leadId: 'l1', lvLeadId: 'LV-000001', name: 'Someone', organisationName: null, location: null, status: 'NEW', percent: 80, strength: 'STRONG', matchingFields: ['name'] }], recommendation: { memberId: null, displayName: null, strategy: 'NONE', reasons: [], noMatchReason: 'No eligible member', candidates: [] } });

    expect(state.phase).toBe('DECIDE');
    expect(state.assignment.mode).toBe('SELF');
    expect(canCreate(state)).toEqual({ ok: false, reason: 'Decide what to do about the possible duplicate.' });
    expect(canCreate(decideDuplicates(state, 'IGNORED')).ok).toBe(true);
    expect(canCreate({ ...decideDuplicates(state, 'CREATE_NEW'), confirmed: false }).reason).toBe('Review the details first.');
    expect(chooseAssignment(state, { mode: 'MEMBER', memberId: 'm2' }).assignment).toEqual({ mode: 'MEMBER', memberId: 'm2' });
  });

  it('refuses to create with nothing identifying', () => {
    const state = { ...chooseMethod(initialCaptureState(), 'MANUAL'), confirmed: true };

    expect(canCreate(state).reason).toMatch(/name, organisation, website or profile/);
    expect(canCreate(setField(state, 'instagramHandle', '@x')).ok).toBe(true);
  });
});

describe('import screen state machine', () => {
  const csv = 'Name,Company,E-mail,Mobile,City,Weird\nAsha,Asha Villas,asha@example.com,+91 98765 43210,Goa,zzz\nRavi,,ravi@example.com,,Panaji,\n';

  it('parses the file, auto-maps known headers and lets unknown ones be mapped by hand', () => {
    const state = loadCsv(initialImportState(), 'leads.csv', csv);

    expect(state.phase).toBe('MAP');
    expect(state.headers).toEqual(['Name', 'Company', 'E-mail', 'Mobile', 'City', 'Weird']);
    expect(state.mapping[0]).toBe('name');
    expect(state.mapping[1]).toBe('organisationName');
    expect(state.mapping[2]).toBe('email');
    expect(state.mapping[3]).toBe('phone');
    expect(state.mapping[4]).toBe('location');
    expect(state.mapping[5] ?? null).toBeNull();
    expect(mappingProblems(state)).toEqual([]);

    // Mapping "Weird" to Name frees the first column.
    const remapped = setMapping(state, 5, 'name');

    expect(remapped.mapping[5]).toBe('name');
    expect(remapped.mapping[0]).toBeNull();

    const none = setMapping(setMapping(remapped, 5, null), 1, null);

    expect(mappingProblems(none)).toEqual([]);
    expect(mappingProblems(setMapping(none, 2, null))).toHaveLength(1);
  });

  it('rows carry their spreadsheet line number and validation defaults errors and duplicates to SKIP', () => {
    const state = loadCsv(initialImportState(), 'leads.csv', csv);
    const rows = rowsForValidation(state);

    expect(rows.map((row) => row.rowNumber)).toEqual([2, 3]);
    expect(rows[0]!.fields).toEqual({ name: 'Asha', organisationName: 'Asha Villas', email: 'asha@example.com', phone: '+91 98765 43210', location: 'Goa' });

    const reviewed = applyValidation(state, {
      rows: [
        { rowNumber: 2, status: 'VALID', errors: [], warnings: [], draft: { name: 'Asha', organisationName: 'Asha Villas', email: 'asha@example.com', phone: '+91 98765 43210', location: 'Goa', category: null }, duplicateOfRow: null, duplicateOf: null },
        { rowNumber: 3, status: 'DUPLICATE', errors: [], warnings: [], draft: { name: 'Ravi', organisationName: null, email: 'ravi@example.com', phone: null, location: 'Panaji', category: null }, duplicateOfRow: null, duplicateOf: { leadId: 'l9', lvLeadId: 'LV-000009', name: 'Ravi', percent: 70, matchingFields: ['email'] } },
      ],
      summary: { total: 2, valid: 1, warnings: 0, errors: 0, duplicates: 1 },
      duplicateError: null,
    });

    expect(reviewed.phase).toBe('REVIEW');
    expect(reviewed.results.map((row) => row.decision)).toEqual(['CREATE', 'SKIP']);
    expect(rowsForCommit(decideRow(reviewed, 3, 'CREATE')).map((row) => row.decision)).toEqual(['CREATE', 'CREATE']);

    const done = applyReport(reviewed, { report: [{ rowNumber: 2, status: 'CREATED', leadId: 'l2', lvLeadId: 'LV-000010', error: null }], summary: { total: 2, created: 1, skipped: 1, existing: 0, errors: 0, ownerWarnings: 0 }, note: null });

    expect(done.phase).toBe('REPORT');
    expect(done.reportSummary?.created).toBe(1);
  });

  it('rejects an empty or header-only file', () => {
    expect(loadCsv(initialImportState(), 'x.csv', 'Name,Email\n').error).toMatch(/no header row or no data rows/);
    expect(loadCsv(initialImportState(), 'x.csv', '').phase).toBe('UPLOAD');
  });
});

describe('Lead 360 capture summary', () => {
  it('reads provenance defensively and labels method / platform for people', () => {
    const summary = summariseCapture({ captureMode: 'INSTAGRAM', captureFiles: [{ fileId: 'f1', label: 'card.jpg' }], captureProvenance: { method: 'INSTAGRAM', platform: 'INSTAGRAM', originalHandle: 'asha.villas', capturedAt: '2026-09-16T10:00:00.000Z', capturedById: 'm1', extraction: { status: 'UNAVAILABLE', kind: null, fieldCount: 0 }, classification: { status: 'ACCEPTED' }, duplicateDecision: { decision: 'IGNORED', candidateLeadIds: ['l1', 42] } } }, (id) => (id === 'm1' ? { id: 'm1', displayName: 'Tim', email: null } : null));

    expect(summary).toMatchObject({ method: 'INSTAGRAM', methodLabel: 'Instagram profile', platformLabel: 'Instagram', originalHandle: 'asha.villas', capturedBy: { displayName: 'Tim' }, extraction: { status: 'UNAVAILABLE' }, classification: { status: 'ACCEPTED' }, duplicateDecision: { decision: 'IGNORED', candidateLeadIds: ['l1'] }, files: [{ fileId: 'f1', label: 'card.jpg' }] });
    expect(summariseCapture({ captureMode: 'MANUAL', captureFiles: null, captureProvenance: null }, () => null)).toBeNull();
    expect(summariseCapture({ captureMode: null, captureFiles: null, captureProvenance: { method: 'API', duplicateDecision: { decision: 'NONE' } } }, () => null)).toMatchObject({ methodLabel: 'API', duplicateDecision: null });
  });
});
