import { describe, expect, it } from 'vitest';

import { LvStyles } from 'src/design/kit';
import { LV_RESPONSIVE_CONTRACT, LV_TIERS, LV_TOUCH_TARGET_COMPACT, tierFor } from 'src/design/responsive';
import { themeFor } from 'src/design/theme';
import { LV_BREAKPOINT, LV_MEDIA, LV_TOKENS, LV_TYPE, type LvTokenSet } from 'src/design/tokens';

// The design system's own tests.
//
// They do not assert that anything looks right — no test can. They assert the
// promises the system makes about itself: that every component family has its
// responsive behaviour written down, that mobile is genuinely a different
// decision rather than a narrower desktop, that the two colour schemes cannot
// drift apart, and that nothing a finger has to hit is too small.

// The families Phase 0 commissioned. If one is dropped from the contract, this
// list is what notices.
const REQUIRED_FAMILIES = [
  'typography',
  'color',
  'spacing',
  'elevation',
  'surfaces',
  'cards',
  'buttons',
  'inputs',
  'selects',
  'tabs',
  'tables',
  'lists',
  'filters',
  'search',
  'breadcrumbs',
  'drawers',
  'modals',
  'bottom-sheets',
  'timelines',
  'activity-cards',
  'status-chips',
  'progress',
  'documents',
  'upload',
  'waiting-states',
  'column-mapping',
  'document-preview',
  'verification-decision',
  'activation-readiness',
  'ai-surfaces',
  'charts',
  'navigation',
  'notifications',
  'empty-states',
  'loading-states',
  'error-states',
  'confirmation',
];

const theme = themeFor('light');

// LvStyles is a component whose only child is the stylesheet text, so the CSS
// can be read without a DOM.
const stylesheet = (): string => {
  const element = LvStyles({ theme }) as unknown as { props: { children: string } };

  return element.props.children;
};

describe('the responsive contract', () => {
  it('covers every family the design system ships', () => {
    const covered = LV_RESPONSIVE_CONTRACT.map((entry) => entry.family);

    for (const family of REQUIRED_FAMILIES) {
      expect(covered, `${family} has no responsive behaviour written down`).toContain(family);
    }
  });

  it('names each family only once', () => {
    const covered = LV_RESPONSIVE_CONTRACT.map((entry) => entry.family);

    expect(new Set(covered).size).toBe(covered.length);
  });

  it('decides all three widths for every family', () => {
    for (const entry of LV_RESPONSIVE_CONTRACT) {
      expect(entry.desktop.length, `${entry.family} desktop`).toBeGreaterThan(0);
      expect(entry.tablet.length, `${entry.family} tablet`).toBeGreaterThan(0);
      expect(entry.mobile.length, `${entry.family} mobile`).toBeGreaterThan(0);
      expect(entry.stacking.length, `${entry.family} stacking`).toBeGreaterThan(0);
      expect(entry.overflow.length, `${entry.family} overflow`).toBeGreaterThan(0);
    }
  });

  it('makes mobile a different decision from desktop for every component', () => {
    // The rule Karan set: mobile is a product, not a narrowed desktop. A
    // component whose phone behaviour is word-for-word its desktop behaviour
    // has not been thought about.
    for (const entry of LV_RESPONSIVE_CONTRACT.filter((candidate) => candidate.kind === 'component')) {
      expect(entry.mobile, `${entry.family} ships the desktop layout to a phone`).not.toBe(entry.desktop);
    }
  });

  it('gives every interactive family a touch target a finger can hit', () => {
    for (const entry of LV_RESPONSIVE_CONTRACT) {
      if (entry.touchTarget === null) {
        continue;
      }

      expect(entry.touchTarget, `${entry.family} touch target`).toBeGreaterThanOrEqual(LV_TOUCH_TARGET_COMPACT);
    }
  });

  it('says so wherever a family docks to the bottom edge', () => {
    for (const entry of LV_RESPONSIVE_CONTRACT.filter((candidate) => candidate.bottomSheet)) {
      const described = `${entry.mobile} ${entry.interaction ?? ''}`.toLowerCase();

      expect(described, `${entry.family} claims a bottom sheet but does not describe one`).toMatch(/sheet|bottom/);
    }
  });

  it('lists the exports that implement each component', () => {
    for (const entry of LV_RESPONSIVE_CONTRACT.filter((candidate) => candidate.kind === 'component')) {
      expect(entry.exports.length, `${entry.family} names no implementation`).toBeGreaterThan(0);
    }
  });
});

describe('breakpoints', () => {
  it('runs mobile, tablet then desktop without a gap or an overlap', () => {
    expect(LV_TIERS.mobile.max).toBe(LV_TIERS.tablet.min - 1);
    expect(LV_TIERS.tablet.max).toBe(LV_TIERS.desktop.min - 1);
    expect(LV_TIERS.desktop.max).toBeNull();
  });

  it('places the QA widths in the tier they are meant to test', () => {
    expect(tierFor(390)).toBe('mobile');
    expect(tierFor(767)).toBe('mobile');
    expect(tierFor(768)).toBe('tablet');
    expect(tierFor(1023)).toBe('tablet');
    expect(tierFor(1024)).toBe('desktop');
    expect(tierFor(1440)).toBe('desktop');
  });
});

describe('the stylesheet', () => {
  const css = stylesheet();
  const [base, wide = ''] = css.split(`@media ${LV_MEDIA.md}`);

  // Every class whose whole point is that it differs by width. Declaring one
  // in the base block and forgetting the wide block is the bug that once left
  // the phone bottom bar on a 1440px desktop.
  const RESPONSIVE_CLASSES = [
    'lv-sidebar',
    'lv-bottomnav',
    'lv-shell-main',
    'lv-shell-panel',
    'lv-topbar',
    'lv-topbar-identity',
    'lv-topbar-more',
    'lv-nav-label',
    'lv-page-header',
    'lv-page-actions',
    'lv-record-header',
    'lv-record-facts',
    'lv-contextual-sticky',
    'lv-contextual-inner',
    'lv-search-hint',
    'lv-entry-card',
    'lv-hero-body',
    'lv-logo-mark',
    'lv-logo-lockup',
    'lv-modal-panel',
    'lv-drawer-panel',
    'lv-sheet-panel',
    'lv-sheet-handle',
    'lv-overlay-footer',
    'lv-toast-stack',
    'lv-tabs',
    'lv-steps',
    'lv-step',
    'lv-action-row',
    'lv-document-state',
    'lv-profile-actions',
    'lv-activity-outcome',
    'lv-nba-aside',
    'lv-entry-grid',
    'lv-field-grid',
    'lv-two-col',
    'lv-map-row',
    'lv-import-row',
    'lv-import-decision',
    'lv-segmented',
    'lv-kind-switch',
    'lv-messages',
    'lv-messages-list',
    'lv-review-layout',
    'lv-review-evidence',
    'lv-doc-actions',
    'lv-preview-bar',
    'lv-journey',
  ];

  it('defines each width-dependent class at both a narrow and a wide width', () => {
    for (const className of RESPONSIVE_CLASSES) {
      expect(base, `.${className} has no phone rule`).toContain(`.${className}`);
      expect(wide, `.${className} has no rule above ${LV_BREAKPOINT.md}px`).toContain(`.${className}`);
    }
  });

  it('is written mobile first, so the narrow rules need no media query', () => {
    expect(base.indexOf('@media')).toBe(-1);
  });
});

describe('colour tokens', () => {
  const keys = (scheme: 'light' | 'dark') => (Object.keys(LV_TOKENS[scheme]) as (keyof LvTokenSet)[]).sort();

  it('keeps the two schemes on exactly the same set of tokens', () => {
    expect(keys('dark')).toEqual(keys('light'));
  });

  it('gives every category tint both marks that read on it', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const tints = (Object.keys(LV_TOKENS[scheme]) as string[]).filter(
        (token) => token.startsWith('tint-') && !token.endsWith('-ink') && !token.endsWith('-glyph'),
      );

      expect(tints.length).toBeGreaterThan(0);

      for (const tint of tints) {
        expect(LV_TOKENS[scheme], `${scheme} ${tint} has no ink`).toHaveProperty(`${tint}-ink`);
        expect(LV_TOKENS[scheme], `${scheme} ${tint} has no glyph`).toHaveProperty(`${tint}-glyph`);
      }
    }
  });

  it('resolves every token to a value in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const [token, value] of Object.entries(LV_TOKENS[scheme])) {
        expect(value, `${scheme} ${token}`).toBeTruthy();
      }
    }
  });
});

describe('the type scale', () => {
  it('never drops below 11px, at any width', () => {
    for (const [name, style] of Object.entries(LV_TYPE)) {
      const size = style.fontSize;

      if (typeof size === 'number') {
        expect(size, `${name} is too small to read`).toBeGreaterThanOrEqual(11);
        continue;
      }

      // Fluid sizes are clamp(min, preferred, max); the floor is the first.
      const floor = Number(/clamp\((\d+)px/.exec(size)?.[1] ?? '0');

      expect(floor, `${name} floor`).toBeGreaterThanOrEqual(11);
    }
  });

  it('keeps body text at a size iOS will not zoom the page for', () => {
    expect(LV_TYPE.body.fontSize).toBeGreaterThanOrEqual(15);
  });
});
