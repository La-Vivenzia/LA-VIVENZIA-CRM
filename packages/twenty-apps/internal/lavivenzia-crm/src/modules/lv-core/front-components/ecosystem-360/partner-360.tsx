import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme, useRecordId } from 'twenty-sdk/front-component';

import { type Partner360Model } from 'src/modules/lv-core/services/ecosystem-360';
import { EmptyState, ErrorState, Facts, ForbiddenState, InlineNotice, InversePanel, isForbiddenMessage, LoadingState, LvBadge, LvButton, LvPage, LvStatusBadge, RecordList, RecordRow, Section, formatWhen } from 'src/modules/lv-core/ui/kit';
import { themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';
import { openCapturePage } from 'src/modules/lv-core/utils/open-capture';

import { AuditPanel, CreateListingForm, DocumentsPanel, humanise, OnboardingPanel, openRecord, OwnerForm, ReadinessPanel, ScoreCell, StatusForm, TimelinePanel, value } from 'src/modules/lv-core/front-components/ecosystem-360/shared';

// Partner 360 — the operating view of one La Vivenzia partner.
//
// One request (/partners/360) returns everything under the caller's
// permissions; every action maps to a governed route (actor from the
// session, audited) and the page reloads afterwards. Scores appear only when
// the server could compute them from real inputs — otherwise N/A with the
// reason, never a placeholder number.

type LoadState = { phase: 'LOADING' } | { phase: 'READY'; model: Partner360Model } | { phase: 'FORBIDDEN'; text: string } | { phase: 'ERROR'; text: string };

type Open = { kind: 'STATUS' } | { kind: 'OWNER' } | { kind: 'CREATE'; listing: 'experience' | 'property' } | null;

export const Partner360 = () => {
  const recordId = useRecordId();
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const [state, setState] = useState<LoadState>({ phase: 'LOADING' });
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!recordId) {
      return;
    }

    try {
      const response = (await callRoute('/partners/360', { partnerId: recordId })) as Partner360Model;

      setState({ phase: 'READY', model: response });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'The partner could not be loaded.';

      setState(isForbiddenMessage(text) || /not found/i.test(text) ? { phase: 'FORBIDDEN', text } : { phase: 'ERROR', text });
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const done = (message: string) => {
    setOpen(null);
    setNotice(message);
    void load();
  };

  const activate = async (model: Partner360Model) => {
    setBusy(true);

    try {
      await callRoute('/ecosystem/transition', { kind: 'partner', id: model.partner.id, action: 'STATUS', to: 'ACTIVE' });
      done('Partner activated.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Activation was refused.');
    } finally {
      setBusy(false);
    }
  };

  if (state.phase === 'LOADING') {
    return (
      <LvPage theme={theme} className="lv-360">
        <LoadingState theme={theme} rows={6} label="Loading partner" />
      </LvPage>
    );
  }

  if (state.phase === 'FORBIDDEN') {
    return (
      <LvPage theme={theme} className="lv-360">
        <ForbiddenState theme={theme} title="This partner is not available to you" text={state.text} />
      </LvPage>
    );
  }

  if (state.phase === 'ERROR') {
    return (
      <LvPage theme={theme} className="lv-360">
        <ErrorState theme={theme} text={state.text} onRetry={() => void load()} />
      </LvPage>
    );
  }

  const { model } = state;
  const { partner, capabilities } = model;
  const expectsListing = partner.category === 'STAY' ? 'property' : partner.category === 'EXPERIENCE' ? 'experience' : null;

  return (
    <LvPage theme={theme} className="lv-360">
      <InversePanel theme={theme}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(3), alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div style={{ ...theme.type.label, color: theme.color.accent, marginBottom: 4 }}>{partner.partnerCode ?? 'Partner code pending'}</div>
            <h1 style={{ ...theme.type.display, margin: 0, color: theme.color.surfaceInverseText, overflowWrap: 'anywhere' }}>{partner.name ?? 'Unnamed partner'}</h1>
            <div style={{ ...theme.type.body, color: 'rgba(243,239,231,0.78)', marginTop: 2 }}>{[partner.category ? humanise(partner.category) : null, partner.subcategory ? humanise(partner.subcategory) : null, partner.location, partner.geography].filter(Boolean).join(' · ') || 'No category or location recorded'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: theme.space(3) }}>
              <LvStatusBadge theme={theme} kind="partner" value={partner.status} />
              <LvStatusBadge theme={theme} kind="readiness" value={model.readiness.status} />
              {model.onboarding && <LvStatusBadge theme={theme} kind="onboarding" value={model.onboarding.status} />}
              {!partner.ownerId && <LvBadge theme={theme} tone="warning">Unowned</LvBadge>}
            </div>
          </div>
          <Facts
            theme={theme}
            onInverse
            columns={2}
            items={[
              { label: 'Owner', value: partner.owner?.displayName ?? (partner.ownerId ? 'Team member' : 'Unassigned') },
              { label: 'Partner type', value: humanise(partner.partnerType) },
              { label: 'Approved', value: partner.approvedAt ? partner.approvedAt.slice(0, 10) : '—' },
              { label: 'Activated', value: partner.activatedAt ? partner.activatedAt.slice(0, 10) : '—' },
            ]}
          />
        </div>
      </InversePanel>

      <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', margin: `${theme.space(3)}px 0` }} role="toolbar" aria-label="Partner actions">
        {capabilities.canChangeStatus && <LvButton theme={theme} variant="primary" onClick={() => setOpen({ kind: 'STATUS' })} ariaPressed={open?.kind === 'STATUS'}>Change status</LvButton>}
        {(capabilities.canChangeOwner || capabilities.canClaim) && <LvButton theme={theme} onClick={() => setOpen({ kind: 'OWNER' })} ariaPressed={open?.kind === 'OWNER'}>{capabilities.canChangeOwner ? 'Change owner' : 'Claim partner'}</LvButton>}
        {capabilities.canCreateListing && <LvButton theme={theme} onClick={() => setOpen({ kind: 'CREATE', listing: 'experience' })} ariaPressed={open?.kind === 'CREATE' && open.listing === 'experience'}>Create experience</LvButton>}
        {capabilities.canCreateListing && <LvButton theme={theme} onClick={() => setOpen({ kind: 'CREATE', listing: 'property' })} ariaPressed={open?.kind === 'CREATE' && open.listing === 'property'}>Create property</LvButton>}
        {model.lead && <LvButton theme={theme} variant="ghost" onClick={() => openRecord('lvLead', model.lead!.id)}>Open lead {model.lead.lvLeadId ?? ''}</LvButton>}
        <LvButton theme={theme} variant="ghost" onClick={() => void openCapturePage()}>Capture lead</LvButton>
        {!capabilities.canEdit && <span role="status" style={{ ...theme.type.bodySmall, color: theme.color.textMuted, alignSelf: 'center' }}>You can view this partner. Your role has no actions here.</span>}
      </div>

      {notice && (
        <div style={{ marginBottom: theme.space(3) }}>
          <InlineNotice theme={theme} tone={/refused|not ready|cannot|only an/i.test(notice) ? 'warning' : 'success'}>{notice}</InlineNotice>
        </div>
      )}

      {open?.kind === 'STATUS' && <div style={{ marginBottom: theme.space(3) }}><StatusForm theme={theme} kind="partner" id={partner.id} current={partner.status} options={model.settableStatuses} capabilities={capabilities} onDone={done} onCancel={() => setOpen(null)} /></div>}
      {open?.kind === 'OWNER' && <div style={{ marginBottom: theme.space(3) }}><OwnerForm theme={theme} kind="partner" id={partner.id} currentOwnerId={partner.ownerId} members={model.members} capabilities={capabilities} callerId={model.caller.workspaceMemberId} onDone={done} onCancel={() => setOpen(null)} /></div>}
      {open?.kind === 'CREATE' && <div style={{ marginBottom: theme.space(3) }}><CreateListingForm theme={theme} kind={open.listing} partnerId={partner.id} partnerLocation={partner.location} onDone={(id, code) => { done(`${open.listing === 'experience' ? 'Experience' : 'Property'} ${code ?? ''} created as a draft.`); openRecord(open.listing === 'experience' ? 'lvExperience' : 'lvProperty', id); }} onCancel={() => setOpen(null)} /></div>}

      <div className="lv-sidebar-layout">
        <div style={{ display: 'grid', gap: theme.space(3) }}>
          <ReadinessPanel theme={theme} readiness={model.readiness} label="partner" canActivate={capabilities.canGovern && partner.status !== 'ACTIVE' && (partner.status === 'APPROVED' || partner.status === 'PAUSED' || partner.status === 'SUSPENDED' || partner.status === 'INACTIVE')} onActivate={() => void activate(model)} busy={busy} />

          <Section theme={theme} title="Overview">
            <Facts
              theme={theme}
              columns={3}
              items={[
                { label: 'Contact person', value: model.contact ? <button type="button" onClick={() => openRecord('person', model.contact!.id)} style={{ background: 'none', border: 0, padding: 0, color: theme.color.brand, cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>{model.contact.name ?? model.contact.email ?? 'Person'}</button> : value(theme, null) },
                { label: 'Organisation', value: model.organisation ? <button type="button" onClick={() => openRecord('company', model.organisation!.id)} style={{ background: 'none', border: 0, padding: 0, color: theme.color.brand, cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>{model.organisation.name ?? 'Organisation'}</button> : value(theme, null) },
                { label: 'Email', value: value(theme, partner.emails?.primaryEmail) },
                { label: 'Phone', value: value(theme, partner.phones?.primaryPhoneNumber) },
                { label: 'Website', value: value(theme, partner.website?.primaryLinkUrl) },
                { label: 'Instagram', value: value(theme, partner.instagram?.primaryLinkUrl) },
                { label: 'Languages', value: value(theme, partner.languages?.join(', ')) },
                { label: 'Source', value: value(theme, model.lead?.source ? humanise(model.lead.source) : null) },
                { label: 'Lead', value: model.lead ? `${model.lead.lvLeadId ?? 'LV ID pending'} · ${humanise(model.lead.status)}` : value(theme, null) },
                { label: 'Created', value: partner.createdAt.slice(0, 10) },
                { label: 'Last interaction', value: value(theme, model.lead?.lastInteractionAt ? formatWhen(model.lead.lastInteractionAt, model.now) : null) },
                { label: 'Next follow-up', value: value(theme, model.lead?.nextFollowUpAt ? formatWhen(model.lead.nextFollowUpAt, model.now) : null) },
              ]}
            />
            {partner.description && <p style={{ ...theme.type.body, color: theme.color.text, margin: `${theme.space(3)}px 0 0` }}>{partner.description}</p>}
            {partner.statusReason && <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(2)}px 0 0` }}>Status reason: {partner.statusReason}</p>}
          </Section>

          <OnboardingPanel theme={theme} onboarding={model.onboarding} onOpen={(id) => openRecord('lvOnboarding', id)} />

          <Section theme={theme} title="Experiences" count={model.experiences.length} hint={expectsListing === 'experience' && model.experiences.length === 0 ? 'expected for this category' : undefined} tone={expectsListing === 'experience' && model.experiences.length === 0 ? 'warning' : undefined} actions={capabilities.canCreateListing ? <LvButton theme={theme} size="sm" onClick={() => setOpen({ kind: 'CREATE', listing: 'experience' })}>Create experience</LvButton> : undefined}>
            {model.experiences.length === 0 ? <EmptyState theme={theme} text="No experiences yet." /> : (
              <RecordList>
                {model.experiences.map((row) => (
                  <RecordRow key={row.id} theme={theme} primary={row.name ?? 'Unnamed'} secondary={[row.code, row.location, row.capacity ? `up to ${row.capacity}` : null].filter(Boolean).join(' · ') || null} meta={row.readiness.status === 'READY' ? 'Ready' : `${row.readiness.reasons.length} missing`} badge={<LvStatusBadge theme={theme} kind="listing" value={row.status} />} onClick={() => openRecord('lvExperience', row.id)} />
                ))}
              </RecordList>
            )}
          </Section>

          <Section theme={theme} title="Properties" count={model.properties.length} hint={expectsListing === 'property' && model.properties.length === 0 ? 'expected for this category' : undefined} tone={expectsListing === 'property' && model.properties.length === 0 ? 'warning' : undefined} actions={capabilities.canCreateListing ? <LvButton theme={theme} size="sm" onClick={() => setOpen({ kind: 'CREATE', listing: 'property' })}>Create property</LvButton> : undefined}>
            {model.properties.length === 0 ? <EmptyState theme={theme} text="No properties yet." /> : (
              <RecordList>
                {model.properties.map((row) => (
                  <RecordRow key={row.id} theme={theme} primary={row.name ?? 'Unnamed'} secondary={[row.code, row.propertyType ? humanise(row.propertyType) : null, row.location, row.capacity ? `sleeps ${row.capacity}` : null].filter(Boolean).join(' · ') || null} meta={row.readiness.status === 'READY' ? 'Ready' : `${row.readiness.reasons.length} missing`} badge={<LvStatusBadge theme={theme} kind="listing" value={row.status} />} onClick={() => openRecord('lvProperty', row.id)} />
                ))}
              </RecordList>
            )}
          </Section>

          <DocumentsPanel theme={theme} documents={model.documents} onOpen={(id) => openRecord('lvOnboardingDocument', id)} />

          <Section theme={theme} title="Commercial terms" hint="as stated by the partner">
            <div className="lv-two-col">
              <div>
                <div style={{ ...theme.type.label, color: theme.color.textMuted }}>Pricing</div>
                {partner.pricing ? <Facts theme={theme} items={[{ label: 'Base price', value: partner.pricing.basePrice ? `₹${Number(partner.pricing.basePrice).toLocaleString('en-IN')}` : value(theme, null) }, { label: 'Priced per', value: value(theme, partner.pricing.priceUnit as string | null) }, { label: 'Minimum guests', value: value(theme, partner.pricing.minimumGuests as number | null) }, { label: 'Additional charges', value: value(theme, partner.pricing.additionalCharges as string | null) }]} /> : <EmptyState theme={theme} text="No pricing recorded." />}
              </div>
              <div>
                <div style={{ ...theme.type.label, color: theme.color.textMuted }}>Availability</div>
                {partner.availability ? <Facts theme={theme} items={[{ label: 'Available days', value: value(theme, Array.isArray(partner.availability.availableDays) ? (partner.availability.availableDays as string[]).join(', ') : null) }, { label: 'Notice needed', value: value(theme, partner.availability.noticePeriodHours ? `${partner.availability.noticePeriodHours} h` : null) }, { label: 'Seasonal notes', value: value(theme, partner.availability.seasonalNotes as string | null) }]} /> : <EmptyState theme={theme} text="No availability recorded." />}
              </div>
            </div>
            <div style={{ marginTop: theme.space(3) }}>
              <div style={{ ...theme.type.label, color: theme.color.textMuted }}>Policies</div>
              {partner.policies ? <Facts theme={theme} columns={3} items={[{ label: 'Cancellation', value: value(theme, partner.policies.cancellationPolicy as string | null) }, { label: 'House rules', value: value(theme, partner.policies.houseRules as string | null) }, { label: 'Safety', value: value(theme, partner.policies.safetyMeasures as string | null) }, { label: 'Partner terms', value: partner.policies.agreesToTerms === true ? 'Accepted' : <span style={{ color: theme.color.warning }}>Not accepted</span> }]} /> : <EmptyState theme={theme} text="No policies recorded." />}
            </div>
          </Section>

          <TimelinePanel theme={theme} entries={model.timeline} now={model.now} />
          <AuditPanel theme={theme} rows={model.audit} now={model.now} />
        </div>

        <div style={{ display: 'grid', gap: theme.space(3), alignContent: 'start' }}>
          <ScoreCell theme={theme} label="Relationship health" score={model.relationshipHealth} />
          <ScoreCell theme={theme} label="Partner health" score={model.partnerHealth} />

          <Section theme={theme} title="Relationship" count={model.interactions.length}>
            {model.lead?.nextAction && <InlineNotice theme={theme} tone="info">Next action: {model.lead.nextAction}{model.lead.nextFollowUpAt ? ` · ${formatWhen(model.lead.nextFollowUpAt, model.now)}` : ''}</InlineNotice>}
            {model.interactions.length === 0 ? <EmptyState theme={theme} text={model.lead ? 'No interactions logged on the lead.' : 'No lead is linked, so there is no interaction history.'} /> : (
              <RecordList>
                {model.interactions.map((row) => (
                  <RecordRow key={row.id} theme={theme} primary={`${humanise(row.channel)}${row.outcome ? ` · ${humanise(row.outcome)}` : ''}`} secondary={row.summary} meta={row.occurredAt ? formatWhen(row.occurredAt, model.now) : null} onClick={() => openRecord('lvInteraction', row.id)} />
                ))}
              </RecordList>
            )}
          </Section>

          <Section theme={theme} title="Tasks & follow-ups" count={model.tasks.length}>
            {model.tasks.length === 0 ? <EmptyState theme={theme} text="No open tasks." /> : (
              <RecordList>
                {model.tasks.map((task) => (
                  <RecordRow key={task.id} theme={theme} primary={task.title ?? 'Task'} secondary={task.assignee?.displayName ?? null} meta={task.dueAt ? formatWhen(task.dueAt, model.now) : null} badge={<LvStatusBadge theme={theme} kind="task" value={task.status} />} onClick={() => openRecord('task', task.id)} />
                ))}
              </RecordList>
            )}
          </Section>

          <Section theme={theme} title="Notes" count={model.notes.length}>
            {model.notes.length === 0 ? <EmptyState theme={theme} text="No notes." /> : (
              <RecordList>
                {model.notes.map((note) => (
                  <RecordRow key={note.id} theme={theme} primary={note.title ?? 'Note'} meta={formatWhen(note.updatedAt, model.now)} onClick={() => openRecord('note', note.id)} />
                ))}
              </RecordList>
            )}
          </Section>
        </div>
      </div>
      <p style={{ ...theme.type.caption, color: theme.color.textSubtle, margin: `${theme.space(3)}px 0 0` }}>Partner 360 · every action is decided again on the server, under your own permissions, and audited.</p>
    </LvPage>
  );
};
