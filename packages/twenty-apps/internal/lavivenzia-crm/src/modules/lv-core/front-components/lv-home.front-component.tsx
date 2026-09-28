import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme } from 'twenty-sdk/front-component';

import { FC_LV_HOME_ID } from 'src/constants/universal-identifiers';
import { EmptyState, LoadingState, LvCard, LvStyles } from 'src/modules/lv-core/ui/kit';
import { TodayScreen } from 'src/modules/lv-dashboard/front-components/today/today-screen';
import { LV_DOOR_DEFINITIONS, LvEntryGrid, LvHero, LvShell, type LvDoor } from 'src/modules/lv-core/ui/shell';
import { themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';

// The La Vivenzia workspace — phase 1 of the exact-match rebuild.
//
// This component owns the whole screen: the six-door rail, the top bar and the
// content area (docs/UI-EXACT-MATCH-PLAN.md §1). Navigation between doors is
// state inside the shell rather than routing, because a front component runs
// in Twenty's sandboxed renderer and has no router of its own.
//
// The active door is NOT mirrored into the URL: the component executes inside
// a Web Worker, where `location` is a read-only WorkerLocation, and assigning
// to `location.hash` throws on load ("Cannot set property hash of [object
// WorkerLocation]"), which kills the whole component. Deep-linking a door has
// to go through the host, and is left for a later phase.
//
// Phase 1 ships the frame and the home screen. Each door's own screen arrives
// in its phase (Today 2, Profile 3, Capture 4, Onboarding/Messages 5, Ask 6);
// until then a door says plainly what is coming rather than pretending.

const DOOR_PHASE: Record<LvDoor, string> = {
  today: 'Phase 2',
  leads: 'Phase 4',
  capture: 'Phase 4',
  onboarding: 'Phase 5',
  messages: 'Phase 5',
  ask: 'Phase 6',
};

// The lens the server derived, in the words the team uses for itself.
const LENS_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  OVERSIGHT: 'Leadership',
  HUNTER: 'Experience Hunter',
  COORDINATOR: 'Lead Coordinator',
  ONBOARDING: 'Onboarding Expert',
};

type Viewer = { name: string; fullName: string | null; role: string | null };

export const LvHome = () => {
  const theme = themeFor(useColorScheme());
  const [door, setDoor] = useState<LvDoor | null>(null);
  const [search, setSearch] = useState('');
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);

  // Who is looking, and how many notifications they have — the two things the
  // top bar needs. Both come from the dashboard route the app already serves.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const summary = (await callRoute('/dashboard/summary', {})) as {
          viewer?: { displayName?: string | null; firstName?: string | null; lens?: string | null };
        };

        if (!cancelled) {
          setViewer({
            name: summary.viewer?.firstName ?? summary.viewer?.displayName ?? 'there',
            fullName: summary.viewer?.displayName ?? null,
            role: LENS_LABELS[summary.viewer?.lens ?? ''] ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setViewer({ name: 'there', fullName: null, role: null });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const openDoor = useCallback((next: LvDoor) => {
    setDoor(next);
  }, []);

  if (loading) {
    return (
      <div className="lv-root">
        <LvStyles theme={theme} />
        <LoadingState theme={theme} label="Opening your workspace" />
      </div>
    );
  }

  const active = door ?? 'today';
  const definition = LV_DOOR_DEFINITIONS.find((item) => item.key === active);

  return (
    <>
      <LvStyles theme={theme} />
      <LvShell
        theme={theme}
        active={active}
        onNavigate={openDoor}
        user={{ name: viewer?.fullName ?? viewer?.name ?? 'there', role: viewer?.role }}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => void navigate(AppPath.RecordIndexPage, { objectNamePlural: 'lvLeads' })}
        onNotifications={() => void navigate(AppPath.RecordIndexPage, { objectNamePlural: 'lvNotifications' })}
        onSettings={() => void navigate(AppPath.SettingsCatchAll, { '*': 'general' })}
        onHome={() => setDoor(null)}
      >
        {door === null ? (
          <>
            <LvHero
              theme={theme}
              greeting={`Good day, ${viewer?.name ?? 'there'} 👋`}
              subtitle="Let's make more meaningful experiences happen today."
              aside="More experiences. A kinder world."
            />
            <LvEntryGrid theme={theme} onOpen={openDoor} />
          </>
        ) : active === 'today' ? (
          <TodayScreen theme={theme} firstName={viewer?.name ?? 'there'} />
        ) : (
          <LvCard theme={theme}>
            <EmptyState
              theme={theme}
              title={definition?.label ?? 'Coming soon'}
              text={`${definition?.description ?? ''} — this screen is built in ${DOOR_PHASE[active]} of the UI rebuild. Until then, use the existing menu.`}
            />
          </LvCard>
        )}
      </LvShell>
    </>
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_LV_HOME_ID,
  name: 'lv-home',
  description: 'The La Vivenzia workspace: six doors, global search, the home screen and Today',
  component: LvHome,
});
