// Reading the input of an HTTP-route logic function.
//
// Route handlers do NOT receive their JSON body as the argument. Twenty hands
// them a Lambda-style proxy event:
//
//   { headers, queryStringParameters, pathParameters, body, rawBody,
//     isBase64Encoded, requestContext: { http: { method, path } },
//     userWorkspaceId }
//
// A handler that reads `input.onboardingId` therefore always sees undefined,
// which is what every route in this application did before this helper
// existed. The mistake is invisible until a route is actually called.
//
// `userWorkspaceId` is set by the platform from the authenticated session. It
// is the one piece of identity in the event a caller cannot forge, so it is
// what proves a human was really there.

export type RouteEvent = {
  body?: unknown;
  rawBody?: unknown;
  headers?: Record<string, unknown>;
  queryStringParameters?: Record<string, string | undefined> | null;
  pathParameters?: Record<string, string | undefined> | null;
  userWorkspaceId?: string | null;
  // Set by the platform from the session (CM-004). The only actor identity a
  // route may trust; anything in the body was written by the caller.
  workspaceMemberId?: string | null;
  requestContext?: { http?: { method?: string; path?: string } };
};

const parseBody = (body: unknown): Record<string, unknown> => {
  if (body === null || body === undefined) {
    return {};
  }

  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);

      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  if (typeof body === 'object') {
    return body as Record<string, unknown>;
  }

  return {};
};

// True when the event has the proxy shape. Anything else is treated as a
// directly-invoked payload, which is how `twenty dev:function:exec` and the
// unit tests call a handler.
const looksLikeRouteEvent = (event: unknown): event is RouteEvent =>
  typeof event === 'object' &&
  event !== null &&
  ('requestContext' in event ||
    'queryStringParameters' in event ||
    'userWorkspaceId' in event ||
    'rawBody' in event);

export type RouteInput<T> = {
  input: T;
  // Null only when the handler was invoked directly rather than over HTTP.
  userWorkspaceId: string | null;
  // The authenticated workspace member, resolved server-side. Null for API
  // keys, integrations and direct invocation. This — never a body field — is
  // who performed the action.
  actorWorkspaceMemberId: string | null;
  isHttpRequest: boolean;
};

export const readRouteInput = <T extends Record<string, unknown>>(
  event: unknown,
): RouteInput<T> => {
  if (!looksLikeRouteEvent(event)) {
    return {
      input: ((event ?? {}) as T),
      userWorkspaceId: null,
      actorWorkspaceMemberId: null,
      isHttpRequest: false,
    };
  }

  return {
    input: parseBody(event.body) as T,
    userWorkspaceId:
      typeof event.userWorkspaceId === 'string' && event.userWorkspaceId.length > 0
        ? event.userWorkspaceId
        : null,
    actorWorkspaceMemberId:
      typeof event.workspaceMemberId === 'string' && event.workspaceMemberId.length > 0
        ? event.workspaceMemberId
        : null,
    isHttpRequest: true,
  };
};
