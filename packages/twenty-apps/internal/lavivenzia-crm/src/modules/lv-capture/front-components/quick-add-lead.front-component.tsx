import { useCallback, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_QUICK_ADD_LEAD_ID } from 'src/constants/universal-identifiers';
import {
  CAPTURE_MODE_FIELDS,
  duplicateSummary,
  emptyStateMessage,
  initialQuickAddState,
  isBusy,
  isSubmitBlocked,
  QUICK_ADD_MODES,
  validateCapture,
  withCreatedLead,
  withDuplicates,
  withSubmissionError,
  type QuickAddState,
} from 'src/modules/lv-capture/front-components/quick-add-lead/quick-add-state';
import { type CaptureInput } from 'src/modules/lv-capture/types/capture.types';
import { type LeadCaptureMode } from 'src/modules/lv-core/constants/lead-taxonomy';
import {
  findDuplicates,
  type DuplicateCandidateRecord,
} from 'src/modules/lv-core/utils/duplicate-detection';

// Quick Add Lead. CAPTURE-OCR.md targets a lead captured in under 30 seconds,
// so this is mobile-first and single-column, with 44px touch targets and one
// decision per screen.
//
// Permission note: this UI hides what the user cannot do, but the server is the
// authority. SECURITY-RBAC.md is explicit that "UI filtering is never
// security" — a create attempt without permission fails in the API and lands in
// the error state below, which is the behaviour we actually rely on.

// UI-UX-SPEC.md brand tokens. Inlined rather than imported from twenty-ui
// because a front component renders in a sandbox without the host stylesheet;
// scoping them here also avoids a core retheme (see DECISION-04).
const PINE = '#1F4D3A';
const SAGE = '#6B846F';
const SAND = '#F3EFE7';
const CHARCOAL = '#1A1A1A';
const BORDER = '#D8D2C6';

const styles = {
  root: {
    padding: 16,
    maxWidth: 560,
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: CHARCOAL,
    boxSizing: 'border-box',
  } as React.CSSProperties,
  modeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  } as React.CSSProperties,
  modeButton: (active: boolean): React.CSSProperties => ({
    minHeight: 44,
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${active ? PINE : BORDER}`,
    background: active ? PINE : '#FFFFFF',
    color: active ? '#FFFFFF' : CHARCOAL,
    fontSize: 14,
    cursor: 'pointer',
    flex: '1 1 auto',
  }),
  label: { display: 'block', fontSize: 13, marginBottom: 4, color: SAGE } as React.CSSProperties,
  input: {
    width: '100%',
    minHeight: 44,
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    fontSize: 16, // 16px avoids iOS zoom-on-focus
    boxSizing: 'border-box',
    marginBottom: 12,
  } as React.CSSProperties,
  hint: {
    background: SAND,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: SAGE,
    marginBottom: 16,
  } as React.CSSProperties,
  submit: (disabled: boolean): React.CSSProperties => ({
    width: '100%',
    minHeight: 48,
    borderRadius: 8,
    border: 'none',
    background: disabled ? '#B9C3BA' : PINE,
    color: '#FFFFFF',
    fontSize: 16,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  banner: (tone: 'error' | 'warn' | 'ok'): React.CSSProperties => ({
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    marginBottom: 12,
    background:
      tone === 'error' ? '#FDECEC' : tone === 'warn' ? '#FFF7E0' : '#EAF4EE',
    color: tone === 'error' ? '#8A1F1F' : tone === 'warn' ? '#7A5B00' : PINE,
  }),
};

export const QuickAddLead = () => {
  const client = useMemo(() => new CoreApiClient(), []);
  const [state, setState] = useState<QuickAddState>(initialQuickAddState());
  const [input, setInput] = useState<CaptureInput>({ captureMode: 'MANUAL' });

  const config = CAPTURE_MODE_FIELDS[state.mode];

  const selectMode = useCallback((mode: LeadCaptureMode) => {
    setState(initialQuickAddState(mode));
    setInput({ captureMode: mode });
  }, []);

  const update = useCallback((patch: Partial<CaptureInput>) => {
    setInput((current) => ({ ...current, ...patch }));
  }, []);

  const submit = useCallback(async () => {
    const validated = validateCapture(state, { ...input, captureMode: state.mode });

    setState(validated);

    if (validated.phase === 'ERROR' || validated.draft === null) {
      return;
    }

    const draft = validated.draft;

    try {
      // Shortlist on the pre-computed duplicate keys, then rank in memory.
      const response = await client.query({
        lvLeads: {
          __args: { first: 25 },
          edges: {
            node: {
              id: true,
              name: true,
              organisationName: true,
              location: true,
            },
          },
        },
      });

      const candidates = (
        (response as { lvLeads?: { edges?: { node?: DuplicateCandidateRecord }[] } })
          .lvLeads?.edges ?? []
      )
        .map((edge) => edge?.node)
        .filter((node): node is DuplicateCandidateRecord => Boolean(node?.id));

      const duplicates = findDuplicates(
        {
          id: '',
          name: draft.name,
          organisationName: draft.organisationName,
          email: draft.email,
          phone: draft.phone,
          websiteUrl: draft.websiteUrl,
          instagramHandle: draft.instagramHandle,
          location: draft.location,
        },
        candidates,
      );

      const checked = withDuplicates(validated, duplicates);

      setState(checked);

      if (checked.phase === 'DUPLICATES_FOUND') {
        return;
      }

      const created = await client.mutation({
        createLvLead: {
          __args: {
            data: {
              name: draft.name,
              organisationName: draft.organisationName,
              location: draft.location,
              category: draft.category,
              subcategory: draft.subcategory,
              source: draft.source,
              captureMode: draft.captureMode,
              status: draft.status,
              priority: draft.priority,
              languages: draft.languages,
              rawCaptureInput: draft.rawInput,
              fieldProvenance: draft.provenance,
              duplicateKeys: draft.duplicateKeys,
              dataCompleteness: draft.completeness,
            },
          },
          id: true,
        },
      });

      const id = (created as { createLvLead?: { id?: string } }).createLvLead?.id;

      setState(id ? withCreatedLead(checked, id) : withSubmissionError(checked, 'The lead was not created.'));
    } catch (error) {
      // Includes the permission failure path: the server refuses and we say so
      // rather than pretending the capture succeeded.
      setState(
        withSubmissionError(
          validated,
          error instanceof Error ? error.message : 'Could not save this lead.',
        ),
      );
    }
  }, [client, input, state]);

  if (state.phase === 'SUCCESS') {
    return (
      <div style={styles.root}>
        <div style={styles.banner('ok')}>
          Lead created. It is being routed to an owner now.
        </div>
        <button
          type="button"
          style={styles.submit(false)}
          onClick={() => selectMode(state.mode)}
        >
          Capture another
        </button>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.modeRow}>
        {QUICK_ADD_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            style={styles.modeButton(mode === state.mode)}
            onClick={() => selectMode(mode)}
          >
            {CAPTURE_MODE_FIELDS[mode].label}
          </button>
        ))}
      </div>

      <div style={styles.hint}>{emptyStateMessage(state.mode)}</div>

      {state.errors.map((message) => (
        <div key={message} style={styles.banner('error')}>
          {message}
        </div>
      ))}

      {state.warnings.map((message) => (
        <div key={message} style={styles.banner('warn')}>
          {message}
        </div>
      ))}

      {state.phase === 'DUPLICATES_FOUND' && (
        <div style={styles.banner('warn')}>
          {duplicateSummary(state.duplicates)} Review before creating a new record.
        </div>
      )}

      {config.primaryInput !== 'none' && config.primaryInput !== 'file' && (
        <>
          <label style={styles.label} htmlFor="lv-primary">
            {config.primaryLabel}
          </label>
          <input
            id="lv-primary"
            style={styles.input}
            value={
              config.primaryInput === 'text'
                ? (input.name ?? '')
                : (input.rawInput ?? '')
            }
            onChange={(event) =>
              update(
                config.primaryInput === 'text'
                  ? { name: event.target.value }
                  : { rawInput: event.target.value },
              )
            }
          />
        </>
      )}

      {config.primaryInput === 'file' && (
        <>
          <label style={styles.label} htmlFor="lv-file">
            {config.primaryLabel}
          </label>
          <input
            id="lv-file"
            style={styles.input}
            placeholder="Uploaded file path"
            value={input.attachmentPath ?? ''}
            onChange={(event) => update({ attachmentPath: event.target.value })}
          />
        </>
      )}

      {config.showsContactFields && (
        <>
          <label style={styles.label} htmlFor="lv-org">
            Organisation
          </label>
          <input
            id="lv-org"
            style={styles.input}
            value={input.organisationName ?? ''}
            onChange={(event) => update({ organisationName: event.target.value })}
          />
          <label style={styles.label} htmlFor="lv-phone">
            Phone
          </label>
          <input
            id="lv-phone"
            style={styles.input}
            inputMode="tel"
            value={input.phone ?? ''}
            onChange={(event) => update({ phone: event.target.value })}
          />
          <label style={styles.label} htmlFor="lv-location">
            Location
          </label>
          <input
            id="lv-location"
            style={styles.input}
            value={input.location ?? ''}
            onChange={(event) => update({ location: event.target.value })}
          />
        </>
      )}

      {config.showsReferrer && (
        <>
          <label style={styles.label} htmlFor="lv-referrer">
            Referred by
          </label>
          <input
            id="lv-referrer"
            style={styles.input}
            value={input.referrerName ?? ''}
            onChange={(event) => update({ referrerName: event.target.value })}
          />
        </>
      )}

      <button
        type="button"
        style={styles.submit(isSubmitBlocked(state))}
        disabled={isSubmitBlocked(state)}
        onClick={submit}
      >
        {isBusy(state) ? 'Saving…' : 'Create lead'}
      </button>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_QUICK_ADD_LEAD_ID,
  name: 'lv-quick-add-lead',
  description: 'Capture a lead in under 30 seconds from any source',
  component: QuickAddLead,
});
