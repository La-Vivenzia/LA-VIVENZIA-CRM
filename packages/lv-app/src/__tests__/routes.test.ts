import { describe, expect, it } from 'vitest';

// The route table is read as text, through Vite's own `?raw`, so this test
// needs no Node types and sees exactly the file the bundler compiles.
import APP from 'src/App.tsx?raw';
import { matchesRoutePattern, resolveRoute, SEARCH_DESTINATIONS } from 'src/routes';

// B1 — a navigation destination must be a route that exists.
//
// Global search sent person results to `/people/:id` and organisation results
// to `/organisations/:id`. Neither was ever declared. React Router matched the
// `*` catch-all instead and redirected to `/`, so choosing a person out of
// search quietly dropped you on the home screen — no error, no console
// warning, nothing a type checker could see, because both sides are strings.
//
// This test reads the route table out of `App.tsx` rather than keeping a copy
// of it. A copy would be the same bug one level up: it could agree with itself
// while disagreeing with the router. The source of truth is the source.

const declaredRoutes = (): string[] => {
  const literal = [...APP.matchAll(/<Route[^>]*?\spath="([^"]+)"/g)].map((match) => match[1]);

  return [...new Set(literal)];
};

const ID = '11111111-2222-4333-8444-555555555555';

describe('the route table in App.tsx', () => {
  it('is readable, and is the real one', () => {
    const routes = declaredRoutes();

    // A guard on the extraction itself: if the regex ever stops matching, the
    // assertions below would all pass against an empty list.
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toContain('/');
    expect(routes).toContain('*');
    expect(routes).toContain('/directory/people/:personId');
    expect(routes).toContain('/directory/organisations/:companyId');
  });

  it('declares no route twice', () => {
    const routes = [...APP.matchAll(/<Route[^>]*?\spath="([^"]+)"/g)].map((match) => match[1]);

    expect(routes.length).toBe(new Set(routes).size);
  });

  it('has no path built from a template, which this test could not see', () => {
    // `path={DOOR_PATHS[door.key]}` once produced a route whose path was
    // `undefined` at runtime. Every route being a literal is what makes the
    // extraction above complete rather than merely plausible.
    expect(APP).not.toMatch(/<Route[^>]*\spath=\{/);
  });
});

describe('every global search destination resolves to a declared route', () => {
  const routes = declaredRoutes();

  it.each(Object.keys(SEARCH_DESTINATIONS) as (keyof typeof SEARCH_DESTINATIONS)[])('%s', (kind) => {
    const destination = SEARCH_DESTINATIONS[kind](ID);
    const matched = resolveRoute(routes, destination);

    // `resolveRoute` ignores `*` on purpose: matching only the catch-all is
    // precisely the failure this test exists to catch.
    expect(matched, `${destination} matches no route but the catch-all`).not.toBeNull();
  });

  it('sends people and organisations into the directory, not to the top level', () => {
    expect(SEARCH_DESTINATIONS.person(ID)).toBe(`/directory/people/${ID}`);
    expect(SEARCH_DESTINATIONS.organisation(ID)).toBe(`/directory/organisations/${ID}`);
    expect(SEARCH_DESTINATIONS.lead(ID)).toBe(`/leads/${ID}`);
  });

  it('would have failed on the paths that were there before', () => {
    // The actual bug, pinned down. If someone reverts the fix, the test above
    // goes red for the right reason — this proves the matcher is capable of
    // saying no.
    expect(resolveRoute(routes, `/people/${ID}`)).toBeNull();
    expect(resolveRoute(routes, `/organisations/${ID}`)).toBeNull();
  });
});

describe('the pattern matcher', () => {
  it('matches a parameter against exactly one non-empty segment', () => {
    expect(matchesRoutePattern('/leads/:leadId', '/leads/abc')).toBe(true);
    expect(matchesRoutePattern('/leads/:leadId', '/leads')).toBe(false);
    expect(matchesRoutePattern('/leads/:leadId', '/leads/abc/timeline')).toBe(false);
  });

  it('ignores a query string and a fragment', () => {
    expect(matchesRoutePattern('/leads', '/leads?q=kerala')).toBe(true);
    expect(matchesRoutePattern('/leads/:leadId', '/leads/abc#notes')).toBe(true);
  });

  it('does not let one literal segment stand in for another', () => {
    expect(matchesRoutePattern('/directory/people', '/directory/organisations')).toBe(false);
  });
});
