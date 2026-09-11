import { describe, expect, it } from 'vitest';

import { BRAND, layout, themeFor } from 'src/modules/lv-core/ui/theme';

// Relative luminance / contrast ratio per WCAG 2.1. Dark mode existing is not
// the same as dark mode being readable, so the tokens are checked rather than
// eyeballed.
const luminance = (hex: string): number => {
  const value = hex.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(value.slice(i * 2, i * 2 + 2), 16) / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
};

describe('brand tokens', () => {
  it('carries the five specified brand colours exactly', () => {
    expect(BRAND).toEqual({
      pineGreen: '#1F4D3A',
      sage: '#6B846F',
      warmGold: '#D4AF37',
      sand: '#F3EFE7',
      charcoal: '#1A1A1A',
    });
  });
});

describe.each(['light', 'dark'] as const)('%s scheme', (scheme) => {
  const theme = themeFor(scheme);

  it('reports its own scheme', () => {
    expect(theme.scheme).toBe(scheme);
  });

  it('has readable body text on the page and on surfaces', () => {
    expect(contrast(theme.color.text, theme.color.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.color.text, theme.color.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('has readable muted text (3:1, it is secondary)', () => {
    expect(contrast(theme.color.textMuted, theme.color.surface)).toBeGreaterThanOrEqual(3);
  });

  it('has readable text on the brand colour', () => {
    expect(contrast(theme.color.textOnBrand, theme.color.brand)).toBeGreaterThanOrEqual(4.5);
  });

  it('defines every colour token as a concrete value', () => {
    for (const [name, value] of Object.entries(theme.color)) {
      expect(value, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('the two schemes are genuinely different', () => {
  it('does not reuse the light page colour in dark mode', () => {
    expect(themeFor('dark').color.page).not.toBe(themeFor('light').color.page);
    expect(themeFor('dark').color.text).not.toBe(themeFor('light').color.text);
  });

  it('keeps gold as the accent in both, because the brand does not change', () => {
    expect(themeFor('light').color.accent).toBe(BRAND.warmGold);
    expect(themeFor('dark').color.accent).toBe(BRAND.warmGold);
  });
});

describe('layout primitives', () => {
  const theme = themeFor('light');
  const l = layout(theme);

  it('spaces on a 4px scale', () => {
    expect(theme.space(0)).toBe(0);
    expect(theme.space(2)).toBe(8);
    expect(theme.space(4)).toBe(16);
  });

  it('gives buttons a 44px touch target', () => {
    for (const variant of ['primary', 'secondary', 'danger'] as const) {
      expect(l.button(variant).minHeight).toBe(44);
    }
  });

  it('gives inputs a 44px touch target and full width', () => {
    expect(l.input.minHeight).toBe(44);
    expect(l.input.width).toBe('100%');
  });

  it('makes the container fluid rather than fixed-width', () => {
    const container = l.container(640);

    expect(container.width).toBe('100%');
    expect(container.maxWidth).toBe(640);
  });

  it('wraps rows so a narrow viewport never scrolls sideways', () => {
    expect(l.row.flexWrap).toBe('wrap');
  });

  it('uses border-box everywhere padding is applied', () => {
    expect(l.page.boxSizing).toBe('border-box');
    expect(l.card.boxSizing).toBe('border-box');
    expect(l.input.boxSizing).toBe('border-box');
  });
});
