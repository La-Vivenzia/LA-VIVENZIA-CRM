// Where global search sends a result.
//
// These were inline in `App.tsx` and two of the three were wrong: a person
// result navigated to `/people/:id` and an organisation result to
// `/organisations/:id`, neither of which is a declared route. Both fell
// through the `*` catch-all to `<Navigate to="/">`, so choosing a person out
// of global search silently dropped you on the home screen — no error, no
// message, nothing to report.
//
// It is the kind of mistake that static types cannot catch, because a route is
// a string on both sides. So the destinations live here, on their own, and
// `__tests__/routes.test.ts` reads the route table out of `App.tsx` and
// asserts that each one still resolves to a real route. A destination cannot
// drift away from the router again without a test going red.

export const SEARCH_DESTINATIONS = {
  lead: (id: string) => `/leads/${id}`,
  person: (id: string) => `/directory/people/${id}`,
  organisation: (id: string) => `/directory/organisations/${id}`,
} as const;

export type SearchDestinationKind = keyof typeof SEARCH_DESTINATIONS;

/**
 * Does a concrete path match a declared react-router pattern?
 *
 * Only the two forms this application's routes actually use are handled: a
 * `:param` segment, which matches exactly one non-empty segment, and a
 * trailing `*`, which matches the rest. Anything else is compared literally.
 */
export const matchesRoutePattern = (pattern: string, path: string): boolean => {
  if (pattern === '*') {
    return true;
  }

  const expected = pattern.split('/').filter((segment) => segment !== '');
  const actual = path.split('?')[0].split('#')[0].split('/').filter((segment) => segment !== '');

  if (expected.length !== actual.length) {
    return false;
  }

  return expected.every((segment, index) => (segment.startsWith(':') ? actual[index].length > 0 : segment === actual[index]));
};

/**
 * The first declared pattern a path resolves to, ignoring the catch-all.
 *
 * Returning the catch-all would make every path "valid" and the check
 * worthless — the whole point is to notice a path that *only* the catch-all
 * would take.
 */
export const resolveRoute = (patterns: readonly string[], path: string): string | null =>
  patterns.filter((pattern) => pattern !== '*').find((pattern) => matchesRoutePattern(pattern, path)) ?? null;
