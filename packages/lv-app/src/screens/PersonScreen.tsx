import { useNavigate, useParams } from 'react-router-dom';

import { listingPath, usePerson, type LinkedListing, type LinkedPartner, type PersonInteraction } from 'src/api/directory';
import { CHANNEL_LABELS } from 'src/api/messages';
import { channelIcon, LvIcon } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  formatWhen,
  InlineNotice,
  LoadingState,
  LvBadge,
  LvButton,
  LvIconTile,
} from 'src/design/kit';
import { LvPageHeader, LvRecordHeader } from 'src/design/page';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// 13.2 — one person: their partners, their listings and the conversations.
//
// "Their leads" is reached the only way the data allows — a person is the
// contact *on a partner*, and that partner may have come from a lead. The
// screen says so rather than implying a direct link that does not exist, and
// the interactions shown are the ones logged against those leads.

const STATUS_TONE = (status: string | null): 'success' | 'warning' | 'info' | 'neutral' =>
  status === 'ACTIVE' || status === 'APPROVED' ? 'success' : status === 'SUSPENDED' || status === 'PAUSED' ? 'warning' : status === 'PROSPECTIVE' ? 'info' : 'neutral';

const sentence = (value: string | null): string => (value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—');

export const PersonScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { personId } = useParams();
  const { data, loading, error, forbidden, reload } = usePerson(personId);
  const now = new Date().toISOString();

  const header = (
    <LvPageHeader
      theme={theme}
      variant="panel"
      title={data?.person.name ?? 'Person'}
      subtitle="One contact, and everything the ecosystem links to them."
      onBack={() => navigate('/directory/people')}
      backLabel="Back to people"
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState theme={theme} rows={5} label="Loading this person" />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        {header}
        <ForbiddenState theme={theme} text={error ?? 'Your role cannot read this person.'} />
      </>
    );
  }

  if (error !== null || data === null) {
    return (
      <>
        {header}
        <ErrorState theme={theme} title="This person could not be loaded" text={error ?? 'Unknown error.'} onRetry={reload} />
      </>
    );
  }

  const { person, partners, listings, interactions } = data;

  return (
    <>
      {header}

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        <LvRecordHeader
          theme={theme}
          name={person.name}
          imageUrl={person.avatarUrl}
          // A job title is free text, so it belongs in the meta line, which
          // wraps. `typeLabel` renders an LvBadge, and a badge is nowrap by
          // design — a long title there pushed the page 49px past a 320 screen.
          meta={[
            ...(person.jobTitle ? [{ icon: 'person' as const, text: person.jobTitle }] : []),
            ...(person.city ? [{ icon: 'location' as const, text: person.city }] : []),
            ...(person.companyName ? [{ icon: 'organisation' as const, text: person.companyName }] : []),
          ]}
          facts={[
            { key: 'email', label: 'Email', value: person.email ?? '—' },
            { key: 'phone', label: 'Phone', value: person.phone ?? '—' },
            { key: 'partners', label: 'Partners', value: String(partners.length) },
            { key: 'listings', label: 'Listings', value: String(listings.length) },
          ]}
          actions={
            person.companyId ? (
              <LvButton theme={theme} variant="secondary" size="sm" onClick={() => navigate(`/directory/organisations/${person.companyId}`)} icon={<LvIcon name="organisation" size={16} />}>
                Open the organisation
              </LvButton>
            ) : undefined
          }
        />

        <div className="lv-ops-grid" style={{ display: 'grid', gap: theme.space(4) }}>
          <LvSectionCard theme={theme} title="Partners they are the contact for" icon="partner">
            {partners.length === 0 ? (
              <EmptyState theme={theme} quiet text="This person is not named as the contact on any partner." />
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                {partners.map((partner: LinkedPartner) => (
                  <li key={partner.id} className="lv-action-row" style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'center', gap: theme.space(3) }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => navigate(`/ecosystem/partners/${partner.id}`)}
                        className="lv-text-button"
                        style={{ ...theme.type.body, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: theme.color.heading, fontFamily: theme.font.body, cursor: 'pointer', overflowWrap: 'anywhere' }}
                      >
                        {partner.name}
                      </button>
                      <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle }}>
                        {[partner.code, partner.leadRef ? `from ${partner.leadRef}` : null].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <LvBadge theme={theme} tone={STATUS_TONE(partner.status)}>{sentence(partner.status)}</LvBadge>
                  </li>
                ))}
              </ul>
            )}
          </LvSectionCard>

          <LvSectionCard theme={theme} title="Experiences and properties" icon="property">
            {listings.length === 0 ? (
              <EmptyState theme={theme} quiet text="This person is not the host or manager of any listing." />
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                {listings.map((listing: LinkedListing) => (
                  <li key={`${listing.kind}-${listing.id}`} className="lv-action-row" style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'center', gap: theme.space(3) }}>
                    <LvIconTile theme={theme} icon={listing.kind === 'experience' ? 'experience' : 'property'} tint={listing.kind === 'experience' ? 'peach' : 'mint'} size={36} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => navigate(listingPath(listing))}
                        className="lv-text-button"
                        style={{ ...theme.type.body, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: theme.color.heading, fontFamily: theme.font.body, cursor: 'pointer', overflowWrap: 'anywhere' }}
                      >
                        {listing.name}
                      </button>
                      <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle }}>
                        {listing.kind === 'experience' ? 'Experience' : 'Property'} · {sentence(listing.status)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </LvSectionCard>
        </div>

        <LvSectionCard theme={theme} title="Conversations on their relationships" icon="messages">
          {interactions.length === 0 ? (
            <EmptyState
              theme={theme}
              quiet
              text={
                partners.length === 0
                  ? 'No partner links to this person, so there is no conversation to show.'
                  : 'Nothing has been logged on the leads behind these partners yet.'
              }
            />
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
              {interactions.map((entry: PersonInteraction) => (
                <li key={entry.id} className="lv-action-row" style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'flex-start', gap: theme.space(3) }}>
                  <LvIconTile theme={theme} icon={channelIcon(entry.channel)} tint={entry.direction === 'INBOUND' ? 'blue' : 'mint'} size={36} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>
                      {CHANNEL_LABELS[entry.channel] ?? entry.channel} · {entry.direction === 'INBOUND' ? 'from them' : 'from us'}
                      {entry.leadName ? ` · ${entry.leadName}` : ''}
                    </span>
                    {entry.summary && <span style={{ display: 'block', ...theme.type.body, color: theme.color.text, overflowWrap: 'anywhere' }}>{entry.summary}</span>}
                  </span>
                  <span style={{ ...theme.type.caption, color: theme.color.textSubtle, flex: '0 0 auto', whiteSpace: 'nowrap' }}>{formatWhen(entry.occurredAt, now)}</span>
                </li>
              ))}
            </ul>
          )}

          <InlineNotice theme={theme}>
            A conversation belongs to a lead, not to a contact. These are the conversations on the leads behind the partners above.
          </InlineNotice>
        </LvSectionCard>
      </div>
    </>
  );
};
