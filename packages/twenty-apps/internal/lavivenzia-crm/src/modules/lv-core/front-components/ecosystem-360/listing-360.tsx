import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme, useRecordId } from 'twenty-sdk/front-component';

import { type Listing360Model } from 'src/modules/lv-core/services/ecosystem-360';
import { EmptyState, ErrorState, Facts, ForbiddenState, InlineNotice, InversePanel, isForbiddenMessage, LoadingState, LvBadge, LvButton, LvPage, LvStatusBadge, Section } from 'src/modules/lv-core/ui/kit';
import { themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';

import { AuditPanel, DocumentsPanel, humanise, money, OnboardingPanel, openRecord, OwnerForm, ReadinessPanel, ScoreCell, StatusForm, TimelinePanel, value } from 'src/modules/lv-core/front-components/ecosystem-360/shared';

// Experience 360 / Property 360 — one component, two shapes. Answers the
// operator's questions in order: what is it, who operates it, where, how
// much, when, what is verified, is it approved, what is missing, what next.

type LoadState = { phase: 'LOADING' } | { phase: 'READY'; model: Listing360Model } | { phase: 'FORBIDDEN'; text: string } | { phase: 'ERROR'; text: string };

type Open = { kind: 'STATUS' } | { kind: 'OWNER' } | null;

export const Listing360 = ({ kind }: { kind: 'experience' | 'property' }) => {
  const recordId = useRecordId();
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const [state, setState] = useState<LoadState>({ phase: 'LOADING' });
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = kind === 'experience' ? 'Experience' : 'Property';
  const route = kind === 'experience' ? '/experiences/360' : '/properties/360';

  const load = useCallback(async () => {
    if (!recordId) {
      return;
    }

    try {
      const response = (await callRoute(route, kind === 'experience' ? { experienceId: recordId } : { propertyId: recordId })) as Listing360Model;

      setState({ phase: 'READY', model: response });
    } catch (error) {
      const text = error instanceof Error ? error.message : `The ${label.toLowerCase()} could not be loaded.`;

      setState(isForbiddenMessage(text) || /not found/i.test(text) ? { phase: 'FORBIDDEN', text } : { phase: 'ERROR', text });
    }
  }, [recordId, route, kind, label]);

  useEffect(() => {
    void load();
  }, [load]);

  const done = (message: string) => {
    setOpen(null);
    setNotice(message);
    void load();
  };

  const transition = async (model: Listing360Model, to: string, message: string) => {
    setBusy(true);

    try {
      await callRoute('/ecosystem/transition', { kind, id: model.listing.id, action: 'STATUS', to });
      done(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The change was refused.');
    } finally {
      setBusy(false);
    }
  };

  if (state.phase === 'LOADING') {
    return (
      <LvPage theme={theme} className="lv-360">
        <LoadingState theme={theme} rows={6} label={`Loading ${label.toLowerCase()}`} />
      </LvPage>
    );
  }

  if (state.phase === 'FORBIDDEN') {
    return (
      <LvPage theme={theme} className="lv-360">
        <ForbiddenState theme={theme} title={`This ${label.toLowerCase()} is not available to you`} text={state.text} />
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
  const { listing, capabilities, partner } = model;
  const canSubmit = capabilities.canChangeStatus && (listing.status === 'DRAFT' || listing.status === 'CHANGES_REQUIRED' || listing.status === null);
  const canApprove = capabilities.canGovern && listing.status === 'IN_REVIEW';
  const canActivate = capabilities.canGovern && (listing.status === 'READY' || listing.status === 'PAUSED' || listing.status === 'SUSPENDED');

  return (
    <LvPage theme={theme} className="lv-360">
      <InversePanel theme={theme}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(3), alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div style={{ ...theme.type.label, color: theme.color.accent, marginBottom: 4 }}>{listing.code ?? `${label} code pending`}</div>
            <h1 style={{ ...theme.type.display, margin: 0, color: theme.color.surfaceInverseText, overflowWrap: 'anywhere' }}>{listing.name ?? `Unnamed ${label.toLowerCase()}`}</h1>
            <div style={{ ...theme.type.body, color: 'rgba(243,239,231,0.78)', marginTop: 2 }}>{[kind === 'experience' ? (listing.category ? humanise(listing.category) : null) : (listing.propertyType ? humanise(listing.propertyType) : null), listing.subcategory ? humanise(listing.subcategory) : null, listing.location, listing.destination].filter(Boolean).join(' · ') || 'No category or location recorded'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: theme.space(3) }}>
              <LvStatusBadge theme={theme} kind="listing" value={listing.status} />
              <LvStatusBadge theme={theme} kind="readiness" value={model.readiness.status} />
              {!listing.ownerId && <LvBadge theme={theme} tone="warning">Unowned</LvBadge>}
              {!partner && <LvBadge theme={theme} tone="danger">No partner</LvBadge>}
            </div>
          </div>
          <Facts
            theme={theme}
            onInverse
            columns={2}
            items={[
              { label: 'Partner', value: partner ? `${partner.name ?? 'Partner'}${partner.partnerCode ? ` · ${partner.partnerCode}` : ''}` : '—' },
              { label: 'Owner', value: listing.owner?.displayName ?? (listing.ownerId ? 'Team member' : 'Unassigned') },
              { label: 'Approved', value: listing.approvedAt ? `${listing.approvedAt.slice(0, 10)}${listing.reviewer ? ` · ${listing.reviewer.displayName ?? 'reviewer'}` : ''}` : '—' },
              { label: 'Activated', value: listing.activatedAt ? listing.activatedAt.slice(0, 10) : '—' },
            ]}
          />
        </div>
      </InversePanel>

      <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', margin: `${theme.space(3)}px 0` }} role="toolbar" aria-label={`${label} actions`}>
        {canSubmit && <LvButton theme={theme} variant="primary" onClick={() => void transition(model, 'IN_REVIEW', 'Submitted for review.')} busy={busy}>Submit for review</LvButton>}
        {canApprove && <LvButton theme={theme} variant="primary" onClick={() => void transition(model, 'READY', 'Approved.')} busy={busy}>Approve</LvButton>}
        {canActivate && model.readiness.status === 'READY' && <LvButton theme={theme} variant="gold" onClick={() => void transition(model, 'LIVE', `${label} activated.`)} busy={busy}>Activate</LvButton>}
        {capabilities.canChangeStatus && <LvButton theme={theme} onClick={() => setOpen({ kind: 'STATUS' })} ariaPressed={open?.kind === 'STATUS'}>Change status</LvButton>}
        {(capabilities.canChangeOwner || capabilities.canClaim) && <LvButton theme={theme} onClick={() => setOpen({ kind: 'OWNER' })} ariaPressed={open?.kind === 'OWNER'}>{capabilities.canChangeOwner ? 'Change owner' : `Claim ${label.toLowerCase()}`}</LvButton>}
        {partner && <LvButton theme={theme} variant="ghost" onClick={() => openRecord('lvPartner', partner.id)}>Open partner</LvButton>}
        {!capabilities.canEdit && <span role="status" style={{ ...theme.type.bodySmall, color: theme.color.textMuted, alignSelf: 'center' }}>You can view this {label.toLowerCase()}. Your role has no actions here.</span>}
      </div>

      {notice && (
        <div style={{ marginBottom: theme.space(3) }}>
          <InlineNotice theme={theme} tone={/refused|not ready|cannot|only an/i.test(notice) ? 'warning' : 'success'}>{notice}</InlineNotice>
        </div>
      )}

      {open?.kind === 'STATUS' && <div style={{ marginBottom: theme.space(3) }}><StatusForm theme={theme} kind={kind} id={listing.id} current={listing.status} options={model.settableStatuses} capabilities={capabilities} onDone={done} onCancel={() => setOpen(null)} /></div>}
      {open?.kind === 'OWNER' && <div style={{ marginBottom: theme.space(3) }}><OwnerForm theme={theme} kind={kind} id={listing.id} currentOwnerId={listing.ownerId} members={model.members} capabilities={capabilities} callerId={model.caller.workspaceMemberId} onDone={done} onCancel={() => setOpen(null)} /></div>}

      <div className="lv-sidebar-layout">
        <div style={{ display: 'grid', gap: theme.space(3) }}>
          <ReadinessPanel theme={theme} readiness={model.readiness} label={label.toLowerCase()} canActivate={canActivate} onActivate={() => void transition(model, 'LIVE', `${label} activated.`)} busy={busy} />

          <Section theme={theme} title="Overview">
            {listing.shortDescription && <p style={{ ...theme.type.body, margin: `0 0 ${theme.space(2)}px`, color: theme.color.heading }}>{listing.shortDescription}</p>}
            {listing.description ? <p style={{ ...theme.type.body, margin: `0 0 ${theme.space(3)}px`, color: theme.color.text, whiteSpace: 'pre-wrap' }}>{listing.description}</p> : <div style={{ marginBottom: theme.space(3) }}><EmptyState theme={theme} text="No description yet." /></div>}
            <Facts
              theme={theme}
              columns={3}
              items={kind === 'experience'
                ? [
                    { label: 'Duration', value: value(theme, listing.durationMinutes ? `${listing.durationMinutes} min` : null) },
                    { label: 'Participants', value: value(theme, listing.capacity ? `${listing.minParticipants ? `${listing.minParticipants}–` : 'up to '}${listing.capacity}` : null) },
                    { label: 'Difficulty', value: value(theme, listing.difficulty ? humanise(listing.difficulty) : null) },
                    { label: 'Languages', value: value(theme, listing.languages?.join(', ')) },
                    { label: 'Age requirement', value: value(theme, listing.ageRequirement) },
                    { label: 'Accessibility', value: value(theme, listing.accessibility) },
                    { label: 'Included', value: value(theme, listing.included?.join(', ')) },
                    { label: 'Not included', value: value(theme, listing.excluded?.join(', ')) },
                    { label: 'Requirements', value: value(theme, listing.requirements) },
                  ]
                : [
                    { label: 'Property type', value: value(theme, listing.propertyType ? humanise(listing.propertyType) : null) },
                    { label: 'Sleeps', value: value(theme, listing.capacity) },
                    { label: 'Rooms / units', value: value(theme, listing.rooms) },
                    { label: 'Amenities', value: value(theme, listing.amenities?.join(', ')) },
                    { label: 'Check-in', value: value(theme, listing.checkIn) },
                    { label: 'Check-out', value: value(theme, listing.checkOut) },
                  ]}
            />
          </Section>

          <Section theme={theme} title={kind === 'experience' ? 'Partner & host' : 'Partner & owner'}>
            <Facts
              theme={theme}
              columns={3}
              items={[
                { label: 'Partner', value: partner ? <button type="button" onClick={() => openRecord('lvPartner', partner.id)} style={{ background: 'none', border: 0, padding: 0, color: theme.color.brand, cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>{partner.name ?? 'Partner'}</button> : <span style={{ color: theme.color.danger }}>Not linked</span> },
                { label: 'Partner status', value: partner ? <LvStatusBadge theme={theme} kind="partner" value={partner.status} /> : '—' },
                { label: 'Partner owner', value: value(theme, partner?.owner?.displayName) },
                { label: kind === 'experience' ? 'Host / expert' : 'Manager / contact', value: model.host ? <button type="button" onClick={() => openRecord('person', model.host!.id)} style={{ background: 'none', border: 0, padding: 0, color: theme.color.brand, cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>{model.host.name ?? model.host.email ?? 'Person'}</button> : value(theme, listing.hostName) },
                { label: 'Contact email', value: value(theme, model.host?.email ?? partner?.emails?.primaryEmail) },
                { label: 'Contact phone', value: value(theme, model.host?.phone ?? partner?.phones?.primaryPhoneNumber) },
              ]}
            />
          </Section>

          <Section theme={theme} title="Location">
            <Facts theme={theme} columns={3} items={[{ label: 'Location', value: value(theme, listing.location) }, { label: 'Destination', value: value(theme, listing.destination) }, { label: kind === 'experience' ? 'Meeting point' : 'Address', value: value(theme, kind === 'experience' ? listing.meetingPoint : listing.address) }]} />
          </Section>

          <Section theme={theme} title="Pricing & availability">
            <div className="lv-two-col">
              <Facts theme={theme} items={[{ label: 'Base price', value: money(theme, listing.basePrice, listing.priceUnit) }, { label: 'Currency', value: value(theme, listing.basePrice?.currencyCode ?? null) }]} />
              {listing.availability ? <Facts theme={theme} items={[{ label: 'Available days', value: value(theme, Array.isArray(listing.availability.availableDays) ? (listing.availability.availableDays as string[]).join(', ') : null) }, { label: 'Notice needed', value: value(theme, listing.availability.noticePeriodHours ? `${listing.availability.noticePeriodHours} h` : null) }, { label: 'Seasonal notes', value: value(theme, listing.availability.seasonalNotes as string | null) }]} /> : <EmptyState theme={theme} text="No availability recorded." />}
            </div>
          </Section>

          <Section theme={theme} title="Policies">
            <Facts theme={theme} columns={kind === 'experience' ? 2 : 2} items={kind === 'experience' ? [{ label: 'Cancellation', value: value(theme, listing.cancellationPolicy) }, { label: 'Safety information', value: value(theme, listing.safetyInformation) }] : [{ label: 'Cancellation', value: value(theme, listing.cancellationPolicy) }, { label: 'House rules', value: value(theme, listing.houseRules) }]} />
          </Section>

          <Section theme={theme} title="Media" count={listing.images?.length ?? 0}>
            {!listing.images || listing.images.length === 0 ? <EmptyState theme={theme} text="No images attached. Add them on the Details tab (Images field)." /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: theme.space(2) }}>
                {listing.images.map((image) => (
                  <div key={image.fileId} style={{ aspectRatio: '4 / 3', maxWidth: '100%', borderRadius: theme.radius.sm, overflow: 'hidden', background: theme.color.surfaceSunken, border: `1px solid ${theme.color.border}` }}>
                    {image.url ? <img src={image.url} alt={image.label ?? 'Image'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div style={{ ...theme.type.caption, padding: theme.space(2), color: theme.color.textMuted }}>{image.label ?? 'Image'}</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <DocumentsPanel theme={theme} documents={model.documents} title="Verification (onboarding documents)" onOpen={(id) => openRecord('lvOnboardingDocument', id)} />
          {listing.documents && listing.documents.length > 0 && (
            <Section theme={theme} title={`${label} documents`} count={listing.documents.length}>
              <ul style={{ margin: 0, paddingLeft: 18, ...theme.type.bodySmall }}>
                {listing.documents.map((document) => (
                  <li key={document.fileId}>{document.label ?? document.fileId}</li>
                ))}
              </ul>
            </Section>
          )}

          <TimelinePanel theme={theme} entries={model.timeline} now={model.now} />
          <AuditPanel theme={theme} rows={model.audit} now={model.now} />
        </div>

        <div style={{ display: 'grid', gap: theme.space(3), alignContent: 'start' }}>
          <Section theme={theme} title="Approval">
            <Facts
              theme={theme}
              items={[
                { label: 'Status', value: <LvStatusBadge theme={theme} kind="listing" value={listing.status} /> },
                { label: 'Submitted', value: value(theme, listing.submittedAt?.slice(0, 10)) },
                { label: 'Reviewer', value: value(theme, listing.reviewer?.displayName ?? (listing.reviewerId ? 'Team member' : null)) },
                { label: 'Approved', value: value(theme, listing.approvedAt?.slice(0, 10)) },
              ]}
            />
            {listing.statusReason && <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(2)}px 0 0` }}>Reason: {listing.statusReason}</p>}
            <p style={{ ...theme.type.caption, color: theme.color.textSubtle, margin: `${theme.space(2)}px 0 0` }}>Approval and activation are human decisions; the owner of a record cannot approve their own work unless they are an administrator.</p>
          </Section>
          <ScoreCell theme={theme} label={kind === 'experience' ? 'Quality' : 'Quality'} score={model.quality} />
          <Section theme={theme} title="Booking readiness">
            <p style={{ ...theme.type.bodySmall, margin: 0, color: theme.color.text }}>{model.readiness.status === 'READY' ? (listing.status === 'LIVE' ? 'Active and bookable on paper: approved, priced, available, imaged and under an approved partner.' : 'Every requirement is met; activation makes it bookable.') : `Not bookable yet — ${model.readiness.reasons.length} requirement${model.readiness.reasons.length === 1 ? '' : 's'} missing (see Activation readiness).`}</p>
          </Section>
          <OnboardingPanel theme={theme} onboarding={model.onboarding} onOpen={(id) => openRecord('lvOnboarding', id)} />
        </div>
      </div>
      <p style={{ ...theme.type.caption, color: theme.color.textSubtle, margin: `${theme.space(3)}px 0 0` }}>{label} 360 · every action is decided again on the server, under your own permissions, and audited.</p>
    </LvPage>
  );
};
