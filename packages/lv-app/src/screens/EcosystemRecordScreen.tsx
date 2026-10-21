import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  formatMoney,
  humanise,
  isPartner360,
  kindFromPath,
  KIND_LABELS,
  statusLabel,
  useEcosystemRecord,
  type EcosystemKind,
  type Listing360,
  type ListingKind,
  type Partner360,
} from 'src/api/ecosystem';
import { LvIcon, type LvIconName } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  formatWhen,
  InlineNotice,
  isForbiddenMessage,
  LoadingState,
  LvBadge,
  LvButton,
  LvCard,
  LvTabs,
  VisuallyHidden,
} from 'src/design/kit';
import { LvContextualActions, LvPageHeader, LvRecordHeader, type LvFact } from 'src/design/page';
import { LvSectionCard, LvTimeline, type LvTimelineEntry } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { CreateListingSheet } from 'src/screens/ecosystem/create';
import { describeCapabilities, EcosystemStatus, LvConnections, LvDocumentSummary, LvListings, LvReadinessPanel } from 'src/screens/ecosystem/parts';
import { EcosystemTransitionSheet } from 'src/screens/ecosystem/transition';

// 8.2 Partner 360, 8.4 Property 360, 8.6 Experience 360 — with 8.7 activation
// readiness as a section of each and 8.8 the transition over all of them.
//
// One screen for three kinds, because the server composes all three the same
// way: a record, what it is connected to, whether it can go live, and what
// has happened to it. A partner additionally has listings; a listing
// additionally has the partner it belongs to. Everything else is shared.

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'readiness', label: 'Readiness' },
  { key: 'connections', label: 'Connections' },
  { key: 'activity', label: 'Activity' },
] as const;

type Section = (typeof SECTIONS)[number]['key'];

const KIND_ICON: Record<EcosystemKind, LvIconName> = { partner: 'partner', property: 'property', experience: 'experience' };

const Facts = ({ theme, facts }: { theme: LvTheme; facts: { label: string; value: string | null }[] }) => (
  <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.space(3), margin: 0 }}>
    {facts
      .filter((fact) => fact.value !== null && fact.value !== '')
      .map((fact) => (
        <div key={fact.label} style={{ minWidth: 0 }}>
          <dt style={{ ...theme.type.caption, color: theme.color.textMuted }}>{fact.label}</dt>
          <dd style={{ ...theme.type.body, color: theme.color.heading, margin: 0, overflowWrap: 'anywhere' }}>{fact.value}</dd>
        </div>
      ))}
  </dl>
);

export const EcosystemRecordScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { kind: kindParam, id, section } = useParams<{ kind: string; id: string; section?: string }>();
  const kind = kindFromPath(kindParam);
  const { model, error, reload } = useEcosystemRecord(kind, id);
  const [moving, setMoving] = useState(false);
  // Which listing the person is adding to this partner, if any.
  const [adding, setAdding] = useState<ListingKind | null>(null);

  const active: Section = SECTIONS.some((entry) => entry.key === section) ? (section as Section) : 'overview';
  const go = (next: Section) => navigate(`/ecosystem/${kindParam}/${id}/${next}`, { replace: true });
  const back = () => navigate(`/ecosystem/${kindParam ?? 'partners'}`);

  if (kind === null) {
    return (
      <>
        <LvPageHeader theme={theme} variant="panel" title="Ecosystem" onBack={() => navigate('/ecosystem')} backLabel="Back to the ecosystem" />
        <EmptyState theme={theme} icon="info" tint="blue" title="Not an ecosystem record" text="That address does not name a partner, a property or an experience." />
      </>
    );
  }

  if (error !== null && model === null) {
    return (
      <>
        <LvPageHeader theme={theme} variant="panel" title={KIND_LABELS[kind].one} onBack={back} backLabel={`Back to ${KIND_LABELS[kind].many.toLowerCase()}`} />
        <ErrorState
          theme={theme}
          title={isForbiddenMessage(error) ? `Your role cannot open this ${KIND_LABELS[kind].one.toLowerCase()}` : 'That record could not be opened'}
          text={error}
          onRetry={isForbiddenMessage(error) ? undefined : () => void reload()}
        />
      </>
    );
  }

  if (model === null) {
    return (
      <>
        <LvPageHeader theme={theme} variant="panel" title={KIND_LABELS[kind].one} onBack={back} backLabel={`Back to ${KIND_LABELS[kind].many.toLowerCase()}`} />
        <LoadingState theme={theme} rows={4} label={`Loading the ${KIND_LABELS[kind].one.toLowerCase()}`} />
      </>
    );
  }

  const partnerModel = isPartner360(model) ? (model as Partner360) : null;
  const listingModel = partnerModel === null ? (model as Listing360) : null;
  const record = partnerModel ? partnerModel.partner : listingModel!.listing;
  const now = model.now;
  const name = (record.name as string | null) ?? 'Unnamed';
  const status = record.status as string | null;
  const owner = record.owner;
  const notes = describeCapabilities(model.capabilities);

  const headerFacts: LvFact[] = [
    { key: 'status', label: 'Status', value: statusLabel(kind, status) },
    { key: 'readiness', label: 'Readiness', value: model.readiness.status === 'READY' ? 'Ready' : `${model.readiness.reasons.length} blocking` },
    { key: 'owner', label: 'Owner', value: owner?.displayName ?? 'Nobody yet' },
    ...(partnerModel
      ? [{ key: 'listings', label: 'Listings', value: `${partnerModel.properties.length + partnerModel.experiences.length}` }]
      : [{ key: 'partner', label: 'Partner', value: listingModel!.partner?.name ?? 'Not linked' }]),
  ];

  const timeline: LvTimelineEntry[] = model.timeline.map((entry) => ({
    id: entry.id,
    at: entry.at,
    title: entry.title,
    detail: entry.detail,
    tone: entry.tone,
    kind: entry.kind,
  }));

  return (
    <>
      <LvPageHeader
        theme={theme}
        variant="panel"
        title={name}
        onBack={back}
        backLabel={`Back to ${KIND_LABELS[kind].many.toLowerCase()}`}
        actions={
          <>
            {partnerModel?.lead && (
              <LvButton theme={theme} variant="ghost" onClick={() => navigate(`/leads/${partnerModel.lead!.id}`)} icon={<LvIcon name="leads" size={16} />}>
                Open the lead
              </LvButton>
            )}
            <LvButton theme={theme} variant="secondary" onClick={() => void reload()}>
              Refresh
            </LvButton>
          </>
        }
      />

      <LvRecordHeader
        theme={theme}
        name={name}
        typeLabel={humanise((record.partnerType as string | null) ?? (record.category as string | null)) ?? KIND_LABELS[kind].one}
        meta={record.location ? [{ icon: 'location' as const, text: record.location as string }] : undefined}
        facts={headerFacts}
      />

      <LvCard theme={theme} padding={4}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2) }}>
          <EcosystemStatus theme={theme} kind={kind} status={status} />
          {model.readiness.status === 'READY' ? (
            <LvBadge theme={theme} tone="success">Ready to go live</LvBadge>
          ) : (
            <LvBadge theme={theme} tone="warning">{model.readiness.reasons.length} blocking activation</LvBadge>
          )}
          {model.capabilities.isOwner && <LvBadge theme={theme} tone="neutral">You own this</LvBadge>}
          {(record.statusReason as string | null) && (
            <span style={{ flex: '1 0 100%', ...theme.type.bodySmall, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>
              {record.statusReason as string}
            </span>
          )}
        </div>
      </LvCard>

      {/* What this person may not do, said once rather than by silently
          missing buttons. */}
      {notes.length > 0 && (
        <InlineNotice theme={theme}>
          {notes.join(' ')}
        </InlineNotice>
      )}

      {error !== null && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}

      <LvTabs
        theme={theme}
        label={`${KIND_LABELS[kind].one} sections`}
        value={active}
        onChange={(next) => go(next as Section)}
        tabs={SECTIONS.map((entry) => ({
          key: entry.key,
          label: entry.label,
          count: entry.key === 'readiness' && model.readiness.status === 'NOT_READY' ? model.readiness.reasons.length : undefined,
        }))}
      />

      {active === 'overview' && (
        <>
          <LvSectionCard theme={theme} title={`About this ${KIND_LABELS[kind].one.toLowerCase()}`} icon={KIND_ICON[kind]}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
              {(record.description as string | null) && (
                <p style={{ ...theme.type.body, color: theme.color.text, margin: 0, whiteSpace: 'pre-wrap' }}>{record.description as string}</p>
              )}
              <Facts
                theme={theme}
                facts={
                  partnerModel
                    ? [
                        { label: 'Code', value: partnerModel.partner.partnerCode },
                        { label: 'Category', value: humanise(partnerModel.partner.category) },
                        { label: 'Subcategory', value: humanise(partnerModel.partner.subcategory) },
                        { label: 'Location', value: partnerModel.partner.location },
                        { label: 'Email', value: partnerModel.partner.emails?.primaryEmail ?? null },
                        { label: 'Phone', value: partnerModel.partner.phones?.primaryPhoneNumber ?? null },
                        { label: 'Website', value: partnerModel.partner.website?.primaryLinkUrl ?? null },
                        { label: 'Instagram', value: partnerModel.partner.instagram?.primaryLinkUrl ?? null },
                        { label: 'Languages', value: (partnerModel.partner.languages ?? []).join(', ') || null },
                        { label: 'Approved', value: partnerModel.partner.approvedAt ? formatWhen(partnerModel.partner.approvedAt, now) : null },
                        { label: 'Live since', value: partnerModel.partner.activatedAt ? formatWhen(partnerModel.partner.activatedAt, now) : null },
                      ]
                    : [
                        { label: 'Code', value: (record.propertyCode as string | null) ?? (record.experienceCode as string | null) ?? null },
                        { label: 'Destination', value: listingModel!.listing.destination },
                        { label: 'Location', value: listingModel!.listing.location },
                        { label: 'Guests', value: listingModel!.listing.capacity === null ? null : String(listingModel!.listing.capacity) },
                        { label: 'From', value: formatMoney(listingModel!.listing.basePrice, listingModel!.listing.priceUnit) },
                        { label: 'Host', value: listingModel!.host?.name ?? null },
                        { label: 'Reviewer', value: listingModel!.listing.reviewer?.displayName ?? null },
                        { label: 'Quality', value: listingModel!.quality.value === null ? null : `${listingModel!.quality.value}` },
                      ]
                }
              />
              {listingModel && listingModel.quality.value === null && (
                <p style={{ ...theme.type.caption, color: theme.color.textMuted, margin: 0 }}>{listingModel.quality.reason}</p>
              )}
            </div>
          </LvSectionCard>

          <LvReadinessPanel theme={theme} kind={kind} readiness={model.readiness} onFix={() => go('connections')} />

          {partnerModel && (
            <>
              {/* A listing is created against a partner, so this is where it
                  is offered. `canCreateListing` is the server's own answer —
                  it is only computed for a partner, and only for a caller
                  whose role may write the listing objects. */}
              <LvListings
                theme={theme}
                title="Properties"
                kind="property"
                listings={partnerModel.properties}
                onOpen={(listingId) => navigate(`/ecosystem/properties/${listingId}`)}
                emptyText="This partner has no properties on the platform."
                action={
                  model.capabilities.canCreateListing ? (
                    <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setAdding('property')} icon={<LvIcon name="plus" size={16} />}>
                      Add a property
                    </LvButton>
                  ) : undefined
                }
              />
              <LvListings
                theme={theme}
                title="Experiences"
                kind="experience"
                listings={partnerModel.experiences}
                onOpen={(listingId) => navigate(`/ecosystem/experiences/${listingId}`)}
                emptyText="This partner has no experiences on the platform."
                action={
                  model.capabilities.canCreateListing ? (
                    <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setAdding('experience')} icon={<LvIcon name="plus" size={16} />}>
                      Add an experience
                    </LvButton>
                  ) : undefined
                }
              />
            </>
          )}
        </>
      )}

      {active === 'readiness' && (
        <>
          <LvReadinessPanel theme={theme} kind={kind} readiness={model.readiness} onFix={() => go('connections')} />
          <LvDocumentSummary
            theme={theme}
            documents={model.documents}
            onOpenOnboarding={model.onboarding ? () => navigate(`/onboarding/${model.onboarding!.id}/documents`) : undefined}
          />
        </>
      )}

      {active === 'connections' && (
        <>
          <LvConnections
            theme={theme}
            items={[
              ...(partnerModel?.contact
                ? [
                    {
                      key: 'contact',
                      icon: 'person' as const,
                      label: partnerModel.contact.name ?? 'Primary contact',
                      detail: [partnerModel.contact.email, partnerModel.contact.phone].filter(Boolean).join(' · ') || 'Primary contact',
                    },
                  ]
                : []),
              ...(partnerModel?.organisation
                ? [
                    {
                      key: 'organisation',
                      icon: 'organisation' as const,
                      label: partnerModel.organisation.name ?? 'Organisation',
                      detail: [partnerModel.organisation.domain, partnerModel.organisation.city].filter(Boolean).join(' · ') || 'Organisation',
                    },
                  ]
                : []),
              ...(partnerModel?.lead
                ? [
                    {
                      key: 'lead',
                      icon: 'leads' as const,
                      label: partnerModel.lead.name ?? 'Lead',
                      detail: [partnerModel.lead.lvLeadId, partnerModel.lead.status].filter(Boolean).join(' · ') || 'The lead this came from',
                      onOpen: () => navigate(`/leads/${partnerModel.lead!.id}`),
                    },
                  ]
                : []),
              ...(listingModel?.partner
                ? [
                    {
                      key: 'partner',
                      icon: 'partner' as const,
                      label: listingModel.partner.name ?? 'Partner',
                      detail: [listingModel.partner.partnerCode, listingModel.partner.statusLabel].filter(Boolean).join(' · '),
                      onOpen: () => navigate(`/ecosystem/partners/${listingModel.partner!.id}`),
                    },
                  ]
                : []),
              ...(listingModel?.host
                ? [
                    {
                      key: 'host',
                      icon: 'person' as const,
                      label: listingModel.host.name ?? 'Host',
                      detail: [listingModel.host.email, listingModel.host.phone].filter(Boolean).join(' · ') || 'Host',
                    },
                  ]
                : []),
              ...(model.onboarding
                ? [
                    {
                      key: 'onboarding',
                      icon: 'onboarding' as const,
                      label: 'Onboarding',
                      detail: `${model.onboarding.status ?? 'In progress'}${model.onboarding.progressPercentage === null ? '' : ` · ${model.onboarding.progressPercentage}% of the form`}`,
                      onOpen: () => navigate(`/onboarding/${model.onboarding!.id}`),
                    },
                  ]
                : []),
              ...(owner
                ? [{ key: 'owner', icon: 'person' as const, label: owner.displayName ?? 'Owner', detail: owner.email ?? 'Owns this record' }]
                : []),
            ]}
          />

          <LvDocumentSummary
            theme={theme}
            documents={model.documents}
            onOpenOnboarding={model.onboarding ? () => navigate(`/onboarding/${model.onboarding!.id}/documents`) : undefined}
          />

          {partnerModel && (
            <LvSectionCard theme={theme} title={`Open work (${partnerModel.tasks.length})`} icon="task">
              {partnerModel.tasks.length === 0 ? (
                <EmptyState theme={theme} icon="check" tint="mint" text="Nothing is outstanding against this partner." />
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), margin: 0, padding: 0, listStyle: 'none' }}>
                  {partnerModel.tasks.map((task) => (
                    <li key={task.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2), paddingBottom: theme.space(2), borderBottom: `1px solid ${theme.color.border}` }}>
                      <span style={{ ...theme.type.bodySmall, color: theme.color.heading, flex: '1 1 160px', minWidth: 0, overflowWrap: 'anywhere' }}>
                        {task.title ?? 'Task'}
                      </span>
                      {task.dueAt && <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>Due {formatWhen(task.dueAt, now)}</span>}
                      {task.assignee?.displayName && <LvBadge theme={theme} tone="neutral">{task.assignee.displayName}</LvBadge>}
                    </li>
                  ))}
                </ul>
              )}
            </LvSectionCard>
          )}
        </>
      )}

      {active === 'activity' && (
        <>
          <LvSectionCard theme={theme} title="What has happened" icon="clock">
            {timeline.length === 0 ? (
              <EmptyState theme={theme} icon="clock" tint="blue" text="Nothing has been recorded against this record yet." />
            ) : (
              <LvTimeline theme={theme} entries={timeline} formatWhen={(iso) => formatWhen(iso, now)} />
            )}
          </LvSectionCard>

          {partnerModel && partnerModel.interactions.length > 0 && (
            <LvSectionCard theme={theme} title={`Conversations (${partnerModel.interactions.length})`} icon="messages">
              <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
                {partnerModel.interactions.map((interaction) => (
                  <li key={interaction.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ ...theme.type.caption, color: theme.color.textMuted }}>
                      {[interaction.channel, interaction.occurredAt ? formatWhen(interaction.occurredAt, now) : null, interaction.actor?.displayName]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span style={{ ...theme.type.bodySmall, color: theme.color.text, overflowWrap: 'anywhere' }}>{interaction.summary ?? 'No summary recorded.'}</span>
                  </li>
                ))}
              </ul>
            </LvSectionCard>
          )}

          <LvSectionCard theme={theme} title={`Governance (${model.audit.length})`} icon="settings">
            {model.audit.length === 0 ? (
              <EmptyState theme={theme} icon="settings" tint="blue" text="No governed decision has been recorded against this record." />
            ) : (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), margin: 0, padding: 0, listStyle: 'none' }}>
                {model.audit.map((row) => (
                  <li key={row.id} style={{ display: 'flex', gap: theme.space(3) }}>
                    <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', flex: '0 0 auto', marginTop: 2 }}>
                      <LvIcon name={row.outcome === 'REFUSED' ? 'warning' : 'check'} size={15} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.heading }}>
                        {row.action}
                        {row.outcome ? ` · ${row.outcome}` : ''}
                      </span>
                      <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>
                        {[row.at ? formatWhen(row.at, now) : null, row.actor?.displayName].filter(Boolean).join(' · ')}
                      </span>
                      {row.reason && (
                        <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.text, marginTop: 2, overflowWrap: 'anywhere' }}>{row.reason}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </LvSectionCard>
        </>
      )}

      {/* The one action that moves this record on. Offered only when the
          server says this person may change its status and something is
          actually on offer. */}
      {model.capabilities.canChangeStatus && model.settableStatuses.length > 0 && (
        <LvContextualActions theme={theme}>
          <LvButton theme={theme} variant="primary" onClick={() => setMoving(true)}>
            Change status
          </LvButton>
        </LvContextualActions>
      )}

      {moving && (
        <EcosystemTransitionSheet
          theme={theme}
          kind={kind}
          id={record.id as string}
          name={name}
          currentStatus={status}
          statuses={model.settableStatuses}
          capabilities={model.capabilities}
          readiness={model.readiness}
          onClose={() => setMoving(false)}
          onDone={() => void reload()}
        />
      )}

      {adding !== null && partnerModel && (
        <CreateListingSheet
          theme={theme}
          kind={adding}
          partnerId={record.id as string}
          partnerName={name}
          partnerLocation={(record.location as string | null) ?? null}
          onClose={() => setAdding(null)}
          // Straight to the record that was just created: it is a draft with
          // a code, and the next thing anyone does is fill it in.
          onCreated={(created) => navigate(`/ecosystem/${created.kind === 'experience' ? 'experiences' : 'properties'}/${created.id}`)}
        />
      )}

      <VisuallyHidden>{`${name} is ${statusLabel(kind, status)}.`}</VisuallyHidden>
    </>
  );
};
