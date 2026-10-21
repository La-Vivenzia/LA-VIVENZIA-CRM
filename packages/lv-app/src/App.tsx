import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { fetchViewer, getSession, onSessionExpired, signOut, type Viewer } from 'src/api/client';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, searchEverything } from 'src/api/shell';
import { LvNotificationPanel, type LvNotification } from 'src/design/feedback';
import { formatWhen, LoadingState, LvOfflineBanner, LvStyles } from 'src/design/kit';
import { LvGlobalSearch, LvNotificationBell, type LvSearchResult } from 'src/design/search';
import { LV_SECONDARY_ITEMS, LvAppShell, type LvDoor, type LvSecondaryItem } from 'src/design/shell';
import { themeFor } from 'src/design/theme';
import { useColorScheme } from 'src/design/use-color-scheme';
import { useConnection } from 'src/design/use-connection';
import { SEARCH_DESTINATIONS } from 'src/routes';
import { AccountScreen } from 'src/screens/AccountScreen';
import { AskScreen } from 'src/screens/AskScreen';
import { BriefingScreen } from 'src/screens/BriefingScreen';
import { EcosystemRecordScreen } from 'src/screens/EcosystemRecordScreen';
import { EcosystemScreen } from 'src/screens/EcosystemScreen';
import { HomeScreen } from 'src/screens/HomeScreen';
import { LeadsScreen } from 'src/screens/LeadsScreen';
import { MessagesScreen } from 'src/screens/MessagesScreen';
import { OnboardingRecordScreen } from 'src/screens/OnboardingRecordScreen';
import { OnboardingScreen } from 'src/screens/OnboardingScreen';
import { OrganisationScreen } from 'src/screens/OrganisationScreen';
import { OrganisationsScreen } from 'src/screens/OrganisationsScreen';
import { PeopleScreen } from 'src/screens/PeopleScreen';
import { PersonScreen } from 'src/screens/PersonScreen';
import { ProfileScreen } from 'src/screens/ProfileScreen';
import { SettingsScreen } from 'src/screens/SettingsScreen';
import { SignInScreen } from 'src/screens/SignInScreen';
import { TodayScreen } from 'src/screens/TodayScreen';
import { WorkLogScreen } from 'src/screens/WorkLogScreen';
import { WorkNotesScreen } from 'src/screens/WorkNotesScreen';
import { WorkScreen } from 'src/screens/WorkScreen';

// Route-level code splitting.
//
// Three groups, each a destination a person goes to deliberately rather than
// one they land on: the design system (which is for the team building the
// product, not using it, and which drags in the chart primitives and the
// 34kB responsive contract that nothing else needs), the capture and import
// flows, and the six leadership screens.
//
// Today, My Leads, the lead profile, messages, onboarding, the ecosystem and
// the directory stay eager. They are what the CRM opens on, and splitting the
// first paint to save bytes on it would be the wrong trade.
//
// Named exports, so each one is mapped to a default here. Written out one by
// one rather than through a helper, because naming the export inline is what
// lets TypeScript keep each screen's real prop types.
const CaptureScreen = lazy(() => import('src/screens/CaptureScreen').then((module) => ({ default: module.CaptureScreen })));
const ImportScreen = lazy(() => import('src/screens/ImportScreen').then((module) => ({ default: module.ImportScreen })));
const DesignSystemScreen = lazy(() => import('src/screens/DesignSystemScreen').then((module) => ({ default: module.DesignSystemScreen })));
const ControlTowerScreen = lazy(() => import('src/screens/ControlTowerScreen').then((module) => ({ default: module.ControlTowerScreen })));
const OpsPipelineScreen = lazy(() => import('src/screens/OpsPipelineScreen').then((module) => ({ default: module.OpsPipelineScreen })));
const OpsSlaScreen = lazy(() => import('src/screens/OpsSlaScreen').then((module) => ({ default: module.OpsSlaScreen })));
const OpsChannelsScreen = lazy(() => import('src/screens/OpsChannelsScreen').then((module) => ({ default: module.OpsChannelsScreen })));
const OpsDocumentsScreen = lazy(() => import('src/screens/OpsDocumentsScreen').then((module) => ({ default: module.OpsDocumentsScreen })));
const OpsAuditScreen = lazy(() => import('src/screens/OpsAuditScreen').then((module) => ({ default: module.OpsAuditScreen })));

// Every door is a URL. `/` is the six entry cards; `/today`, `/leads` and the
// rest are the doors themselves, so a link, a refresh and the back button all
// behave the way a person expects.
const DOOR_PATHS: Record<LvDoor, string> = {
  today: '/today',
  leads: '/leads',
  capture: '/capture',
  onboarding: '/onboarding',
  messages: '/messages',
  ask: '/ask',
};

const doorFromPath = (pathname: string): LvDoor | null =>
  (Object.entries(DOOR_PATHS).find(([, path]) => pathname.startsWith(path))?.[0] as LvDoor | undefined) ?? null;

const secondaryFromPath = (pathname: string): string | null => {
  if (pathname.startsWith('/settings')) {
    return 'settings';
  }

  return LV_SECONDARY_ITEMS.find((item) => pathname.startsWith(item.path))?.key ?? null;
};

// Which pages lay themselves on a rounded panel and which sit open on the
// photograph. The references use both: a flow or a record is a panel, a
// destination that opens with a display title is not.
const OPEN_CANVAS_PATHS = ['/', '/today'];

export const App = () => {
  // The colour scheme follows the operating system until the person chooses
  // otherwise in Settings, and that choice is remembered. Both token sets have
  // always been complete; until now this line read `themeFor('light')` under a
  // comment that described exactly this behaviour and did not implement it.
  const appearance = useColorScheme();
  const theme = themeFor(appearance.scheme);
  const navigate = useNavigate();
  const location = useLocation();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  // 14.6 — one connection bar for the whole application.
  const connection = useConnection(fetchViewer);
  const [status, setStatus] = useState<'checking' | 'signed-out' | 'ready'>('checking');
  // Set when a request found the session dead, so the sign-in screen can say
  // why the person is looking at it instead of what they were doing.
  const [expired, setExpired] = useState(false);
  const [notifications, setNotifications] = useState<LvNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);

  const load = useCallback(async () => {
    if (!getSession()) {
      setStatus('signed-out');

      return;
    }

    try {
      setViewer(await fetchViewer());
      setStatus('ready');
    } catch {
      signOut();
      setStatus('signed-out');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Any request, on any screen, can be the one that discovers the session has
  // run out. Whichever it is, the answer is the same: stop, and ask them to
  // sign in again.
  useEffect(
    () =>
      onSessionExpired(() => {
        setViewer(null);
        setNotifications([]);
        setExpired(true);
        setStatus('signed-out');
      }),
    [],
  );

  const openLead = useCallback((id: string) => navigate(`/leads/${id}`), [navigate]);

  // Notifications are read once the shell is up, and again whenever the bell
  // is opened — the CRM writes them from its own engines, so the browser
  // cannot know when one arrives without asking.
  const loadNotifications = useCallback(async () => {
    if (!getSession()) {
      return;
    }

    try {
      setNotifications(await fetchNotifications(new Date().toISOString(), formatWhen, openLead));
    } catch {
      // A bell that cannot be filled is not worth interrupting the product
      // for; the panel shows its empty state and the rest of the CRM works.
      setNotifications([]);
    }
  }, [openLead]);

  useEffect(() => {
    if (status === 'ready') {
      void loadNotifications();
    }
  }, [status, loadNotifications]);

  const unread = useMemo(() => notifications.filter((notification) => notification.unread).length, [notifications]);

  // The directory lives under /directory. These used to point at `/people/:id`
  // and `/organisations/:id`, which are not routes — so two of global search's
  // three result types fell through the catch-all and silently returned the
  // person to the home screen. `SEARCH_DESTINATIONS` and the test beside it
  // exist so that a destination can never again drift away from a real route
  // without something failing.
  const onSearch = useCallback(
    (term: string, signal: AbortSignal): Promise<LvSearchResult[]> =>
      searchEverything(term, signal, {
        lead: openLead,
        person: (id) => navigate(SEARCH_DESTINATIONS.person(id)),
        organisation: (id) => navigate(SEARCH_DESTINATIONS.organisation(id)),
      }),
    [navigate, openLead],
  );

  if (status === 'checking') {
    return (
      <>
        <LvStyles theme={theme} />
        <div className="lv-root" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: theme.color.page }}>
          <LoadingState theme={theme} label="Opening La Vivenzia" />
        </div>
      </>
    );
  }

  if (status === 'signed-out') {
    return (
      <>
        <LvStyles theme={theme} />
        <SignInScreen
          theme={theme}
          notice={expired ? 'Your session ran out, so you have been signed out. Sign in again to pick up where you were.' : undefined}
          onSignedIn={() => {
            setExpired(false);
            void load();
          }}
        />
      </>
    );
  }

  const active = doorFromPath(location.pathname);
  const activeSecondary = secondaryFromPath(location.pathname);
  const canvas = OPEN_CANVAS_PATHS.includes(location.pathname) ? 'open' : 'panel';

  const signOutNow = () => {
    signOut();
    setViewer(null);
    setNotifications([]);
    setExpired(false);
    setStatus('signed-out');
  };

  return (
    <>
      <LvStyles theme={theme} />
      {/* Inside .lv-root, because the whole stylesheet is scoped to it: a bar
          rendered as a sibling of the shell gets none of its rules — not the
          fixed position, not the 44px touch floor on its own button. */}
      {connection.offline && (
        <div className="lv-root">
          <LvOfflineBanner theme={theme} onRetry={connection.retry} retrying={connection.retrying} />
        </div>
      )}
      <LvAppShell
        theme={theme}
        active={active}
        activeSecondary={activeSecondary}
        onNavigate={(door) => navigate(DOOR_PATHS[door])}
        onNavigateSecondary={(item: LvSecondaryItem) => navigate(item.path)}
        onHome={() => navigate('/')}
        onSettings={() => navigate('/settings')}
        canvas={canvas}
        user={{ name: viewer?.displayName ?? 'there', role: viewer?.role }}
        accountActions={[
          { key: 'profile', label: 'Your profile', icon: 'profile', onSelect: () => navigate('/profile') },
          { key: 'settings', label: 'Settings', icon: 'settings', onSelect: () => navigate('/settings') },
          { key: 'signout', label: 'Sign out', icon: 'signout', tone: 'danger', onSelect: signOutNow },
        ]}
        search={<LvGlobalSearch theme={theme} onSearch={onSearch} onSubmitAll={(term) => navigate(`/leads?q=${encodeURIComponent(term)}`)} />}
        notifications={
          <LvNotificationBell
            theme={theme}
            count={unread}
            open={bellOpen}
            onToggle={() => {
              setBellOpen((value) => {
                if (!value) {
                  void loadNotifications();
                }

                return !value;
              });
            }}
          >
            <LvNotificationPanel
              theme={theme}
              notifications={notifications.map((notification) => ({
                ...notification,
                onOpen: notification.onOpen
                  ? () => {
                      setBellOpen(false);
                      void markNotificationRead(notification.id).then(loadNotifications, () => undefined);
                      notification.onOpen?.();
                    }
                  : undefined,
              }))}
              onClose={() => setBellOpen(false)}
              onMarkAllRead={
                unread > 0
                  ? () => {
                      void markAllNotificationsRead().then(loadNotifications, () => undefined);
                    }
                  : undefined
              }
            />
          </LvNotificationBell>
        }
      >
        {/* One boundary for every split route. Each screen already shows its
            own loading state while it fetches, so the same component is the
            right thing to show while its code arrives. */}
        <Suspense fallback={<LoadingState theme={theme} rows={4} label="Opening" />}>
        <Routes>
          <Route path="/" element={<HomeScreen theme={theme} firstName={viewer?.firstName ?? 'there'} onOpen={(door) => navigate(DOOR_PATHS[door])} />} />
          <Route path="/today" element={<TodayScreen theme={theme} firstName={viewer?.firstName ?? 'there'} />} />
          <Route path="/today/briefing" element={<BriefingScreen theme={theme} />} />
          <Route path="/leads" element={<LeadsScreen theme={theme} />} />
          <Route path="/leads/:leadId" element={<ProfileScreen theme={theme} />} />
          {/* The section is part of the URL, so a colleague can be sent
              straight to a lead's documents and the back button behaves. */}
          <Route path="/leads/:leadId/:tab" element={<ProfileScreen theme={theme} />} />
          {/* The design system, rendered. Not a door — it is for the team
              building the product, not for the team using it. */}
          <Route path="/capture" element={<CaptureScreen theme={theme} />} />
          <Route path="/capture/import" element={<ImportScreen theme={theme} />} />
          <Route path="/onboarding" element={<OnboardingScreen theme={theme} viewerId={viewer?.workspaceMemberId ?? null} />} />
          <Route path="/onboarding/:onboardingId" element={<OnboardingRecordScreen theme={theme} />} />
          {/* The section is in the URL so a colleague can be sent straight to
              a partner's documents, and the back button behaves. */}
          <Route path="/onboarding/:onboardingId/:section" element={<OnboardingRecordScreen theme={theme} />} />
          {/* The ecosystem: partners, and the properties and experiences they
              put on the platform. One list surface and one record surface
              over three kinds, because the server composes all three alike. */}
          <Route path="/ecosystem" element={<Navigate to="/ecosystem/partners" replace />} />
          <Route path="/ecosystem/:kind" element={<EcosystemScreen theme={theme} viewerId={viewer?.workspaceMemberId ?? null} />} />
          <Route path="/ecosystem/:kind/:id" element={<EcosystemRecordScreen theme={theme} />} />
          <Route path="/ecosystem/:kind/:id/:section" element={<EcosystemRecordScreen theme={theme} />} />
          {/* Messages. The thread is a real route, so Back works on a phone
              and a colleague can be sent straight to one. */}
          <Route path="/messages" element={<MessagesScreen theme={theme} viewerId={viewer?.workspaceMemberId ?? null} />} />
          <Route path="/messages/:leadId" element={<MessagesScreen theme={theme} viewerId={viewer?.workspaceMemberId ?? null} />} />
          {/* People & organisations — the directory behind the ecosystem.
              Twenty's own person and company records, which La Vivenzia links
              to through the partner. Reached from the ecosystem, which is what
              they belong to. */}
          <Route path="/directory" element={<Navigate to="/directory/people" replace />} />
          <Route path="/directory/people" element={<PeopleScreen theme={theme} />} />
          <Route path="/directory/people/:personId" element={<PersonScreen theme={theme} />} />
          <Route path="/directory/organisations" element={<OrganisationsScreen theme={theme} />} />
          <Route path="/directory/organisations/:companyId" element={<OrganisationScreen theme={theme} />} />
          {/* Leadership & operations. Six analytical screens on one surface,
              reached from Today rather than a seventh door. The Control Tower,
              pipeline and verification backlog are administrator-only — the
              route decides that and refuses in its own words — while the SLA
              board and channel activity are delegated and scoped per person. */}
          <Route path="/ops" element={<Navigate to="/ops/control-tower" replace />} />
          <Route path="/ops/control-tower" element={<ControlTowerScreen theme={theme} />} />
          <Route path="/ops/pipeline" element={<OpsPipelineScreen theme={theme} />} />
          <Route path="/ops/sla" element={<OpsSlaScreen theme={theme} />} />
          <Route path="/ops/channels" element={<OpsChannelsScreen theme={theme} />} />
          <Route path="/ops/documents" element={<OpsDocumentsScreen theme={theme} />} />
          <Route path="/ops/audit" element={<OpsAuditScreen theme={theme} />} />
          {/* Work management. Four lenses on the same follow-ups, plus the
              two histories they come out of. Reached from Today's own "Your
              work" section rather than a seventh door — the six doors are the
              approved IA and work is what Today is about. */}
          <Route path="/work" element={<Navigate to="/work/today" replace />} />
          <Route path="/work/interactions" element={<WorkLogScreen theme={theme} />} />
          <Route path="/work/notes" element={<WorkNotesScreen theme={theme} />} />
          <Route path="/work/:lens" element={<WorkScreen theme={theme} />} />
          {/* Ask LV. One question, one answer — no transcript, because the
              backend keeps no conversation. */}
          <Route path="/ask" element={<AskScreen theme={theme} />} />
          <Route path="/design" element={<DesignSystemScreen theme={theme} />} />
          <Route
            path="/profile"
            element={<AccountScreen theme={theme} viewer={viewer} appearance={appearance} onSignedOut={signOutNow} onOpenSettings={() => navigate('/settings')} />}
          />
          <Route path="/settings" element={<SettingsScreen theme={theme} viewer={viewer} appearance={appearance} onOpenProfile={() => navigate('/profile')} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </LvAppShell>
    </>
  );
};
