import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { useColorScheme, useRecordId } from 'twenty-sdk/front-component';

import {
  DocumentUploadField,
  resolveFilesFieldMetadataId,
  type UploadedDocument,
} from 'src/modules/lv-onboarding/front-components/onboarding-wizard/document-upload-field';
import { themeFor } from 'src/modules/lv-core/ui/theme';
import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_ONBOARDING_WIZARD_ID } from 'src/constants/universal-identifiers';
import {
  stepSpec,
  type OnboardingFieldSpec,
} from 'src/modules/lv-onboarding/constants/onboarding-steps';
import {
  canAdvance,
  currentIssues,
  goBack,
  goNext,
  goToStep,
  initialWizardState,
  isFinalStep,
  isFirstStep,
  isReadOnly,
  readOnlyReason,
  setAnswer,
  stepNumber,
  stepTitle,
  summarise,
  withSaveState,
  withSubmitError,
  type WizardState,
} from 'src/modules/lv-onboarding/front-components/onboarding-wizard/wizard-state';
import { isOnboardingStatus } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { type OnboardingData } from 'src/modules/lv-onboarding/utils/validate-onboarding';

// The partner-facing onboarding wizard.
//
// UI-UX-SPEC.md: mobile-first, single column, 44px touch targets, brand tokens,
// premium and calm rather than enterprise-dense. One question set per screen so
// a partner on a phone at a villa can finish it in sittings.
//
// The decision logic lives in wizard-state.ts and is unit-tested; this file is
// rendering and I/O only.

const PINE = '#1F4D3A';
const SAGE = '#6B846F';
const GOLD = '#D4AF37';
const SAND = '#F3EFE7';
const CHARCOAL = '#1A1A1A';
const BORDER = '#D8D2C6';

const s = {
  root: {
    padding: 16,
    maxWidth: 640,
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: CHARCOAL,
    boxSizing: 'border-box',
  } as React.CSSProperties,
  eyebrow: { fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: SAGE } as React.CSSProperties,
  h1: { fontSize: 24, margin: '4px 0 4px', fontWeight: 600 } as React.CSSProperties,
  lede: { fontSize: 14, color: SAGE, marginBottom: 20 } as React.CSSProperties,
  progressTrack: { height: 6, borderRadius: 3, background: BORDER, overflow: 'hidden', marginBottom: 6 } as React.CSSProperties,
  progressFill: (pct: number): React.CSSProperties => ({
    height: '100%',
    width: `${pct}%`,
    background: PINE,
    transition: 'width 200ms ease',
  }),
  progressMeta: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SAGE, marginBottom: 20 } as React.CSSProperties,
  label: { display: 'block', fontSize: 13, marginBottom: 4, color: SAGE } as React.CSSProperties,
  required: { color: GOLD, marginLeft: 4 } as React.CSSProperties,
  input: (invalid: boolean): React.CSSProperties => ({
    width: '100%',
    minHeight: 44,
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${invalid ? '#B3261E' : BORDER}`,
    fontSize: 16, // 16px stops iOS zooming on focus
    boxSizing: 'border-box',
    marginBottom: 4,
    fontFamily: 'inherit',
  }),
  textarea: (invalid: boolean): React.CSSProperties => ({
    width: '100%',
    minHeight: 120,
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${invalid ? '#B3261E' : BORDER}`,
    fontSize: 16,
    boxSizing: 'border-box',
    marginBottom: 4,
    fontFamily: 'inherit',
    resize: 'vertical',
  }),
  help: { fontSize: 12, color: SAGE, marginBottom: 14, display: 'block' } as React.CSSProperties,
  fieldError: { fontSize: 12, color: '#B3261E', marginBottom: 14, display: 'block' } as React.CSSProperties,
  // Column on phones, row from ~480px up. Inline styles cannot express a media
  // query, so the layout stays single-column and the buttons simply stretch —
  // which is the correct mobile-first default anyway.
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 } as React.CSSProperties,
  primary: (disabled: boolean): React.CSSProperties => ({
    flex: '1 1 160px',
    minHeight: 48,
    borderRadius: 8,
    border: 'none',
    background: disabled ? '#B9C3BA' : PINE,
    color: '#FFFFFF',
    fontSize: 16,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  secondary: {
    flex: '0 1 120px',
    minHeight: 48,
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    background: '#FFFFFF',
    color: CHARCOAL,
    fontSize: 16,
    cursor: 'pointer',
  } as React.CSSProperties,
  banner: (tone: 'info' | 'error' | 'ok'): React.CSSProperties => ({
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    marginBottom: 16,
    background: tone === 'error' ? '#FDECEC' : tone === 'ok' ? '#EAF4EE' : SAND,
    color: tone === 'error' ? '#8A1F1F' : tone === 'ok' ? PINE : SAGE,
  }),
  checklistRow: (complete: boolean): React.CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    marginBottom: 8,
    background: complete ? '#FFFFFF' : SAND,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    fontSize: 14,
    fontFamily: 'inherit',
    color: CHARCOAL,
  }),
  saveBadge: { fontSize: 12, color: SAGE } as React.CSSProperties,
};

const asString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const asListText = (value: unknown): string =>
  Array.isArray(value) ? value.join(', ') : asString(value);

export const OnboardingWizard = ({
  onboardingId,
  initialStatus = 'IN_PROGRESS',
  initialData = {},
}: {
  onboardingId?: string;
  initialStatus?: WizardState['status'];
  initialData?: OnboardingData;
}) => {
  const client = useMemo(() => new CoreApiClient(), []);

  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);

  // The FILES field's metadata id is workspace-specific, so it is resolved
  // once at mount rather than hard-coded into the manifest.
  const [filesFieldMetadataId, setFilesFieldMetadataId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isActive = true;

    void resolveFilesFieldMetadataId('lvOnboardingDocument', 'file').then(
      (resolved) => {
        if (isActive) {
          setFilesFieldMetadataId(resolved);
        }
      },
    );

    return () => {
      isActive = false;
    };
  }, []);
  const [state, setState] = useState<WizardState>(
    initialWizardState({ status: initialStatus, data: initialData }),
  );

  const spec = stepSpec(state.step);
  const summary = summarise(state);
  const issues = currentIssues(state);
  const readOnly = isReadOnly(state);
  const lockedReason = readOnlyReason(state.status);

  const issueFor = (fieldKey: string) =>
    issues.find((issue) => issue.fieldKey === fieldKey);

  // Save/resume: the whole answer set is persisted, so a partner can close the
  // tab on a phone and pick the form up on a laptop.
  const save = useCallback(
    async (next: WizardState) => {
      if (onboardingId === undefined) {
        return;
      }

      setState(withSaveState(next, 'SAVING'));

      try {
        await client.mutation({
          updateLvOnboarding: {
            __args: {
              id: onboardingId,
              data: {
                answers: next.data,
                currentStep: next.step,
                progressPercentage: summarise(next).progress,
                healthScore: summarise(next).health,
              },
            },
            id: true,
          },
        });

        setState(withSaveState(next, 'SAVED'));
      } catch (error) {
        setState(
          withSaveState(
            next,
            'ERROR',
            error instanceof Error ? error.message : 'Could not save your progress.',
          ),
        );
      }
    },
    [client, onboardingId],
  );

  const update = (fieldKey: string, value: unknown) => {
    setState((current) => setAnswer(current, fieldKey, value));
  };

  const handleNext = useCallback(() => {
    setState((current) => {
      const next = goNext(current);

      if (next.step !== current.step) {
        void save(next);
      }

      return next;
    });
  }, [save]);

  const submit = useCallback(async () => {
    if (onboardingId === undefined || !summary.canSubmit) {
      return;
    }

    try {
      await client.mutation({
        updateLvOnboarding: {
          __args: {
            id: onboardingId,
            data: { status: 'VERIFICATION', submittedAt: new Date().toISOString() },
          },
          id: true,
        },
      });

      setState((current) => ({ ...current, status: 'VERIFICATION' }));
    } catch (error) {
      setState((current) =>
        withSubmitError(
          current,
          error instanceof Error ? error.message : 'Could not submit for review.',
        ),
      );
    }
  }, [client, onboardingId, summary.canSubmit]);

  const renderField = (field: OnboardingFieldSpec) => {
    const value = (state.data[state.step] ?? {})[field.key];
    const issue = issueFor(field.key);
    const invalid = issue !== undefined;

    // Props written out on each input rather than spread: the house lint rule
    // forbids JSX prop spreading, and being explicit keeps the accessibility
    // attributes visible at the point of use.
    const fieldId = `lv-${field.key}`;
    const errorId = invalid ? `${fieldId}-error` : undefined;

    return (
      <div key={field.key}>
        <label style={s.label} htmlFor={fieldId}>
          {field.label}
          {field.isRequired && <span style={s.required}>*</span>}
        </label>

        {field.kind === 'BOOLEAN' ? (
          <label style={{ ...s.help, display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
            <input
              id={fieldId}
              disabled={readOnly}
              aria-invalid={invalid}
              aria-describedby={errorId}
              type="checkbox"
              checked={value === true}
              onChange={(event) => update(field.key, event.target.checked)}
              style={{ width: 20, height: 20 }}
            />
            <span>{field.label}</span>
          </label>
        ) : field.kind === 'LONG_TEXT' ? (
          <textarea
            id={fieldId}
            disabled={readOnly}
            aria-invalid={invalid}
            aria-describedby={errorId}
            style={s.textarea(invalid)}
            value={asString(value)}
            onChange={(event) => update(field.key, event.target.value)}
          />
        ) : field.kind === 'FILES' ? (
          <DocumentUploadField
            theme={theme}
            fieldMetadataId={filesFieldMetadataId}
            disabled={readOnly}
            maxFiles={field.minItems !== undefined ? undefined : 1}
            value={Array.isArray(value) ? (value as UploadedDocument[]) : []}
            onChange={(next) => update(field.key, next)}
          />
        ) : field.kind === 'LIST' ? (
          <input
            id={fieldId}
            disabled={readOnly}
            aria-invalid={invalid}
            aria-describedby={errorId}
            style={s.input(invalid)}
            value={asListText(value)}
            placeholder="Comma separated"
            onChange={(event) =>
              update(
                field.key,
                event.target.value
                  .split(',')
                  .map((part) => part.trim())
                  .filter((part) => part.length > 0),
              )
            }
          />
        ) : (
          <input
            id={fieldId}
            disabled={readOnly}
            aria-invalid={invalid}
            aria-describedby={errorId}
            style={s.input(invalid)}
            type={field.kind === 'NUMBER' ? 'number' : 'text'}
            inputMode={field.kind === 'PHONE' ? 'tel' : field.kind === 'NUMBER' ? 'numeric' : undefined}
            value={asString(value)}
            onChange={(event) =>
              update(
                field.key,
                field.kind === 'NUMBER' && event.target.value !== ''
                  ? Number(event.target.value)
                  : event.target.value,
              )
            }
          />
        )}

        {invalid ? (
          <span id={errorId} style={s.fieldError} role="alert">
            {issue.reason === 'TOO_SHORT'
              ? 'Please add a little more detail.'
              : issue.reason === 'TOO_FEW'
                ? `Please add at least ${field.minItems ?? 1}.`
                : issue.reason === 'INVALID'
                  ? 'That does not look right.'
                  : 'This one is required.'}
          </span>
        ) : (
          field.help !== undefined && <span style={s.help}>{field.help}</span>
        )}
      </div>
    );
  };

  return (
    <div style={s.root}>
      <div style={s.eyebrow}>{stepNumber(state.step)}</div>
      <h1 style={s.h1}>{stepTitle(state.step)}</h1>
      <p style={s.lede}>{spec.description}</p>

      <div style={s.progressTrack}>
        <div style={s.progressFill(summary.progress)} />
      </div>
      <div style={s.progressMeta}>
        <span>{summary.progress}% complete</span>
        <span style={s.saveBadge}>
          {state.saveState === 'SAVING'
            ? 'Saving…'
            : state.saveState === 'SAVED'
              ? 'Saved'
              : state.saveState === 'ERROR'
                ? 'Not saved'
                : 'Your progress is saved as you go'}
        </span>
      </div>

      {lockedReason !== null && <div style={s.banner('info')}>{lockedReason}</div>}
      {state.saveError !== null && <div style={s.banner('error')}>{state.saveError}</div>}
      {state.submitError !== null && <div style={s.banner('error')}>{state.submitError}</div>}

      {isFinalStep(state) ? (
        <>
          {summary.canSubmit ? (
            <div style={s.banner('ok')}>
              Everything we need is here. Submitting sends your application to our
              team for review.
            </div>
          ) : (
            <div style={s.banner('error')}>
              {summary.blockingCount} item(s) still need attention. Tap a step to
              finish it.
            </div>
          )}

          {summary.steps.map((entry) => (
            <button
              key={entry.step}
              type="button"
              style={s.checklistRow(entry.isComplete)}
              onClick={() => setState((current) => goToStep(current, entry.step))}
            >
              <span>{stepTitle(entry.step)}</span>
              <span style={{ color: entry.isComplete ? PINE : GOLD }}>
                {entry.isComplete ? 'Complete' : `${entry.missingCount} to add`}
              </span>
            </button>
          ))}
        </>
      ) : (
        spec.fields.map(renderField)
      )}

      <div style={s.actions}>
        {!isFirstStep(state) && (
          <button
            type="button"
            style={s.secondary}
            onClick={() => setState((current) => goBack(current))}
          >
            Back
          </button>
        )}

        {isFinalStep(state) ? (
          <button
            type="button"
            style={s.primary(!summary.canSubmit || readOnly)}
            disabled={!summary.canSubmit || readOnly}
            onClick={submit}
          >
            Submit for review
          </button>
        ) : (
          <button
            type="button"
            style={s.primary(readOnly)}
            disabled={readOnly}
            onClick={handleNext}
          >
            {canAdvance(state) ? 'Continue' : 'Check and continue'}
          </button>
        )}
      </div>
    </div>
  );
};

// On the onboarding record page the wizard works on the record being viewed.
// Without the id it would render an unsaved, detached form — the state the
// component sat in until Day 7, when it was first mounted on a page.
const OnboardingWizardWidget = () => {
  const recordId = useRecordId();
  const client = useMemo(() => new CoreApiClient(), []);
  const [loaded, setLoaded] = useState<
    | { phase: 'LOADING' }
    | { phase: 'READY'; status: WizardState['status']; data: OnboardingData }
    | { phase: 'ERROR'; text: string }
  >({ phase: 'LOADING' });

  useEffect(() => {
    let isActive = true;

    if (!recordId) {
      return;
    }

    // Resume: the saved answers and status come from the record, read as the
    // viewer — an onboarding they cannot see is an error here, not a blank
    // form they could start filling in.
    void client
      .query({
        lvOnboarding: {
          __args: { filter: { id: { eq: recordId } } },
          id: true,
          status: true,
          answers: true,
        },
      })
      .then((result: unknown) => {
        if (!isActive) {
          return;
        }

        const row = (result as { lvOnboarding?: { id?: string; status?: string | null; answers?: unknown } | null }).lvOnboarding;

        if (!row?.id) {
          setLoaded({ phase: 'ERROR', text: "You don't have permission to view this onboarding, or it no longer exists." });

          return;
        }

        const status = typeof row.status === 'string' && isOnboardingStatus(row.status) ? row.status : 'IN_PROGRESS';
        const data = row.answers && typeof row.answers === 'object' ? (row.answers as OnboardingData) : {};

        setLoaded({ phase: 'READY', status, data });
      })
      .catch((error: unknown) => {
        if (isActive) {
          setLoaded({ phase: 'ERROR', text: error instanceof Error ? error.message : 'Unable to load this onboarding.' });
        }
      });

    return () => {
      isActive = false;
    };
  }, [client, recordId]);

  if (!recordId) {
    return null;
  }

  if (loaded.phase === 'LOADING') {
    return (
      <p role="status" style={{ padding: 16, fontFamily: 'inherit' }}>
        Loading onboarding…
      </p>
    );
  }

  if (loaded.phase === 'ERROR') {
    return (
      <p role="alert" style={{ padding: 16, fontFamily: 'inherit' }}>
        {loaded.text}
      </p>
    );
  }

  return <OnboardingWizard key={recordId} onboardingId={recordId} initialStatus={loaded.status} initialData={loaded.data} />;
};

export default defineFrontComponent({
  universalIdentifier: FC_ONBOARDING_WIZARD_ID,
  name: 'lv-onboarding-wizard',
  description: 'Ten-step partner onboarding, with save and resume',
  component: OnboardingWizardWidget,
});
