import 'src/modules/lv-core/runtime/resilient-fetch';
// Minimal GraphQL transport for the dashboard routes.
//
// The dashboards need dozens of COUNT / GROUP BY aggregations per page. The
// generated CoreApiClient issues one request per query; a hand-written
// document with aliases lets the whole dashboard be one or two round-trips
// while every count is still computed by the database.
//
// Always DELEGATED: the token is the signed-in caller's, so CM-004 and the
// caller's object permissions decide what each aggregation can see. Nothing
// here elevates.

export type GraphqlErrors = { message: string }[];

export class DelegatedGraphqlClient {
  private readonly apiUrl: string;
  private readonly token: string;

  constructor(options: { apiUrl?: string; token?: string } = {}) {
    const apiUrl = options.apiUrl ?? process.env.TWENTY_API_URL;
    const token = options.token ?? process.env.TWENTY_APP_ACCESS_TOKEN;

    if (!apiUrl || !token) {
      throw new Error('Delegated API access is not configured for this function.');
    }

    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.token = token;
  }

  async query<T>(
    document: string,
    variables: Record<string, unknown> = {},
    endpoint: 'graphql' | 'metadata' = 'graphql',
  ): Promise<{ data: T; errors: GraphqlErrors }> {
    const response = await fetch(`${this.apiUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query: document, variables }),
    });

    const body = (await response.json()) as { data?: T; errors?: GraphqlErrors };

    if (!response.ok && !body.data) {
      throw new Error(`API request failed (${response.status}).`);
    }

    return { data: (body.data ?? {}) as T, errors: body.errors ?? [] };
  }
}

// Serialises a filter object as a GraphQL input literal. Enum-valued fields
// in Twenty's filter inputs accept strings, so JSON with unquoted keys is the
// whole job. Values are never interpolated from user input without passing
// through the validators in control-tower-filters.ts first.
export const toGraphqlInput = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(toGraphqlInput).join(', ')}]`;
  }

  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => `${key}: ${toGraphqlInput(entry)}`)
      .join(', ')}}`;
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  return String(value);
};
