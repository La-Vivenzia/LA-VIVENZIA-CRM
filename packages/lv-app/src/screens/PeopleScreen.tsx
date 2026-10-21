import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { matchesPerson, usePeople, type DirectoryPerson } from 'src/api/directory';
import { LvIcon } from 'src/design/icons';
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  InlineNotice,
  LoadingState,
  LvAvatar,
  LvButton,
  LvCard,
  LvSearchField,
  LvTable,
} from 'src/design/kit';
import { LvPageHeader, LvSectionNav } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';

// 13.1 — the people list: the contacts behind the relationships.
//
// A person is linked into La Vivenzia through a partner (`lvPartner.contact`),
// an experience host or a property manager. There is no link from a lead,
// because in this product a lead already *is* the person or organisation it
// names — so this list is the ecosystem's address book, not a second copy of
// My Leads.

export const DIRECTORY_SECTIONS = [
  { key: 'people', label: 'People', path: '/directory/people' },
  { key: 'organisations', label: 'Organisations', path: '/directory/organisations' },
] as const;

export const DirectoryNav = ({ theme, value }: { theme: LvTheme; value: 'people' | 'organisations' }) => {
  const navigate = useNavigate();

  return (
    <LvSectionNav
      theme={theme}
      label="Directory"
      value={value}
      sections={DIRECTORY_SECTIONS.map((entry) => ({ key: entry.key, label: entry.label }))}
      onChange={(key) => {
        const next = DIRECTORY_SECTIONS.find((entry) => entry.key === key);

        if (next) {
          navigate(next.path);
        }
      }}
    />
  );
};

export const PeopleScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { data, loading, error, forbidden, reload } = usePeople();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => (data?.people ?? []).filter((person) => matchesPerson(person, query)), [data, query]);

  const header = (
    <LvPageHeader
      theme={theme}
      variant="panel"
      title="People"
      subtitle="The contacts behind the partners, experiences and properties."
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
        <DirectoryNav theme={theme} value="people" />
        <ForbiddenState theme={theme} text={error ?? 'Your role cannot read people.'} />
      </>
    );
  }

  return (
    <>
      {header}
      <DirectoryNav theme={theme} value="people" />

      <LvCard theme={theme}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          <LvSearchField theme={theme} label="Search people" placeholder="Name, email, role or city" value={query} onChange={setQuery} />

          {loading ? (
            <LoadingState theme={theme} rows={5} label="Loading people" />
          ) : error !== null ? (
            <ErrorState theme={theme} title="People could not be loaded" text={error} onRetry={reload} />
          ) : (data?.people ?? []).length === 0 ? (
            <EmptyState
              theme={theme}
              icon="person"
              tint="blue"
              title="No contacts recorded yet"
              text="A person appears here once they are named as a partner's contact, an experience host or a property manager."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              theme={theme}
              icon="filter"
              tint="blue"
              title="Nothing matches that search"
              text="The contacts exist — this search just does not match them."
              action={
                <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setQuery('')}>
                  Show everyone
                </LvButton>
              }
            />
          ) : (
            <LvTable
              theme={theme}
              caption="People"
              rowKey={(person: DirectoryPerson) => person.id}
              rows={visible}
              columns={[
                {
                  key: 'name',
                  label: 'Person',
                  render: (person: DirectoryPerson) => (
                    <button
                      type="button"
                      onClick={() => navigate(`/directory/people/${person.id}`)}
                      className="lv-text-button"
                      style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: theme.font.body, minWidth: 0 }}
                    >
                      <LvAvatar theme={theme} name={person.name} src={person.avatarUrl} size={32} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', ...theme.type.subheading, color: theme.color.heading, overflowWrap: 'anywhere' }}>{person.name}</span>
                        {person.jobTitle && <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textSubtle }}>{person.jobTitle}</span>}
                      </span>
                    </button>
                  ),
                },
                {
                  key: 'company',
                  label: 'Organisation',
                  render: (person: DirectoryPerson) =>
                    person.companyId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/directory/organisations/${person.companyId}`)}
                        className="lv-text-button"
                        style={{ ...theme.type.bodySmall, background: 'transparent', border: 'none', padding: 0, textAlign: 'left', color: theme.color.brand, fontFamily: theme.font.body, cursor: 'pointer', overflowWrap: 'anywhere' }}
                      >
                        {person.companyName ?? 'Unnamed organisation'}
                      </button>
                    ) : (
                      <span style={{ ...theme.type.bodySmall, color: theme.color.textSubtle }}>—</span>
                    ),
                },
                {
                  key: 'contact',
                  label: 'Reach them',
                  render: (person: DirectoryPerson) => (
                    <span style={{ ...theme.type.bodySmall, color: person.email || person.phone ? theme.color.text : theme.color.textSubtle, overflowWrap: 'anywhere' }}>
                      {[person.email, person.phone].filter(Boolean).join(' · ') || 'No contact details'}
                    </span>
                  ),
                },
                {
                  key: 'city',
                  label: 'City',
                  render: (person: DirectoryPerson) => <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{person.city ?? '—'}</span>,
                },
              ]}
            />
          )}

          {!loading && error === null && (data?.people ?? []).length > 0 && (
            <InlineNotice theme={theme}>
              Showing {visible.length} of {data?.total ?? (data?.people ?? []).length} contacts you can read.
            </InlineNotice>
          )}
        </div>
      </LvCard>
    </>
  );
};
