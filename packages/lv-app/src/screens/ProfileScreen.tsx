import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useLead360 } from 'src/api/leads';
import { LvBreadcrumbs } from 'src/design/data';
import { LvIcon } from 'src/design/icons';
import { ErrorState, isForbiddenMessage, LvButton, LvCard, LvSkeletonRow, VisuallyHidden } from 'src/design/kit';
import { LvMenu } from 'src/design/overlay';
import { LvContextualActions, LvSectionNav } from 'src/design/page';
import { LvNextBestAction } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';
import { LeadHeader, leadChannels, sentenceCase } from 'src/screens/lead/header';
import { GovernanceTab, IntelligenceTab } from 'src/screens/lead/insight';
import { ConversationsTab, DocumentsTab, OnboardingTab, OverviewTab, TimelineTab } from 'src/screens/lead/tabs';
import { LeadActionDialog, LEAD_ACTIONS, type LeadAction } from 'src/screens/lead/actions';

// The lead profile — a relationship workspace, not a record page.
//
// Everything comes from one /leads/360 call: the server composes the
// relationship under the caller's own permissions, and this screen arranges
// it. No second query, no client-side business rule, and no tab shown that the
// caller's role cannot see.
//
// The section is part of the URL, so a colleague can be sent straight to the
// documents of a specific lead and the back button behaves.

const ALL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'conversations', label: 'Conversations' },
  { key: 'documents', label: 'Documents' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'governance', label: 'Governance' },
];

export const ProfileScreen = ({ theme }: { theme: LvTheme }) => {
  const { leadId, tab: tabParam } = useParams<{ leadId: string; tab?: string }>();
  const navigate = useNavigate();
  const { data, error, reload } = useLead360(leadId);
  // An action can be addressed in the URL, so another screen can send
  // somebody straight into it — Messages hands over to "log an interaction"
  // this way once a draft has been sent. The parameter is consumed on arrival
  // so a refresh does not reopen it.
  const [search, setSearch] = useSearchParams();
  const requested = search.get('action');
  const [action, setAction] = useState<LeadAction | null>(null);

  useEffect(() => {
    if (requested === null) {
      return;
    }

    // An unknown value must not put the screen into a state that renders
    // nothing: ?action=delete silently set an action no dialog answers to.
    if (LEAD_ACTIONS.includes(requested as LeadAction)) {
      setAction(requested as LeadAction);
    }

    setSearch(
      (current) => {
        const next = new URLSearchParams(current);

        next.delete('action');

        return next;
      },
      { replace: true },
    );
  }, [requested, setSearch]);

  const goToTab = (next: string) => navigate(next === 'overview' ? `/leads/${leadId}` : `/leads/${leadId}/${next}`, { replace: true });

  // ------------------------------------------------------------------ error
  if (error !== null) {
    // A refusal is not a crash. The server says why, and the way back is the
    // list rather than a dead end.
    const forbidden = isForbiddenMessage(error);

    return (
      <>
        <LvBreadcrumbs theme={theme} trail={[{ key: 'leads', label: 'My Leads', onNavigate: () => navigate('/leads') }, { key: 'lead', label: 'Lead' }]} />
        <ErrorState
          theme={theme}
          title={forbidden ? 'You cannot open this relationship' : 'That lead could not be opened'}
          text={error}
          onRetry={forbidden ? undefined : reload}
        />
        <LvCard theme={theme} style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
          <LvButton theme={theme} variant="secondary" icon={<LvIcon name="chevronLeft" size={16} />} onClick={() => navigate('/leads')}>
            Back to my leads
          </LvButton>
        </LvCard>
      </>
    );
  }

  // ---------------------------------------------------------------- loading
  if (data === null) {
    return (
      <>
        <VisuallyHidden>Opening the relationship</VisuallyHidden>
        <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5) }}>
          <LvCard theme={theme} padding={0} style={{ overflow: 'hidden' }}>
            <span className="lv-skeleton" aria-hidden="true" style={{ display: 'block', height: 120, borderRadius: 0 }} />
            <div style={{ padding: theme.space(5), display: 'flex', gap: theme.space(4), alignItems: 'center' }}>
              <span className="lv-skeleton" aria-hidden="true" style={{ width: 72, height: 72, borderRadius: theme.radius.pill, flex: '0 0 auto' }} />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <LvSkeletonRow theme={theme} width="46%" />
                <LvSkeletonRow theme={theme} width="68%" />
              </span>
            </div>
          </LvCard>
          <LvCard theme={theme}>
            <LvSkeletonRow theme={theme} width="34%" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), marginTop: theme.space(4) }}>
              <LvSkeletonRow theme={theme} />
              <LvSkeletonRow theme={theme} width="80%" />
            </div>
          </LvCard>
        </div>
      </>
    );
  }

  const { lead, capabilities } = data;
  const channels = leadChannels(lead);
  const recommendation = data.intelligence.nextBestAction?.primary ?? data.nextAction.suggestion;

  // A tab the caller's role cannot use is not shown disabled — it is not
  // shown. The section list is what this person's product actually has.
  const tabs = ALL_TABS.filter((candidate) => {
    if (candidate.key === 'onboarding') {
      return capabilities.canViewOnboarding || data.onboarding !== null;
    }

    if (candidate.key === 'documents') {
      return capabilities.canViewOnboarding || (data.onboarding?.documents.length ?? 0) > 0;
    }

    if (candidate.key === 'intelligence') {
      return capabilities.canViewIntelligence;
    }

    if (candidate.key === 'governance') {
      return capabilities.canGovern || capabilities.canChangeStatus || data.caller.isAdmin;
    }

    return true;
  }).map((candidate) => ({
    ...candidate,
    count: candidate.key === 'documents' ? (data.onboarding?.documents.length ?? 0) : candidate.key === 'conversations' ? data.interactions.length : undefined,
  }));

  // An unknown or now-forbidden section falls back to the overview rather than
  // rendering nothing.
  const tab = tabs.some((candidate) => candidate.key === tabParam) ? (tabParam as string) : 'overview';

  const overflow = (
    <LvMenu
      theme={theme}
      label={`Actions for ${lead.name ?? 'this lead'}`}
      // Only what this person may actually do. An action the payload does not
      // support is absent, not disabled — a greyed row is a question nobody
      // can answer from the screen.
      items={[
        ...(capabilities.canLogInteraction ? [{ key: 'interaction', label: 'Log an interaction', icon: 'messages' as const, onSelect: () => setAction('interaction') }] : []),
        ...(capabilities.canCreateTask ? [{ key: 'task', label: 'Create a follow-up', icon: 'task' as const, onSelect: () => setAction('task') }] : []),
        ...(capabilities.canAddNote ? [{ key: 'note', label: 'Add an internal note', icon: 'note' as const, onSelect: () => setAction('note') }] : []),
        ...(capabilities.canChangeOwner || capabilities.canClaim
          ? [{ key: 'owner', label: capabilities.canClaim && !lead.owner ? 'Claim this lead' : 'Change the owner', icon: 'person' as const, onSelect: () => setAction('owner') }]
          : []),
        // The one that ends a relationship sits last and reads as what it is.
        ...(capabilities.canChangeStatus
          ? [{ key: 'status', label: 'Change the status', icon: 'check' as const, tone: 'danger' as const, onSelect: () => setAction('status') }]
          : []),
      ]}
    />
  );

  // One props object, passed explicitly: the house lint rule forbids
  // spreading, and naming them keeps each tab's contract visible.
  const onTabAction = (next: LeadAction) => setAction(next);

  return (
    <>
      <div className="lv-hide-mobile">
        <LvBreadcrumbs
          theme={theme}
          trail={[
            { key: 'leads', label: 'My Leads', onNavigate: () => navigate('/leads') },
            { key: 'lead', label: lead.name ?? 'Lead' },
          ]}
        />
      </div>

      <LeadHeader theme={theme} data={data} onBack={() => navigate('/leads')} onAction={(next) => setAction(next)} overflow={overflow} />

      {recommendation?.action && (
        <LvNextBestAction
          theme={theme}
          action={recommendation.title ?? sentenceCase(recommendation.action)}
          reason={recommendation.reason ?? null}
          aside={
            capabilities.canViewIntelligence ? (
              <LvButton theme={theme} variant="secondary" size="sm" onClick={() => goToTab('intelligence')}>
                Why this?
              </LvButton>
            ) : undefined
          }
        />
      )}

      <LvSectionNav theme={theme} label="Relationship sections" sections={tabs} value={tab} onChange={goToTab} />

      <div className="lv-lead-body">
        {tab === 'overview' && <OverviewTab theme={theme} data={data} onAction={onTabAction} onOpenTab={goToTab} />}
        {tab === 'onboarding' && <OnboardingTab theme={theme} data={data} onAction={onTabAction} onOpenTab={goToTab} />}
        {tab === 'conversations' && <ConversationsTab theme={theme} data={data} onAction={onTabAction} onOpenTab={goToTab} />}
        {tab === 'documents' && <DocumentsTab theme={theme} data={data} onAction={onTabAction} onOpenTab={goToTab} />}
        {tab === 'timeline' && <TimelineTab theme={theme} data={data} onAction={onTabAction} onOpenTab={goToTab} />}
        {tab === 'intelligence' && <IntelligenceTab theme={theme} data={data} onAction={onTabAction} onOpenTab={goToTab} />}
        {tab === 'governance' && <GovernanceTab theme={theme} data={data} onAction={onTabAction} onOpenTab={goToTab} />}
      </div>

      {/* On a phone this pins to the foot of the screen and the six doors step
          aside for it; on a wider screen it sits in the flow. Only the actions
          this person may take are in it. */}
      {/* One primary, the rest secondary, nothing destructive: ending a
          relationship lives in the overflow, not under a thumb. */}
      <LvContextualActions theme={theme}>
        {channels.phone && (
          <LvButton theme={theme} variant="primary" icon={<LvIcon name="phone" size={16} />} onClick={() => window.open(`tel:${channels.phone}`)}>
            Call
          </LvButton>
        )}
        {channels.whatsapp && (
          <LvButton theme={theme} variant="secondary" icon={<LvIcon name="whatsapp" size={16} />} onClick={() => window.open(channels.whatsapp as string, '_blank', 'noreferrer')}>
            WhatsApp
          </LvButton>
        )}
        {capabilities.canLogInteraction && (
          <LvButton theme={theme} variant={channels.phone ? 'secondary' : 'primary'} icon={<LvIcon name="messages" size={16} />} onClick={() => setAction('interaction')}>
            Log
          </LvButton>
        )}
        {capabilities.canCreateTask && (
          <LvButton theme={theme} variant="secondary" icon={<LvIcon name="task" size={16} />} onClick={() => setAction('task')}>
            Follow-up
          </LvButton>
        )}
        {capabilities.canClaim && !lead.owner && (
          <LvButton theme={theme} variant="secondary" icon={<LvIcon name="person" size={16} />} onClick={() => setAction('owner')}>
            Claim
          </LvButton>
        )}
      </LvContextualActions>

      {action !== null && (
        <LeadActionDialog theme={theme} action={action} data={data} onClose={() => setAction(null)} onDone={reload} onOpenTab={goToTab} />
      )}
    </>
  );
};
