import { useCallback, useEffect, useRef, useState } from 'react';

import { callRoute } from 'src/api/client';

// Today's data, in two phases.
//
// The briefing route builds its facts deterministically and only then, when a
// model is configured, asks it to reorder them. The deterministic half takes
// about a second; the model adds twenty-five more. Waiting for both is what
// made Today take half a minute to appear.
//
// So Today asks twice. First with `skipModel`, which returns the complete
// briefing ranked by the fixed rule — everything a person needs to start
// working. Then again without the flag, in the background, and folds the
// model's ranking in when it arrives. Nothing is faked while it is in flight:
// the page says which ranking it is showing, and if the model never answers
// the rules-based one simply stays.

export type TodayRef = { ref: string; label: string; target: { object: string; recordId: string } };

export type TodayAction = { title: string; why: string; ref: TodayRef | null; origin: 'RULES' | 'MODEL' };

export type BriefingLine = { key: string; count: number; label: string; link?: { object: string } | null };

export type Briefing = {
  ok?: boolean;
  error?: string;
  generatedAt?: string;
  lens?: string;
  headline?: string;
  today?: BriefingLine[];
  topActions?: TodayAction[];
  ai?: { available?: boolean; reason?: string | null };
  narrative?: { provider: string; model: string | null; status: 'RULES' | 'MODEL' | 'UNAVAILABLE'; code: string | null };
  notes?: string[];
};

export type Kpi = { key: string; label: string; value: number | null; emptyText: string; tone?: string; link?: { object: string } | null };

export type ActionRow = Record<string, unknown> & {
  id?: string;
  title?: string | null;
  name?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  lvLeadId?: string | null;
  dueAt?: string | null;
  priority?: string | null;
  status?: string | null;
  rule?: string | null;
  target?: { object: string; recordId: string } | null;
};

export type ActionSection = { key: string; title: string; emptyText: string; totalCount: number; rows: ActionRow[] };

export type ActivityItem = {
  kind: string;
  at: string;
  title: string;
  detail: string | null;
  target: { object: string; recordId: string } | null;
};

export type Summary = {
  ok?: boolean;
  lens?: string;
  generatedAt?: string;
  kpis?: Kpi[];
  actions?: ActionSection[];
  activity?: ActivityItem[];
  viewer?: { firstName?: string | null; displayName?: string | null; lens?: string | null };
  partial?: string[];
};

/** Where the enriched briefing is in its life. */
export type AiPhase =
  /** No provider is configured for this workspace — nothing is coming. */
  | 'none'
  /** Asked, still reading. */
  | 'loading'
  /** The model answered and its ranking is what the page is showing. */
  | 'ready'
  /** Read back from this session rather than asked again. */
  | 'cached'
  /** It did not answer. The rules-based briefing is still on screen. */
  | 'failed';

// The model is asked at most once per session per day. A second visit to Today
// in the same session reads this back instead of spending another half minute.
const cacheKey = (day: string, lens: string) => `lv.today.briefing.${day}.${lens}`;

const readCache = (day: string, lens: string): Briefing | null => {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(day, lens));

    return raw ? (JSON.parse(raw) as Briefing) : null;
  } catch {
    return null;
  }
};

const writeCache = (day: string, lens: string, briefing: Briefing) => {
  try {
    window.sessionStorage.setItem(cacheKey(day, lens), JSON.stringify(briefing));
  } catch {
    // A remembered briefing is a convenience, never a requirement.
  }
};

export const clearBriefingCache = (day: string, lens: string) => {
  try {
    window.sessionStorage.removeItem(cacheKey(day, lens));
  } catch {
    // Nothing to do; the next load simply asks again.
  }
};

// Long enough for a model that is thinking, short enough that "still reading"
// does not sit on the page for ever. The route's own budget is 45 seconds.
const AI_TIMEOUT_MS = 40_000;

export type TodayData = {
  briefing: Briefing | null;
  summary: Summary | null;
  /** The ranking on screen: the model's when it answered, the rule's otherwise. */
  actions: TodayAction[];
  aiPhase: AiPhase;
  error: string | null;
  loading: boolean;
  reload: () => void;
  retryAi: () => void;
};

export const useTodayData = (): TodayData => {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [enriched, setEnriched] = useState<Briefing | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [aiPhase, setAiPhase] = useState<AiPhase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [aiAttempt, setAiAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;

    return () => {
      live.current = false;
    };
  }, []);

  const timeZoneOffsetMinutes = new Date().getTimezoneOffset();

  // Phase one: everything the CRM already knows, with the model skipped.
  useEffect(() => {
    let cancelled = false;

    setError(null);

    const load = async () => {
      try {
        const [fast, dash] = await Promise.all([
          callRoute<Briefing>('/ai/briefing', { timeZoneOffsetMinutes, skipModel: true }),
          callRoute<Summary>('/dashboard/summary', { timeZoneOffsetMinutes }),
        ]);

        if (!cancelled) {
          setBriefing(fast);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Phase two: the model's ranking, folded in when and if it arrives.
  useEffect(() => {
    if (briefing === null) {
      return;
    }

    const day = (briefing.generatedAt ?? new Date().toISOString()).slice(0, 10);
    const lens = briefing.lens ?? 'default';

    if (briefing.ai?.available !== true) {
      setAiPhase('none');

      return;
    }

    const cached = aiAttempt === 0 ? readCache(day, lens) : null;

    if (cached) {
      setEnriched(cached);
      setAiPhase('cached');

      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        setAiPhase('failed');
      }
    }, AI_TIMEOUT_MS);

    setAiPhase('loading');

    const enrich = async () => {
      try {
        const full = await callRoute<Briefing>('/ai/briefing', { timeZoneOffsetMinutes });

        if (cancelled) {
          return;
        }

        // The route reports honestly when the model did not answer; a briefing
        // that fell back to the rules is not an enrichment, so it is not
        // cached and not announced as one.
        if (full.narrative?.status === 'MODEL') {
          writeCache(day, lens, full);
          setEnriched(full);
          setAiPhase('ready');
        } else {
          setAiPhase('failed');
        }
      } catch {
        if (!cancelled) {
          setAiPhase('failed');
        }
      } finally {
        window.clearTimeout(timer);
      }
    };

    void enrich();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing, aiAttempt]);

  const reload = useCallback(() => {
    setBriefing(null);
    setSummary(null);
    setEnriched(null);
    setAiPhase('loading');
    setAttempt((value) => value + 1);
  }, []);

  const retryAi = useCallback(() => {
    const day = (briefing?.generatedAt ?? new Date().toISOString()).slice(0, 10);

    clearBriefingCache(day, briefing?.lens ?? 'default');
    setEnriched(null);
    setAiAttempt((value) => value + 1);
  }, [briefing]);

  const shown = enriched ?? briefing;

  return {
    briefing: shown,
    summary,
    actions: shown?.topActions ?? [],
    aiPhase,
    error,
    loading: briefing === null || summary === null,
    reload,
    retryAi,
  };
};

// ---------------------------------------------------------------------------
// The sections of Today's work, in the order a day is actually worked.
//
// The dashboard engine returns one set of sections per lens; these are the
// keys that belong on Today, with the tone each carries. A key that the
// caller's lens did not produce is simply absent — nothing is invented to
// fill a gap.
// ---------------------------------------------------------------------------
export const TODAY_WORK_SECTIONS: { key: string; tone: 'danger' | 'warning' | 'info' | 'neutral'; icon: 'clock' | 'task' | 'onboarding' | 'document' | 'leads' | 'warning' }[] = [
  { key: 'slaBreached', tone: 'danger', icon: 'warning' },
  { key: 'overdueFollowUps', tone: 'danger', icon: 'clock' },
  { key: 'overdue', tone: 'danger', icon: 'clock' },
  { key: 'dueToday', tone: 'warning', icon: 'task' },
  { key: 'slaDue', tone: 'warning', icon: 'warning' },
  { key: 'approvals', tone: 'warning', icon: 'onboarding' },
  { key: 'rejectedDocs', tone: 'danger', icon: 'document' },
  { key: 'docReview', tone: 'warning', icon: 'document' },
  { key: 'firstContact', tone: 'warning', icon: 'leads' },
  { key: 'highNoRecent', tone: 'info', icon: 'leads' },
  { key: 'awaiting', tone: 'info', icon: 'leads' },
  { key: 'noNextAction', tone: 'neutral', icon: 'leads' },
  { key: 'stuck', tone: 'warning', icon: 'leads' },
];
