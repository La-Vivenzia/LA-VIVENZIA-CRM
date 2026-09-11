// The La Vivenzia design tokens.
//
// One definition of the brand, consumed by every LV surface. Before this,
// each front component repeated its own hex literals, which meant the palette
// existed in the components rather than in the product — and meant a Twenty
// user in dark mode got a light card pasted into a dark shell.
//
// The brand colours are fixed. What changes between schemes is which of them
// carries which role, plus the neutrals around them.

export const BRAND = {
  pineGreen: '#1F4D3A',
  sage: '#6B846F',
  warmGold: '#D4AF37',
  sand: '#F3EFE7',
  charcoal: '#1A1A1A',
} as const;

export type ColorScheme = 'light' | 'dark';

export type LvTheme = {
  scheme: ColorScheme;
  color: {
    // Brand, unchanged across schemes so the identity stays constant.
    brand: string;
    brandMuted: string;
    accent: string;
    // Surfaces and text, which do change.
    page: string;
    surface: string;
    surfaceRaised: string;
    border: string;
    borderStrong: string;
    text: string;
    textMuted: string;
    textOnBrand: string;
    // Status.
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
  space: (steps: number) => number;
  radius: { sm: number; md: number; lg: number; pill: number };
  font: {
    // System stacks only: ONBOARDING.md and UI-UX-SPEC.md name no typeface,
    // and shipping a webfont would add a network dependency and a licensing
    // question for a decision nobody has made. Documented as outstanding.
    body: string;
    mono: string;
    size: { xs: number; sm: number; md: number; lg: number; xl: number };
    weight: { regular: number; medium: number; bold: number };
  };
  // Single breakpoint. The CRM is mobile-first, so layouts are single-column
  // by default and widen once there is room, rather than the reverse.
  breakpoint: { sm: number; md: number };
};

const SHARED = {
  space: (steps: number) => steps * 4,
  radius: { sm: 4, md: 8, lg: 12, pill: 999 },
  font: {
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    size: { xs: 11, sm: 12, md: 14, lg: 18, xl: 24 },
    weight: { regular: 400, medium: 500, bold: 600 },
  },
  breakpoint: { sm: 480, md: 768 },
} as const;

const LIGHT: LvTheme = {
  scheme: 'light',
  color: {
    brand: BRAND.pineGreen,
    brandMuted: BRAND.sage,
    accent: BRAND.warmGold,
    page: BRAND.sand,
    surface: '#FFFFFF',
    surfaceRaised: '#FBF9F5',
    border: '#E4DFD4',
    borderStrong: '#CFC7B6',
    text: BRAND.charcoal,
    textMuted: '#5C5C5C',
    textOnBrand: '#FFFFFF',
    success: '#1F7A4D',
    warning: '#B57A0B',
    danger: '#A32020',
    info: '#1F4D6B',
  },
  ...SHARED,
};

const DARK: LvTheme = {
  scheme: 'dark',
  color: {
    // Pine green is too dark to read against a dark ground, so sage takes the
    // brand role and gold does more of the emphasis work.
    brand: '#4E8F6F',
    brandMuted: BRAND.sage,
    accent: BRAND.warmGold,
    page: '#141414',
    surface: '#1E1E1E',
    surfaceRaised: '#262624',
    border: '#333331',
    borderStrong: '#4A4A46',
    text: '#F2EFE9',
    textMuted: '#A8A49B',
    textOnBrand: '#0B1811',
    success: '#5FBF8C',
    warning: '#E0B44C',
    danger: '#E07A7A',
    info: '#7FB2D4',
  },
  ...SHARED,
};

export const themeFor = (scheme: ColorScheme): LvTheme =>
  scheme === 'dark' ? DARK : LIGHT;

// Layout primitives shared by every LV surface, so "responsive" is one
// decision rather than a per-component guess.
export const layout = (theme: LvTheme) => ({
  page: {
    background: theme.color.page,
    color: theme.color.text,
    fontFamily: theme.font.body,
    fontSize: theme.font.size.md,
    padding: theme.space(4),
    minHeight: '100%',
    boxSizing: 'border-box' as const,
  },
  // Fluid up to a readable maximum: full width on a phone, capped on desktop.
  container: (max = 640) => ({
    width: '100%',
    maxWidth: max,
    marginLeft: 'auto',
    marginRight: 'auto',
    boxSizing: 'border-box' as const,
  }),
  card: {
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.lg,
    padding: theme.space(4),
    boxSizing: 'border-box' as const,
  },
  // Wraps instead of overflowing, which is what keeps a narrow viewport from
  // scrolling sideways.
  row: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: theme.space(2),
    alignItems: 'center',
  },
  stack: (gap = 3) => ({
    display: 'flex',
    flexDirection: 'column' as const,
    gap: theme.space(gap),
  }),
  // Buttons reach the 44px touch target the moment they are on a phone.
  button: (variant: 'primary' | 'secondary' | 'danger' = 'primary') => ({
    minHeight: 44,
    padding: `${theme.space(2)}px ${theme.space(4)}px`,
    borderRadius: theme.radius.md,
    fontFamily: theme.font.body,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
    cursor: 'pointer',
    border: '1px solid transparent',
    ...(variant === 'primary'
      ? { background: theme.color.brand, color: theme.color.textOnBrand }
      : variant === 'danger'
        ? { background: 'transparent', color: theme.color.danger, borderColor: theme.color.danger }
        : {
            background: theme.color.surfaceRaised,
            color: theme.color.text,
            borderColor: theme.color.border,
          }),
  }),
  input: {
    width: '100%',
    minHeight: 44,
    padding: theme.space(2),
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.color.borderStrong}`,
    background: theme.color.surface,
    color: theme.color.text,
    fontFamily: 'inherit',
    fontSize: theme.font.size.md,
    boxSizing: 'border-box' as const,
  },
  badge: (tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info') => ({
    display: 'inline-block',
    padding: `2px ${theme.space(2)}px`,
    borderRadius: theme.radius.pill,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.medium,
    color: theme.color.textOnBrand,
    background:
      tone === 'success'
        ? theme.color.success
        : tone === 'warning'
          ? theme.color.warning
          : tone === 'danger'
            ? theme.color.danger
            : tone === 'info'
              ? theme.color.info
              : theme.color.brandMuted,
  }),
});
