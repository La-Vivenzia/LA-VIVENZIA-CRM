import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { callRoute } from 'src/api/client';
import { LvIcon, type LvIconName } from 'src/design/icons';
import { ErrorState, LoadingState, LvActionRow, LvButton, LvCard, LvCounter } from 'src/design/kit';
import { LvHero } from 'src/design/shell';
import { type LvTheme, type LvTint } from 'src/design/theme';

// Today — the first door, and the screen the reference boards open on.
//
// It answers one question: what needs this person today? The attention rows
// carry the action you would actually take (call, review, message) rather than
// making someone open a record to find out. Everything here already existed as
// data: /ai/briefing ranks the work and writes the headline, /dashboard/summary
// counts the day. Nothing new is computed in the browser.

type Ref = { ref: string; label: string; target: { object: string; recordId: string } };
type Action = { title: string; why: string; ref: Ref | null; origin: 'RULES' | 'MODEL' };
type BriefingLine = { key: string; count: number; label: string };

type Briefing = {
  ok?: boolean;
  error?: string;
  headline?: string;
  today?: BriefingLine[];
  topActions?: Action[];
  ai?: { available?: boolean; reason?: string | null };
};

type Kpi = { key: string; label: string; value: number };
type Summary = { ok?: boolean; kpis?: Kpi[]; viewer?: { firstName?: string | null } };

// The counters the boards show, in their order, with the channel they belong
// to. A counter only appears when the lens actually produced it.
const COUNTERS: { key: string; label: string; icon: LvIconName; tint: LvTint }[] = [
  { key: 'calls', label: 'Calls', icon: 'phone', tint: 'lavender' },
  { key: 'whatsapp', label: 'WhatsApps', icon: 'whatsapp', tint: 'mint' },
  { key: 'meetings', label: 'Meetings', icon: 'meeting', tint: 'blue' },
  { key: 'overdue', label: 'Overdue', icon: 'clock', tint: 'pink' },
];

// What the person should do with this row, inferred from why it was raised.
// The verb matters: "Call" and "Review" are different days' work.
const actionFor = (why: string): { label: string; icon: LvIconName; primary: boolean } => {
  const text = why.toLowerCase();

  if (text.includes('document') || text.includes('verif') || text.includes('onboard')) {
    return { label: 'Review', icon: 'document', primary: false };
  }

  if (text.includes('whatsapp') || text.includes('message') || text.includes('repl')) {
    return { label: 'WhatsApp', icon: 'whatsapp', primary: false };
  }

  return { label: 'Call', icon: 'phone', primary: true };
};

const tintFor = (index: number): LvTint => (['mint', 'blue', 'peach', 'lavender', 'pink'] as const)[index % 5];

const greetingFor = (hour: number): string => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

export const TodayScreen = ({ theme, firstName }: { theme: LvTheme; firstName: string }) => {
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // Both at once: the briefing is the slower of the two because it may
        // ask the model, and the counters should not wait for it.
        const [brief, dash] = await Promise.all([
          callRoute<Briefing>('/ai/briefing'),
          callRoute<Summary>('/dashboard/summary'),
        ]);

        if (!cancelled) {
          setBriefing(brief);
          setSummary(dash);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Today could not be loaded.');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== null) {
    return <ErrorState theme={theme} text={error} />;
  }

  if (briefing === null || summary === null) {
    return <LoadingState theme={theme} label="Gathering today" />;
  }

  const actions = (briefing.topActions ?? []).slice(0, 3);
  const counters = COUNTERS.map((counter) => ({ ...counter, value: summary.kpis?.find((kpi) => kpi.key === counter.key)?.value ?? null })).filter(
    (counter) => counter.value !== null,
  );
  const openRef = (ref: Ref | null) => {
    if (ref) {
      navigate(`/leads/${ref.target.recordId}`);
    }
  };

  return (
    <>
      <LvHero
        theme={theme}
        greeting={`${greetingFor(new Date().getHours())}, ${firstName} 👋`}
        subtitle="Here's what needs your attention today."
        aside="More experiences. A kinder world."
      />

      <LvCard theme={theme}>
        <h2 style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: `0 0 ${theme.space(4)}px`, display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
          <span
            aria-hidden="true"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 26, borderRadius: theme.radius.pill, background: actions.length > 0 ? theme.color.danger : theme.color.success, color: '#FFFFFF', ...theme.type.bodySmall, fontWeight: theme.font.weight.bold }}
          >
            {actions.length}
          </span>
          {actions.length === 0 ? 'Nothing needs your attention' : `${actions.length} thing${actions.length === 1 ? '' : 's'} need your attention`}
        </h2>

        {actions.length === 0 ? (
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0 }}>
            Your queue is clear — nothing is overdue, breached or waiting on you.
          </p>
        ) : (
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
            {actions.map((action, index) => {
              const verb = actionFor(action.why);

              return (
                <LvActionRow
                  key={action.ref?.ref ?? action.title}
                  theme={theme}
                  title={action.ref?.label ?? action.title}
                  // The briefing often names the record it points at, which
                  // would print the same line twice.
                  subtitle={action.ref && action.ref.label !== action.title ? action.title : null}
                  urgent={action.why}
                  tint={tintFor(index)}
                  avatarName={action.ref?.label ?? action.title}
                  action={
                    <LvButton
                      theme={theme}
                      size="sm"
                      variant={verb.primary ? 'primary' : 'secondary'}
                      icon={<LvIcon name={verb.icon} size={16} />}
                      onClick={() => openRef(action.ref)}
                    >
                      {verb.label}
                    </LvButton>
                  }
                  onOpen={action.ref ? () => openRef(action.ref) : undefined}
                  openLabel={action.ref ? `Open ${action.ref.label}` : undefined}
                />
              );
            })}
          </ul>
        )}
      </LvCard>

      <div className="lv-two-col">
        <LvCard theme={theme}>
          <h2 style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: `0 0 ${theme.space(3)}px` }}>Today&apos;s work</h2>
          {counters.length === 0 ? (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: 0 }}>This view does not track a personal queue.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {counters.map((counter) => (
                <LvCounter
                  key={counter.key}
                  theme={theme}
                  icon={counter.icon}
                  tint={counter.tint}
                  count={counter.value ?? 0}
                  label={counter.label}
                  onClick={() => navigate('/today')}
                />
              ))}
            </div>
          )}
        </LvCard>

        <LvCard theme={theme}>
          <h2 style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: `0 0 ${theme.space(3)}px`, display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
            <span style={{ color: theme.color.accentInk, display: 'inline-flex' }}>
              <LvIcon name="sparkle" size={18} />
            </span>
            AI says
          </h2>
          <p style={{ ...theme.type.body, color: theme.color.text, margin: 0 }}>
            {briefing.headline ?? 'No summary is available right now.'}
          </p>
          {briefing.ai?.available === false && (
            <p style={{ ...theme.type.bodySmall, color: theme.color.textMuted, margin: `${theme.space(3)}px 0 0` }}>
              Written from your CRM data; the assistant is unavailable{briefing.ai?.reason ? ` (${briefing.ai.reason})` : ''}.
            </p>
          )}
          {(briefing.today ?? []).length > 0 && (
            <ul style={{ margin: `${theme.space(3)}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: theme.space(2) }}>
              {(briefing.today ?? []).map((line) => (
                <li
                  key={line.key}
                  style={{ ...theme.type.bodySmall, color: theme.color.textMuted, background: theme.color.surfaceSunken, borderRadius: theme.radius.pill, padding: `2px ${theme.space(3)}px` }}
                >
                  <strong style={{ color: theme.color.heading, fontWeight: theme.font.weight.bold }}>{line.count}</strong> {line.label}
                </li>
              ))}
            </ul>
          )}
        </LvCard>
      </div>
    </>
  );
};
