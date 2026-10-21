import { useState } from 'react';

import {
  DATA_BEARING_STEPS,
  PARTNER_EDITABLE,
  stepSpec,
  useStepProgress,
  type OnboardingFieldSpec,
  type OnboardingRecord,
} from 'src/api/onboarding';
import { LvIcon } from 'src/design/icons';
import { EmptyState, InlineNotice, LvBadge, LvButton, LvSteps, type LvStep } from 'src/design/kit';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// 7.3 — one wizard step.
//
// The ten steps are the partner's form, not La Vivenzia's. This side of the
// product reads it: what they answered, what is still empty, and which step
// they are on. There is no route that writes a partner's answers from here —
// `/onboarding/transition` moves the status and nothing else — so nothing on
// this screen pretends to be editable. Saying "the partner still has to fill
// this in" is the honest version of an input nobody can submit.

const show = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
};

const FieldRow = ({ theme, field, value, missing }: { theme: LvTheme; field: OnboardingFieldSpec; value: unknown; missing: boolean }) => {
  const text = show(value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: theme.space(3), borderBottom: `1px solid ${theme.color.border}` }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), flexWrap: 'wrap' }}>
        <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{field.label}</span>
        {field.isRequired && <LvBadge theme={theme} tone={missing ? 'warning' : 'neutral'}>Required</LvBadge>}
      </span>
      {text === '' ? (
        <span style={{ ...theme.type.bodySmall, color: missing ? theme.color.warning : theme.color.textSubtle }}>
          {missing ? 'Not answered yet' : 'Left blank'}
        </span>
      ) : (
        <span style={{ ...theme.type.body, color: theme.color.heading, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{text}</span>
      )}
      {field.help && <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>{field.help}</span>}
    </div>
  );
};

export const StepsSection = ({ theme, record }: { theme: LvTheme; record: OnboardingRecord }) => {
  const progress = useStepProgress(record);
  // FINAL_REVIEW carries no fields, so the section always shows one of the
  // nine that do.
  type DataStep = (typeof DATA_BEARING_STEPS)[number];
  const [open, setOpen] = useState<DataStep>(
    record.currentStep && record.currentStep !== 'FINAL_REVIEW' ? (record.currentStep as DataStep) : DATA_BEARING_STEPS[0],
  );
  const spec = stepSpec(open);
  const state = progress.find((entry) => entry.step === open);
  const answers = record.answers[open] ?? {};
  const missingKeys = new Set((state?.missing ?? []).map((entry) => entry.key));

  const steps: LvStep[] = progress.map((entry) => ({
    key: entry.step,
    label: entry.label,
    state: entry.step === open ? 'current' : entry.isComplete ? 'done' : entry.isStarted ? 'blocked' : 'todo',
    detail: entry.step === open ? entry.description : entry.missing.length > 0 ? `${entry.missing.length} still to answer` : null,
    onOpen: () => setOpen(entry.step as DataStep),
  }));

  return (
    <>
      <LvSectionCard theme={theme} title="The partner's form" icon="onboarding">
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
            Nine steps carry answers; the tenth is where the partner checks everything and submits.
            {record.currentStep ? ` They are on ${stepSpec(record.currentStep).label}.` : ' No current step is recorded.'}
          </p>
          <LvSteps theme={theme} label="Form steps" steps={steps} />
        </div>
      </LvSectionCard>

      <LvSectionCard
        theme={theme}
        title={spec.label}
        icon="note"
        action={
          state?.isComplete ? (
            <LvBadge theme={theme} tone="success">Complete</LvBadge>
          ) : (
            <LvBadge theme={theme} tone="warning">{state?.missing.length ?? 0} outstanding</LvBadge>
          )
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>{spec.description}</p>

          {PARTNER_EDITABLE.includes(record.status) ? (
            <InlineNotice theme={theme}>
              The partner can still change these answers. Nothing here is edited by La Vivenzia — the form belongs to them until they submit it.
            </InlineNotice>
          ) : (
            <InlineNotice theme={theme}>This submission is locked. The partner cannot change it while it sits with La Vivenzia.</InlineNotice>
          )}

          {spec.fields.length === 0 ? (
            <EmptyState theme={theme} icon="check" tint="mint" text="This step has no fields of its own." />
          ) : Object.keys(answers).length === 0 ? (
            <EmptyState
              theme={theme}
              icon="info"
              tint="peach"
              title="Nothing answered yet"
              text={`The partner has not started ${spec.label.toLowerCase()}. The ${spec.fields.filter((field) => field.isRequired).length} required answers below are all outstanding.`}
            />
          ) : null}

          {spec.fields.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
              {spec.fields.map((field) => (
                <FieldRow key={field.key} theme={theme} field={field} value={answers[field.key]} missing={missingKeys.has(field.key)} />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
            <LvButton
              theme={theme}
              variant="ghost"
              size="sm"
              disabled={DATA_BEARING_STEPS.indexOf(open) === 0}
              onClick={() => setOpen(DATA_BEARING_STEPS[Math.max(0, DATA_BEARING_STEPS.indexOf(open) - 1)])}
              icon={<LvIcon name="chevronLeft" size={15} />}
            >
              Previous step
            </LvButton>
            <LvButton
              theme={theme}
              variant="ghost"
              size="sm"
              disabled={DATA_BEARING_STEPS.indexOf(open) === DATA_BEARING_STEPS.length - 1}
              onClick={() => setOpen(DATA_BEARING_STEPS[Math.min(DATA_BEARING_STEPS.length - 1, DATA_BEARING_STEPS.indexOf(open) + 1)])}
              icon={<LvIcon name="chevronRight" size={15} />}
            >
              Next step
            </LvButton>
          </div>
        </div>
      </LvSectionCard>
    </>
  );
};
