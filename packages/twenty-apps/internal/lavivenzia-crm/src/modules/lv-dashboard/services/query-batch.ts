import { type DelegatedGraphqlClient } from 'src/modules/lv-dashboard/services/graphql-client';

// Builds ONE GraphQL document out of many aggregations, each behind an alias,
// with every filter passed as a typed variable (so enum values such as
// `is: NULL` coerce correctly and nothing is string-interpolated).
//
// Three shapes cover every dashboard metric:
//   count    → `alias: lvLeads(first: 1, filter: $v) { totalCount }`   COUNT(*) WHERE
//   groupBy  → `alias: lvLeadsGroupBy(groupBy: [...], filter: $v) {...}` GROUP BY
//   list     → `alias: lvLeads(first: n, filter: $v, orderBy: [...]) {...}` bounded rows
//
// Each builder returns a reader that pulls its slice out of the response, so
// the calling code never touches alias names.

export type ObjectSpec = { plural: string; type: string };

export const OBJECTS = {
  lead: { plural: 'lvLeads', type: 'LvLead' },
  task: { plural: 'tasks', type: 'Task' },
  sla: { plural: 'lvSlas', type: 'LvSla' },
  onboarding: { plural: 'lvOnboardings', type: 'LvOnboarding' },
  document: { plural: 'lvOnboardingDocuments', type: 'LvOnboardingDocument' },
  interaction: { plural: 'lvInteractions', type: 'LvInteraction' },
  notification: { plural: 'lvNotifications', type: 'LvNotification' },
  note: { plural: 'notes', type: 'Note' },
  assignmentHistory: { plural: 'lvAssignmentHistories', type: 'LvAssignmentHistory' },
  taskTarget: { plural: 'taskTargets', type: 'TaskTarget' },
  auditEvent: { plural: 'lvAuditEvents', type: 'LvAuditEvent' },
  problem: { plural: 'lvProblems', type: 'LvProblem' },
  aiRun: { plural: 'lvAiRuns', type: 'LvAiRun' },
} as const;

export type GroupRow = { groupByDimensionValues: (string | null)[]; totalCount: number };

type Variable = { name: string; type: string; value: unknown };
type Field = { alias: string; root: string; body: string; variables: Variable[] };

// Twenty refuses documents with more than 20 root resolvers, and refuses the
// same root resolver twice in one document (aliases do not help). A batch is
// therefore packed into documents that each name a root resolver at most
// once and stay under the limit; the documents run in parallel and the
// results are merged. For a typical dashboard that is 10–13 requests, every one
// of them a set of COUNT / GROUP BY / bounded SELECT run by the database.
export const MAX_ROOT_RESOLVERS_PER_REQUEST = 18;

export const packFields = <T extends { root: string }>(fields: T[], limit = MAX_ROOT_RESOLVERS_PER_REQUEST): T[][] => {
  const chunks: { roots: Set<string>; fields: T[] }[] = [];

  for (const field of fields) {
    let chunk = chunks.find((candidate) => !candidate.roots.has(field.root) && candidate.fields.length < limit);

    if (!chunk) {
      chunk = { roots: new Set(), fields: [] };
      chunks.push(chunk);
    }

    chunk.roots.add(field.root);
    chunk.fields.push(field);
  }

  return chunks.map((chunk) => chunk.fields);
};

export class QueryBatch {
  private readonly fields: Field[] = [];
  private pending: Variable[] = [];
  private sequence = 0;

  private declare(type: string, value: unknown): string {
    const name = `v${this.sequence++}`;

    this.pending.push({ name, type, value });

    return `$${name}`;
  }

  private push(alias: string, root: string, body: string): void {
    this.fields.push({ alias, root, body, variables: this.pending });
    this.pending = [];
  }

  private alias(prefix: string): string {
    return `${prefix}_${this.fields.length}`;
  }

  count(object: ObjectSpec, filter: Record<string, unknown>): (data: Record<string, unknown>) => number {
    const alias = this.alias('count');
    const variable = this.declare(`${object.type}FilterInput`, filter);

    this.push(alias, object.plural, `${object.plural}(first: 1, filter: ${variable}) { totalCount }`);

    return (data) => Number((data[alias] as { totalCount?: number } | undefined)?.totalCount ?? 0);
  }

  groupBy(
    object: ObjectSpec,
    dimension: string,
    filter: Record<string, unknown>,
  ): (data: Record<string, unknown>) => Record<string, number> {
    const alias = this.alias('group');
    const variable = this.declare(`${object.type}FilterInput`, filter);

    this.push(
      alias,
      `${object.plural}GroupBy`,
      `${object.plural}GroupBy(groupBy: [{ ${dimension}: true }], filter: ${variable}) { groupByDimensionValues totalCount }`,
    );

    return (data) => {
      const rows = (data[alias] as GroupRow[] | undefined) ?? [];
      const out: Record<string, number> = {};

      for (const row of rows) {
        const key = row.groupByDimensionValues[0];

        out[key === null || key === undefined ? '__null' : String(key)] = row.totalCount;
      }

      return out;
    };
  }

  list<T>(
    object: ObjectSpec,
    options: {
      filter: Record<string, unknown>;
      orderBy?: Record<string, string>[];
      first: number;
      selection: string;
    },
  ): (data: Record<string, unknown>) => { rows: T[]; totalCount: number } {
    const alias = this.alias('list');
    const variable = this.declare(`${object.type}FilterInput`, options.filter);
    const orderVariable = options.orderBy
      ? this.declare(`[${object.type}OrderByInput]`, options.orderBy)
      : null;

    this.push(
      alias,
      object.plural,
      `${object.plural}(first: ${Math.max(1, Math.min(100, Math.floor(options.first)))}, filter: ${variable}${orderVariable ? `, orderBy: ${orderVariable}` : ''}) { totalCount edges { node { ${options.selection} } } }`,
    );

    return (data) => {
      const connection = data[alias] as { totalCount?: number; edges?: { node?: T }[] } | undefined;

      return {
        totalCount: Number(connection?.totalCount ?? 0),
        rows: (connection?.edges ?? []).map((edge) => edge.node).filter((node): node is T => Boolean(node)),
      };
    };
  }

  get size(): number {
    return this.fields.length;
  }

  get requestCount(): number {
    return packFields(this.fields).length;
  }

  async run(client: DelegatedGraphqlClient): Promise<{ data: Record<string, unknown>; errors: string[] }> {
    if (this.fields.length === 0) {
      return { data: {}, errors: [] };
    }

    const chunks = packFields(this.fields);

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const variables = chunk.flatMap((field) => field.variables);
        const declarations = variables.map((variable) => `$${variable.name}: ${variable.type}`);
        const lines = chunk.map((field) => `  ${field.alias}: ${field.body}`);
        const document = [
          `query Dashboard${declarations.length > 0 ? `(${declarations.join(', ')})` : ''} {`,
          ...lines,
          '}',
        ].join(String.fromCharCode(10));

        return client.query<Record<string, unknown>>(
          document,
          Object.fromEntries(variables.map((variable) => [variable.name, variable.value])),
        );
      }),
    );

    return {
      data: Object.assign({}, ...results.map((result) => result.data)),
      errors: results.flatMap((result) => result.errors.map((error) => error.message)),
    };
  }
}
