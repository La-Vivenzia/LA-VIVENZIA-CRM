import { LEAD_PRIORITIES, LEAD_STATUSES } from 'src/modules/lv-core/constants/lead-lifecycle';
import {
  LEAD_CATEGORY_OPTIONS,
  LEAD_SOURCE_OPTIONS,
} from 'src/modules/lv-core/constants/select-options.generated';
import { ONBOARDING_STATUSES } from 'src/modules/lv-onboarding/constants/onboarding-status';
import { SLA_STATUSES } from 'src/modules/lv-sla/constants/sla-rules';
import { type Filter } from 'src/modules/lv-dashboard/metrics/definitions';

// Control Tower filters: parsed and validated server-side, then turned into
// GraphQL filters that are ANDed into every lead / task / SLA / onboarding
// query. Nothing from the body is used until it has passed through here.
//
// "Team" — the data model has no team object; the closest real concept is a
// set of owners, so Owner and Team share the `ownerIds` filter. Documented as a
// limitation.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set(LEAD_CATEGORY_OPTIONS.map((option) => option.value));
const SOURCES = new Set(LEAD_SOURCE_OPTIONS.map((option) => option.value));

export type ControlTowerFilters = {
  ownerIds: string[];
  unownedOnly: boolean;
  categories: string[];
  location: string | null;
  statuses: string[];
  priorities: string[];
  createdFrom: string | null;
  createdTo: string | null;
  slaStatuses: string[];
  onboardingStatuses: string[];
  sources: string[];
};

const strings = (value: unknown, allowed: ReadonlySet<string> | null, max = 20): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    .filter((item) => (allowed ? allowed.has(item) : UUID.test(item)))
    .slice(0, max);
};

const isoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return new Date(Date.parse(value)).toISOString();
};

export const parseControlTowerFilters = (input: unknown): ControlTowerFilters => {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const location = typeof body.location === 'string' ? body.location.trim().slice(0, 80) : '';

  return {
    ownerIds: strings(body.ownerIds, null),
    unownedOnly: body.unownedOnly === true,
    categories: strings(body.categories, CATEGORIES),
    location: location.length > 0 ? location : null,
    statuses: strings(body.statuses, new Set(LEAD_STATUSES)),
    priorities: strings(body.priorities, new Set(LEAD_PRIORITIES)),
    createdFrom: isoDate(body.createdFrom),
    createdTo: isoDate(body.createdTo),
    slaStatuses: strings(body.slaStatuses, new Set(SLA_STATUSES)),
    onboardingStatuses: strings(body.onboardingStatuses, new Set(ONBOARDING_STATUSES)),
    sources: strings(body.sources, SOURCES),
  };
};

// The part of the filters that applies to leads.
export const leadScope = (filters: ControlTowerFilters): Filter => {
  const clauses: Filter[] = [];

  if (filters.unownedOnly) {
    clauses.push({ ownerId: { is: 'NULL' } });
  } else if (filters.ownerIds.length > 0) {
    clauses.push({ ownerId: { in: filters.ownerIds } });
  }

  if (filters.categories.length > 0) {
    clauses.push({ category: { in: filters.categories } });
  }

  if (filters.location) {
    clauses.push({ location: { ilike: `%${filters.location.replace(/[%_]/g, '')}%` } });
  }

  if (filters.statuses.length > 0) {
    clauses.push({ status: { in: filters.statuses } });
  }

  if (filters.priorities.length > 0) {
    clauses.push({ priority: { in: filters.priorities } });
  }

  // One operator per field object (Twenty's filter grammar).
  if (filters.createdFrom) {
    clauses.push({ createdAt: { gte: filters.createdFrom } });
  }

  if (filters.createdTo) {
    clauses.push({ createdAt: { lte: filters.createdTo } });
  }

  if (filters.sources.length > 0) {
    clauses.push({ source: { in: filters.sources } });
  }

  return clauses.length === 0 ? {} : { and: clauses };
};

// Owner / date filters carried onto tasks, SLAs and onboardings; the other
// lead-only dimensions do not exist on those objects.
export const ownerScope = (filters: ControlTowerFilters, column: string): Filter => {
  if (filters.unownedOnly) {
    return { [column]: { is: 'NULL' } };
  }

  return filters.ownerIds.length > 0 ? { [column]: { in: filters.ownerIds } } : {};
};

export const slaScope = (filters: ControlTowerFilters): Filter => {
  const clauses: Filter[] = [ownerScope(filters, 'ownerId')].filter((clause) => Object.keys(clause).length > 0);

  if (filters.slaStatuses.length > 0) {
    clauses.push({ status: { in: filters.slaStatuses } });
  }

  if (filters.priorities.length > 0) {
    clauses.push({ priority: { in: filters.priorities } });
  }

  return clauses.length === 0 ? {} : { and: clauses };
};

export const onboardingScope = (filters: ControlTowerFilters): Filter => {
  const clauses: Filter[] = [ownerScope(filters, 'reviewerId')].filter((clause) => Object.keys(clause).length > 0);

  if (filters.onboardingStatuses.length > 0) {
    clauses.push({ status: { in: filters.onboardingStatuses } });
  }

  return clauses.length === 0 ? {} : { and: clauses };
};

export const hasAnyFilter = (filters: ControlTowerFilters): boolean =>
  filters.ownerIds.length > 0 ||
  filters.unownedOnly ||
  filters.categories.length > 0 ||
  filters.location !== null ||
  filters.statuses.length > 0 ||
  filters.priorities.length > 0 ||
  filters.createdFrom !== null ||
  filters.createdTo !== null ||
  filters.slaStatuses.length > 0 ||
  filters.onboardingStatuses.length > 0 ||
  filters.sources.length > 0;
