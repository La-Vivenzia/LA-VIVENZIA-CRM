// How the La Vivenzia interface talks to its backend.
//
// Twenty is the backend and nothing else: this application owns every screen,
// and reaches the server through three doors only —
//   1. `auth`      — Twenty's own credential mutations, so sessions and
//                    password rules stay the platform's business;
//   2. `callRoute` — the application's own HTTP routes (`/s/...`), which is
//                    where every CRM decision lives (capture, assignment,
//                    lifecycle, onboarding, AI, SLA);
//   3. `graphql`   — for plain record reads that need no business logic.
//
// The token is the signed-in person's own, so the server applies their
// permissions; the client never decides what someone may see.

const SERVER_URL = (import.meta.env.VITE_LV_SERVER_URL as string | undefined) ?? 'http://localhost:3100';

const TOKEN_KEY = 'lv.session';

type StoredSession = { token: string; expiresAt: string | null };

let session: StoredSession | null = null;

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);

    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
};

export const getSession = (): StoredSession | null => session ?? (session = readStoredSession());

export const setSession = (next: StoredSession | null) => {
  session = next;

  try {
    if (next) {
      window.localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // A browser with storage disabled still works for the current tab.
  }
};

const post = async <T>(path: string, body: unknown, token?: string): Promise<T> => {
  const response = await fetch(`${SERVER_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || `Request failed (${response.status}).`);
  }
};

type GraphqlResponse<T> = { data?: T; errors?: { message: string }[] };

export const graphql = async <T>(query: string, variables: Record<string, unknown> = {}, endpoint: 'graphql' | 'metadata' = 'graphql'): Promise<T> => {
  const token = getSession()?.token;
  const result = await post<GraphqlResponse<T>>(endpoint, { query, variables }, token);

  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }

  if (!result.data) {
    throw new Error('The server returned no data.');
  }

  return result.data;
};

// A refusal from an LV route is a 200 with `ok: false`, carrying the reason the
// server refused. Treating it as success would show a change that never
// happened, so it is raised here once for every screen.
export const callRoute = async <T>(path: string, body: Record<string, unknown> = {}): Promise<T> => {
  const token = getSession()?.token;

  if (!token) {
    throw new Error('You are signed out.');
  }

  const result = await post<T & { ok?: boolean; error?: string; message?: string; detail?: string; code?: string }>(`s${path}`, body, token);

  if (result.ok === false) {
    const code = typeof result.code === 'string' && result.code.startsWith('AI_') ? `${result.code}: ` : '';
    const detail = typeof result.detail === 'string' && result.detail.length > 0 ? ` (${result.detail})` : '';

    throw new Error(`${code}${result.error ?? result.message ?? 'The server refused that action.'}${detail}`);
  }

  return result;
};

type LoginTokenResponse = { data?: { getLoginTokenFromCredentials?: { loginToken?: { token: string; expiresAt?: string } } }; errors?: { message: string }[] };
type AuthTokenResponse = { data?: { getAuthTokensFromLoginToken?: { tokens?: { accessOrWorkspaceAgnosticToken?: { token: string; expiresAt?: string } } } }; errors?: { message: string }[] };

export const signIn = async (email: string, password: string): Promise<void> => {
  const origin = window.location.origin;
  const login = await post<LoginTokenResponse>('metadata', {
    query: `mutation($email: String!, $password: String!, $origin: String!) {
      getLoginTokenFromCredentials(email: $email, password: $password, origin: $origin) { loginToken { token expiresAt } }
    }`,
    variables: { email, password, origin },
  });

  if (login.errors?.length) {
    throw new Error(login.errors[0].message);
  }

  const loginToken = login.data?.getLoginTokenFromCredentials?.loginToken?.token;

  if (!loginToken) {
    throw new Error('Those credentials were not accepted.');
  }

  const auth = await post<AuthTokenResponse>('metadata', {
    query: `mutation($loginToken: String!, $origin: String!) {
      getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
        tokens { accessOrWorkspaceAgnosticToken { token expiresAt } }
      }
    }`,
    variables: { loginToken, origin },
  });

  if (auth.errors?.length) {
    throw new Error(auth.errors[0].message);
  }

  const access = auth.data?.getAuthTokensFromLoginToken?.tokens?.accessOrWorkspaceAgnosticToken;

  if (!access?.token) {
    throw new Error('The server did not return a session.');
  }

  setSession({ token: access.token, expiresAt: access.expiresAt ?? null });
};

export const signOut = () => setSession(null);

export type Viewer = { workspaceMemberId: string | null; firstName: string; displayName: string; role: string | null };

const LENS_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  OVERSIGHT: 'Leadership',
  HUNTER: 'Experience Hunter',
  COORDINATOR: 'Lead Coordinator',
  ONBOARDING: 'Onboarding Expert',
};

// Who is signed in. The name comes from Twenty's own record so the greeting is
// the person's real name, and the role from the lens the server derived.
export const fetchViewer = async (): Promise<Viewer> => {
  const me = await graphql<{ currentUser?: { workspaceMember?: { id?: string; name?: { firstName?: string; lastName?: string } } } }>(
    '{ currentUser { workspaceMember { id name { firstName lastName } } } }',
    {},
    'metadata',
  );
  const member = me.currentUser?.workspaceMember;
  const firstName = member?.name?.firstName?.trim() ?? '';
  const lastName = member?.name?.lastName?.trim() ?? '';
  const summary = await callRoute<{ viewer?: { lens?: string | null } }>('/dashboard/summary').catch(() => ({ viewer: undefined }));

  return {
    workspaceMemberId: member?.id ?? null,
    firstName: firstName || 'there',
    displayName: [firstName, lastName].filter(Boolean).join(' ') || 'there',
    role: summary.viewer?.lens ? (LENS_LABELS[summary.viewer.lens] ?? null) : null,
  };
};
