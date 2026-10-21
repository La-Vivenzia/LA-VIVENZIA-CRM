import { afterEach, describe, expect, it, vi } from 'vitest';

import { themeFor } from 'src/design/theme';
import { LV_TOKENS } from 'src/design/tokens';
import { isSchemePreference, readStoredPreference, SCHEME_STORAGE_KEY, schemeFor } from 'src/design/use-color-scheme';

// Dark mode.
//
// Both token sets have been complete since Phase 1, but `App.tsx` passed a
// hardcoded 'light' under a comment claiming it followed the operating system.
// The scheme is now a real preference, which makes two things worth pinning:
// that the two token sets stay interchangeable, and that a bad stored value
// cannot leave the CRM with no theme.

const withWindow = (localStorage: unknown) => {
  // The suite runs in Node, so there is no window at all. Each test installs
  // the one it wants and removes it again.
  (globalThis as { window?: unknown }).window = { localStorage };
};

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe('the two token sets are interchangeable', () => {
  it('define exactly the same keys', () => {
    // A token present in light and missing from dark renders as `undefined`
    // in a style — an invisible border, transparent text — rather than
    // failing. The only reliable guard is that neither set has a key the
    // other lacks.
    const light = Object.keys(LV_TOKENS.light).sort();
    const dark = Object.keys(LV_TOKENS.dark).sort();

    expect(dark).toEqual(light);
    expect(light.length).toBeGreaterThan(40);
  });

  it('give every token a value in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const [key, value] of Object.entries(LV_TOKENS[scheme])) {
        expect(typeof value, `${scheme}.${key}`).toBe('string');
        expect(value, `${scheme}.${key}`).not.toBe('');
      }
    }
  });

  it('build a theme that knows which scheme it is', () => {
    expect(themeFor('light').scheme).toBe('light');
    expect(themeFor('dark').scheme).toBe('dark');
  });

  it('invert the ink used on a filled status ground', () => {
    // `danger` is a deep red in light and a pale salmon in dark, so the ink on
    // top of it has to swap with the scheme. Three counter badges hardcoded
    // '#FFFFFF' and would have been illegible in dark the moment it became
    // reachable; `textInverse` is what they use now.
    expect(themeFor('light').color.textInverse).not.toBe(themeFor('dark').color.textInverse);
    expect(themeFor('light').color.danger).not.toBe(themeFor('dark').color.danger);
  });
});

describe('resolving a preference', () => {
  it('follows the system only when asked to', () => {
    expect(schemeFor('system', 'dark')).toBe('dark');
    expect(schemeFor('system', 'light')).toBe('light');
  });

  it('overrides the system when the person has chosen', () => {
    expect(schemeFor('dark', 'light')).toBe('dark');
    expect(schemeFor('light', 'dark')).toBe('light');
  });
});

describe('what counts as a stored preference', () => {
  it('accepts the three it knows', () => {
    expect(isSchemePreference('system')).toBe(true);
    expect(isSchemePreference('light')).toBe(true);
    expect(isSchemePreference('dark')).toBe(true);
  });

  it('rejects everything else', () => {
    // Anything that got through would be handed to `themeFor`, which would
    // index to undefined and leave every screen without a theme.
    for (const value of ['Dark', 'DARK', '', 'true', null, undefined, 0, {}]) {
      expect(isSchemePreference(value), String(value)).toBe(false);
    }
  });
});

describe('reading the stored preference', () => {
  it('returns what was stored', () => {
    withWindow({ getItem: (key: string) => (key === SCHEME_STORAGE_KEY ? 'dark' : null) });

    expect(readStoredPreference()).toBe('dark');
  });

  it('falls back to following the system when nothing is stored', () => {
    withWindow({ getItem: () => null });

    expect(readStoredPreference()).toBe('system');
  });

  it('ignores a corrupt value instead of trusting it', () => {
    withWindow({ getItem: () => 'solarized' });

    expect(readStoredPreference()).toBe('system');
  });

  it('survives storage that throws, as it does in a private window', () => {
    withWindow({
      getItem: () => {
        throw new Error('The operation is insecure.');
      },
    });

    expect(() => readStoredPreference()).not.toThrow();
    expect(readStoredPreference()).toBe('system');
  });
});
