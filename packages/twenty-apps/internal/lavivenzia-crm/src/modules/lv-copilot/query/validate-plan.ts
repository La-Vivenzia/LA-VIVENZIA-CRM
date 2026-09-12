import { isRecord } from 'src/modules/lv-ai/provider/structured-output';
import { COPILOT_OBJECTS, type CopilotObject, DEFAULT_LIMIT, type FieldSpec, MAX_LIMIT, OPERATORS, type Operator, type PlanFilter, type QueryPlan, SCHEMA } from 'src/modules/lv-copilot/query/query-schema';

// Validates an untrusted plan (from the rule engine or the model) against
// the allowlist and turns it into a Twenty GraphQL filter. Every rejection is
// a named reason so tests can assert exactly what was refused.

export type Validation = { ok: true; plan: QueryPlan } | { ok: false; reason: string };

const DAY = 86_400_000;

// "today", "yesterday", "tomorrow", "7d" (7 days ago), "-3d" (3 days ahead),
// or an ISO date/time. Anything else is rejected.
export const resolveDate = (value: unknown, now: string): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim().toLowerCase();
  const base = new Date(now);
  const startOfDay = (offsetDays: number) => {
    const at = new Date(base.getTime() + offsetDays * DAY);

    at.setUTCHours(0, 0, 0, 0);

    return at.toISOString();
  };

  if (text === 'now') {
    return base.toISOString();
  }

  if (text === 'today') {
    return startOfDay(0);
  }

  if (text === 'yesterday') {
    return startOfDay(-1);
  }

  if (text === 'tomorrow') {
    return startOfDay(1);
  }

  const relative = text.match(/^(-?)(\d{1,3})d$/);

  if (relative) {
    const days = Number(relative[2]) * (relative[1] === '-' ? -1 : 1);

    return new Date(base.getTime() - days * DAY).toISOString();
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) && /^\d{4}-\d{2}-\d{2}/.test(text) ? new Date(parsed).toISOString() : null;
};

const validateValue = (field: FieldSpec, operator: Operator, value: unknown, now: string): { ok: true; value: unknown } | { ok: false; reason: string } => {
  if (operator === 'is_null' || operator === 'is_not_null') {
    return { ok: true, value: null };
  }

  switch (field.kind) {
    case 'enum': {
      const values = Array.isArray(value) ? value : [value];
      const clean = values.map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : ''));

      if (clean.length === 0 || clean.some((item) => !(field.values ?? []).includes(item))) {
        return { ok: false, reason: `Value not in the allowed vocabulary for ${field.graphql}.` };
      }

      if (operator !== 'in' && clean.length !== 1) {
        return { ok: false, reason: `Operator ${operator} takes a single value.` };
      }

      if (!['eq', 'neq', 'in'].includes(operator)) {
        return { ok: false, reason: `Operator ${operator} is not allowed on an enum field.` };
      }

      return { ok: true, value: operator === 'in' ? clean : clean[0] };
    }
    case 'text':
    case 'composite_text': {
      if (typeof value !== 'string' || value.trim().length === 0 || value.length > 80) {
        return { ok: false, reason: 'Text values must be 1–80 characters.' };
      }

      if (!['eq', 'neq', 'contains'].includes(operator)) {
        return { ok: false, reason: `Operator ${operator} is not allowed on a text field.` };
      }

      // Strip the LIKE wildcards; the value is a literal.
      return { ok: true, value: value.trim().replace(/[%_]/g, '') };
    }
    case 'number': {
      const number = typeof value === 'number' ? value : Number(value);

      if (!Number.isFinite(number)) {
        return { ok: false, reason: 'Number expected.' };
      }

      if (!['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(operator)) {
        return { ok: false, reason: `Operator ${operator} is not allowed on a number field.` };
      }

      return { ok: true, value: number };
    }
    case 'date': {
      const iso = resolveDate(value, now);

      if (!iso) {
        return { ok: false, reason: 'Date expected (ISO, today, yesterday, tomorrow, Nd).' };
      }

      if (!['gt', 'gte', 'lt', 'lte', 'eq'].includes(operator)) {
        return { ok: false, reason: `Operator ${operator} is not allowed on a date field.` };
      }

      return { ok: true, value: iso };
    }
    case 'member': {
      const text = typeof value === 'string' ? value.trim().toLowerCase() : '';

      if (text !== 'me' && text !== 'none') {
        // A UUID or a name here would let a client target another member's
        // rows by name; CM-004 would still stop the read, but the plan is
        // refused outright so the intent is never even attempted.
        return { ok: false, reason: 'Member filters accept only "me" or "none".' };
      }

      if (operator !== 'eq' && operator !== 'neq') {
        return { ok: false, reason: `Operator ${operator} is not allowed on a member field.` };
      }

      return { ok: true, value: text };
    }
    default:
      return { ok: false, reason: 'Unsupported field kind.' };
  }
};

export const validatePlan = (raw: unknown, now = new Date().toISOString()): Validation => {
  if (!isRecord(raw)) {
    return { ok: false, reason: 'Plan must be an object.' };
  }

  const object = typeof raw.object === 'string' ? raw.object.trim().toLowerCase() : '';

  if (!(COPILOT_OBJECTS as readonly string[]).includes(object)) {
    return { ok: false, reason: `Unsupported object "${object || '?'}".` };
  }

  const spec = SCHEMA[object as CopilotObject];
  const rawFilters = Array.isArray(raw.filters) ? raw.filters : [];

  if (rawFilters.length > 8) {
    return { ok: false, reason: 'Too many filters (max 8).' };
  }

  const filters: PlanFilter[] = [];

  for (const item of rawFilters) {
    if (!isRecord(item) || typeof item.field !== 'string' || typeof item.operator !== 'string') {
      return { ok: false, reason: 'Each filter needs a field and an operator.' };
    }

    const field = spec.fields[item.field];

    if (!field) {
      return { ok: false, reason: `Unsupported field "${item.field}" on ${object}.` };
    }

    const operator = item.operator.toLowerCase();

    if (!(OPERATORS as readonly string[]).includes(operator)) {
      return { ok: false, reason: `Unsupported operator "${item.operator}".` };
    }

    const value = validateValue(field, operator as Operator, item.value, now);

    if (!value.ok) {
      return { ok: false, reason: value.reason };
    }

    filters.push({ field: item.field, operator: operator as Operator, value: value.value });
  }

  let sort: QueryPlan['sort'] = null;

  if (isRecord(raw.sort) && typeof raw.sort.field === 'string') {
    const field = spec.fields[raw.sort.field];

    if (!field?.sortable) {
      return { ok: false, reason: `Cannot sort by "${raw.sort.field}".` };
    }

    sort = { field: raw.sort.field, direction: raw.sort.direction === 'asc' ? 'asc' : 'desc' };
  }

  const requestedLimit = typeof raw.limit === 'number' && Number.isFinite(raw.limit) ? Math.floor(raw.limit) : DEFAULT_LIMIT;

  if (requestedLimit > MAX_LIMIT) {
    return { ok: false, reason: `Limit ${requestedLimit} exceeds the maximum of ${MAX_LIMIT}.` };
  }

  return { ok: true, plan: { object: object as CopilotObject, filters, sort, limit: Math.max(1, requestedLimit) } };
};

// GraphQL filter for a validated plan. "me" becomes the caller's own member
// id here — and only here; nothing from the client ever reaches this column.
export const toGraphqlFilter = (plan: QueryPlan, callerWorkspaceMemberId: string): Record<string, unknown> => {
  const spec = SCHEMA[plan.object];
  const clauses: Record<string, unknown>[] = [];

  for (const filter of plan.filters) {
    const field = spec.fields[filter.field]!;
    const column = field.graphql;
    let clause: Record<string, unknown>;

    switch (filter.operator) {
      case 'is_null':
        clause = { [column]: { is: 'NULL' } };
        break;
      case 'is_not_null':
        clause = { [column]: { is: 'NOT_NULL' } };
        break;
      case 'contains':
        clause = field.kind === 'composite_text' ? { [column]: { [field.sub!]: { ilike: `%${String(filter.value)}%` } } } : { [column]: { ilike: `%${String(filter.value)}%` } };
        break;
      case 'in':
        clause = { [column]: { in: filter.value } };
        break;
      case 'eq':
      case 'neq': {
        if (field.kind === 'member') {
          const resolved = filter.value === 'me' ? callerWorkspaceMemberId : null;

          clause =
            resolved === null
              ? { [column]: { is: filter.operator === 'eq' ? 'NULL' : 'NOT_NULL' } }
              : { [column]: { [filter.operator]: resolved } };
        } else if (field.kind === 'composite_text') {
          clause = { [column]: { [field.sub!]: { [filter.operator]: filter.value } } };
        } else {
          clause = { [column]: { [filter.operator]: filter.value } };
        }
        break;
      }
      default:
        clause = { [column]: { [filter.operator]: filter.value } };
    }

    clauses.push(clause);
  }

  return clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0]! : { and: clauses };
};

export const toGraphqlOrderBy = (plan: QueryPlan): Record<string, string>[] => {
  const spec = SCHEMA[plan.object];
  const sort = plan.sort ?? spec.defaultSort;
  const column = spec.fields[sort.field]?.graphql ?? sort.field;

  return [{ [column]: sort.direction === 'asc' ? 'AscNullsLast' : 'DescNullsLast' }];
};
