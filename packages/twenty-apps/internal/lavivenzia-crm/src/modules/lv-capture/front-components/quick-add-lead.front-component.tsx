import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme } from 'twenty-sdk/front-component';

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
import { LEAD_CATEGORY_OPTIONS, LEAD_SOURCE_OPTIONS, LEAD_SUBCATEGORY_OPTIONS } from 'src/modules/lv-core/constants/select-options.generated';
import { type LeadCaptureMode, type LeadSource } from 'src/modules/lv-core/constants/lead-taxonomy';
import { LvStyles } from 'src/modules/lv-core/ui/kit';
import { type LvTheme, layout, themeFor } from 'src/modules/lv-core/ui/theme';
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

// Styles are a function of the theme (tokens.ts), so the page follows light
// and dark mode like every other LV surface.
const buildStyles = (theme: LvTheme) => ({
  root: {
    padding: 'clamp(12px, 3vw, 20px)',
    maxWidth: 560,
    margin: '0 auto',
    fontFamily: theme.font.body,
    color: theme.color.text,
    boxSizing: 'border-box',
  } as React.CSSProperties,
  modeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  } as React.CSSProperties,
  modeButton: (active: boolean): React.CSSProperties => ({
    ...layout(theme).button(active ? 'primary' : 'secondary'),
    fontSize: 14,
    flex: '1 1 auto',
  }),
  label: { ...theme.type.bodySmall, display: 'block', fontWeight: theme.font.weight.medium, marginBottom: 4, color: theme.color.heading } as React.CSSProperties,
  input: {
    width: '100%',
    minHeight: 44,
    padding: '10px 12px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.color.borderStrong}`,
    background: theme.color.surfaceRaised,
    color: theme.color.text,
    fontSize: 16, // 16px avoids iOS zoom-on-focus
    boxSizing: 'border-box',
    marginBottom: 12,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  hint: {
    ...theme.type.bodySmall,
    background: theme.color.surfaceSunken,
    borderRadius: theme.radius.sm,
    padding: 12,
    color: theme.color.textMuted,
    marginBottom: 16,
  } as React.CSSProperties,
  submit: (disabled: boolean): React.CSSProperties => ({
    ...layout(theme).button('primary'),
    width: '100%',
    minHeight: 48,
    fontSize: 15,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  secondaryAction: {
    ...layout(theme).button('secondary'),
    width: '100%',
    minHeight: 48,
    fontSize: 15,
  } as React.CSSProperties,
  banner: (tone: 'error' | 'warn' | 'ok'): React.CSSProperties => ({
    ...theme.type.bodySmall,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 12,
    borderLeft: `3px solid ${tone === 'error' ? theme.color.danger : tone === 'warn' ? theme.color.warning : theme.color.success}`,
    background: tone === 'error' ? theme.color.dangerMuted : tone === 'warn' ? theme.color.warningMuted : theme.color.successMuted,
    color: theme.color.text,
  }),
});

type CreatedLead = { id: string; lvLeadId: string | null; ownerName: string | null; ownerId: string | null; settled: boolean };

// After creation the LV Lead ID and the owner are written by
// lv-on-lead-created a moment later; the page polls the record (as the
// person, so CM-004 applies) until both appear or a few seconds pass, and
// says which. Nothing is invented while it waits.
const POLL_MS = 700;
const POLL_LIMIT = 12;

export const QuickAddLead = () => {
  const client = useMemo(() => new CoreApiClient(), []);
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [state, setState] = useState<QuickAddState>(initialQuickAddState());
  const [input, setInput] = useState<CaptureInput>({ captureMode: 'MANUAL' });
  const [ownerId, setOwnerId] = useState('');
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [created, setCreated] = useState<CreatedLead | null>(null);

  useEffect(() => {
    let isActive = true;

    void client
      .query({ workspaceMembers: { __args: { first: 100 }, edges: { node: { id: true, name: { firstName: true, lastName: true } } } } })
      .then((result: unknown) => {
        if (!isActive) {
          return;
        }

        const rows = (result as { workspaceMembers?: { edges?: { node?: { id: string; name?: { firstName?: string | null; lastName?: string | null } | null } }[] } }).workspaceMembers?.edges ?? [];

        setMembers(
          rows
            .map((edge) => edge.node)
            .filter((node): node is NonNullable<typeof node> => Boolean(node?.id))
            .map((node) => ({ id: node.id, name: [node.name?.firstName, node.name?.lastName].filter(Boolean).join(' ') || node.id })),
        );
      })
      .catch(() => setMembers([]));

    return () => {
      isActive = false;
    };
  }, [client]);

  useEffect(() => {
    if (!created || created.settled) {
      return;
    }

    let attempts = 0;
    let isActive = true;
    const memberName = (id: string | null) => (id ? (members.find((member) => member.id === id)?.name ?? 'Team member') : null);
    const tick = async () => {
      attempts += 1;

      try {
        const result = await client.query({ lvLead: { __args: { filter: { id: { eq: created.id } } }, id: true, lvLeadId: true, ownerId: true } });
        const row = (result as { lvLead?: { lvLeadId?: string | null; ownerId?: string | null } | null }).lvLead;
        const lvLeadId = row?.lvLeadId ?? null;
        const nextOwnerId = row?.ownerId ?? null;
        const done = (lvLeadId !== null && nextOwnerId !== null) || attempts >= POLL_LIMIT;

        if (isActive) {
          setCreated({ id: created.id, lvLeadId, ownerId: nextOwnerId, ownerName: memberName(nextOwnerId), settled: done });
        }

        if (!done && isActive) {
          setTimeout(() => void tick(), POLL_MS);
        }
      } catch {
        if (isActive) {
          setCreated({ ...created, settled: attempts >= POLL_LIMIT });

          if (attempts < POLL_LIMIT) {
            setTimeout(() => void tick(), POLL_MS);
          }
        }
      }
    };

    setTimeout(() => void tick(), POLL_MS);

    return () => {
      isActive = false;
    };
    // Re-run only for a new lead; the poll updates `created` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created?.id, client]);

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

      const createdRow = await client.mutation({
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
              emails: draft.email ? { primaryEmail: draft.email } : undefined,
              phones: draft.phone ? { primaryPhoneNumber: draft.phone } : undefined,
              website: draft.websiteUrl ? { primaryLinkUrl: draft.websiteUrl } : undefined,
              instagram: draft.instagramHandle ? { primaryLinkUrl: draft.instagramHandle } : undefined,
              // A chosen owner is a manual assignment (precedence rule 1);
              // left empty, the assignment engine routes the lead.
              ownerId: ownerId || undefined,
            },
          },
          id: true,
        },
      });

      const id = (createdRow as { createLvLead?: { id?: string } }).createLvLead?.id;

      if (id) {
        setCreated({ id, lvLeadId: null, ownerId: null, ownerName: null, settled: false });
      }

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
  }, [client, input, state, ownerId]);

  if (state.phase === 'SUCCESS' && state.createdLeadId) {
    const leadId = state.createdLeadId;
    const openLead = () => void navigate(AppPath.RecordShowPage, { objectNameSingular: 'lvLead', objectRecordId: leadId });
    const steps: { label: string; state: 'DONE' | 'WAITING' | 'FAILED'; detail: string }[] = [
      { label: 'Lead created', state: 'DONE', detail: 'Saved with your name as the capturer.' },
      {
        label: 'LV Lead ID generated',
        state: created?.lvLeadId ? 'DONE' : created?.settled ? 'FAILED' : 'WAITING',
        detail: created?.lvLeadId ?? (created?.settled ? 'Not allocated yet — open the lead; it will appear once routing completes.' : 'Allocating…'),
      },
      {
        label: 'Assignment',
        state: created?.ownerId ? 'DONE' : created?.settled ? 'FAILED' : 'WAITING',
        detail: created?.ownerId ? `Owner: ${created.ownerName ?? 'team member'}` : created?.settled ? 'No owner could be assigned — claim it from Lead 360 or ask an administrator.' : 'Routing to an owner…',
      },
      { label: 'Next action', state: 'WAITING', detail: 'Open Lead 360 to log the first interaction or schedule the first follow-up.' },
    ];

    return (
      <div style={styles.root} className="lv-root">
        <LvStyles theme={theme} />
        <div style={styles.banner('ok')} role="status">
          Lead created{created?.lvLeadId ? ` — ${created.lvLeadId}` : ''}.
        </div>
        <ol style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((step) => (
            <li key={step.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14 }}>
              <span aria-hidden="true" style={{ width: 22, textAlign: 'center', color: step.state === 'DONE' ? theme.color.success : step.state === 'FAILED' ? theme.color.danger : theme.color.textMuted }}>
                {step.state === 'DONE' ? '✓' : step.state === 'FAILED' ? '!' : '…'}
              </span>
              <span>
                <strong>{step.label}</strong>
                <span style={{ display: 'block', fontSize: 13, color: theme.color.textMuted, fontFamily: step.label === 'LV Lead ID generated' && created?.lvLeadId ? theme.font.mono : 'inherit' }}>{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={styles.submit(false)} onClick={openLead}>
            Open Lead 360
          </button>
          <button type="button" style={styles.secondaryAction} onClick={() => { setCreated(null); selectMode(state.mode); }}>
            Capture another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div key={state.mode} style={styles.root} className="lv-root">
      <LvStyles theme={theme} />
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
            defaultValue={
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
            defaultValue={input.attachmentPath ?? ''}
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
            defaultValue={input.organisationName ?? ''}
            onChange={(event) => update({ organisationName: event.target.value })}
          />
          <label style={styles.label} htmlFor="lv-phone">
            Phone
          </label>
          <input
            id="lv-phone"
            style={styles.input}
            inputMode="tel"
            defaultValue={input.phone ?? ''}
            onChange={(event) => update({ phone: event.target.value })}
          />
          <label style={styles.label} htmlFor="lv-email">
            Email
          </label>
          <input
            id="lv-email"
            style={styles.input}
            inputMode="email"
            defaultValue={input.email ?? ''}
            onChange={(event) => update({ email: event.target.value })}
          />
          <label style={styles.label} htmlFor="lv-location">
            Location
          </label>
          <input
            id="lv-location"
            style={styles.input}
            defaultValue={input.location ?? ''}
            onChange={(event) => update({ location: event.target.value })}
          />
          <label style={styles.label} htmlFor="lv-category">
            Category
          </label>
          <select id="lv-category" style={styles.input} value={input.category ?? ''} onChange={(event) => update({ category: event.target.value || null, subcategory: null })}>
            <option value="">Not yet known</option>
            {LEAD_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label style={styles.label} htmlFor="lv-subcategory">
            Subcategory
          </label>
          <select id="lv-subcategory" style={styles.input} value={input.subcategory ?? ''} onChange={(event) => update({ subcategory: event.target.value || null })}>
            <option value="">Not yet known</option>
            {LEAD_SUBCATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label style={styles.label} htmlFor="lv-source">
            Source
          </label>
          <select id="lv-source" style={styles.input} value={input.source ?? ''} onChange={(event) => update({ source: (event.target.value || null) as LeadSource | null })}>
            <option value="">Derived from capture mode</option>
            {LEAD_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </>
      )}

      <label style={styles.label} htmlFor="lv-owner">
        Owner
      </label>
      <select id="lv-owner" style={styles.input} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
        <option value="">Let the assignment engine choose</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>{member.name}</option>
        ))}
      </select>

      {config.showsReferrer && (
        <>
          <label style={styles.label} htmlFor="lv-referrer">
            Referred by
          </label>
          <input
            id="lv-referrer"
            style={styles.input}
            defaultValue={input.referrerName ?? ''}
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
