import { useNavigate } from 'react-router-dom';

import { useTodayData, type TodayRef } from 'src/api/today';
import { LvBreadcrumbs } from 'src/design/data';
import { LvIcon } from 'src/design/icons';
import { EmptyState, ErrorState, LvButton, LvCard, LvSkeletonCard, Provenance, VisuallyHidden } from 'src/design/kit';
import { LvAiUnavailable } from 'src/design/intelligence';
import { LvPageHeader } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';
import { AiRankingNote } from 'src/screens/today/parts';

// The daily briefing, in full.
//
// Today shows the first few ranked actions; this is the whole ranking with the
// reason for each one written out, plus the counts it was built from and a
// plain statement of what produced it. It exists because a ranking a person
// cannot inspect is a ranking they will stop trusting — and because the
// reasons are too long to sit on the Today card without crowding it out.

export const BriefingScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { briefing, actions, aiPhase, error, loading, reload, retryAi } = useTodayData();

  const openRef = (ref: TodayRef | null) => {
    if (ref?.target.object === 'lvLead') {
      navigate(`/leads/${ref.target.recordId}`);
    }
  };

  const header = (
    <LvPageHeader
      theme={theme}
      title="Daily briefing"
      subtitle="Everything the CRM thinks is worth your time today, in order, with the reason for each."
      onBack={() => navigate('/today')}
      backLabel="Back to Today"
      breadcrumbs={
        <LvBreadcrumbs
          theme={theme}
          trail={[
            { key: 'today', label: 'Today', onNavigate: () => navigate('/today') },
            { key: 'briefing', label: 'Daily briefing' },
          ]}
        />
      }
    />
  );

  if (error !== null) {
    return (
      <>
        {header}
        <ErrorState theme={theme} title="The briefing could not be built" text={error} onRetry={reload} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        {header}
        <VisuallyHidden>Building the briefing</VisuallyHidden>
        <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
          <LvSkeletonCard theme={theme} lines={2} />
          <LvSkeletonCard theme={theme} lines={4} />
        </div>
      </>
    );
  }

  const lines = briefing?.today ?? [];

  return (
    <>
      {header}

      <LvCard theme={theme}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.space(3), flexWrap: 'wrap' }}>
          <span aria-hidden="true" style={{ color: theme.color.accentInk, display: 'inline-flex', marginTop: 2 }}>
            <LvIcon name="sparkle" size={20} />
          </span>
          <p style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: 0, flex: 1, minWidth: 220 }}>
            {briefing?.headline ?? 'Nothing to summarise yet.'}
          </p>
          <Provenance theme={theme} source={aiPhase === 'ready' || aiPhase === 'cached' ? 'ai' : 'rules'} />
        </div>

        {lines.length > 0 && (
          <ul style={{ margin: `${theme.space(4)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
            {lines.map((line) => (
              <li
                key={line.key}
                style={{ ...theme.type.bodySmall, color: theme.color.textMuted, background: theme.color.surfaceSunken, borderRadius: theme.radius.pill, padding: `3px ${theme.space(3)}px` }}
              >
                <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.bold }}>{line.count}</strong> {line.label}
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: theme.space(4), paddingTop: theme.space(3), borderTop: `1px solid ${theme.color.border}` }}>
          <AiRankingNote theme={theme} phase={aiPhase} onRetry={retryAi} />
        </div>
      </LvCard>

      {/* The assistant is off for this workspace — said once, plainly, with
          what is still true without it. */}
      {aiPhase === 'none' && (
        <LvAiUnavailable
          theme={theme}
          reason={briefing?.ai?.reason ? `The assistant is not available: ${briefing.ai.reason}` : 'No assistant is enabled for this workspace.'}
          fallback="The briefing below is complete either way — the counts, the ranking and the reasons are all computed by the CRM from your own records."
        />
      )}

      <LvCard theme={theme}>
        <h2 style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: `0 0 ${theme.space(4)}px` }}>
          {actions.length === 0 ? 'Nothing is ranked today' : `Ranked actions (${actions.length})`}
        </h2>

        {actions.length === 0 ? (
          <EmptyState
            theme={theme}
            text="Nothing is overdue, breached or waiting on you, so there is nothing to rank. This is what a clear day looks like."
          />
        ) : (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {actions.map((action, index) => (
              <li
                key={action.ref?.ref ?? `${action.title}-${index}`}
                style={{ display: 'flex', gap: theme.space(3), border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, padding: theme.space(4) }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    flex: '0 0 auto',
                    borderRadius: theme.radius.pill,
                    background: index === 0 ? theme.color.brand : theme.color.surfaceSunken,
                    color: index === 0 ? theme.color.textOnBrand : theme.color.textMuted,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...theme.type.bodySmall,
                    fontWeight: theme.font.weight.bold,
                  }}
                >
                  {index + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', ...theme.type.subheading, fontSize: 16, color: theme.color.heading, overflowWrap: 'anywhere' }}>
                    {action.ref?.label ?? action.title}
                  </span>
                  {action.ref && action.ref.label !== action.title && (
                    <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted }}>{action.title}</span>
                  )}
                  {/* The reason, in full. A ranking you cannot check is a
                      ranking you will not follow. */}
                  <span style={{ display: 'block', ...theme.type.body, color: theme.color.text, marginTop: theme.space(2) }}>{action.why}</span>
                  <span style={{ display: 'inline-flex', marginTop: theme.space(2) }}>
                    <Provenance theme={theme} source={action.origin === 'MODEL' ? 'ai' : 'rules'} />
                  </span>
                </span>
                {action.ref && (
                  <LvButton theme={theme} size="sm" variant="secondary" onClick={() => openRef(action.ref)}>
                    Open
                  </LvButton>
                )}
              </li>
            ))}
          </ol>
        )}
      </LvCard>

      {(briefing?.notes ?? []).length > 0 && (
        <LvCard theme={theme} style={{ background: 'transparent', boxShadow: 'none' }}>
          <h2 style={{ ...theme.type.label, color: theme.color.textMuted, margin: `0 0 ${theme.space(2)}px` }}>How this was built</h2>
          <ul style={{ margin: 0, paddingLeft: theme.space(4), display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(briefing?.notes ?? []).map((note) => (
              <li key={note} style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>
                {note}
              </li>
            ))}
          </ul>
        </LvCard>
      )}
    </>
  );
};
