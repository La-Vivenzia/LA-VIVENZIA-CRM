import { DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// Two GraphQL clients, two identities, deliberately named:
//
//   delegated   — the signed-in caller. CM-004 row scoping and the caller's
//                 object permissions apply. Used to READ the records an
//                 insight is about (so nobody gets an insight for a record
//                 they cannot open) and to WRITE any change a person accepts
//                 (so the platform, not this code, decides if they may).
//   application — the app's own role. Used ONLY for the AI bookkeeping
//                 objects (lvAiInsight, lvAiRun, lvProblem) that team roles
//                 cannot read or write directly.

export type GraphqlClient = Pick<DelegatedGraphqlClient, 'query'>;

export const delegatedClient = (): DelegatedGraphqlClient => new DelegatedGraphqlClient();

export const applicationClient = (): DelegatedGraphqlClient => {
  const token = process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (!token) {
    throw new Error('Application API access is not configured for this function.');
  }

  return new DelegatedGraphqlClient({ token });
};

// Bounded JSON for RAW_JSON columns: an oversized payload is truncated with a
// marker rather than rejected, so an audit row is never lost to size.
export const boundedJson = (value: unknown, maxChars = 12_000): unknown => {
  const text = JSON.stringify(value ?? null);

  if (text.length <= maxChars) {
    return value ?? null;
  }

  return { truncated: true, preview: text.slice(0, maxChars) };
};
