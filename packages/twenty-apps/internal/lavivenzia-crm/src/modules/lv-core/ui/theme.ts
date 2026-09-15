// The La Vivenzia theme as the front components consume it.
//
// The values live in tokens.ts (shared with the host stylesheet); this file
// shapes them into the `LvTheme` object every LV surface reads, plus the
// layout primitives that keep "responsive" one decision instead of a
// per-component guess.

import {
  BRAND,
  LV_BREAKPOINT,
  LV_FONT,
  LV_MOTION,
  LV_RADIUS,
  LV_TOKENS,
  LV_TYPE,
  type ColorScheme,
  type LvTokenSet,
  type LvTypeStyle,
} from 'src/modules/lv-core/ui/tokens';

export { BRAND, LV_TYPE, type ColorScheme };

export type LvTheme = {
  scheme: ColorScheme;
  // The semantic tokens, verbatim.
  token: LvTokenSet;
  // Named colour roles used by the components.
  color: {
    brand: string;
    brandHover: string;
    brandMuted: string;
    accent: string;
    accentInk: string;
    accentMuted: string;
    page: string;
    surface: string;
    surfaceRaised: string;
    surfaceSunken: string;
    surfaceInverse: string;
    surfaceInverseText: string;
    border: string;
    borderStrong: string;
    heading: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    textOnBrand: string;
    success: string;
    successMuted: string;
    warning: string;
    warningMuted: string;
    danger: string;
    dangerMuted: string;
    info: string;
    infoMuted: string;
    ring: string;
  };
  shadow: { sm: string; md: string; lg: string };
  space: (steps: number) => number;
  radius: typeof LV_RADIUS;
  motion: typeof LV_MOTION;
  type: typeof LV_TYPE;
  font: {
    body: string;
    display: string;
    mono: string;
    size: { xs: number; sm: number; md: number; lg: number; xl: number };
    weight: { regular: number; medium: number; bold: number };
  };
  breakpoint: typeof LV_BREAKPOINT;
};

const build = (scheme: ColorScheme): LvTheme => {
  const t = LV_TOKENS[scheme];

  return {
    scheme,
    token: t,
    color: {
      brand: t.primary,
      brandHover: t['primary-hover'],
      brandMuted: t.sage,
      accent: t.gold,
      accentInk: t['gold-ink'],
      accentMuted: t['gold-muted'],
      page: t.bg,
      surface: t.surface,
      surfaceRaised: t['surface-elevated'],
      surfaceSunken: t['surface-sunken'],
      surfaceInverse: t['surface-inverse'],
      surfaceInverseText: t['surface-inverse-fg'],
      border: t.border,
      borderStrong: t['border-strong'],
      heading: t.heading,
      text: t.text,
      textMuted: t['text-muted'],
      textSubtle: t['text-subtle'],
      textOnBrand: t['primary-fg'],
      success: t.success,
      successMuted: t['success-muted'],
      warning: t.warning,
      warningMuted: t['warning-muted'],
      danger: t.danger,
      dangerMuted: t['danger-muted'],
      info: t.info,
      infoMuted: t['info-muted'],
      ring: t.ring,
    },
    shadow: { sm: t['shadow-sm'], md: t['shadow-md'], lg: t['shadow-lg'] },
    space: (steps: number) => steps * 4,
    radius: LV_RADIUS,
    motion: LV_MOTION,
    type: LV_TYPE,
    font: {
      body: LV_FONT.body,
      display: LV_FONT.display,
      mono: LV_FONT.mono,
      size: { xs: 11, sm: 12, md: 13, lg: 18, xl: 24 },
      weight: { regular: 400, medium: 500, bold: 600 },
    },
    breakpoint: LV_BREAKPOINT,
  };
};

const THEMES: Record<ColorScheme, LvTheme> = { light: build('light'), dark: build('dark') };

export const themeFor = (scheme: ColorScheme): LvTheme => THEMES[scheme];

// A type style as an inline style object.
export const typeStyle = (style: LvTypeStyle) => ({ ...style });

// Layout primitives shared by every LV surface.
export const layout = (theme: LvTheme) => ({
  page: {
    background: theme.color.page,
    color: theme.color.text,
    fontFamily: theme.font.body,
    fontSize: theme.font.size.md,
    lineHeight: 1.5,
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
    boxShadow: theme.shadow.sm,
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
  // Buttons and inputs keep the 44px touch target UI-UX-SPEC.md asks for.
  // One `border` shorthand per variant (never shorthand + borderColor): a
  // button that switches variant would otherwise make React warn about
  // conflicting style properties.
  button: (variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' = 'primary') => ({
    minHeight: 44,
    padding: `${theme.space(2)}px ${theme.space(4)}px`,
    borderRadius: theme.radius.pill,
    fontFamily: theme.font.body,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    transition: `background-color ${theme.motion.duration.fast}ms ${theme.motion.easing}, border-color ${theme.motion.duration.fast}ms ${theme.motion.easing}, color ${theme.motion.duration.fast}ms ${theme.motion.easing}`,
    ...(variant === 'primary'
      ? { background: theme.color.brand, color: theme.color.textOnBrand, border: '1px solid transparent' }
      : variant === 'gold'
        ? { background: theme.color.accent, color: '#10190F', border: '1px solid transparent' }
        : variant === 'danger'
          ? { background: 'transparent', color: theme.color.danger, border: `1px solid ${theme.color.danger}` }
          : variant === 'ghost'
            ? { background: 'transparent', color: theme.color.textMuted, border: '1px solid transparent' }
            : {
                background: theme.color.surfaceRaised,
                color: theme.color.text,
                border: `1px solid ${theme.color.borderStrong}`,
              }),
  }),
  input: {
    width: '100%',
    minHeight: 44,
    padding: `${theme.space(2)}px ${theme.space(3)}px`,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.color.borderStrong}`,
    background: theme.color.surfaceRaised,
    color: theme.color.text,
    fontFamily: 'inherit',
    fontSize: theme.font.size.md,
    lineHeight: 1.4,
    boxSizing: 'border-box' as const,
  },
  // Status chips: tinted ground, coloured text — readable in both schemes and
  // never the only carrier of meaning (the label says it).
  badge: (tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info') => ({
    display: 'inline-block',
    padding: `2px ${theme.space(2)}px`,
    borderRadius: theme.radius.pill,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.bold,
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    whiteSpace: 'nowrap' as const,
    color:
      tone === 'success'
        ? theme.color.success
        : tone === 'warning'
          ? theme.color.warning
          : tone === 'danger'
            ? theme.color.danger
            : tone === 'info'
              ? theme.color.info
              : theme.color.textMuted,
    background:
      tone === 'success'
        ? theme.color.successMuted
        : tone === 'warning'
          ? theme.color.warningMuted
          : tone === 'danger'
            ? theme.color.dangerMuted
            : tone === 'info'
              ? theme.color.infoMuted
              : theme.color.surfaceSunken,
  }),
});
