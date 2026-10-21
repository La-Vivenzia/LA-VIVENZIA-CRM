import { useNavigate, useParams } from 'react-router-dom';

import { listingPath, useOrganisation, type DirectoryPerson, type LinkedListing, type LinkedPartner } from 'src/api/directory';
import { LvIcon } from 'src/design/icons';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LvAvatar, LvBadge, LvButton, LvIconTile } from 'src/design/kit';
import { LvPageHeader, LvRecordHeader } from 'src/design/page';
import { LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// 13.4 — one organisation: its people and its listings.
//
// The listings are reached through the partners this company is the
// organisation for, which is the only path the data has: a company does not
// own an experience or a property directly.

const STATUS_TONE = (status: string | null): 'success' | 'warning' | 'info' | 'neutral' =>
  status === 'ACTIVE' || status === 'APPROVED' ? 'success' : status === 'SUSPENDED' || status === 'PAUSED' ? 'warning' : status === 'PROSPECTIVE' ? 'info' : 'neutral';

const sentence = (value: string | null): string => (value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—');

export const OrganisationScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const { data, loading, error, forbidden, reload } = useOrganisation(companyId);

  const header = (
    <LvPageHeader
      theme={theme}
      variant="panel"
      title={data?.organisation.name ?? 'Organisation'}
      subtitle="One business, its people and its listings."
      onBack={() => navigate('/directory/organisations')}
      backLabel="Back to organisations"
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState theme={theme} rows={5} label="Loading this organisation" />
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        {header}
        <ForbiddenState theme={theme} text={error ?? 'Your role cannot read this organisation.'} />
      </>
    );
  }

  if (error !== null || data === null) {
    return (
      <>
        {header}
        <ErrorState theme={theme} title="This organisation could not be loaded" text={error ?? 'Unknown error.'} onRetry={reload} />
      </>
    );
  }

  const { organisation, people, partners, listings } = data;

  return (
    <>
      {header}

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
        <LvRecordHeader
          theme={theme}
          name={organisation.name}
          meta={[
            ...(organisation.city ? [{ icon: 'location' as const, text: organisation.city }] : []),
            ...(organisation.website ? [{ icon: 'website' as const, text: organisation.website }] : []),
          ]}
          facts={[
            { key: 'people', label: 'People', value: String(people.length) },
            { key: 'partners', label: 'Partners', value: String(partners.length) },
            { key: 'listings', label: 'Listings', value: String(listings.length) },
            { key: 'employees', label: 'Employees', value: organisation.employees === null ? '—' : String(organisation.employees) },
          ]}
          actions={
            organisation.website ? (
              <LvButton theme={theme} variant="secondary" size="sm" href={organisation.website} target="_blank" icon={<LvIcon name="website" size={16} />}>
                Visit the site
              </LvButton>
            ) : undefined
          }
        />

        <div className="lv-ops-grid" style={{ display: 'grid', gap: theme.space(4) }}>
          <LvSectionCard theme={theme} title="People here" icon="leads">
            {people.length === 0 ? (
              <EmptyState theme={theme} quiet text="No contact is recorded against this organisation." />
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                {people.map((person: DirectoryPerson) => (
                  <li key={person.id} className="lv-action-row" style={{ listStyle: 'none', padding: `${theme.space(3)}px 0`, display: 'flex', alignItems: 'center', gap: theme.space(3) }}>
                    <LvAvatar theme={theme} name={person.name} src={person.avatarUrl} size={36} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => navigate(`/directory/people/${person.id}`)}
                        className="lv-text-button"
                        style={{ ...theme.type.body, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: theme.color.heading, fontFamily: theme.font.body, cursor: 'pointer', overflowWrap: 'anywhere' }}
                      >
                        {person.name}
                      </button>
                      <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle, overflowWrap: 'anywhere' }}>
                        {[person.jobTitle, person.email].filter(Boolean).join(' · ') || 'No role or email recorded'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </LvSectionCard>

          <LvSectionCard theme={theme} title="Partners" icon="partner">
            {partners.length === 0 ? (
              <EmptyState theme={theme} quiet text="This organisation is not named on any partner." />
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
                      <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle }}>{partner.code ?? '—'}</span>
                    </span>
                    <LvBadge theme={theme} tone={STATUS_TONE(partner.status)}>{sentence(partner.status)}</LvBadge>
                  </li>
                ))}
              </ul>
            )}
          </LvSectionCard>
        </div>

        <LvSectionCard theme={theme} title="What they offer" icon="property">
          {listings.length === 0 ? (
            <EmptyState theme={theme} quiet text="No experience or property is listed under this organisation's partners." />
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
    </>
  );
};
