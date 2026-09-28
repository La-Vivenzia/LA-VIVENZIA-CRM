import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { graphql } from 'src/api/client';
import { LvIcon } from 'src/design/icons';
import { ErrorState, LoadingState, LvActionRow, LvButton, LvCard, Segmented } from 'src/design/kit';
import { describeStatus } from 'src/design/status';
import { type LvTheme, type LvTint } from 'src/design/theme';

// My Leads — every relationship, each row carrying the action you would take
// on it. The list is read straight from the API under the signed-in person's
// own permissions, so a coordinator and an administrator see different rows
// from the same query.

type Lead = {
  id: string;
  lvLeadId: string | null;
  name: string | null;
  organisationName: string | null;
  location: string | null;
  status: string | null;
  priority: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  lastInteractionAt: string | null;
  phones: { primaryPhoneNumber: string | null } | null;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'closed', label: 'Closed' },
];

const CLOSED = new Set(['LOST', 'NOT_INTERESTED', 'NOT_ELIGIBLE', 'DUPLICATE', 'WRONG_CONTACT', 'REJECTED']);
const ONBOARDING = new Set(['ONBOARDING_INITIATED', 'ONBOARDING_IN_PROGRESS', 'VERIFICATION', 'APPROVED', 'LIVE_ACTIVE', 'GROWTH']);

const tintFor = (index: number): LvTint => (['mint', 'blue', 'peach', 'lavender', 'pink'] as const)[index % 5];

export const LeadsScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get('q')?.toLowerCase() ?? '';
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const result = await graphql<{ lvLeads: { edges: { node: Lead }[] } }>(
          `query {
            lvLeads(orderBy: { lastInteractionAt: DescNullsLast }, first: 100) {
              edges { node {
                id lvLeadId name organisationName location status priority
                nextAction nextFollowUpAt lastInteractionAt
                phones { primaryPhoneNumber }
              } }
            }
          }`,
        );

        if (!cancelled) {
          setLeads(result.lvLeads.edges.map((edge) => edge.node));
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Your leads could not be loaded.');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (leads === null) {
      return [];
    }

    return leads.filter((lead) => {
      const status = lead.status ?? '';
      const matchesFilter =
        filter === 'all' ||
        (filter === 'closed' && CLOSED.has(status)) ||
        (filter === 'onboarding' && ONBOARDING.has(status)) ||
        (filter === 'open' && !CLOSED.has(status));
      const haystack = `${lead.name ?? ''} ${lead.organisationName ?? ''} ${lead.location ?? ''} ${lead.lvLeadId ?? ''}`.toLowerCase();

      return matchesFilter && (query === '' || haystack.includes(query));
    });
  }, [leads, filter, query]);

  if (error !== null) {
    return <ErrorState theme={theme} text={error} />;
  }

  if (leads === null) {
    return <LoadingState theme={theme} label="Loading your leads" />;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.space(3), flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: theme.font.body, fontSize: 24, fontWeight: 600, color: theme.color.heading, margin: 0 }}>My Leads</h1>
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>
            {visible.length} of {leads.length} relationship{leads.length === 1 ? '' : 's'}
            {query ? ` matching “${query}”` : ''}
          </p>
        </div>
        <Segmented theme={theme} label="Filter leads" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <LvCard theme={theme}>
        {visible.length === 0 ? (
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0 }}>No lead matches this view.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {visible.map((lead, index) => {
              const status = describeStatus('lead', lead.status);
              const overdue = lead.nextFollowUpAt !== null && Date.parse(lead.nextFollowUpAt) < Date.now();

              return (
                <LvActionRow
                  key={lead.id}
                  theme={theme}
                  title={lead.name ?? lead.lvLeadId ?? 'Unnamed lead'}
                  subtitle={[lead.organisationName, lead.location, status.label].filter(Boolean).join(' · ')}
                  urgent={overdue ? `Follow-up overdue — ${lead.nextAction ?? 'no action set'}` : null}
                  tint={tintFor(index)}
                  avatarName={lead.name ?? lead.organisationName ?? 'Lead'}
                  action={
                    lead.phones?.primaryPhoneNumber ? (
                      <LvButton
                        theme={theme}
                        size="sm"
                        variant={overdue ? 'primary' : 'secondary'}
                        icon={<LvIcon name="phone" size={16} />}
                        onClick={() => window.open(`tel:${lead.phones?.primaryPhoneNumber}`)}
                      >
                        Call
                      </LvButton>
                    ) : undefined
                  }
                  onOpen={() => navigate(`/leads/${lead.id}`)}
                  openLabel={`Open ${lead.name ?? 'lead'}`}
                />
              );
            })}
          </ul>
        )}
      </LvCard>
    </>
  );
};
