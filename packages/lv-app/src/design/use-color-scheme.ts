import { useCallback, useEffect, useState } from 'react';

import { type ColorScheme } from 'src/design/theme';

// Which colour scheme the CRM draws itself in.
//
// Both schemes have existed in `tokens.ts` since Phase 1 — 49 tokens each,
// with no gap either way — but `App.tsx` passed a hardcoded 'light', so the
// dark set was unreachable and the comment above it described behaviour the
// product did not have. This is that behaviour.
//
// Three states, not two. "System" is the default and is not the same as
// either: it follows the operating system *and keeps following it*, so a
// person whose laptop dims at sunset sees the CRM dim with it. Choosing
// light or dark is a deliberate opt out of that, and it is remembered.
//
// The preference is per-browser, not per-account: there is no route that
// stores a display preference on a workspace member, and inventing one to
// hold a theme toggle would be a schema change for a cosmetic setting.

export type SchemePreference = 'system' | 'light' | 'dark';

export const SCHEME_STORAGE_KEY = 'lv.colorScheme';

export const isSchemePreference = (value: unknown): value is SchemePreference => value === 'system' || value === 'light' || value === 'dark';

/** What a preference resolves to, given what the operating system is asking. */
export const schemeFor = (preference: SchemePreference, system: ColorScheme): ColorScheme => (preference === 'system' ? system : preference);

/**
 * What the operating system is asking for.
 *
 * Absent `matchMedia` — an old browser, a server render — light is the
 * answer, because the reference boards are light and it is the safer default.
 */
const systemScheme = (): ColorScheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * The stored preference, or 'system' for anything else.
 *
 * Storage throws outright in a private window with site data blocked, and
 * comes back empty after a clear, so a failure here is ordinary rather than
 * exceptional: it means "no preference", which is the default anyway. A value
 * that is present but not one of ours — hand-edited, or left by an older
 * build — is treated the same way instead of being passed to `themeFor`,
 * where it would index to `undefined` and leave the CRM with no theme at all.
 */
export const readStoredPreference = (): SchemePreference => {
  try {
    const stored = window.localStorage.getItem(SCHEME_STORAGE_KEY);

    return isSchemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

/**
 * The platform stores this preference on the workspace member as
 * `colorScheme`, with the values 'System' | 'Light' | 'Dark'. That is the
 * source of truth; the browser copy below is only a cache, so the first paint
 * after a reload does not flash the wrong scheme while the record loads.
 */
export const fromStoredScheme = (colorScheme: string | null | undefined): SchemePreference => {
  switch ((colorScheme ?? '').trim().toLowerCase()) {
    case 'dark':
      return 'dark';
    case 'light':
      return 'light';
    default:
      return 'system';
  }
};

/** Back to the platform's capitalisation, which it does not validate itself. */
export const toStoredScheme = (preference: SchemePreference): string =>
  preference === 'dark' ? 'Dark' : preference === 'light' ? 'Light' : 'System';

export type ColorSchemeChoice = {
  /** What the person asked for. */
  preference: SchemePreference;
  /** What that resolves to right now. */
  scheme: ColorScheme;
  /** What the operating system is currently asking for. */
  system: ColorScheme;
  choose: (preference: SchemePreference) => void;
  /** Adopt the value the server holds, without writing it back. */
  adopt: (colorScheme: string | null | undefined) => void;
};

export const useColorScheme = (): ColorSchemeChoice => {
  const [preference, setPreference] = useState<SchemePreference>(readStoredPreference);
  const [system, setSystem] = useState<ColorScheme>(systemScheme);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light');

    query.addEventListener('change', follow);

    return () => query.removeEventListener('change', follow);
  }, []);

  const choose = useCallback((next: SchemePreference) => {
    setPreference(next);

    try {
      window.localStorage.setItem(SCHEME_STORAGE_KEY, next);
    } catch {
      // The choice still applies to this session; it just will not outlive it.
      // That is better than refusing to change the theme at all.
    }
  }, []);

  // Used when the member's record arrives: the server's value wins over the
  // cached one, and nothing is written back for a value that came from there.
  const adopt = useCallback((colorScheme: string | null | undefined) => {
    const next = fromStoredScheme(colorScheme);

    setPreference(next);

    try {
      window.localStorage.setItem(SCHEME_STORAGE_KEY, next);
    } catch {
      // The cache is an optimisation; the record remains the source of truth.
    }
  }, []);

  return { preference, scheme: schemeFor(preference, system), system, choose, adopt };
};
