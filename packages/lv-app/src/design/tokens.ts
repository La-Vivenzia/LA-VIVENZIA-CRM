// The La Vivenzia semantic tokens — the one place the brand is decided.
//
// Every surface in the product reads these through `themeFor()` in theme.ts.
// Nothing hard-codes a colour, which is what makes the dark scheme a data
// change rather than a rewrite, and what lets a unit test prove the two
// schemes carry exactly the same set of tokens.
//
// Values come from the approved La Vivenzia design system
// (lavivenziaSAAS/src/app/globals.css, DESIGN.md): warm ivory grounds, pine
// green as the primary, gold scarce and reserved for emphasis, and a dark mode
// that is a deep pine night rather than an inverted light theme.

export const BRAND = {
  pineGreen: '#1F4D3A',
  sage: '#6B846F',
  warmGold: '#D4AF37',
  sand: '#F3EFE7',
  charcoal: '#1A1A1A',
} as const;

export type ColorScheme = 'light' | 'dark';

// Keys are the CSS custom property names without the `--lv-` prefix.
export type LvTokenSet = {
  // Brand roles
  primary: string;
  'primary-hover': string;
  'primary-muted': string; // tinted ground for selected / active / soft chips
  'primary-fg': string; // text on primary
  sage: string;
  gold: string;
  'gold-ink': string; // gold that passes contrast as text on the light ground
  'gold-muted': string; // gold wash
  sand: string;
  // Surfaces
  bg: string; // page ground
  surface: string; // cards, panels
  'surface-elevated': string; // popovers, dialogs, raised cards
  'surface-sunken': string; // wells, table headers, skeletons
  'surface-inverse': string; // the dark anchor (sidebar rail, hero panels)
  'surface-inverse-fg': string;
  // Text
  heading: string;
  text: string;
  'text-muted': string;
  'text-subtle': string;
  'text-inverse': string;
  // Lines
  border: string;
  'border-strong': string;
  ring: string; // focus ring
  // Status
  danger: string;
  'danger-muted': string;
  success: string;
  'success-muted': string;
  warning: string;
  'warning-muted': string;
  info: string;
  'info-muted': string;
  // Category tints — soft washes that label a *kind* of thing (an entry card,
  // an icon tile, a channel) without implying the urgency a status colour
  // does. Each wash carries two marks that read on it: `glyph` is the large
  // category mark, `ink` the deeper tone for a chevron or a figure on the
  // wash. Neither is ever used for body text.
  'tint-mint': string;
  'tint-mint-glyph': string;
  'tint-mint-ink': string;
  'tint-blue': string;
  'tint-blue-glyph': string;
  'tint-blue-ink': string;
  'tint-peach': string;
  'tint-peach-glyph': string;
  'tint-peach-ink': string;
  'tint-lavender': string;
  'tint-lavender-glyph': string;
  'tint-lavender-ink': string;
  'tint-pink': string;
  'tint-pink-glyph': string;
  'tint-pink-ink': string;
  // Elevation
  'shadow-sm': string;
  'shadow-md': string;
  'shadow-lg': string;
};

export const LV_TOKENS: Record<ColorScheme, LvTokenSet> = {
  light: {
    primary: BRAND.pineGreen,
    'primary-hover': '#163A2B',
    'primary-muted': '#E3EBE5',
    'primary-fg': '#F6F3EC',
    sage: BRAND.sage,
    gold: BRAND.warmGold,
    'gold-ink': '#9A7A2E',
    'gold-muted': '#F6EBCB',
    sand: BRAND.sand,

    bg: BRAND.sand,
    surface: '#FCFAF6',
    'surface-elevated': '#FFFFFF',
    'surface-sunken': '#ECE5D8',
    'surface-inverse': BRAND.pineGreen,
    'surface-inverse-fg': BRAND.sand,

    heading: '#16261E',
    text: BRAND.charcoal,
    'text-muted': '#6B6660',
    'text-subtle': '#8C8579',
    'text-inverse': '#F6F3EC',

    border: '#E1DCD0',
    'border-strong': '#CBC3B2',
    ring: BRAND.pineGreen,

    danger: '#8C2B23',
    'danger-muted': '#FBECEA',
    success: '#2F6042',
    'success-muted': '#EAF1EB',
    warning: '#8A5A12',
    'warning-muted': '#FBF1E0',
    info: '#2E4B66',
    'info-muted': '#ECEFF3',

    'tint-mint': '#E4F0E7',
    'tint-mint-glyph': '#30B080',
    'tint-mint-ink': '#1A6048',
    'tint-blue': '#E6EDF7',
    'tint-blue-glyph': '#4880D0',
    'tint-blue-ink': '#2C5AA8',
    'tint-peach': '#FAE9DA',
    'tint-peach-glyph': '#E89868',
    'tint-peach-ink': '#A85423',
    'tint-lavender': '#ECE8F7',
    'tint-lavender-glyph': '#A088D0',
    'tint-lavender-ink': '#3B2F72',
    'tint-pink': '#F9E7EC',
    'tint-pink-glyph': '#D870A0',
    'tint-pink-ink': '#8C2A44',

    'shadow-sm': '0 1px 2px rgba(31, 77, 58, 0.05), 0 2px 8px rgba(31, 77, 58, 0.05)',
    'shadow-md': '0 2px 6px rgba(31, 77, 58, 0.06), 0 10px 30px rgba(31, 77, 58, 0.09)',
    'shadow-lg': '0 8px 20px rgba(31, 77, 58, 0.08), 0 24px 60px rgba(31, 77, 58, 0.12)',
  },
  dark: {
    // Pine green is too dark to read on a dark ground, so a lifted pine takes
    // the primary role and gold carries the call to action, as DESIGN.md's
    // dark anchors do.
    primary: '#2C6B4F',
    'primary-hover': '#357F5E',
    'primary-muted': '#1C3328',
    'primary-fg': '#F3EFE7',
    sage: BRAND.sage,
    gold: BRAND.warmGold,
    'gold-ink': '#D9BB5C',
    'gold-muted': '#2E2A1A',
    sand: BRAND.sand,

    bg: '#0D1611',
    surface: '#15221A',
    'surface-elevated': '#1E2C22',
    'surface-sunken': '#101C15',
    'surface-inverse': '#132B1E',
    'surface-inverse-fg': '#F3EFE7',

    heading: '#F5F1E8',
    text: '#F3EFE7',
    'text-muted': '#9FAA9C',
    'text-subtle': '#7C8A7B',
    'text-inverse': '#10190F',

    border: '#26362A',
    'border-strong': '#3A4D3E',
    ring: '#CBA94E',

    danger: '#E58A82',
    'danger-muted': '#3A1F1C',
    success: '#7FC39A',
    'success-muted': '#17301F',
    warning: '#E2B45B',
    'warning-muted': '#332912',
    info: '#8FB4D2',
    'info-muted': '#1A2A36',

    'tint-mint': '#16301F',
    'tint-mint-glyph': '#4FC194',
    'tint-mint-ink': '#7FC39A',
    'tint-blue': '#172532',
    'tint-blue-glyph': '#6FA3E2',
    'tint-blue-ink': '#8FB4D2',
    'tint-peach': '#33260F',
    'tint-peach-glyph': '#E9A776',
    'tint-peach-ink': '#E2B45B',
    'tint-lavender': '#211D33',
    'tint-lavender-glyph': '#A990E0',
    'tint-lavender-ink': '#B3A6E0',
    'tint-pink': '#331A22',
    'tint-pink-glyph': '#DE84AE',
    'tint-pink-ink': '#E7A0B0',

    'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
    'shadow-md': '0 2px 8px rgba(0, 0, 0, 0.35), 0 12px 32px rgba(0, 0, 0, 0.3)',
    'shadow-lg': '0 10px 24px rgba(0, 0, 0, 0.4), 0 30px 70px rgba(0, 0, 0, 0.45)',
  },
};

// Typography. Cinzel is the display face (page titles, KPI figures, the
// wordmark), Sora the working face. Both are self-hosted (public/fonts/lv,
// SIL OFL) and fall back to system faces of the same shape, so a missing font
// never changes the layout.
export const LV_FONT = {
  display: '"Cinzel", "Cormorant Garamond", Georgia, "Times New Roman", serif',
  body: '"Sora", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
  mono: '"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export type LvTypeStyle = {
  fontFamily: string;
  fontSize: string | number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: string;
  textTransform?: 'uppercase';
};

// Semantic type scale. Sizes are fluid where a title has to survive a phone.
//
// The scale was raised one step across the board (body 13 -> 15, small 12 ->
// 13, caption 11 -> 12) for the reference UI: the approved screens read as a
// calm assistant rather than a dense admin panel, and that difference is
// mostly type size and line height. Nothing drops below 11px any more, which
// also closes accessibility finding A1.
export const LV_TYPE: Record<'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodySmall' | 'label' | 'caption' | 'figure' | 'mono', LvTypeStyle> = {
  // Sora throughout, at every size.
  //
  // These three were Cinzel, which rendered every page title as serif
  // small-caps. The reference boards carry no Cinzel anywhere inside the
  // application: the greeting, the record names, the card titles and the
  // figures are all bold Sora. Cinzel survives in the wordmark, which is an
  // image, and nowhere else.
  display: { fontFamily: LV_FONT.body, fontSize: 'clamp(26px, 3.2vw, 34px)', fontWeight: 700, lineHeight: 1.18, letterSpacing: '-0.01em' },
  title: { fontFamily: LV_FONT.body, fontSize: 'clamp(20px, 2.4vw, 25px)', fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em' },
  heading: { fontFamily: LV_FONT.body, fontSize: 17, fontWeight: 600, lineHeight: 1.35 },
  subheading: { fontFamily: LV_FONT.body, fontSize: 16, fontWeight: 600, lineHeight: 1.4 },
  body: { fontFamily: LV_FONT.body, fontSize: 15, fontWeight: 400, lineHeight: 1.55 },
  bodySmall: { fontFamily: LV_FONT.body, fontSize: 13, fontWeight: 400, lineHeight: 1.5 },
  label: { fontFamily: LV_FONT.body, fontSize: 11, fontWeight: 600, lineHeight: 1.2, letterSpacing: '0.1em', textTransform: 'uppercase' },
  caption: { fontFamily: LV_FONT.body, fontSize: 12, fontWeight: 400, lineHeight: 1.45 },
  figure: { fontFamily: LV_FONT.body, fontSize: 'clamp(28px, 3.4vw, 36px)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em' },
  mono: { fontFamily: LV_FONT.mono, fontSize: 13, fontWeight: 400, lineHeight: 1.45 },
};

// `xl` is the reference system's card and tile radius (the entry cards, the
// icon tiles, the profile header); `lg` stays the radius of a plain panel.
export const LV_RADIUS = { xs: 3, sm: 6, md: 10, lg: 14, xl: 18, pill: 999 } as const;

export const LV_MOTION = {
  duration: { fast: 120, normal: 180 },
  easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
} as const;

// Breakpoints match UI-UX-SPEC.md's QA widths: phones up to 767, tablet 768,
// desktop from 1024.
export const LV_BREAKPOINT = { sm: 480, md: 768, lg: 1024 } as const;

// The media queries, written once.
//
// The threshold sits half a pixel below the breakpoint on purpose: a viewport
// that is 768 CSS pixels wide measures 767.99 at a fractional device pixel
// ratio, and `min-width: 768px` then fails. The result is the worst of both
// layouts — the sidebar gone but the table still rendering rows — so the
// stylesheet and `useLvTier` read the same guarded query.
export const LV_MEDIA = {
  md: `(min-width: ${LV_BREAKPOINT.md - 0.5}px)`,
  lg: `(min-width: ${LV_BREAKPOINT.lg - 0.5}px)`,
} as const;

export const lvVar = (token: keyof LvTokenSet): string => `var(--lv-${token})`;

// The `--lv-*` declarations for one scheme, as CSS text. The host stylesheet
// embeds exactly this output (see the parity test).
export const lvCssDeclarations = (scheme: ColorScheme): string =>
  (Object.keys(LV_TOKENS[scheme]) as (keyof LvTokenSet)[]).map((token) => `  --lv-${token}: ${LV_TOKENS[scheme][token]};`).join('\n');
