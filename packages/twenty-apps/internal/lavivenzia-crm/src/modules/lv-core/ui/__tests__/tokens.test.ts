import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { LEAD_PRIORITIES, LEAD_STATUSES } from 'src/modules/lv-core/constants/lead-lifecycle';
import { describeStatus, statusBadgeTone } from 'src/modules/lv-core/ui/status';
import { LV_TOKENS, LV_TYPE, lvCssDeclarations } from 'src/modules/lv-core/ui/tokens';

// WCAG 2.1 relative luminance / contrast.
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

describe.each(['light', 'dark'] as const)('%s semantic tokens', (scheme) => {
  const t = LV_TOKENS[scheme];

  it('reads: body and heading text on every surface (AA 4.5:1)', () => {
    for (const surface of [t.bg, t.surface, t['surface-elevated'], t['surface-sunken']]) {
      expect(contrast(t.text, surface), `text on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.heading, surface), `heading on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['text-muted'], surface), `muted on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads: text on the primary and on the inverse surface', () => {
    expect(contrast(t['primary-fg'], t.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t['surface-inverse-fg'], t['surface-inverse'])).toBeGreaterThanOrEqual(4.5);
  });

  it('reads: every status colour on its wash and on the surface', () => {
    for (const status of ['danger', 'success', 'warning', 'info'] as const) {
      expect(contrast(t[status], t[`${status}-muted`]), `${status} on wash`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t[status], t.surface), `${status} on surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps gold as an accent, not a text colour, unless it is the ink variant', () => {
    expect(t.gold).toBe('#D4AF37');
    expect(contrast(t['gold-ink'], t.surface)).toBeGreaterThanOrEqual(3);
  });

  it('draws borders that are visible against the surface', () => {
    expect(contrast(t.border, t.surface)).toBeGreaterThanOrEqual(1.15);
    expect(contrast(t['border-strong'], t.surface)).toBeGreaterThanOrEqual(1.3);
  });

  it('gives the focus ring 3:1 against the page', () => {
    expect(contrast(t.ring, t.bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('dark mode is designed, not inverted', () => {
  it('is a deep pine, not a grey', () => {
    const bg = LV_TOKENS.dark.bg.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(bg.slice(i, i + 2), 16));

    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('lifts the primary so it reads on the dark ground', () => {
    expect(contrast(LV_TOKENS.dark.primary, LV_TOKENS.dark.bg)).toBeGreaterThan(contrast(LV_TOKENS.light.primary, LV_TOKENS.dark.bg));
  });
});

describe('typography', () => {
  it('uses the display face for titles and the body face for text', () => {
    expect(LV_TYPE.display.fontFamily).toMatch(/Cinzel/);
    expect(LV_TYPE.title.fontFamily).toMatch(/Cinzel/);
    expect(LV_TYPE.body.fontFamily).toMatch(/Sora/);
    expect(LV_TYPE.label.textTransform).toBe('uppercase');
  });

  it('never drops below 10.5px', () => {
    for (const [name, style] of Object.entries(LV_TYPE)) {
      if (typeof style.fontSize === 'number') {
        expect(style.fontSize, name).toBeGreaterThanOrEqual(10.5);
      }
    }
  });
});

describe('the host stylesheet carries the same tokens', () => {
  const cssPath = path.resolve(__dirname, '../../../../../../../../twenty-front/src/lv/lv-theme.css');

  it('exists and embeds the generated blocks verbatim', () => {
    const css = fs.readFileSync(cssPath, 'utf8').replace(/\r\n/g, '\n');

    for (const scheme of ['light', 'dark'] as const) {
      expect(css, `${scheme} block`).toContain(`/* @lv-tokens ${scheme} */\n${lvCssDeclarations(scheme)}\n/* @lv-tokens end */`);
    }
  });

  it('self-hosts Cinzel and Sora with a fallback stack and no font CDN', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toMatch(/font-family: 'Cinzel'/);
    expect(css).toMatch(/font-family: 'Sora'/);
    expect(css).toMatch(/url\('\/fonts\/lv\/cinzel-latin\.woff2'\)/);
    expect(css).toMatch(/--lv-font-display: 'Cinzel'.*serif/);
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    for (const file of ['cinzel-latin.woff2', 'cinzel-latin-ext.woff2', 'sora-latin.woff2', 'sora-latin-ext.woff2', 'OFL-Cinzel.txt', 'OFL-Sora.txt']) {
      expect(fs.existsSync(path.resolve(path.dirname(cssPath), '../../public/fonts/lv', file)), file).toBe(true);
    }
  });
});

describe('unified status system', () => {
  it('describes every lead status and priority with a label that is not SNAKE_CASE', () => {
    for (const status of LEAD_STATUSES) {
      const described = describeStatus('lead', status);

      expect(described.label).not.toMatch(/_/);
      expect(described.label).not.toBe(status);
    }
    for (const priority of LEAD_PRIORITIES) {
      expect(describeStatus('priority', priority).label).not.toMatch(/_/);
    }
  });

  it('maps urgency consistently across kinds', () => {
    expect(statusBadgeTone('sla', 'BREACHED')).toBe('danger');
    expect(statusBadgeTone('sla', 'DUE_SOON')).toBe('warning');
    expect(statusBadgeTone('sla', 'ON_TRACK')).toBe('success');
    expect(statusBadgeTone('document', 'VERIFIED')).toBe('success');
    expect(statusBadgeTone('document', 'REJECTED')).toBe('danger');
    expect(statusBadgeTone('health', 'AT_RISK')).toBe('danger');
    expect(statusBadgeTone('priority', 'CRITICAL')).toBe('danger');
    expect(statusBadgeTone('onboarding', 'ACTIVATED')).toBe('success');
    expect(statusBadgeTone('insight', 'UNAVAILABLE')).toBe('neutral');
  });

  it('never crashes on an unknown or empty value', () => {
    expect(describeStatus('lead', 'SOMETHING_NEW')).toEqual({ label: 'Something new', tone: 'neutral' });
    expect(describeStatus('sla', null).label).toBe('—');
  });
});
