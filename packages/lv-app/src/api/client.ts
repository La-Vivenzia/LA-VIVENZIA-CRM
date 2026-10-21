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

// A session that has run out.
//
// The token is only checked when the application starts, so before this an
// expiry surfaced as whatever the current screen happened to be doing — "The
// queue could not be loaded. Token has expired." with a Retry that could only
// fail again. It is not a screen's problem and no screen can fix it, so it is
// recognised here, once, and the application is told to ask the person to
// sign in again.
const EXPIRED = /token has expired|jwt expired|token expired|invalid token|unauthenticated|unauthorized/i;

export const isExpiredSession = (message: string | null | undefined): boolean => EXPIRED.test(message ?? '');

const expiryListeners = new Set<() => void>();

/** Called when any request finds the session no longer valid. */
export const onSessionExpired = (listener: () => void): (() => void) => {
  expiryListeners.add(listener);

  return () => expiryListeners.delete(listener);
};

const sessionExpired = () => {
  // Clearing first means a listener that re-renders cannot fire another
  // request with the dead token still in storage.
  setSession(null);

  for (const listener of expiryListeners) {
    listener();
  }
};

/**
 * 14.6 — reachability.
 *
 * `navigator.onLine` only knows whether the *device* has a network. It says
 * nothing about whether this server is answering, and it is wrong often
 * enough on desktop that it cannot be the only signal. So the truth is
 * whatever the last request found: a `fetch` that rejects before producing a
 * response means the server could not be reached, and a request that comes
 * back at all means it could.
 */
export const UNREACHABLE = 'The server could not be reached. Check your connection — nothing has been lost.';

let reachable = true;
const reachListeners = new Set<(reachable: boolean) => void>();

export const isReachable = (): boolean => reachable;

/** Called whenever the answer to "can we reach the server" changes. */
export const onReachabilityChange = (listener: (reachable: boolean) => void): (() => void) => {
  reachListeners.add(listener);

  return () => reachListeners.delete(listener);
};

const setReachable = (next: boolean) => {
  if (reachable === next) {
    return;
  }

  reachable = next;

  for (const listener of reachListeners) {
    listener(next);
  }
};

/**
 * A rejected `fetch` is a transport failure, not an answer: no status, no
 * body, nothing to reason about. An aborted request is deliberate and says
 * nothing about the server, so it is excluded.
 */
const isTransportFailure = (cause: unknown): boolean =>
  cause instanceof TypeError || (cause instanceof Error && cause.name !== 'AbortError' && /fetch failed|networkerror|failed to fetch|load failed/i.test(cause.message));

const raise = (message: string): never => {
  if (isExpiredSession(message)) {
    sessionExpired();
  }

  throw new Error(message);
};

/**
 * What came back, with the transport's own verdict kept alongside the body.
 *
 * The status used to be discarded the moment the body parsed, so a 502 from a
 * proxy carrying `{"error":"Bad gateway"}` — no `ok`, no `statusCode` — read
 * as a successful reply. Keeping it is what lets both callers below decide
 * for themselves.
 */
type Reply<T> = { status: number; httpOk: boolean; body: T };

const post = async <T>(path: string, body: unknown, token?: string): Promise<Reply<T>> => {
  // A refused connection or a DNS failure rejects here with no reply to
  // reason about. It is caught only to record that the server is unreachable
  // and to say so in words a person can act on — then it propagates as before.
  let response: Response;

  try {
    response = await fetch(`${SERVER_URL}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    if (isTransportFailure(cause)) {
      setReachable(false);

      throw new Error(UNREACHABLE);
    }

    throw cause;
  }

  // An answer of any kind — including a 500 — proves the server is there.
  setReachable(true);

  const text = await response.text();

  try {
    return { status: response.status, httpOk: response.ok, body: JSON.parse(text) as T };
  } catch {
    // Not JSON at all — an HTML error page, or nothing.
    throw new Error(text.slice(0, 200) || `Request failed (${response.status}).`);
  }
};

type GraphqlResponse<T> = { data?: T; errors?: { message: string }[] };

/**
 * A GraphQL mutation that carries a file, for the platform's `Upload` scalar.
 *
 * Added for one existing capability — `uploadWorkspaceLogo(file: Upload)` —
 * because the JSON transport above cannot express a file and the alternative
 * was a settings control that only appeared to work. It is the GraphQL
 * multipart request specification and nothing more: an `operations` field
 * holding the query with a null where the file goes, a `map` naming that
 * path, and the file itself as part "0".
 *
 * Deliberately not a general upload layer. `api/files.ts` already owns the
 * presigned-PUT flow for record attachments; this is the narrow case where
 * the server wants the bytes itself.
 */
export const uploadMultipart = async <T>(query: string, variablePath: string, file: File, endpoint: 'graphql' | 'metadata' = 'metadata'): Promise<T> => {
  const token = getSession()?.token;

  if (!token) {
    throw new Error('You are signed out.');
  }

  const form = new FormData();

  form.append('operations', JSON.stringify({ query, variables: { file: null } }));
  form.append('map', JSON.stringify({ 0: [variablePath] }));
  form.append('0', file, file.name);

  let response: Response;

  try {
    // No Content-Type header: the browser sets it with the multipart boundary,
    // and overriding it makes the body unparseable.
    response = await fetch(`${SERVER_URL}/${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  } catch (cause) {
    if (isTransportFailure(cause)) {
      setReachable(false);

      throw new Error(UNREACHABLE);
    }

    throw cause;
  }

  setReachable(true);

  const text = await response.text();
  let result: GraphqlResponse<T>;

  try {
    result = JSON.parse(text) as GraphqlResponse<T>;
  } catch {
    throw new Error(text.slice(0, 200) || `The upload failed (${response.status}).`);
  }

  if (result.errors?.length) {
    return raise(result.errors[0].message);
  }

  if (!response.ok || !result.data) {
    return raise(`The upload was rejected (${response.status}).`);
  }

  return result.data;
};

export const graphql = async <T>(query: string, variables: Record<string, unknown> = {}, endpoint: 'graphql' | 'metadata' = 'graphql'): Promise<T> => {
  const token = getSession()?.token;
  const { status, httpOk, body: result } = await post<GraphqlResponse<T>>(endpoint, { query, variables }, token);

  // GraphQL's own error is the better message, whatever the status, so it is
  // preferred over the bare code.
  if (result.errors?.length) {
    return raise(result.errors[0].message);
  }

  if (!httpOk) {
    return raise(`The server rejected that request (${status}).`);
  }

  if (!result.data) {
    throw new Error('The server returned no data.');
  }

  return result.data;
};

/**
 * A refusal, with the structure the route sent alongside its sentence.
 *
 * An LV route refuses with a 200 and `ok: false`, and it says why twice: in
 * prose for the person, and in a `refusal` code for the caller — plus, for
 * some routes, the records behind the decision. `DUPLICATE_UNDECIDED` carries
 * the matches it found, and a screen that wants to show them needs more than
 * the message.
 *
 * It extends Error and keeps the same message, so nothing that already
 * catches an Error and reads `.message` has to change.
 */
export class RouteRefusal extends Error {
  readonly refusal: string | null;
  readonly body: Record<string, unknown>;

  constructor(message: string, refusal: string | null, body: Record<string, unknown>) {
    super(message);
    this.name = 'RouteRefusal';
    this.refusal = refusal;
    this.body = body;
  }
}

/** The refusal code, when the failure was a refusal and carried one. */
export const refusalCode = (cause: unknown): string | null => (cause instanceof RouteRefusal ? cause.refusal : null);

// A refusal from an LV route is a 200 with `ok: false`, carrying the reason the
// server refused. Treating it as success would show a change that never
// happened, so it is raised here once for every screen.
export const callRoute = async <T>(path: string, body: Record<string, unknown> = {}): Promise<T> => {
  const token = getSession()?.token;

  if (!token) {
    throw new Error('You are signed out.');
  }

  const { status, httpOk, body: result } = await post<
    T & { ok?: boolean; refusal?: string; error?: string; message?: string; detail?: string; code?: string; statusCode?: number; messages?: string[] }
  >(`s${path}`, body, token);

  // An LV route's own refusal is the most useful thing it can say, so it is
  // read first however the request was framed.
  if (result.ok === false) {
    const code = typeof result.code === 'string' && result.code.startsWith('AI_') ? `${result.code}: ` : '';
    const detail = typeof result.detail === 'string' && result.detail.length > 0 ? ` (${result.detail})` : '';
    const message = `${code}${result.error ?? result.message ?? 'The server refused that action.'}${detail}`;

    if (isExpiredSession(message)) {
      sessionExpired();
    }

    // The sentence is still the Error's message, so every existing caller that
    // only reads `.message` behaves exactly as before. What is added is the
    // structured part of the refusal — its code, and whatever else the route
    // sent with it — which used to be thrown away. A duplicate check that
    // returns the records it matched is useless if the caller can only read
    // the prose.
    throw new RouteRefusal(message, typeof result.refusal === 'string' ? result.refusal : null, result as Record<string, unknown>);
  }

  // A route whose sandbox died answers with the platform's own envelope — a
  // statusCode and no `ok` at all — and that envelope arrives over HTTP 500.
  // Either signal is enough on its own: the envelope can come back on a 200,
  // and a gateway error can arrive with no envelope. Checking only for
  // `ok === false` let both through as data.
  const envelope = typeof result.statusCode === 'number' && result.statusCode >= 400;

  if (envelope || !httpOk) {
    const code = envelope ? result.statusCode : status;
    const detail =
      Array.isArray(result.messages) && result.messages.length > 0
        ? result.messages[0]
        : (result.error ?? result.message ?? 'no detail');

    return raise(`The server could not run that (${code}: ${detail}).`);
  }

  // Nothing said it failed, so it succeeded.
  return result;
};

type LoginTokenResponse = { data?: { getLoginTokenFromCredentials?: { loginToken?: { token: string; expiresAt?: string } } }; errors?: { message: string }[] };
type AuthTokenResponse = { data?: { getAuthTokensFromLoginToken?: { tokens?: { accessOrWorkspaceAgnosticToken?: { token: string; expiresAt?: string } } } }; errors?: { message: string }[] };

export const signIn = async (email: string, password: string): Promise<void> => {
  const origin = window.location.origin;
  const { body: login } = await post<LoginTokenResponse>('metadata', {
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

  const { body: auth } = await post<AuthTokenResponse>('metadata', {
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

export type Viewer = { workspaceMemberId: string | null; firstName: string; displayName: string; email: string | null; role: string | null };

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
  // `email` is the signed-in user's own address on the core User type, which
  // is what a profile should show. The workspace member's `userEmail` is the
  // same address seen from the workspace side, but it is a workspace field
  // rather than a core one and is not reliably on this schema — and this
  // query gates the entire application, so it asks only for what is certain.
  const me = await graphql<{ currentUser?: { email?: string | null; workspaceMember?: { id?: string; name?: { firstName?: string; lastName?: string } } } }>(
    '{ currentUser { email workspaceMember { id name { firstName lastName } } } }',
    {},
    'metadata',
  );
  const member = me.currentUser?.workspaceMember;
  const firstName = member?.name?.firstName?.trim() ?? '';
  const lastName = member?.name?.lastName?.trim() ?? '';
  const email = me.currentUser?.email?.trim() ?? '';
  const summary = await callRoute<{ viewer?: { lens?: string | null } }>('/dashboard/summary').catch(() => ({ viewer: undefined }));

  return {
    workspaceMemberId: member?.id ?? null,
    firstName: firstName || 'there',
    displayName: [firstName, lastName].filter(Boolean).join(' ') || 'there',
    email: email === '' ? null : email,
    role: summary.viewer?.lens ? (LENS_LABELS[summary.viewer.lens] ?? null) : null,
  };
};
