import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { callRoute } from 'src/api/client';
import { TODAY_WORK_SECTIONS, useTodayData, type TodayAction, type TodayRef } from 'src/api/today';
import { withoutSubject } from 'src/design/copy';
import { LvIcon, type LvIconName } from 'src/design/icons';
import {
  CountPill,
  EmptyState,
  ErrorState,
  formatWhen,
  LvActionRow,
  LvButton,
  LvCard,
  LvCounter,
  LvSkeletonCard,
  LvSkeletonRow,
  VisuallyHidden,
  type Tone,
} from 'src/design/kit';
import { LvPageHeader } from 'src/design/page';
import { type LvTheme, type LvTint } from 'src/design/theme';
import { AiRankingNote, WorkGroup } from 'src/screens/today/parts';

// Today — the first door, and the screen the reference boards open on.
//
// It answers four questions in order, and the page is laid out in that order:
// what needs me now, what work is waiting, what does the day add up to, and
// what has just happened. It is deliberately not a dashboard: no metric is
// here unless a person would act on it this morning.
//
// Everything shown is the CRM's own data, computed server-side under the
// caller's permissions. The model, when it answers, only reorders the first
// section — and the page says so.

const COUNTERS: { key: string; label: string; icon: LvIconName; tint: LvTint }[] = [
  { key: 'calls', label: 'Calls', icon: 'phone', tint: 'lavender' },
  { key: 'whatsapp', label: 'WhatsApps', icon: 'whatsapp', tint: 'mint' },
  { key: 'meetings', label: 'Meetings', icon: 'meeting', tint: 'blue' },
  { key: 'emails', label: 'Emails', icon: 'email', tint: 'peach' },
  { key: 'overdue', label: 'Overdue', icon: 'clock', tint: 'pink' },
  { key: 'overdueTasks', label: 'Overdue follow-ups', icon: 'clock', tint: 'pink' },
  { key: 'dueToday', label: 'Due today', icon: 'task', tint: 'peach' },
  { key: 'newToday', label: 'New leads today', icon: 'leads', tint: 'blue' },
];

// What a person does with an attention row. The verb has to be one the page
// can actually carry out: every one of these opens the record, where the real
// call and message controls live, so none of them promises more than it does.
const verbFor = (why: string): { label: string; icon: LvIconName } => {
  const text = why.toLowerCase();

  if (text.includes('document') || text.includes('verif') || text.includes('onboard') || text.includes('approv')) {
    return { label: 'Review', icon: 'document' };
  }

  if (text.includes('follow-up') || text.includes('overdue') || text.includes('due today')) {
    return { label: 'Follow up', icon: 'clock' };
  }

  if (text.includes('sla')) {
    return { label: 'Respond', icon: 'warning' };
  }

  return { label: 'Open', icon: 'leads' };
};

const tintFor = (index: number): LvTint => (['pink', 'peach', 'lavender', 'blue', 'mint'] as const)[index % 5];

// The reason repeats the name the row is already headed with, so it is removed
// at display time. The helper is shared with My Leads, which had exactly the
// same duplication in its overdue line.
export const reasonFor = (why: string | null | undefined, title: string): string | null => withoutSubject(why, title);

const greetingFor = (hour: number): string => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

// The glyph follows the greeting rather than decorating it: the sun while it
// is still the working day, a crescent once it is not. It replaces a waving
// emoji, which rendered in each platform's own cartoon style and was the one
// thing on the page not drawn from the La Vivenzia glyph set.
const greetingIcon = (hour: number): 'sun' | 'moon' => (hour < 17 ? 'sun' : 'moon');

const dayLabel = (): string =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const TodayScreen = ({ theme, firstName }: { theme: LvTheme; firstName: string }) => {
  const navigate = useNavigate();
  const { briefing, summary, actions, aiPhase, error, loading, reload, retryAi } = useTodayData();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const openRef = (ref: TodayRef | null) => {
    if (ref?.target.object === 'lvLead') {
      navigate(`/leads/${ref.target.recordId}`);
    }
  };

  const completeTask = async (taskId: string, leadId: string) => {
    setBusyTaskId(taskId);
    setActionError(null);

    try {
      await callRoute('/tasks/update', { taskId, leadId, action: 'COMPLETE' });
      reload();
    } catch (cause) {
      // The server's own words. A refusal without its reason is a dead end.
      setActionError(cause instanceof Error ? cause.message : 'That follow-up could not be completed.');
    } finally {
      setBusyTaskId(null);
    }
  };


  const header = (
    <LvPageHeader
      theme={theme}
      variant="hero"
      eyebrow={dayLabel()}
      title={`${greetingFor(new Date().getHours())}, ${firstName}`}
      titleIcon={greetingIcon(new Date().getHours())}
      subtitle="Here's what needs your attention today."
      actions={
        <LvButton theme={theme} variant="secondary" onClick={() => navigate('/today/briefing')} icon={<LvIcon name="sparkle" size={16} />}>
          Full briefing
        </LvButton>
      }
    />
  );

  // ------------------------------------------------------------------ error
  if (error !== null) {
    return (
      <>
        {header}
        <ErrorState theme={theme} title="Today could not be loaded" text={error} onRetry={reload} />
      </>
    );
  }

  // ---------------------------------------------------------------- loading
  // The skeleton takes the shape the page will have, so nothing jumps when
  // the data lands.
  if (loading) {
    return (
      <>
        {header}
        <VisuallyHidden>Gathering today</VisuallyHidden>
        <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: theme.space(5) }}>
          <LvCard theme={theme}>
            <LvSkeletonRow theme={theme} width="42%" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3), marginTop: theme.space(4) }}>
              <LvSkeletonRow theme={theme} />
              <LvSkeletonRow theme={theme} width="85%" />
              <LvSkeletonRow theme={theme} width="70%" />
            </div>
          </LvCard>
          <LvSkeletonCard theme={theme} lines={2} />
          <LvSkeletonCard theme={theme} lines={3} />
        </div>
      </>
    );
  }

  const now = summary?.generatedAt ?? new Date().toISOString();
  const sections = summary?.actions ?? [];
  // Only the sections this lens actually produced, and only while they have
  // something in them. A lens that does not track onboarding simply has no
  // onboarding group — nothing is invented to fill the space.
  const work = TODAY_WORK_SECTIONS.flatMap((definition) => {
    const section = sections.find((candidate) => candidate.key === definition.key);

    return section && section.totalCount > 0 ? [{ ...definition, tone: definition.tone as Tone, section }] : [];
  });

  const counters = COUNTERS.map((counter) => ({
    ...counter,
    value: summary?.kpis?.find((kpi) => kpi.key === counter.key)?.value ?? null,
  })).filter((counter) => counter.value !== null && counter.value > 0);

  const lines = briefing?.today ?? [];
  const activity = (summary?.activity ?? []).slice(0, 5);
  const totalWork = work.reduce((sum, entry) => sum + entry.section.totalCount, 0);

  // ------------------------------------------------------------ empty Today
  // Nothing ranked and nothing waiting: a real, designed state rather than a
  // page of empty cards.
  if (actions.length === 0 && totalWork === 0) {
    return (
      <>
        {header}
        <LvCard theme={theme} padding={7}>
          <EmptyState
            theme={theme}
            quiet={false}
            icon="check"
            title="Your day is clear"
            text="Nothing is overdue, breached or waiting on you. When something arrives it will appear here first."
            action={
              <LvButton theme={theme} variant="primary" icon={<LvIcon name="capture" size={16} />} onClick={() => navigate('/capture')}>
                Capture a lead
              </LvButton>
            }
          />
        </LvCard>
        {lines.length > 0 && (
          <LvCard theme={theme}>
            <h2 style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: `0 0 ${theme.space(3)}px` }}>The day so far</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
              {lines.map((line) => (
                <li key={line.key} style={{ ...theme.type.bodySmall, color: theme.color.textMuted, background: theme.color.surfaceSunken, borderRadius: theme.radius.pill, padding: `3px ${theme.space(3)}px` }}>
                  <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.bold }}>{line.count}</strong> {line.label}
                </li>
              ))}
            </ul>
          </LvCard>
        )}
      </>
    );
  }

  return (
    <>
      {header}

      {actionError && (
        <LvCard theme={theme} tone="danger">
          <p role="alert" style={{ ...theme.type.body, color: theme.color.danger, margin: 0 }}>
            {actionError}
          </p>
        </LvCard>
      )}

      {/* 1 — what needs me now */}
      <LvCard theme={theme}>
        {/* The heading counts them in words, so the numeral beside it stated
            the same fact twice. A small status dot carries the state instead. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap', marginBottom: theme.space(5) }}>
          <span
            aria-hidden="true"
            style={{
              flex: '0 0 auto',
              width: 8,
              height: 8,
              borderRadius: theme.radius.pill,
              background: actions.length > 0 ? theme.color.danger : theme.color.success,
            }}
          />
          <h2 style={{ ...theme.type.subheading, fontSize: 19, color: theme.color.heading, margin: 0, flex: 1, minWidth: 0 }}>
            {actions.length === 0 ? 'Nothing needs you right now' : `${actions.length} thing${actions.length === 1 ? '' : 's'} need your attention`}
          </h2>
        </div>

        {actions.length === 0 ? (
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0 }}>
            Nothing is overdue or breached. The work below is waiting but not urgent.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {actions.slice(0, 5).map((action: TodayAction, index) => {
              const verb = verbFor(action.why);

              return (
                <LvActionRow
                  key={action.ref?.ref ?? `${action.title}-${index}`}
                  theme={theme}
                  title={action.ref?.label ?? action.title}
                  subtitle={action.ref && action.ref.label !== action.title ? action.title : null}
                  urgent={reasonFor(action.why, action.ref?.label ?? action.title)}
                  tint={tintFor(index)}
                  avatarName={action.ref?.label ?? action.title}
                  action={
                    action.ref ? (
                      <LvButton theme={theme} size="sm" variant={index === 0 ? 'primary' : 'secondary'} icon={<LvIcon name={verb.icon} size={16} />} onClick={() => openRef(action.ref)}>
                        {verb.label}
                      </LvButton>
                    ) : undefined
                  }
                  onOpen={action.ref ? () => openRef(action.ref) : undefined}
                  openLabel={action.ref ? `Open ${action.ref.label}` : undefined}
                />
              );
            })}
          </ul>
        )}

        <div style={{ marginTop: theme.space(4), paddingTop: theme.space(3), borderTop: `1px solid ${theme.color.border}` }}>
          <AiRankingNote theme={theme} phase={aiPhase} onRetry={retryAi} />
        </div>
      </LvCard>

      {/* 2 — the work waiting behind it.

          The groups below are this morning's reading of it. The three links
          are the standing views: every follow-up by when it is due, and the
          two histories they come out of. They are shown whether or not today
          produced any groups, because the work exists either way. */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(3), flexWrap: 'wrap' }}>
        <h2 style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: 0, display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
          Your work
          {work.length > 0 && <CountPill theme={theme} count={totalWork} tone="neutral" />}
        </h2>
        <nav aria-label="Work management" style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), marginLeft: 'auto' }}>
        <LvButton theme={theme} variant="secondary" size="sm" onClick={() => navigate('/work/today')} icon={<LvIcon name="task" size={16} />}>
          All follow-ups
        </LvButton>
        <LvButton theme={theme} variant="ghost" size="sm" onClick={() => navigate('/work/interactions')} icon={<LvIcon name="messages" size={16} />}>
          Interactions log
        </LvButton>
        <LvButton theme={theme} variant="ghost" size="sm" onClick={() => navigate('/work/notes')} icon={<LvIcon name="note" size={16} />}>
          Notes
        </LvButton>
        {/* The leadership view. Shown to everyone because the SLA board and
            channel activity are genuinely scoped per person; the screens that
            are administrator-only refuse in the server's own words rather than
            being hidden here on a guess about the role. */}
        <LvButton theme={theme} variant="ghost" size="sm" onClick={() => navigate('/ops/control-tower')} icon={<LvIcon name="chart" size={16} />}>
          Control Tower
        </LvButton>
        </nav>
      </div>

      {work.length > 0 && (
        <>
          {work.map((entry) => (
            <WorkGroup
              key={entry.key}
              theme={theme}
              section={entry.section}
              tone={entry.tone}
              icon={entry.icon}
              now={now}
              defaultOpen={false}
              onOpenLead={(leadId) => navigate(`/leads/${leadId}`)}
              onCompleteTask={(taskId, leadId) => void completeTask(taskId, leadId)}
              busyTaskId={busyTaskId}
            />
          ))}
        </>
      )}
      </section>

      {/* 3 — what the day adds up to */}
      <div className="lv-two-col">
        <LvCard theme={theme}>
          <h2 style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: `0 0 ${theme.space(3)}px` }}>Today&apos;s work</h2>
          {counters.length === 0 ? (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>
              {summary?.kpis?.length ? 'Nothing is queued on your channels today.' : 'This view does not track a personal queue.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {counters.map((counter) => (
                <LvCounter key={counter.key} theme={theme} icon={counter.icon} tint={counter.tint} count={counter.value ?? 0} label={counter.label} />
              ))}
            </div>
          )}
        </LvCard>

        <LvCard theme={theme}>
          <h2 style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: `0 0 ${theme.space(3)}px`, display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
            <span aria-hidden="true" style={{ color: theme.color.accentInk, display: 'inline-flex' }}>
              <LvIcon name="sparkle" size={17} />
            </span>
            The day in a line
          </h2>
          <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>{briefing?.headline ?? 'Nothing to summarise yet.'}</p>
          {lines.length > 0 && (
            <ul style={{ margin: `${theme.space(3)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
              {lines.map((line) => (
                <li key={line.key} style={{ ...theme.type.bodySmall, color: theme.color.textMuted, background: theme.color.surfaceSunken, borderRadius: theme.radius.pill, padding: `3px ${theme.space(3)}px` }}>
                  <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.bold }}>{line.count}</strong> {line.label}
                </li>
              ))}
            </ul>
          )}
        </LvCard>
      </div>

      {/* 4 — what has just happened */}
      {activity.length > 0 && (
        <LvCard theme={theme}>
          <h2 style={{ ...theme.type.subheading, fontSize: 17, color: theme.color.heading, margin: `0 0 ${theme.space(3)}px` }}>Just happened</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {activity.map((item, index) => (
              <li key={`${item.at}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: theme.space(3) }}>
                <span aria-hidden="true" style={{ color: theme.color.textSubtle, display: 'inline-flex', marginTop: 2 }}>
                  <LvIcon name="clock" size={15} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.heading, overflowWrap: 'anywhere' }}>{item.title}</span>
                  {item.detail && <span style={{ display: 'block', ...theme.type.caption, color: theme.color.textMuted }}>{item.detail}</span>}
                </span>
                <span style={{ ...theme.type.caption, color: theme.color.textSubtle, flex: '0 0 auto' }}>{formatWhen(item.at, now)}</span>
              </li>
            ))}
          </ul>
        </LvCard>
      )}
    </>
  );
};
