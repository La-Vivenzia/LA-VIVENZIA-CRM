import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { fetchViewer, getSession, signOut, type Viewer } from 'src/api/client';
import { LoadingState, LvStyles } from 'src/design/kit';
import { LV_DOOR_DEFINITIONS, LvShell, type LvDoor } from 'src/design/shell';
import { themeFor } from 'src/design/theme';
import { AccountScreen } from 'src/screens/AccountScreen';
import { HomeScreen } from 'src/screens/HomeScreen';
import { LeadsScreen } from 'src/screens/LeadsScreen';
import { PlaceholderScreen } from 'src/screens/PlaceholderScreen';
import { ProfileScreen } from 'src/screens/ProfileScreen';
import { SignInScreen } from 'src/screens/SignInScreen';
import { TodayScreen } from 'src/screens/TodayScreen';

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

const doorFromPath = (pathname: string): LvDoor =>
  (Object.entries(DOOR_PATHS).find(([, path]) => pathname.startsWith(path))?.[0] as LvDoor | undefined) ?? 'today';

export const App = () => {
  // The colour scheme follows the operating system until the person chooses;
  // the reference boards are light, and that is the default.
  const theme = themeFor('light');
  const navigate = useNavigate();
  const location = useLocation();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [status, setStatus] = useState<'checking' | 'signed-out' | 'ready'>('checking');
  const [search, setSearch] = useState('');

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
        <SignInScreen theme={theme} onSignedIn={() => void load()} />
      </>
    );
  }

  const active = doorFromPath(location.pathname);

  return (
    <>
      <LvStyles theme={theme} />
      <LvShell
        theme={theme}
        active={active}
        onNavigate={(door) => navigate(DOOR_PATHS[door])}
        onHome={() => navigate('/')}
        user={{ name: viewer?.displayName ?? 'there', role: viewer?.role }}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => navigate(`/leads?q=${encodeURIComponent(search)}`)}
        onProfile={() => navigate('/profile')}
        onSettings={() => navigate('/settings')}
      >
        <Routes>
          <Route path="/" element={<HomeScreen theme={theme} firstName={viewer?.firstName ?? 'there'} onOpen={(door) => navigate(DOOR_PATHS[door])} />} />
          <Route path="/today" element={<TodayScreen theme={theme} firstName={viewer?.firstName ?? 'there'} />} />
          <Route path="/leads" element={<LeadsScreen theme={theme} />} />
          <Route path="/leads/:leadId" element={<ProfileScreen theme={theme} />} />
          <Route
            path="/profile"
            element={<AccountScreen theme={theme} viewer={viewer} onSignedOut={() => { setViewer(null); setStatus('signed-out'); }} />}
          />
          {LV_DOOR_DEFINITIONS.filter((door) => door.key !== 'today' && door.key !== 'leads').map((door) => (
            <Route key={door.key} path={DOOR_PATHS[door.key]} element={<PlaceholderScreen theme={theme} door={door} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LvShell>
    </>
  );
};
