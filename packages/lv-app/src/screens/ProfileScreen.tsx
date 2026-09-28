import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { callRoute } from 'src/api/client';
import { LvIcon } from 'src/design/icons';
import { ErrorState, formatWhen, LoadingState, LvButton, LvCard, LvTabs, LvProgress, type Tone } from 'src/design/kit';
import { LvMenu } from 'src/design/overlay';
import { LvChip, LvFactRow, LvNextBestAction, LvProfileHeader, LvRelatedList, LvSectionCard, LvTimeline } from 'src/design/profile';
import { describeStatus, statusBadgeTone } from 'src/design/status';
import { LeadActionDialog, type LeadAction } from 'src/screens/profile/LeadActions';
import { type LvTheme } from 'src/design/theme';

// The profile — the screen the reference boards call "the one screen that
// defines the CRM". Everything on it comes from a single /leads/360 call: the
// server composes the relationship under the caller's own permissions, and
// this screen arranges it. No second query, no client-side business rule.

type Member = { id: string; displayName: string | null; email: string | null };
type Target = { object: string; recordId: string } | null;

type Lead360 = {
  now: string;
  lead: {
    id: string;
    lvLeadId: string | null;
    name: string | null;
    organisationName: string | null;
    category: string | null;
    subcategory: string | null;
    location: string | null;
    source: string | null;
    status: string | null;
    priority: string | null;
    jobTitle: string | null;
    languages: string[] | null;
    emails: { primaryEmail: string | null } | null;
    phones: { primaryPhoneNumber: string | null } | null;
    opportunityScore: number | null;
    dataCompleteness: number | null;
    lastInteractionAt: string | null;
    nextAction: string | null;
    nextFollowUpAt: string | null;
    rawCaptureInput: string | null;
    owner: Member | null;
  };
  capabilities: Record<string, boolean>;
  settableStatuses: string[];
  nextAction: { task: { id: string; title: string | null; dueAt: string | null } | null; suggestion: { action?: string | null; reason?: string | null } | null };
  openTasks: { id: string; title: string | null; dueAt: string | null; isOverdue: boolean }[];
  interactions: { id: string; channel: string | null; direction: string | null; occurredAt: string | null; summary: string | null; sentiment: string | null; outcome: string | null; objections: string | null }[];
  timeline: { id: string; kind: string; at: string; title: string; detail: string | null; tone: Tone | 'neutral'; target: Target }[];
  onboarding: {
    id: string;
    status: string | null;
    progressPercentage: number | null;
    currentStep: string | null;
    documents: { id: string; name: string | null; documentType: string | null; status: string | null }[];
    pendingDocuments: number;
  } | null;
  intelligence: {
    opportunity: { available: boolean; score: number | null };
    health: { state: string | null };
    nextBestAction: { primary: { action?: string | null; reason?: string | null } | null };
    dataQuality: { issues: { field?: string; text?: string }[] };
  };
  ecosystem: { partner: { id: string; name: string | null } | null; experiences: unknown[]; properties: unknown[] };
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'conversations', label: 'Conversations' },
  { key: 'documents', label: 'Documents' },
  { key: 'timeline', label: 'Timeline' },
];

const sentenceCase = (value: string | null | undefined): string =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—';

export const ProfileScreen = ({ theme }: { theme: LvTheme }) => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Lead360 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');
  const [action, setAction] = useState<LeadAction | null>(null);
  // Bumped after an action succeeds so the whole relationship is re-read from
  // the server rather than patched in the browser — the routes change more
  // than the record they were called on (tasks, SLAs, status, timeline).
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setData(null);
    setError(null);

    const load = async () => {
      try {
        const result = await callRoute<Lead360>('/leads/360', { leadId });

        if (!cancelled) {
          setData(result);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'That lead could not be opened.');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [leadId, reloads]);

  if (error !== null) {
    return <ErrorState theme={theme} text={error} />;
  }

  if (data === null) {
    return <LoadingState theme={theme} label="Opening the relationship" />;
  }

  const { lead, onboarding, intelligence } = data;
  const status = describeStatus('lead', lead.status);
  const recommendation = intelligence.nextBestAction?.primary ?? data.nextAction.suggestion;
  const documents = onboarding?.documents ?? [];
  const lastInteraction = data.interactions[0];

  return (
    <>
      <LvProfileHeader
        theme={theme}
        name={lead.name ?? 'Unnamed lead'}
        status={status.label}
        statusTone={statusBadgeTone('lead', lead.status)}
        subtitle={[lead.jobTitle, lead.organisationName].filter(Boolean).join(' · ') || null}
        meta={[
          ...(lead.location ? [{ icon: 'location' as const, text: lead.location }] : []),
          ...(lead.lvLeadId ? [{ icon: 'person' as const, text: lead.lvLeadId }] : []),
          ...(typeof lead.opportunityScore === 'number' ? [{ icon: 'star' as const, text: `Score ${lead.opportunityScore}` }] : []),
        ]}
        overflow={
          <LvMenu
            theme={theme}
            label={`Actions for ${lead.name ?? 'this lead'}`}
            items={[
              { key: 'interaction', label: 'Log an interaction', icon: 'note', onSelect: () => setAction('interaction'), disabled: !data.capabilities.canLogInteraction },
              { key: 'task', label: 'Create a follow-up', icon: 'task', onSelect: () => setAction('task'), disabled: !data.capabilities.canCreateTask },
              { key: 'note', label: 'Add a note', icon: 'note', onSelect: () => setAction('note'), disabled: !data.capabilities.canAddNote },
              { key: 'status', label: 'Change the status', icon: 'check', onSelect: () => setAction('status'), disabled: !data.capabilities.canChangeStatus || (data.settableStatuses ?? []).length === 0 },
            ]}
          />
        }
        actions={
          <>
            {lead.phones?.primaryPhoneNumber && (
              <LvButton theme={theme} variant="primary" icon={<LvIcon name="phone" size={16} />} onClick={() => window.open(`tel:${lead.phones?.primaryPhoneNumber}`)}>
                Call
              </LvButton>
            )}
            {lead.phones?.primaryPhoneNumber && (
              <LvButton
                theme={theme}
                variant="secondary"
                icon={<LvIcon name="whatsapp" size={16} />}
                onClick={() => window.open(`https://wa.me/${(lead.phones?.primaryPhoneNumber ?? '').replace(/\D/g, '')}`, '_blank', 'noreferrer')}
              >
                WhatsApp
              </LvButton>
            )}
          </>
        }
      />

      {recommendation?.action && (
        <LvNextBestAction
          theme={theme}
          action={sentenceCase(recommendation.action)}
          reason={recommendation.reason ?? null}
          aside={
            data.capabilities.canViewIntelligence ? (
              <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setTab('conversations')}>
                View message suggestions
              </LvButton>
            ) : undefined
          }
        />
      )}

      <LvTabs theme={theme} label="Relationship sections" value={tab} onChange={setTab} tabs={TABS.map((item) => ({ ...item, count: item.key === 'documents' ? documents.length : undefined }))} />

      <div className="lv-sidebar-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5), minWidth: 0 }}>
          {tab === 'overview' && (
            <>
              <LvSectionCard theme={theme} title="About" icon="person">
                <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
                  {lead.rawCaptureInput ?? `${lead.name ?? 'This lead'} came in from ${sentenceCase(lead.source)}.`}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(3) }}>
                  {[lead.category, lead.subcategory, ...(lead.languages ?? [])].filter(Boolean).map((chip, index) => (
                    <LvChip key={`${chip}`} theme={theme} tint={(['mint', 'blue', 'peach', 'lavender', 'pink'] as const)[index % 5]}>
                      {sentenceCase(String(chip))}
                    </LvChip>
                  ))}
                </div>
              </LvSectionCard>

              <LvSectionCard theme={theme} title="Relationship" icon="leads">
                <LvFactRow theme={theme} label="Last contact">
                  {lead.lastInteractionAt ? `${formatWhen(lead.lastInteractionAt, data.now)} · ${sentenceCase(lastInteraction?.channel)}` : 'No contact yet'}
                </LvFactRow>
                <LvFactRow theme={theme} label="Sentiment">{sentenceCase(lastInteraction?.sentiment)}</LvFactRow>
                <LvFactRow theme={theme} label="Concern">{lastInteraction?.objections ?? '—'}</LvFactRow>
                <LvFactRow theme={theme} label="Owner">{lead.owner?.displayName ?? 'Unassigned'}</LvFactRow>
                <LvFactRow theme={theme} label="Next follow-up">
                  {lead.nextFollowUpAt ? formatWhen(lead.nextFollowUpAt, data.now) : 'Not scheduled'}
                </LvFactRow>
              </LvSectionCard>
            </>
          )}

          {(tab === 'overview' || tab === 'onboarding') && onboarding && (
            <LvSectionCard
              theme={theme}
              title="Onboarding"
              icon="onboarding"
              action={<span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{sentenceCase(onboarding.status)}</span>}
            >
              <LvProgress
                theme={theme}
                percentage={onboarding.progressPercentage ?? 0}
                caption={onboarding.pendingDocuments > 0 ? 'Documents pending:' : `Current step: ${sentenceCase(onboarding.currentStep)}`}
                pending={documents.filter((document) => (document.status ?? 'PENDING') !== 'VERIFIED').map((document) => document.name ?? sentenceCase(document.documentType))}
                action={
                  data.capabilities.canWorkOnboarding ? (
                    <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setTab('documents')}>
                      Help complete
                    </LvButton>
                  ) : undefined
                }
              />
            </LvSectionCard>
          )}

          {tab === 'overview' && data.capabilities.canViewIntelligence && (
            <LvSectionCard theme={theme} title="AI insights" icon="sparkle">
              <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
                {intelligence.opportunity.available && typeof intelligence.opportunity.score === 'number'
                  ? `Opportunity score ${intelligence.opportunity.score} of 100, relationship ${sentenceCase(intelligence.health.state).toLowerCase()}.`
                  : 'No scoring is available for this lead yet.'}
              </p>
              {intelligence.dataQuality.issues.length > 0 && (
                <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(2)}px 0 0` }}>
                  {intelligence.dataQuality.issues.length} data quality issue{intelligence.dataQuality.issues.length === 1 ? '' : 's'} to fix.
                </p>
              )}
            </LvSectionCard>
          )}

          {tab === 'conversations' && (
            <LvSectionCard theme={theme} title="Conversations" icon="messages">
              {data.interactions.length === 0 ? (
                <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0 }}>Nothing has been logged yet.</p>
              ) : (
                <LvTimeline
                  theme={theme}
                  formatWhen={(iso) => formatWhen(iso, data.now)}
                  entries={data.interactions.map((interaction) => ({
                    id: interaction.id,
                    at: interaction.occurredAt ?? data.now,
                    title: `${sentenceCase(interaction.channel)} · ${sentenceCase(interaction.outcome)}`,
                    detail: interaction.summary,
                    kind: 'INTERACTION',
                    channel: interaction.channel,
                  }))}
                />
              )}
            </LvSectionCard>
          )}

          {tab === 'documents' && (
            <LvSectionCard theme={theme} title="Documents" icon="document">
              {documents.length === 0 ? (
                <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0 }}>No document has been uploaded.</p>
              ) : (
                documents.map((document) => (
                  <LvFactRow key={document.id} theme={theme} label={document.name ?? sentenceCase(document.documentType)}>
                    {sentenceCase(document.status ?? 'PENDING')}
                  </LvFactRow>
                ))
              )}
            </LvSectionCard>
          )}

          {tab === 'timeline' && (
            <LvSectionCard theme={theme} title="Relationship timeline" icon="clock">
              <LvTimeline theme={theme} formatWhen={(iso) => formatWhen(iso, data.now)} entries={data.timeline} />
            </LvSectionCard>
          )}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5), minWidth: 0 }}>
          <LvSectionCard theme={theme} title="Timeline" icon="clock">
            <LvTimeline theme={theme} formatWhen={(iso) => formatWhen(iso, data.now)} entries={data.timeline.slice(0, 6)} />
          </LvSectionCard>

          <LvSectionCard theme={theme} title="Related" icon="partner">
            <LvRelatedList
              theme={theme}
              items={[
                { key: 'experiences', icon: 'experience', label: 'Experiences', detail: `${data.ecosystem.experiences.length} linked` },
                { key: 'documents', icon: 'document', label: 'Documents', detail: `${documents.length} received` },
                { key: 'tasks', icon: 'task', label: 'Tasks', detail: `${data.openTasks.length} open` },
                ...(data.ecosystem.partner
                  ? [{ key: 'partner', icon: 'partner' as const, label: data.ecosystem.partner.name ?? 'Partner', detail: 'Partner profile', onOpen: () => navigate('/onboarding') }]
                  : []),
              ]}
            />
          </LvSectionCard>

          {data.openTasks.length > 0 && (
            <LvSectionCard theme={theme} title="Open tasks" icon="task">
              {data.openTasks.slice(0, 5).map((task) => (
                <LvFactRow key={task.id} theme={theme} label={task.title ?? 'Task'}>
                  <span style={{ color: task.isOverdue ? theme.color.danger : theme.color.textMuted }}>
                    {task.dueAt ? formatWhen(task.dueAt, data.now) : '—'}
                  </span>
                </LvFactRow>
              ))}
            </LvSectionCard>
          )}
        </aside>
      </div>

      {action !== null && (
        <LeadActionDialog
          theme={theme}
          action={action}
          leadId={lead.id}
          settableStatuses={data.settableStatuses ?? []}
          onClose={() => setAction(null)}
          onDone={() => setReloads((value) => value + 1)}
        />
      )}

      <LvCard theme={theme} style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        <LvButton theme={theme} variant="ghost" size="sm" onClick={() => navigate('/leads')}>
          ← Back to my leads
        </LvButton>
      </LvCard>
    </>
  );
};
