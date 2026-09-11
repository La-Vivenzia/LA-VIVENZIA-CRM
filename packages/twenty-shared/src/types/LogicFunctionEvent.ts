export type LogicFunctionEvent<TBody = object> = {
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined>;
  pathParameters: Record<string, string | undefined>;
  body: TBody | null;
  rawBody?: string;
  isBase64Encoded: boolean;
  requestContext: {
    http: {
      method: string;
      path: string;
    };
  };
  // Populated for HTTP-route triggers with `isAuthRequired: true`. null
  // when the trigger fires without a user (cron, database events) or when
  // auth is disabled.
  userWorkspaceId: string | null;
  // The workspace member the platform authenticated for this request, resolved
  // server-side from the session. null for API-key, application and
  // unauthenticated callers. Functions that record who performed an action
  // should use this rather than anything in the body, which the caller wrote.
  workspaceMemberId: string | null;
};
