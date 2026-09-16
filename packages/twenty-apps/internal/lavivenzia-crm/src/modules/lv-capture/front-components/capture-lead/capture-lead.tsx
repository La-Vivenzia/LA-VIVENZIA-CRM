import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppPath, navigate, uploadFile, useColorScheme } from 'twenty-sdk/front-component';

import { CAPTURE_METHOD_BY_KEY, CAPTURE_METHODS, PRIMARY_CAPTURE_ACTIONS } from 'src/modules/lv-capture/constants/capture-methods';
import {
  acceptClassification,
  applyExtraction,
  applyPreflight,
  canCreate,
  type CaptureState,
  chooseAssignment,
  chooseMethod,
  decideDuplicates,
  editClassification,
  initialCaptureState,
  rejectClassification,
  setField,
  toRequestFields,
} from 'src/modules/lv-capture/front-components/capture-lead/capture-state';
import { ImportLeads } from 'src/modules/lv-capture/front-components/capture-lead/import-leads';
import { LEAD_PRIORITIES, LEAD_PRIORITY_LABELS } from 'src/modules/lv-core/constants/lead-lifecycle';
import { LEAD_CATEGORY_OPTIONS, LEAD_SOURCE_OPTIONS, LEAD_SUBCATEGORY_OPTIONS } from 'src/modules/lv-core/constants/select-options.generated';
import { LEAD_SUBCATEGORIES_BY_CATEGORY, type LeadCaptureMode, type LeadCategory } from 'src/modules/lv-core/constants/lead-taxonomy';
import { ActionBar, Disclosure, EmptyState, ErrorState, Eyebrow, Field, InlineNotice, LoadingState, LvBadge, LvButton, LvCard, LvInput, LvPage, LvSelect, LvStatusBadge, LvTextarea, PageHeader, Provenance, Segmented, VisuallyHidden } from 'src/modules/lv-core/ui/kit';
import { type LvTheme, themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { resolveFilesFieldMetadataId } from 'src/modules/lv-onboarding/front-components/onboarding-wizard/document-upload-field';

// Capture Lead — the one way a relationship enters the CRM.
//
//   what are you holding? → the input step for it → (extraction) → review
//   → duplicates / assignment → create → success (LV ID, owner, next action)
//
// The screen never decides anything of consequence: validation, data
// quality, classification, duplicates, the assignment recommendation, the
// lead, the owner and the next action all come from the capture routes,
// under the signed-in person's permissions. It only collects, shows and
// asks. The capture key is minted once per attempt, so pressing Create twice
// (or a retry after a network blip) returns the same lead.

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  organisationName: 'Organisation',
  jobTitle: 'Job title',
  phone: 'Phone',
  email: 'Email',
  websiteUrl: 'Website',
  instagramHandle: 'Instagram',
  socialProfileUrl: 'Social profile',
  location: 'Location',
  category: 'Category',
  subcategory: 'Subcategory',
  source: 'Source',
  priority: 'Priority',
  referrerName: 'Referred by',
  notes: 'Notes',
};

const ESSENTIAL_FIELDS = ['name', 'organisationName', 'phone', 'email', 'location'] as const;
const MORE_FIELDS = ['jobTitle', 'websiteUrl', 'instagramHandle', 'socialProfileUrl', 'priority', 'notes'] as const;

type Step = { key: string; label: string };

const STEPS: Step[] = [
  { key: 'INPUT', label: 'Capture' },
  { key: 'REVIEW', label: 'Review' },
  { key: 'DECIDE', label: 'Check' },
  { key: 'SUCCESS', label: 'Done' },
];

const stepIndex = (phase: CaptureState['phase']): number => (phase === 'CHOOSE' || phase === 'INPUT' || phase === 'EXTRACTING' ? 0 : phase === 'REVIEW' ? 1 : phase === 'CHECKING' || phase === 'DECIDE' || phase === 'CREATING' ? 2 : 3);

const Steps = ({ theme, phase }: { theme: LvTheme; phase: CaptureState['phase'] }) => {
  const active = stepIndex(phase);

  return (
    <ol aria-label="Capture progress" style={{ display: 'flex', gap: theme.space(2), listStyle: 'none', margin: `0 0 ${theme.space(3)}px`, padding: 0 }}>
      {STEPS.map((step, index) => (
        <li key={step.key} aria-current={index === active ? 'step' : undefined} style={{ ...theme.type.label, flex: 1, paddingTop: 6, borderTop: `3px solid ${index <= active ? theme.color.brand : theme.color.border}`, color: index === active ? theme.color.brand : index < active ? theme.color.textMuted : theme.color.textSubtle }}>
          {step.label}
        </li>
      ))}
    </ol>
  );
};

export const CaptureLead = ({ initialMethod = null }: { initialMethod?: LeadCaptureMode | null }) => {
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const [state, setState] = useState<CaptureState>(() => initialCaptureState(initialMethod));
  const [busy, setBusy] = useState<string | null>(null);
  const [filesFieldId, setFilesFieldId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    void resolveFilesFieldMetadataId('lvLead', 'captureFiles').then((id) => active && setFilesFieldId(id));

    return () => {
      active = false;
    };
  }, []);

  const method = state.method ? CAPTURE_METHOD_BY_KEY[state.method] : null;
  const update = (key: string) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setState((current) => setField(current, key, event.target.value));

  // ---- preflight: validate, classify, duplicates, recommendation ----------
  const preflight = useCallback(
    async (current: CaptureState, stage: 'START' | 'REVIEW'): Promise<CaptureState> => {
      const result = (await callRoute('/capture/preflight', { captureKey: current.captureKey, method: current.method, fields: toRequestFields(current), stage })) as {
        ok: boolean;
        error?: string;
        errors?: string[];
        draft?: { name: string; category: string | null; subcategory: string | null; source: string; completeness: number };
        quality?: CaptureState['quality'];
        duplicates?: CaptureState['duplicates'];
        classification?: CaptureState['classification'];
        recommendation?: CaptureState['recommendation'];
      };

      if (!result.ok || !result.draft) {
        throw new Error(result.errors?.[0] ?? result.error ?? 'The details could not be checked.');
      }

      return applyPreflight(current, { draft: result.draft, quality: result.quality ?? [], duplicates: result.duplicates ?? [], classification: result.classification ?? null, recommendation: result.recommendation ?? null });
    },
    [],
  );

  // ---- step: from INPUT to REVIEW ----------------------------------------
  const continueFromInput = async () => {
    if (!method) {
      return;
    }

    setBusy('extract');
    setState((current) => ({ ...current, error: null }));

    try {
      let next = state;

      if (method.input === 'URL' || method.input === 'HANDLE') {
        const raw = state.rawInput.trim();

        if (raw.length === 0) {
          throw new Error(method.input === 'URL' ? 'Paste the website address first.' : 'Paste the profile link or handle first.');
        }

        setState((current) => ({ ...current, phase: 'EXTRACTING' }));
        const extracted = (await callRoute('/capture/extract', { captureKey: state.captureKey, method: method.key, url: raw, handle: raw })) as { ok: boolean; error?: string; status?: string; kind?: 'OCR' | 'PAGE_METADATA' | null; runId?: string | null; reason?: string | null; notes?: string | null; fields?: { field: string; value: string | null; confidence: number; label: 'HIGH' | 'MEDIUM' | 'LOW' }[] };

        if (!extracted.ok) {
          throw new Error(extracted.error ?? 'That could not be read.');
        }

        next = applyExtraction(state, { status: (extracted.status as CaptureState['extraction']['status']) ?? 'NOT_APPLICABLE', kind: extracted.kind ?? null, runId: extracted.runId ?? null, reason: extracted.reason, notes: extracted.notes, fields: extracted.fields });
      } else if (method.input === 'IMAGE') {
        if (!state.attachment) {
          throw new Error('Take or choose a photo first.');
        }

        next = { ...state, phase: 'REVIEW' };
      } else {
        next = { ...state, phase: 'REVIEW' };
      }

      // The first preflight brings the derived name, quality hints and the
      // classification suggestion onto the review screen.
      next = await preflight({ ...next, phase: 'REVIEW' }, 'START');
      setState({ ...next, phase: 'REVIEW' });
    } catch (error) {
      setState((current) => ({ ...current, phase: 'INPUT', error: error instanceof Error ? error.message : 'Something went wrong.' }));
    } finally {
      setBusy(null);
    }
  };

  // ---- image: upload + extract --------------------------------------------
  const onImage = async (files: FileList | null) => {
    const file = files?.[0];

    if (!file) {
      return;
    }

    if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
      setState((current) => ({ ...current, error: 'Use a JPG, PNG or WEBP image.' }));

      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setState((current) => ({ ...current, error: 'The image is larger than 6 MB. Take a smaller photo.' }));

      return;
    }

    setBusy('upload');
    setState((current) => ({ ...current, error: null, phase: 'EXTRACTING' }));

    try {
      // The sandboxed renderer never sees file bytes: the picked file arrives
      // as metadata plus a host-side handle (CM-006), which uploadFile hands
      // back to the host. The photo lands in the lead's FILES field and the
      // server reads it from its own signed URL for extraction.
      if (!filesFieldId) {
        throw new Error('The upload is not ready yet. Try again in a moment.');
      }

      const uploaded = await uploadFile(file, { fieldMetadataId: filesFieldId, fileName: file.name });

      if (uploaded.status !== 'uploaded') {
        throw new Error(`The upload did not complete (${uploaded.reason}). Check your connection and try again.`);
      }

      const attachment: CaptureState['attachment'] = { fileId: uploaded.file.fileId, label: file.name, mimeType: file.type, size: file.size, previewUrl: uploaded.file.url };
      const extracted = (await callRoute('/capture/extract', { captureKey: state.captureKey, method: state.method, image: { mimeType: file.type, url: uploaded.file.url, fileId: uploaded.file.fileId } })) as { ok: boolean; error?: string; status?: string; kind?: 'OCR' | 'PAGE_METADATA' | null; runId?: string | null; reason?: string | null; notes?: string | null; fields?: { field: string; value: string | null; confidence: number; label: 'HIGH' | 'MEDIUM' | 'LOW' }[] };

      if (!extracted.ok) {
        throw new Error(extracted.error ?? 'The image could not be read.');
      }

      let next = applyExtraction({ ...state, attachment }, { status: (extracted.status as CaptureState['extraction']['status']) ?? 'FAILED', kind: extracted.kind ?? 'OCR', runId: extracted.runId ?? null, reason: extracted.reason, notes: extracted.notes, fields: extracted.fields });

      next = await preflight(next, 'START').catch(() => next);
      setState({ ...next, phase: 'REVIEW' });
    } catch (error) {
      setState((current) => ({ ...current, phase: 'INPUT', error: error instanceof Error ? error.message : 'The image could not be processed.' }));
    } finally {
      setBusy(null);

      if (fileInput.current) {
        fileInput.current.value = '';
      }
    }
  };

  // ---- review → check (duplicates + assignment) ---------------------------
  const check = async () => {
    setBusy('check');

    try {
      const confirmed = { ...state, confirmed: true, phase: 'CHECKING' as const };

      setState(confirmed);
      const next = await preflight(confirmed, 'REVIEW');

      setState({ ...next, phase: 'DECIDE' });
    } catch (error) {
      setState((current) => ({ ...current, phase: 'REVIEW', error: error instanceof Error ? error.message : 'The details could not be checked.' }));
    } finally {
      setBusy(null);
    }
  };

  // ---- create -------------------------------------------------------------
  const create = async () => {
    const gate = canCreate(state);

    if (!gate.ok) {
      setState((current) => ({ ...current, error: gate.reason }));

      return;
    }

    setBusy('create');
    setState((current) => ({ ...current, phase: 'CREATING', error: null }));

    try {
      const result = (await callRoute('/capture/create', {
        captureKey: state.captureKey,
        method: state.method,
        fields: toRequestFields({ ...state, confirmed: true }),
        assignment: state.assignment,
        duplicate: { decision: state.duplicateDecision, candidateLeadIds: state.duplicates.map((candidate) => candidate.leadId) },
        classification: { status: state.classificationDecision, runId: state.classification?.runId ?? null },
        extraction: { status: state.extraction.status, kind: state.extraction.kind, runId: state.extraction.runId, fieldCount: state.extraction.fieldCount },
        attachment: state.attachment ? [{ fileId: state.attachment.fileId, label: state.attachment.label }] : null,
        timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      })) as { ok: boolean; error?: string; leadId?: string; lvLeadId?: string | null; ownerId?: string | null; ownerName?: string | null; assignment?: { state: string; reason: string | null }; task?: CaptureState['result'] extends infer R ? (R extends { task: infer T } ? T : never) : never; taskError?: string | null; replayed?: boolean };

      if (!result.ok || !result.leadId) {
        throw new Error(result.error ?? 'The lead was not created.');
      }

      setState((current) => ({
        ...current,
        phase: 'SUCCESS',
        result: { leadId: result.leadId!, lvLeadId: result.lvLeadId ?? null, ownerId: result.ownerId ?? null, ownerName: result.ownerName ?? null, assignment: result.assignment ?? { state: result.ownerId ? 'ASSIGNED' : 'UNASSIGNED', reason: null }, task: result.task ?? null, taskError: result.taskError ?? null, replayed: result.replayed === true },
      }));
    } catch (error) {
      setState((current) => ({ ...current, phase: 'DECIDE', error: error instanceof Error ? error.message : 'The lead was not created.' }));
    } finally {
      setBusy(null);
    }
  };

  const openLead = (leadId: string) => void navigate(AppPath.RecordShowPage, { objectNameSingular: 'lvLead', objectRecordId: leadId });
  const restart = (nextMethod: LeadCaptureMode | null = null) => setState(initialCaptureState(nextMethod));

  // ---- import branch --------------------------------------------------------
  if (state.method === 'IMPORT') {
    return (
      <LvPage theme={theme} maxWidth={960}>
        <PageHeader theme={theme} eyebrow="Capture lead" title="Import CSV" subtitle="Upload → map → validate → review duplicates → import → report." right={<LvButton theme={theme} variant="ghost" size="sm" onClick={() => restart()}>Back to capture</LvButton>} />
        <ImportLeads theme={theme} />
      </LvPage>
    );
  }

  // ---- entry screen -----------------------------------------------------------
  if (state.phase === 'CHOOSE' || !method) {
    return (
      <LvPage theme={theme} maxWidth={860}>
        <PageHeader theme={theme} eyebrow="Capture lead" title="What are you capturing?" subtitle="A card, a profile, a website, a conversation — turn it into a lead in under a minute." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.space(3), marginBottom: theme.space(5) }}>
          {PRIMARY_CAPTURE_ACTIONS.map((action, index) => (
            <button
              key={action.method}
              type="button"
              onClick={() => setState((current) => chooseMethod(current, action.method))}
              style={{ ...theme.type.body, textAlign: 'left', minHeight: 96, padding: theme.space(3), borderRadius: theme.radius.lg, cursor: 'pointer', fontFamily: theme.font.body, border: `1px solid ${index === 0 ? theme.color.brand : theme.color.border}`, background: index === 0 ? theme.color.surfaceInverse : theme.color.surfaceRaised, color: index === 0 ? theme.color.surfaceInverseText : theme.color.text, boxShadow: theme.shadow.sm }}
            >
              <span style={{ ...theme.type.subheading, display: 'block', color: index === 0 ? theme.color.surfaceInverseText : theme.color.heading }}>{action.label}</span>
              <span style={{ ...theme.type.caption, display: 'block', marginTop: 4, color: index === 0 ? 'rgba(243,239,231,0.75)' : theme.color.textMuted }}>{action.hint}</span>
            </button>
          ))}
        </div>
        <Eyebrow theme={theme}>Or, more precisely</Eyebrow>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(2) }}>
          {CAPTURE_METHODS.filter((candidate) => !PRIMARY_CAPTURE_ACTIONS.some((action) => action.method === candidate.key)).map((candidate) => (
            <LvButton key={candidate.key} theme={theme} variant="secondary" size="sm" onClick={() => setState((current) => chooseMethod(current, candidate.key))} title={candidate.hint}>
              {candidate.label}
            </LvButton>
          ))}
        </div>
      </LvPage>
    );
  }

  const fieldsFor = (keys: readonly string[]) =>
    keys.map((key) => {
      const field = state.fields[key] ?? { value: '', extracted: false, confidence: null };
      const id = `lv-capture-${key}`;
      const help = field.extracted && field.confidence ? `Read automatically · ${field.confidence.toLowerCase()} confidence` : undefined;
      const quality = state.quality.find((hint) => hint.field === key && hint.kind === 'INVALID');

      if (key === 'category') {
        return (
          <Field key={key} theme={theme} label="Category" htmlFor={id} help={help}>
            <LvSelect theme={theme} id={id} value={field.value} onChange={(event) => setState((current) => editClassification(current, event.target.value, ''))}>
              <option value="">—</option>
              {LEAD_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </LvSelect>
          </Field>
        );
      }

      if (key === 'subcategory') {
        const category = state.fields.category?.value as LeadCategory | '';
        const allowed = category ? ((LEAD_SUBCATEGORIES_BY_CATEGORY[category] as readonly string[] | undefined) ?? []) : [];

        return (
          <Field key={key} theme={theme} label="Subcategory" htmlFor={id} help={help}>
            <LvSelect theme={theme} id={id} value={field.value} disabled={!category} onChange={(event) => setState((current) => editClassification(current, current.fields.category?.value ?? '', event.target.value))}>
              <option value="">—</option>
              {LEAD_SUBCATEGORY_OPTIONS.filter((option) => allowed.includes(option.value)).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </LvSelect>
          </Field>
        );
      }

      if (key === 'source') {
        return (
          <Field key={key} theme={theme} label="Source" htmlFor={id}>
            <LvSelect theme={theme} id={id} value={field.value || method.defaultSource} onChange={update(key)}>
              {LEAD_SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </LvSelect>
          </Field>
        );
      }

      if (key === 'priority') {
        return (
          <Field key={key} theme={theme} label="Priority" htmlFor={id}>
            <LvSelect theme={theme} id={id} value={field.value || 'MEDIUM'} onChange={update(key)}>
              {LEAD_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {LEAD_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </LvSelect>
          </Field>
        );
      }

      if (key === 'notes') {
        return (
          <Field key={key} theme={theme} label="Notes" htmlFor={id} span>
            <LvTextarea theme={theme} id={id} value={field.value} onChange={update(key)} rows={3} placeholder="Anything worth remembering from the conversation" />
          </Field>
        );
      }

      return (
        <Field key={key} theme={theme} label={FIELD_LABELS[key] ?? key} htmlFor={id} help={help} error={quality?.text ?? null} required={key === 'name' && method.input === 'FORM'}>
          <LvInput theme={theme} id={id} value={field.value} onChange={update(key)} invalid={Boolean(quality)} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : key === 'websiteUrl' || key === 'socialProfileUrl' ? 'url' : 'text'} placeholder={key === 'phone' ? '+91 …' : key === 'websiteUrl' ? 'https://' : key === 'instagramHandle' ? '@handle' : undefined} />
        </Field>
      );
    });

  const header = (
    <PageHeader
      theme={theme}
      eyebrow="Capture lead"
      title={method.label}
      subtitle={method.hint}
      right={
        <LvButton theme={theme} variant="ghost" size="sm" onClick={() => restart()} disabled={busy !== null}>
          Start over
        </LvButton>
      }
    />
  );

  // ---- INPUT / EXTRACTING -----------------------------------------------------
  if (state.phase === 'INPUT' || state.phase === 'EXTRACTING') {
    const extracting = state.phase === 'EXTRACTING';

    return (
      <LvPage theme={theme} maxWidth={720}>
        {header}
        <Steps theme={theme} phase={state.phase} />
        {state.error && (
          <div style={{ marginBottom: theme.space(3) }}>
            <ErrorState theme={theme} title="Could not continue" text={state.error} />
          </div>
        )}
        {extracting ? (
          <LvCard theme={theme} tone="info">
            <Eyebrow theme={theme} tone="info">Processing</Eyebrow>
            <p style={{ ...theme.type.title, margin: `${theme.space(1)}px 0 ${theme.space(2)}px`, color: theme.color.heading }}>{method.input === 'IMAGE' ? 'Reading the image…' : 'Extracting information…'}</p>
            <LoadingState theme={theme} rows={3} label="Extracting" />
          </LvCard>
        ) : method.input === 'IMAGE' ? (
          <LvCard theme={theme}>
            <input ref={fileInput} id="lv-capture-image" type="file" accept={IMAGE_ACCEPT} capture="environment" onChange={(event) => void onImage(event.target.files)} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
            <label htmlFor="lv-capture-image" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: theme.space(2), minHeight: 220, padding: theme.space(4), borderRadius: theme.radius.md, border: `2px dashed ${theme.color.borderStrong}`, background: theme.color.surfaceSunken, cursor: 'pointer', textAlign: 'center' }}>
              <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 28, background: theme.color.surfaceInverse, color: theme.color.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                ▣
              </span>
              <span style={{ ...theme.type.subheading, color: theme.color.heading }}>Take a photo or choose an image</span>
              <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>JPG, PNG or WEBP · up to 6 MB · the details are read for you to check</span>
            </label>
            <div style={{ marginTop: theme.space(3), display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
              <LvButton theme={theme} variant="primary" onClick={() => fileInput.current?.click()} busy={busy === 'upload'}>
                Take photo
              </LvButton>
              <LvButton theme={theme} variant="ghost" onClick={() => setState((current) => ({ ...current, phase: 'REVIEW', extraction: { ...current.extraction, status: 'SKIPPED' } }))}>
                Type it instead
              </LvButton>
            </div>
          </LvCard>
        ) : method.input === 'URL' || method.input === 'HANDLE' ? (
          <LvCard theme={theme}>
            <Field theme={theme} label={method.input === 'URL' ? 'Website address' : method.key === 'LINKEDIN_PROFILE' ? 'LinkedIn profile or company page' : method.key === 'SOCIAL_HANDLE' ? 'Profile link or handle' : 'Instagram profile link or @handle'} htmlFor="lv-capture-raw" help={method.input === 'URL' ? 'Public page details (name, email, phone, Instagram) are read for you to check.' : 'Social platforms are not scraped: the handle is kept and you add the rest.'}>
              <LvInput theme={theme} id="lv-capture-raw" value={state.rawInput} onChange={(event) => setState((current) => ({ ...current, rawInput: event.target.value, error: null }))} placeholder={method.input === 'URL' ? 'https://' : method.key === 'LINKEDIN_PROFILE' ? 'https://linkedin.com/in/…' : '@handle or profile link'} type={method.input === 'URL' ? 'url' : 'text'} autoComplete="off" />
            </Field>
            {method.key === 'SOCIAL_HANDLE' && (
              <div style={{ marginTop: theme.space(3) }}>
                <Field theme={theme} label="Platform" htmlFor="lv-capture-platform">
                  <LvSelect theme={theme} id="lv-capture-platform" value={state.fields.socialPlatform?.value ?? ''} onChange={update('socialPlatform')}>
                    <option value="">Detect from the link</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="YOUTUBE">YouTube</option>
                    <option value="X">X (Twitter)</option>
                    <option value="OTHER">Other</option>
                  </LvSelect>
                </Field>
              </div>
            )}
            <div style={{ marginTop: theme.space(3) }}>
              <LvButton theme={theme} variant="primary" onClick={() => void continueFromInput()} busy={busy === 'extract'}>
                Continue
              </LvButton>
            </div>
          </LvCard>
        ) : (
          <LvCard theme={theme}>
            <div className="lv-field-grid">{fieldsFor([...ESSENTIAL_FIELDS, 'category', 'subcategory', 'source'])}</div>
            {(method.key === 'REFERRAL' || method.key === 'PARTNER_REFERRAL') && <div style={{ marginTop: theme.space(3) }}>{fieldsFor(['referrerName'])}</div>}
            <div style={{ marginTop: theme.space(3) }}>
              <Disclosure theme={theme} label="More detail" hint="job title, website, social, priority, notes">
                <div className="lv-field-grid">{fieldsFor(MORE_FIELDS)}</div>
              </Disclosure>
            </div>
            <div style={{ marginTop: theme.space(4) }}>
              <LvButton theme={theme} variant="primary" onClick={() => void continueFromInput()} busy={busy === 'extract'}>
                Continue
              </LvButton>
            </div>
          </LvCard>
        )}
      </LvPage>
    );
  }

  // ---- REVIEW -------------------------------------------------------------------
  if (state.phase === 'REVIEW') {
    const missing = state.quality.filter((hint) => hint.kind === 'MISSING');
    const invalid = state.quality.filter((hint) => hint.kind === 'INVALID');
    const warnings = state.quality.filter((hint) => hint.kind === 'WARNING');

    return (
      <LvPage theme={theme} maxWidth={860}>
        {header}
        <Steps theme={theme} phase={state.phase} />
        {state.error && (
          <div style={{ marginBottom: theme.space(3) }}>
            <ErrorState theme={theme} text={state.error} />
          </div>
        )}
        <div className="lv-sidebar-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {state.extraction.status !== 'NOT_APPLICABLE' && (
              <InlineNotice theme={theme} tone={state.extraction.status === 'EXTRACTED' ? 'info' : 'warning'}>
                {state.extraction.status === 'EXTRACTED' ? (
                  <>
                    <strong>Needs review.</strong> {state.extraction.fieldCount} field{state.extraction.fieldCount === 1 ? '' : 's'} read automatically — please verify before creating the lead.{state.extraction.notes ? ` ${state.extraction.notes}` : ''}
                  </>
                ) : state.extraction.status === 'SKIPPED' ? (
                  <>Typed by hand; the image stays attached to the lead.</>
                ) : (
                  <>
                    <strong>Unable to extract information automatically.</strong> {state.extraction.reason ?? 'Continue by hand.'}
                  </>
                )}
              </InlineNotice>
            )}
            <LvCard theme={theme}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap', marginBottom: theme.space(3) }}>
                <Eyebrow theme={theme}>{state.extraction.status === 'EXTRACTED' ? 'Extracted information' : 'Lead details'}</Eyebrow>
                {state.extraction.status === 'EXTRACTED' && state.extraction.kind && <Provenance theme={theme} source={state.extraction.kind === 'OCR' ? 'ai' : 'rules'} label={state.extraction.kind === 'OCR' ? 'AI READ · confirm' : 'PAGE METADATA · confirm'} />}
              </div>
              <div className="lv-field-grid">{fieldsFor([...ESSENTIAL_FIELDS, 'category', 'subcategory', 'source'])}</div>
              <div style={{ marginTop: theme.space(3) }}>
                <Disclosure theme={theme} label="More detail" hint="job title, website, social, priority, notes" defaultOpen={MORE_FIELDS.some((key) => (state.fields[key]?.value ?? '').length > 0)}>
                  <div className="lv-field-grid">{fieldsFor(MORE_FIELDS)}</div>
                </Disclosure>
              </div>
            </LvCard>
            {state.classification && (
              <LvCard theme={theme} tone={state.classification.status === 'AI_SUGGESTED' ? 'success' : state.classification.status === 'REVIEW_REQUIRED' ? 'warning' : undefined} padding={theme.space(3)}>
                <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap' }}>
                  <Eyebrow theme={theme}>Classification</Eyebrow>
                  <Provenance theme={theme} source="ai" label={state.classification.status === 'UNAVAILABLE' ? 'AI UNAVAILABLE' : state.classification.status === 'REVIEW_REQUIRED' ? 'AI SUGGESTION · REVIEW REQUIRED' : 'AI SUGGESTION'} />
                  {state.classificationDecision !== 'NOT_RUN' && state.classificationDecision !== 'UNAVAILABLE' && <LvBadge theme={theme} tone={state.classificationDecision === 'REJECTED' ? 'neutral' : 'success'}>{state.classificationDecision.toLowerCase()}</LvBadge>}
                </div>
                {state.classification.status === 'UNAVAILABLE' ? (
                  <p style={{ ...theme.type.bodySmall, margin: `${theme.space(2)}px 0 0`, color: theme.color.textMuted }}>No AI provider is configured; pick the category yourself above.</p>
                ) : (
                  <>
                    <p style={{ ...theme.type.body, margin: `${theme.space(2)}px 0 0`, color: theme.color.heading }}>
                      Suggested: <strong>{state.classification.category ?? 'no confident category'}</strong>
                      {state.classification.subcategory ? ` / ${state.classification.subcategory}` : ''}
                      {typeof state.classification.confidence === 'number' ? ` · ${Math.round(state.classification.confidence * 100)}%` : ''}
                    </p>
                    {state.classification.reasoning && <p style={{ ...theme.type.bodySmall, margin: `4px 0 0`, color: theme.color.textMuted }}>{state.classification.reasoning}</p>}
                    {state.classification.category && (
                      <div style={{ display: 'flex', gap: theme.space(2), marginTop: theme.space(2), flexWrap: 'wrap' }}>
                        <LvButton theme={theme} size="sm" variant={state.classificationDecision === 'ACCEPTED' ? 'primary' : 'secondary'} onClick={() => setState((current) => acceptClassification(current))}>
                          Accept
                        </LvButton>
                        <LvButton theme={theme} size="sm" variant="ghost" onClick={() => setState((current) => rejectClassification(current))}>
                          Reject
                        </LvButton>
                        <span style={{ ...theme.type.caption, color: theme.color.textMuted, alignSelf: 'center' }}>or change the category above to edit it</span>
                      </div>
                    )}
                  </>
                )}
              </LvCard>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {state.attachment?.previewUrl && (
              <LvCard theme={theme} padding={theme.space(2)}>
                <img src={state.attachment.previewUrl} alt={state.attachment.label} style={{ width: '100%', borderRadius: theme.radius.sm, display: 'block' }} />
                <span style={{ ...theme.type.caption, color: theme.color.textMuted, display: 'block', marginTop: 6 }}>Attached to the lead</span>
              </LvCard>
            )}
            <LvCard theme={theme} tone={invalid.length > 0 ? 'danger' : missing.some((hint) => hint.severity === 'HIGH') ? 'warning' : 'success'} padding={theme.space(3)}>
              <Eyebrow theme={theme}>Before you create</Eyebrow>
              {invalid.length === 0 && missing.length === 0 && warnings.length === 0 ? (
                <p style={{ ...theme.type.bodySmall, margin: `${theme.space(1)}px 0 0` }}>Looks complete.</p>
              ) : (
                <ul style={{ ...theme.type.bodySmall, margin: `${theme.space(1)}px 0 0`, paddingLeft: 18 }}>
                  {invalid.map((hint) => (
                    <li key={hint.code} style={{ color: theme.color.danger }}>
                      Invalid: {hint.text}
                    </li>
                  ))}
                  {missing.map((hint) => (
                    <li key={hint.code} style={{ color: hint.severity === 'HIGH' ? theme.color.warning : theme.color.textMuted }}>
                      Missing: {hint.text}
                    </li>
                  ))}
                  {warnings.map((hint) => (
                    <li key={hint.code} style={{ color: theme.color.textMuted }}>
                      Warning: {hint.text}
                    </li>
                  ))}
                </ul>
              )}
            </LvCard>
            <ActionBar theme={theme}>
              <LvButton theme={theme} variant="primary" onClick={() => void check()} busy={busy === 'check'} style={{ flex: '1 1 auto' }}>
                Looks right — check &amp; continue
              </LvButton>
              <LvButton theme={theme} variant="ghost" onClick={() => setState((current) => ({ ...current, phase: 'INPUT', error: null }))} disabled={busy !== null}>
                Back
              </LvButton>
            </ActionBar>
          </div>
        </div>
      </LvPage>
    );
  }

  // ---- CHECKING / DECIDE / CREATING ------------------------------------------
  if (state.phase === 'CHECKING' || state.phase === 'DECIDE' || state.phase === 'CREATING') {
    const gate = canCreate(state);
    const recommendation = state.recommendation;

    return (
      <LvPage theme={theme} maxWidth={860}>
        {header}
        <Steps theme={theme} phase={state.phase} />
        {state.error && (
          <div style={{ marginBottom: theme.space(3) }}>
            <ErrorState theme={theme} text={state.error} />
          </div>
        )}
        {state.phase === 'CHECKING' ? (
          <LvCard theme={theme} tone="info">
            <Eyebrow theme={theme} tone="info">Processing</Eyebrow>
            <p style={{ ...theme.type.title, margin: `${theme.space(1)}px 0 ${theme.space(2)}px`, color: theme.color.heading }}>Checking for duplicates and finding the right owner…</p>
            <LoadingState theme={theme} rows={2} label="Checking" />
          </LvCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {state.duplicates.length > 0 ? (
              <LvCard theme={theme} tone="danger" as="section" ariaLabel="Possible duplicate">
                <Eyebrow theme={theme} tone="danger">Possible duplicate</Eyebrow>
                <p style={{ ...theme.type.title, margin: `${theme.space(1)}px 0 ${theme.space(3)}px`, color: theme.color.heading }}>
                  {state.duplicates[0]!.percent}% similarity with {state.duplicates.length === 1 ? 'an existing lead' : `${state.duplicates.length} existing leads`}
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: theme.space(2) }}>
                  {state.duplicates.map((candidate) => (
                    <li key={candidate.leadId} style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), alignItems: 'center', padding: theme.space(2), background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md }}>
                      <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                        <span style={{ ...theme.type.label, color: theme.color.textMuted, display: 'block' }}>Existing lead · {candidate.lvLeadId ?? 'no ID yet'}</span>
                        <span style={{ display: 'block', fontWeight: theme.font.weight.medium, color: theme.color.heading }}>{candidate.name ?? candidate.organisationName ?? 'Unnamed'}</span>
                        <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{[candidate.organisationName, candidate.location].filter(Boolean).join(' · ')}</span>
                        <span style={{ ...theme.type.caption, color: theme.color.textMuted, display: 'block', marginTop: 4 }}>Matching: {candidate.matchingFields.join(', ')}</span>
                      </span>
                      <LvBadge theme={theme} tone={candidate.strength === 'STRONG' ? 'danger' : 'warning'}>
                        {candidate.percent}%
                      </LvBadge>
                      {candidate.status && <LvStatusBadge theme={theme} kind="lead" value={candidate.status} />}
                      <LvButton theme={theme} size="sm" variant="secondary" onClick={() => openLead(candidate.leadId)}>
                        Open existing
                      </LvButton>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(3), alignItems: 'center' }}>
                  <LvButton theme={theme} size="sm" variant={state.duplicateDecision === 'CREATE_NEW' ? 'primary' : 'secondary'} ariaPressed={state.duplicateDecision === 'CREATE_NEW'} onClick={() => setState((current) => decideDuplicates(current, 'CREATE_NEW'))}>
                    Create new anyway
                  </LvButton>
                  <LvButton theme={theme} size="sm" variant={state.duplicateDecision === 'IGNORED' ? 'primary' : 'secondary'} ariaPressed={state.duplicateDecision === 'IGNORED'} onClick={() => setState((current) => decideDuplicates(current, 'IGNORED'))}>
                    Ignore — not the same
                  </LvButton>
                  <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>Merging into an existing lead happens on that lead's Intelligence tab, with its owner's permissions. Your decision is recorded either way.</span>
                </div>
              </LvCard>
            ) : (
              <InlineNotice theme={theme} tone="success">No duplicate found among the leads you can see.</InlineNotice>
            )}

            <LvCard theme={theme} as="section" ariaLabel="Assignment" tone={recommendation?.memberId ? 'info' : 'warning'}>
              {recommendation?.memberId ? (
                <>
                  <Eyebrow theme={theme} tone="info">Recommended owner</Eyebrow>
                  <p style={{ ...theme.type.title, margin: `${theme.space(1)}px 0 ${theme.space(2)}px`, color: theme.color.heading }}>{recommendation.displayName}</p>
                  <ul style={{ ...theme.type.bodySmall, margin: 0, paddingLeft: 18, color: theme.color.text }}>
                    {recommendation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <Eyebrow theme={theme} tone="warning">No automatic match</Eyebrow>
                  <p style={{ ...theme.type.body, margin: `${theme.space(1)}px 0 ${theme.space(2)}px`, color: theme.color.text }}>{recommendation?.noMatchReason ?? 'The assignment engine could not recommend anyone.'}</p>
                </>
              )}
              <div style={{ marginTop: theme.space(3) }}>
                <Segmented
                  theme={theme}
                  label="Assignment"
                  value={state.assignment.mode}
                  onChange={(mode) => setState((current) => chooseAssignment(current, { mode: mode as 'ENGINE' | 'SELF' | 'MEMBER' | 'NONE', memberId: mode === 'MEMBER' ? (current.assignment.memberId ?? recommendation?.candidates.find((candidate) => candidate.eligible)?.memberId ?? null) : null }))}
                  options={[...(recommendation?.memberId ? [{ key: 'ENGINE', label: `Assign to ${recommendation.displayName?.split(' ')[0] ?? 'recommended'}` }] : []), { key: 'SELF', label: 'Assign to me' }, { key: 'MEMBER', label: 'Assign manually' }, { key: 'NONE', label: 'Leave unassigned' }]}
                />
              </div>
              {state.assignment.mode === 'MEMBER' && (
                <div style={{ marginTop: theme.space(3), maxWidth: 360 }}>
                  <Field theme={theme} label="Team member" htmlFor="lv-capture-owner" help="Administrators can assign to a colleague; everyone can claim a lead for themselves.">
                    <LvSelect theme={theme} id="lv-capture-owner" value={state.assignment.memberId ?? ''} onChange={(event) => setState((current) => chooseAssignment(current, { mode: 'MEMBER', memberId: event.target.value || null }))}>
                      <option value="">—</option>
                      {(recommendation?.candidates ?? []).map((candidate) => (
                        <option key={candidate.memberId} value={candidate.memberId}>
                          {candidate.displayName}
                          {candidate.eligible ? '' : ` (${candidate.reason ?? 'not available'})`}
                        </option>
                      ))}
                    </LvSelect>
                  </Field>
                </div>
              )}
            </LvCard>

            {!gate.ok && <InlineNotice theme={theme} tone="warning">{gate.reason}</InlineNotice>}
            <ActionBar theme={theme}>
              <LvButton theme={theme} variant="primary" onClick={() => void create()} busy={busy === 'create'} disabled={!gate.ok} style={{ flex: '1 1 auto' }}>
                Create lead
              </LvButton>
              <LvButton theme={theme} variant="ghost" onClick={() => setState((current) => ({ ...current, phase: 'REVIEW', error: null }))} disabled={busy !== null}>
                Back to review
              </LvButton>
            </ActionBar>
          </div>
        )}
      </LvPage>
    );
  }

  // ---- SUCCESS ---------------------------------------------------------------------
  const result = state.result;

  if (state.phase === 'SUCCESS' && result) {
    const assigned = result.assignment.state === 'ASSIGNED' && result.ownerId;

    return (
      <LvPage theme={theme} maxWidth={720}>
        {header}
        <Steps theme={theme} phase={state.phase} />
        <LvCard theme={theme} tone="success" as="section" ariaLabel="Lead created">
          <Eyebrow theme={theme} tone="success">{result.replayed ? 'Already created' : 'Success'}</Eyebrow>
          <p style={{ ...theme.type.display, margin: `${theme.space(1)}px 0 0`, color: theme.color.heading }}>{result.lvLeadId ?? 'ID pending'}</p>
          <p style={{ ...theme.type.body, margin: `${theme.space(1)}px 0 ${theme.space(3)}px`, color: theme.color.textMuted }}>
            {state.fields.name?.value || 'Lead'} created{result.replayed ? ' by your earlier attempt' : ''}.
          </p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: theme.space(3), margin: 0 }}>
            <div>
              <dt style={{ ...theme.type.label, color: theme.color.textMuted }}>Assignment</dt>
              <dd style={{ margin: 0, color: assigned ? theme.color.text : theme.color.warning }}>{assigned ? `Assigned to ${result.ownerName ?? 'a team member'}` : result.assignment.state === 'PENDING' ? 'Routing in progress — check Lead 360 in a moment' : `Unassigned${result.assignment.reason ? ` — ${result.assignment.reason}` : ''}`}</dd>
            </div>
            <div>
              <dt style={{ ...theme.type.label, color: theme.color.textMuted }}>Next action</dt>
              <dd style={{ margin: 0, color: result.task ? theme.color.text : theme.color.warning }}>
                {result.task ? (
                  <>
                    {result.task.title}
                    <span style={{ ...theme.type.caption, display: 'block', color: theme.color.textMuted }}>
                      {result.task.priority} · due {result.task.dueAt ? new Date(result.task.dueAt).toLocaleString() : '—'}
                    </span>
                  </>
                ) : (
                  `Not created${result.taskError ? ` — ${result.taskError}` : ''}`
                )}
              </dd>
            </div>
          </dl>
          <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(4) }}>
            <LvButton theme={theme} variant="primary" onClick={() => openLead(result.leadId)}>
              Open Lead 360
            </LvButton>
            <LvButton theme={theme} variant="secondary" onClick={() => restart(state.method)}>
              Capture another
            </LvButton>
            <LvButton theme={theme} variant="ghost" onClick={() => restart()}>
              Done
            </LvButton>
          </div>
        </LvCard>
        <VisuallyHidden>Lead created successfully</VisuallyHidden>
      </LvPage>
    );
  }

  return (
    <LvPage theme={theme} maxWidth={720}>
      <EmptyState theme={theme} text="Nothing to show." />
    </LvPage>
  );
};

