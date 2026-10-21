import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { matchesOrganisation, useOrganisations, type DirectoryOrganisation } from 'src/api/directory';
import { LvIcon } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  InlineNotice,
  LoadingState,
  LvButton,
  LvCard,
  LvSearchField,
  LvTable,
} from 'src/design/kit';
import { LvPageHeader } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';
import { DirectoryNav } from 'src/screens/PeopleScreen';

// 13.3 — the organisations list: the partner businesses.
//
// Twenty's `company` records, linked in through `lvPartner.organisation`. A
// company row can exist before it is named — Twenty creates it that way — and
// an unnamed row is shown as unnamed rather than hidden or given an invented
// name from its domain.

export const OrganisationsScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { data, loading, error, forbidden, reload } = useOrganisations();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => (data?.organisations ?? []).filter((organisation) => matchesOrganisation(organisation, query)), [data, query]);
  const unnamed = (data?.organisations ?? []).filter((organisation) => organisation.name === 'Unnamed organisation').length;

  const header = (
    <LvPageHeader
      theme={theme}
      variant="panel"
      title="Organisations"
      subtitle="The businesses behind the partners."
      onBack={() => navigate('/ecosystem/partners')}
      backLabel="Back to the ecosystem"
      actions={
        <LvButton theme={theme} variant="secondary" size="sm" onClick={reload} icon={<LvIcon name="clock" size={16} />}>
          Refresh
        </LvButton>
      }
    />
  );

  if (forbidden) {
    return (
      <>
        {header}
        <DirectoryNav theme={theme} value="organisations" />
        <ForbiddenState theme={theme} text={error ?? 'Your role cannot read organisations.'} />
      </>
    );
  }

  return (
    <>
      {header}
      <DirectoryNav theme={theme} value="organisations" />

      <LvCard theme={theme}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <LvSearchField theme={theme} label="Search organisations" placeholder="Name, website or city" value={query} onChange={setQuery} />

          {loading ? (
            <LoadingState theme={theme} rows={4} label="Loading organisations" />
          ) : error !== null ? (
            <ErrorState theme={theme} title="Organisations could not be loaded" text={error} onRetry={reload} />
          ) : (data?.organisations ?? []).length === 0 ? (
            <EmptyState
              theme={theme}
              icon="organisation"
              tint="lavender"
              title="No organisations recorded yet"
              text="A business appears here once it is named as a partner's organisation."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              theme={theme}
              icon="filter"
              tint="blue"
              title="Nothing matches that search"
              text="The organisations exist — this search just does not match them."
              action={
                <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Show everything
                </LvButton>
              }
            />
          ) : (
            <LvTable
              theme={theme}
              caption="Organisations"
              rowKey={(organisation: DirectoryOrganisation) => organisation.id}
              rows={visible}
              columns={[
                {
                  key: 'name',
                  label: 'Organisation',
                  render: (organisation: DirectoryOrganisation) => (
                    <button
                      type="button"
                      onClick={() => navigate(`/directory/organisations/${organisation.id}`)}
                      className="lv-text-button"
                      style={{ ...theme.type.subheading, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: theme.color.heading, fontFamily: theme.font.body, cursor: 'pointer', overflowWrap: 'anywhere' }}
                    >
                      {organisation.name}
                      {organisation.website && <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle, fontWeight: theme.font.weight.regular }}>{organisation.website}</span>}
                    </button>
                  ),
                },
                {
                  key: 'where',
                  label: 'Where',
                  render: (organisation: DirectoryOrganisation) => (
                    <span style={{ ...theme.type.bodySmall, color: organisation.city || organisation.region ? theme.color.text : theme.color.textSubtle, overflowWrap: 'anywhere' }}>
                      {[organisation.city, organisation.region].filter(Boolean).join(' · ') || '—'}
                    </span>
                  ),
                },
                {
                  key: 'people',
                  label: 'People',
                  align: 'right',
                  render: (organisation: DirectoryOrganisation) => (
                    <span style={{ ...theme.type.body, color: organisation.peopleCount > 0 ? theme.color.heading : theme.color.textSubtle }}>{organisation.peopleCount}</span>
                  ),
                },
                {
                  key: 'partners',
                  label: 'Partners',
                  align: 'right',
                  render: (organisation: DirectoryOrganisation) => (
                    <span style={{ ...theme.type.body, color: organisation.partnerCount > 0 ? theme.color.heading : theme.color.textSubtle }}>{organisation.partnerCount}</span>
                  ),
                },
              ]}
            />
          )}

          {!loading && error === null && (data?.organisations ?? []).length > 0 && (
            <InlineNotice theme={theme}>
              Showing {visible.length} of {data?.total ?? (data?.organisations ?? []).length} organisations you can read.
              {unnamed > 0 ? ` ${unnamed} ${unnamed === 1 ? 'has' : 'have'} no name recorded yet.` : ''}
            </InlineNotice>
          )}
        </div>
      </LvCard>
    </>
  );
};
