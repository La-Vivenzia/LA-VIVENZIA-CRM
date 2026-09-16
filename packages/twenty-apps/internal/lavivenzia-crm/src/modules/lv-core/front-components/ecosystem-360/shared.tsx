import { type ReactNode, useState } from 'react';
import { AppPath, navigate } from 'twenty-sdk/front-component';

import { type Readiness } from 'src/modules/lv-core/services/activation-readiness';
import { type DocumentView, type OnboardingView, type TimelineEntry } from 'src/modules/lv-core/services/ecosystem-360';
import { type AuditRow, type EcosystemCapabilities, type MemberRef } from 'src/modules/lv-core/services/ecosystem-service';
import { EmptyState, Eyebrow, Facts, Field, formatWhen, InlineNotice, LvBadge, LvButton, LvCard, LvInput, LvSelect, LvStatusBadge, LvTextarea, RecordList, RecordRow, Section, type Tone } from 'src/modules/lv-core/ui/kit';
import { type LvTheme } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';

// Shared sections of the Partner / Experience / Property 360 pages. Each one
// renders a slice of the server model and nothing else — no derived scores,
// no defaults dressed up as data: an empty slice is an empty state, an
// unavailable score says why.

export const humanise = (value: string | null | undefined): string => (value ? value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase()) : '—');

export const openRecord = (object: string, recordId: string) => void navigate(AppPath.RecordShowPage, { objectNameSingular: object, objectRecordId: recordId });

export const NotRecorded = ({ theme }: { theme: LvTheme }) => <span style={{ color: theme.color.textSubtle }}>Not recorded</span>;

export const value = (theme: LvTheme, text: string | number | null | undefined): ReactNode => (text === null || text === undefined || text === '' ? <NotRecorded theme={theme} /> : String(text));

export const money = (theme: LvTheme, price: { amountMicros?: number | string | null; currencyCode?: string | null } | null, unit: string | null): ReactNode => {
  const raw = price?.amountMicros;
  const micros = raw === null || raw === undefined ? null : Number(raw);

  if (micros === null || !Number.isFinite(micros) || micros <= 0) {
    return <NotRecorded theme={theme} />;
  }

  return `${price?.currencyCode === 'INR' || !price?.currencyCode ? '₹' : `${price.currencyCode} `}${(micros / 1_000_000).toLocaleString('en-IN')}${unit ? ` · ${unit}` : ''}`;
};

// ---- readiness -------------------------------------------------------------------

export const ReadinessPanel = ({ theme, readiness, label, onActivate, canActivate, busy }: { theme: LvTheme; readiness: Readiness; label: string; onActivate?: () => void; canActivate: boolean; busy: boolean }) => {
  const groups = ['PROFILE', 'DOCUMENTS', 'COMMERCIAL', 'APPROVAL', 'RELATIONS'] as const;

  return (
    <Section theme={theme} title="Activation readiness" tone={readiness.status === 'READY' ? 'success' : 'warning'} hint={`${readiness.checks} deterministic checks · ${formatWhen(readiness.checkedAt, readiness.checkedAt)}`} actions={onActivate && canActivate && readiness.status === 'READY' ? <LvButton theme={theme} variant="gold" size="sm" onClick={onActivate} busy={busy}>Activate {label}</LvButton> : undefined}>
      <div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center', flexWrap: 'wrap', marginBottom: readiness.reasons.length > 0 ? theme.space(2) : 0 }}>
        <LvStatusBadge theme={theme} kind="readiness" value={readiness.status} />
        <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{readiness.status === 'READY' ? `Every requirement is met. ${canActivate ? 'A person still has to decide to activate.' : 'Activation is a decision for an administrator or operations member who does not own this record.'}` : `${readiness.reasons.length} requirement${readiness.reasons.length === 1 ? '' : 's'} missing. Nothing here is estimated — each line is a fact about the record.`}</span>
      </div>
      {readiness.reasons.length > 0 && (
        <div style={{ display: 'grid', gap: theme.space(2) }}>
          {groups
            .filter((group) => readiness.reasons.some((reason) => reason.area === group))
            .map((group) => (
              <div key={group}>
                <Eyebrow theme={theme}>{humanise(group)}</Eyebrow>
                <ul style={{ margin: `4px 0 0`, paddingLeft: 18, ...theme.type.bodySmall }}>
                  {readiness.reasons
                    .filter((reason) => reason.area === group)
                    .map((reason) => (
                      <li key={reason.code} style={{ color: theme.color.text }}>
                        {reason.text} <span style={{ ...theme.type.caption, color: theme.color.textSubtle }}>{reason.code}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </Section>
  );
};

// ---- onboarding ----------------------------------------------------------------------

export const OnboardingPanel = ({ theme, onboarding, onOpen }: { theme: LvTheme; onboarding: OnboardingView | null; onOpen?: (id: string) => void }) => {
  if (!onboarding) {
    return (
      <Section theme={theme} title="Onboarding" hint="none linked">
        <EmptyState theme={theme} text="No onboarding is linked to this record. A partner created by hand has not been through verification — readiness will say so." />
      </Section>
    );
  }

  return (
    <Section theme={theme} title="Onboarding" actions={<div style={{ display: 'flex', gap: theme.space(2), alignItems: 'center' }}><LvStatusBadge theme={theme} kind="onboarding" value={onboarding.status} />{onOpen && <LvButton theme={theme} size="sm" variant="ghost" onClick={() => onOpen(onboarding.id)}>Open onboarding</LvButton>}</div>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), marginBottom: theme.space(3), flexWrap: 'wrap' }}>
        <div style={{ ...theme.type.figure, fontSize: 28, color: theme.color.heading }}>{onboarding.progressPercentage}%</div>
        <div style={{ flex: '1 1 200px', height: 6, background: theme.color.surfaceSunken, borderRadius: 3, overflow: 'hidden' }} role="progressbar" aria-valuenow={onboarding.progressPercentage} aria-valuemin={0} aria-valuemax={100} aria-label="Onboarding completion">
          <div style={{ width: `${Math.min(100, Math.max(0, onboarding.progressPercentage))}%`, height: '100%', background: theme.color.brand }} />
        </div>
      </div>
      <Facts
        theme={theme}
        columns={3}
        items={[
          { label: 'Current step', value: value(theme, onboarding.currentStepLabel) },
          { label: 'Reviewer', value: onboarding.reviewer ? (onboarding.reviewer.displayName ?? onboarding.reviewer.email ?? 'Team member') : <span style={{ color: theme.color.warning }}>No reviewer</span> },
          { label: 'Onboarding health', value: onboarding.healthScore === null ? <span style={{ color: theme.color.textSubtle }}>N/A — not computed</span> : `${onboarding.healthScore}` },
          { label: 'Submitted', value: value(theme, onboarding.submittedAt?.slice(0, 10)) },
          { label: 'Decided', value: value(theme, onboarding.decidedAt?.slice(0, 10)) },
          { label: 'Activated', value: value(theme, onboarding.activatedAt?.slice(0, 10)) },
        ]}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: theme.space(3) }}>
        {onboarding.completedSteps.map((step) => (
          <LvBadge key={step} theme={theme} tone="success">
            {humanise(step)}
          </LvBadge>
        ))}
        {onboarding.incompleteSteps.map((step) => (
          <LvBadge key={step} theme={theme} tone="warning">
            {humanise(step)} · incomplete
          </LvBadge>
        ))}
      </div>
      {onboarding.missing.length > 0 && (
        <div style={{ marginTop: theme.space(3) }}>
          <Eyebrow theme={theme} tone="warning">Missing information · {onboarding.missing.length}</Eyebrow>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, ...theme.type.bodySmall }}>
            {onboarding.missing.slice(0, 12).map((item) => (
              <li key={`${item.step}-${item.field}`}>
                {item.stepLabel}: {item.label} — {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {onboarding.decisionReason && <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(2)}px 0 0` }}>Decision note: {onboarding.decisionReason}</p>}
    </Section>
  );
};

// ---- documents -------------------------------------------------------------------------

export const DocumentsPanel = ({ theme, documents, title = 'Verification & documents', onOpen }: { theme: LvTheme; documents: DocumentView[]; title?: string; onOpen?: (id: string) => void }) => {
  const buckets: { key: DocumentView['bucket']; label: string; tone: Tone }[] = [
    { key: 'VERIFIED', label: 'Verified', tone: 'success' },
    { key: 'PENDING', label: 'Pending', tone: 'info' },
    { key: 'REJECTED', label: 'Rejected', tone: 'danger' },
    { key: 'EXPIRED', label: 'Expired', tone: 'warning' },
  ];

  return (
    <Section theme={theme} title={title} count={documents.length}>
      {documents.length === 0 ? (
        <EmptyState theme={theme} text="No documents on file." />
      ) : (
        <div style={{ display: 'grid', gap: theme.space(3) }}>
          {buckets
            .filter((bucket) => documents.some((document) => document.bucket === bucket.key))
            .map((bucket) => (
              <div key={bucket.key}>
                <Eyebrow theme={theme} tone={bucket.tone}>
                  {bucket.label} · {documents.filter((document) => document.bucket === bucket.key).length}
                </Eyebrow>
                <RecordList>
                  {documents
                    .filter((document) => document.bucket === bucket.key)
                    .map((document) => (
                      <RecordRow key={document.id} theme={theme} primary={document.name ?? humanise(document.documentType)} secondary={[humanise(document.documentType), document.expiresAt ? `expires ${document.expiresAt.slice(0, 10)}` : null, document.rejectionReason].filter(Boolean).join(' · ') || null} badge={<LvStatusBadge theme={theme} kind="document" value={document.verificationState} />} onClick={onOpen ? () => onOpen(document.id) : undefined} />
                    ))}
                </RecordList>
              </div>
            ))}
        </div>
      )}
    </Section>
  );
};

// ---- timeline & audit ----------------------------------------------------------------

export const TimelinePanel = ({ theme, entries, now }: { theme: LvTheme; entries: TimelineEntry[]; now: string }) => (
  <Section theme={theme} title="Timeline" count={entries.length} hint="relationship memory">
    {entries.length === 0 ? (
      <EmptyState theme={theme} text="Nothing has happened yet." />
    ) : (
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
        {entries.map((entry) => (
          <li key={entry.id} style={{ display: 'grid', gridTemplateColumns: '10px 1fr', gap: theme.space(2), padding: `${theme.space(1)}px 0`, borderBottom: `1px solid ${theme.color.border}` }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, background: entry.tone === 'danger' ? theme.color.danger : entry.tone === 'warning' ? theme.color.warning : entry.tone === 'success' ? theme.color.success : entry.tone === 'info' ? theme.color.info : theme.color.borderStrong }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.space(2), flexWrap: 'wrap' }}>
                <span style={{ fontWeight: theme.font.weight.medium, color: theme.color.heading }}>{entry.title}</span>
                <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>{formatWhen(entry.at, now)}{entry.actor ? ` · ${entry.actor.displayName ?? entry.actor.email ?? 'team member'}` : ''}</span>
              </div>
              {entry.detail && <div style={{ ...theme.type.bodySmall, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{entry.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
    )}
  </Section>
);

export const AuditPanel = ({ theme, rows, now }: { theme: LvTheme; rows: (AuditRow & { actor: MemberRef | null })[]; now: string }) => (
  <Section theme={theme} title="Audit" count={rows.length} hint="governance events">
    {rows.length === 0 ? (
      <EmptyState theme={theme} text="No governance events recorded." />
    ) : (
      <RecordList>
        {rows.slice(0, 25).map((row) => (
          <RecordRow key={row.id} theme={theme} primary={humanise(row.action)} secondary={[row.reason, row.actor ? `by ${row.actor.displayName ?? row.actor.email ?? 'team member'}` : 'by the system'].filter(Boolean).join(' · ') || null} meta={row.at ? formatWhen(row.at, now) : null} badge={<LvBadge theme={theme} tone={row.outcome === 'REFUSED' ? 'danger' : row.outcome === 'FAILED' ? 'warning' : 'neutral'}>{(row.outcome ?? 'applied').toLowerCase()}</LvBadge>} />
        ))}
      </RecordList>
    )}
  </Section>
);

// ---- score cells ---------------------------------------------------------------------------

export const ScoreCell = ({ theme, label, score }: { theme: LvTheme; label: string; score: { value: number | null; reason: string | null } }) => (
  <LvCard theme={theme} padding={theme.space(3)}>
    <Eyebrow theme={theme}>{label}</Eyebrow>
    {score.value === null ? (
      <>
        <div style={{ ...theme.type.figure, fontSize: 22, color: theme.color.textSubtle, marginTop: 2 }}>N/A</div>
        {score.reason && <p style={{ ...theme.type.caption, color: theme.color.textMuted, margin: `4px 0 0` }}>{score.reason}</p>}
      </>
    ) : (
      <div style={{ ...theme.type.figure, fontSize: 22, color: theme.color.heading, marginTop: 2 }}>{score.value}</div>
    )}
  </LvCard>
);

// ---- forms ----------------------------------------------------------------------------------

const Shell = ({ theme, title, intro, children, error, busy, submitLabel, onSubmit, onCancel, disabled }: { theme: LvTheme; title: string; intro?: string; children: ReactNode; error: string | null; busy: boolean; submitLabel: string; onSubmit: () => void; onCancel: () => void; disabled?: boolean }) => (
  <form
    aria-label={title}
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <LvCard theme={theme} tone="info" padding={theme.space(3)} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), background: theme.color.surfaceRaised }}>
      <div>
        <h3 style={{ ...theme.type.title, margin: 0, color: theme.color.heading }}>{title}</h3>
        {intro && <p style={{ ...theme.type.bodySmall, margin: `${theme.space(1)}px 0 0`, color: theme.color.textMuted }}>{intro}</p>}
      </div>
      {children}
      {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}
      <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>
        <LvButton theme={theme} variant="primary" type="submit" busy={busy} disabled={disabled}>
          {submitLabel}
        </LvButton>
        <LvButton theme={theme} variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </LvButton>
      </div>
    </LvCard>
  </form>
);

export type TransitionOutcome = { ok: boolean; error?: string; readiness?: Readiness };

export const StatusForm = ({ theme, kind, id, current, options, capabilities, onDone, onCancel }: { theme: LvTheme; kind: 'partner' | 'experience' | 'property'; id: string; current: string | null; options: { value: string; label: string; governed: boolean }[]; capabilities: EcosystemCapabilities; onDone: (message: string) => void; onCancel: () => void }) => {
  const allowed = options.filter((option) => (option.governed ? capabilities.canGovern : capabilities.canChangeStatus));
  const [to, setTo] = useState(allowed[0]?.value ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState<Readiness | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotReady(null);

    try {
      const result = (await callRoute('/ecosystem/transition', { kind, id, action: 'STATUS', to, reason: reason.trim() || null })) as TransitionOutcome;

      if (result.ok) {
        onDone(`Status changed to ${humanise(to).toLowerCase()}.`);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The change was refused.';

      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (allowed.length === 0) {
    return (
      <LvCard theme={theme} tone="warning" padding={theme.space(3)}>
        <p style={{ ...theme.type.bodySmall, margin: 0 }}>No status change is open to you from {humanise(current).toLowerCase()}. Approval, activation, suspension and archiving are decided by an administrator or a team member with write rights who does not own the record.</p>
        <div style={{ marginTop: theme.space(2) }}>
          <LvButton theme={theme} variant="ghost" size="sm" onClick={onCancel}>Close</LvButton>
        </div>
      </LvCard>
    );
  }

  return (
    <Shell theme={theme} title="Change status" intro={`Currently ${humanise(current).toLowerCase()}. Every change is server-checked (allowed transition, your permission, readiness for activation) and audited with your name.`} error={error} busy={busy} submitLabel="Apply" onSubmit={() => void submit()} onCancel={onCancel} disabled={to === ''}>
      <Field theme={theme} label="New status" htmlFor={`lv-eco-status-${id}`}>
        <LvSelect theme={theme} id={`lv-eco-status-${id}`} value={to} onChange={(event) => setTo(event.target.value)}>
          {allowed.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}{option.governed ? ' · governance decision' : ''}
            </option>
          ))}
        </LvSelect>
      </Field>
      <Field theme={theme} label="Reason" htmlFor={`lv-eco-reason-${id}`} help="Required for changes required, pause, suspension and archiving; recorded on the audit trail.">
        <LvTextarea theme={theme} id={`lv-eco-reason-${id}`} value={reason} rows={2} onChange={(event) => setReason(event.target.value)} />
      </Field>
      {notReady && <InlineNotice theme={theme} tone="warning">Not ready: {notReady.reasons.map((item) => item.text).join(' ')}</InlineNotice>}
    </Shell>
  );
};

export const OwnerForm = ({ theme, kind, id, currentOwnerId, members, capabilities, callerId, onDone, onCancel }: { theme: LvTheme; kind: 'partner' | 'experience' | 'property'; id: string; currentOwnerId: string | null; members: MemberRef[]; capabilities: EcosystemCapabilities; callerId: string; onDone: (message: string) => void; onCancel: () => void }) => {
  const claimOnly = !capabilities.canChangeOwner && capabilities.canClaim;
  const [ownerId, setOwnerId] = useState(claimOnly ? callerId : (currentOwnerId ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      await callRoute('/ecosystem/transition', { kind, id, action: 'OWNER', ownerId: ownerId || null });
      onDone(ownerId ? 'Owner changed.' : 'Owner removed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The change was refused.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell theme={theme} title={claimOnly ? 'Claim this record' : 'Change owner'} intro={claimOnly ? 'Unowned records can be claimed by anyone with write access — for themselves only.' : 'Administrators may reassign; the current owner may hand over.'} error={error} busy={busy} submitLabel={claimOnly ? 'Claim' : 'Save'} onSubmit={() => void submit()} onCancel={onCancel}>
      <Field theme={theme} label="Owner" htmlFor={`lv-eco-owner-${id}`}>
        <LvSelect theme={theme} id={`lv-eco-owner-${id}`} value={ownerId} disabled={claimOnly} onChange={(event) => setOwnerId(event.target.value)}>
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName ?? member.email ?? member.id}
            </option>
          ))}
        </LvSelect>
      </Field>
    </Shell>
  );
};

export const CreateListingForm = ({ theme, kind, partnerId, partnerLocation, onDone, onCancel }: { theme: LvTheme; kind: 'experience' | 'property'; partnerId: string; partnerLocation: string | null; onDone: (id: string, code: string | null) => void; onCancel: () => void }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState(partnerLocation ?? '');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState(kind === 'experience' ? 'Per person' : 'Per night');
  const [extra, setExtra] = useState('');
  const [propertyType, setPropertyType] = useState('VILLA');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<{ id: string; name: string | null; code: string | null; percent: number }[] | null>(null);

  const submit = async (decision: 'NONE' | 'CREATE_NEW') => {
    setBusy(true);
    setError(null);

    try {
      const result = (await callRoute('/ecosystem/create', { kind, partnerId, duplicateDecision: decision === 'CREATE_NEW' ? 'CREATE_NEW' : undefined, fields: { name, location, capacity, basePrice: price, priceUnit: unit, ...(kind === 'experience' ? { durationMinutes: extra } : { rooms: extra, propertyType }) } })) as { ok: boolean; id?: string; code?: string | null };

      if (result.ok && result.id) {
        onDone(result.id, result.code ?? null);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The record could not be created.';

      // The route refuses with the duplicate list before writing; the person decides.
      if (/similar/i.test(message)) {
        setDuplicates([]);
      }

      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const label = kind === 'experience' ? 'experience' : 'property';

  return (
    <Shell theme={theme} title={`Create ${label}`} intro={`A draft ${label} under this partner, with a server-allocated code. It goes through review and approval before it can be activated.`} error={error} busy={busy} submitLabel={duplicates ? 'Create anyway' : `Create ${label}`} onSubmit={() => void submit(duplicates ? 'CREATE_NEW' : 'NONE')} onCancel={onCancel} disabled={name.trim().length < 2}>
      <div className="lv-field-grid">
        <Field theme={theme} label="Name" htmlFor={`lv-create-${kind}-name`} required>
          <LvInput theme={theme} id={`lv-create-${kind}-name`} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field theme={theme} label="Location" htmlFor={`lv-create-${kind}-location`}>
          <LvInput theme={theme} id={`lv-create-${kind}-location`} value={location} onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field theme={theme} label={kind === 'experience' ? 'Maximum participants' : 'Sleeps'} htmlFor={`lv-create-${kind}-capacity`}>
          <LvInput theme={theme} id={`lv-create-${kind}-capacity`} type="number" min={0} value={capacity} onChange={(event) => setCapacity(event.target.value)} />
        </Field>
        <Field theme={theme} label={kind === 'experience' ? 'Duration (minutes)' : 'Rooms / units'} htmlFor={`lv-create-${kind}-extra`}>
          <LvInput theme={theme} id={`lv-create-${kind}-extra`} type="number" min={0} value={extra} onChange={(event) => setExtra(event.target.value)} />
        </Field>
        <Field theme={theme} label="Base price (INR)" htmlFor={`lv-create-${kind}-price`}>
          <LvInput theme={theme} id={`lv-create-${kind}-price`} type="number" min={0} value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
        <Field theme={theme} label="Priced per" htmlFor={`lv-create-${kind}-unit`}>
          <LvInput theme={theme} id={`lv-create-${kind}-unit`} value={unit} onChange={(event) => setUnit(event.target.value)} />
        </Field>
        {kind === 'property' && (
          <Field theme={theme} label="Property type" htmlFor="lv-create-property-type">
            <LvSelect theme={theme} id="lv-create-property-type" value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
              {['VILLA', 'HOMESTAY', 'BOUTIQUE_HOTEL', 'RESORT', 'HOTEL', 'FARMSTAY', 'HERITAGE_PROPERTY', 'LUXURY_STAY', 'UNIQUE_STAY', 'CAMP', 'HOSTEL', 'RETREAT_CENTRE', 'PROPERTY_MANAGER', 'PROPERTY_OWNER', 'VENUE', 'OTHER'].map((option) => (
                <option key={option} value={option}>
                  {option === 'BOUTIQUE_HOTEL' ? 'Boutique stay' : option === 'CAMP' ? 'Glamping property' : option === 'FARMSTAY' ? 'Farm stay' : humanise(option)}
                </option>
              ))}
            </LvSelect>
          </Field>
        )}
      </div>
      {duplicates && <InlineNotice theme={theme} tone="warning">A similar {label} already exists under this partner. Open it from the list above, or create a new one anyway — your decision is recorded.</InlineNotice>}
    </Shell>
  );
};
