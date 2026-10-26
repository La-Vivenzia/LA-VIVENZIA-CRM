import { type ChangeEvent, type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { LvIcon, type LvIconName } from 'src/design/icons';
import { describeStatus, badgeToneOf, type BadgeTone, type StatusKind, type StatusTone } from 'src/design/status';
import { layout, type LvTheme, type LvTint } from 'src/design/theme';

// The La Vivenzia component kit — every primitive an LV surface is built
// from. One place, so the dashboard, the Lead 360, onboarding, the Control
// Tower and the Copilot read as one product rather than six.
//
// Inline styles carry what never changes — colour, and geometry that is the
// same at every width. Everything that differs by width lives in the injected
// stylesheet (LvStyles), because an inline style beats a media query and
// would pin the desktop shape to a phone. LvStyles also supplies what inline
// styles cannot: :focus-visible, :hover and reduced motion.
//
// Accessibility: real <button>s for anything clickable, visible focus rings,
// status conveyed by text as well as colour, headings for sections, labels
// bound to inputs, live regions for loading and errors.

export type Tone = 'neutral' | 'info' | 'warning' | 'danger' | 'success';

export const toneColour = (theme: LvTheme, tone: Tone | undefined): string =>
  tone === 'danger'
    ? theme.color.danger
    : tone === 'warning'
      ? theme.color.warning
      : tone === 'success'
        ? theme.color.success
        : tone === 'info'
          ? theme.color.info
          : theme.color.brandMuted;

export const toneWash = (theme: LvTheme, tone: Tone | undefined): string =>
  tone === 'danger'
    ? theme.color.dangerMuted
    : tone === 'warning'
      ? theme.color.warningMuted
      : tone === 'success'
        ? theme.color.successMuted
        : tone === 'info'
          ? theme.color.infoMuted
          : theme.color.surfaceSunken;

export const focusRing = (theme: LvTheme): CSSProperties => ({
  outline: `2px solid ${theme.color.ring}`,
  outlineOffset: 2,
});

export const formatWhen = (iso: string | null | undefined, now: string): string => {
  if (!iso) {
    return '—';
  }

  const diff = Date.parse(now) - Date.parse(iso);

  if (Number.isNaN(diff)) {
    return '—';
  }

  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const word = minutes < 60 ? `${minutes} min` : hours < 48 ? `${hours} h` : `${days} d`;

  return diff >= 0 ? `${word} ago` : `in ${word}`;
};

const SR_ONLY: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

export const VisuallyHidden = ({ children }: { children: ReactNode }) => <span style={SR_ONLY}>{children}</span>;

// ---------------------------------------------------------------------------
// The product's stylesheet. Scoped to `.lv-root`, mobile first: the base
// block is the phone and every media query only ever adds.
// ---------------------------------------------------------------------------
export const LvStyles = ({ theme }: { theme: LvTheme }) => (
  <style>{`
    /* The scheme has to reach the document, not just the shell. Without the
       background on html/body the overscroll area stays white behind a dark
       CRM, and without \`color-scheme\` the browser keeps drawing its own
       chrome light — a native <select> dropdown renders white text on white,
       and so do the scrollbars. */
    html, body { background: ${theme.color.page}; }
    :root { color-scheme: ${theme.scheme}; }
    .lv-root, .lv-root * { box-sizing: border-box; }
    .lv-root { font-family: ${theme.font.body}; -webkit-font-smoothing: antialiased; }
    .lv-root button:focus-visible, .lv-root select:focus-visible, .lv-root input:focus-visible, .lv-root textarea:focus-visible, .lv-root a:focus-visible, .lv-root [tabindex]:focus-visible { outline: 2px solid ${theme.color.ring}; outline-offset: 2px; }
    .lv-root button:hover:not(:disabled) { filter: brightness(${theme.scheme === 'dark' ? 1.08 : 0.96}); }
    .lv-root button:active:not(:disabled) { filter: brightness(${theme.scheme === 'dark' ? 1.14 : 0.92}); }
    .lv-root button:disabled { cursor: not-allowed; opacity: 0.5; }
    .lv-root input::placeholder, .lv-root textarea::placeholder { color: ${theme.color.textSubtle}; }
    .lv-root .lv-row-hover:hover { background: ${theme.color.surfaceSunken}; }
    /* A notification that opens something lifts its ground on hover, and an
       unread one carries a brand accent down its leading edge. */
    .lv-root .lv-notif-item { transition: background ${theme.motion.duration.fast}ms ${theme.motion.easing}, border-color ${theme.motion.duration.fast}ms ${theme.motion.easing}; }
    .lv-root button.lv-notif-item:hover { background: ${theme.color.surfaceSunken}; border-color: ${theme.color.border}; }
    /* Ask LV reads as one focused assistant column rather than a page of
       cards. The composer, its send control and the prompt starters carry
       their width behaviour here so the screen stays one decision wide. */
    .lv-root .lv-ask-shell { width: 100%; max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: ${theme.space(5)}px; }
    .lv-root .lv-ask-hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: ${theme.space(3)}px; padding: ${theme.space(4)}px 0 ${theme.space(1)}px; }
    .lv-root .lv-ask-composer { position: relative; display: flex; flex-direction: column; gap: ${theme.space(1)}px; background: ${theme.color.surfaceRaised}; border: 1px solid ${theme.color.border}; border-radius: ${theme.radius.xl}px; padding: ${theme.space(3)}px; box-shadow: ${theme.shadow.md}; transition: border-color ${theme.motion.duration.normal}ms ${theme.motion.easing}, box-shadow ${theme.motion.duration.normal}ms ${theme.motion.easing}; }
    .lv-root .lv-ask-composer:focus-within { border-color: ${theme.color.brand}; box-shadow: ${theme.shadow.lg}; }
    .lv-root .lv-ask-input { width: 100%; border: none; background: transparent; resize: none; outline: none; color: ${theme.color.text}; font-family: ${theme.font.body}; font-size: ${theme.font.size.md}px; line-height: 1.55; padding: ${theme.space(2)}px; min-height: 56px; }
    .lv-root .lv-ask-composer-foot { display: flex; align-items: center; justify-content: space-between; gap: ${theme.space(2)}px; padding: 0 ${theme.space(1)}px ${theme.space(1)}px; }
    .lv-root .lv-ask-send { width: 44px; height: 44px; flex: 0 0 auto; border-radius: ${theme.radius.pill}px; border: none; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; background: ${theme.color.brand}; color: ${theme.color.textOnBrand}; box-shadow: ${theme.shadow.sm}; transition: transform ${theme.motion.duration.fast}ms ${theme.motion.easing}; }
    .lv-root .lv-ask-send:disabled { cursor: not-allowed; opacity: 0.4; box-shadow: none; }
    .lv-root .lv-ask-send:not(:disabled):hover { transform: translateY(-1px); }
    .lv-root .lv-ask-starter-grid { display: grid; grid-template-columns: 1fr; gap: ${theme.space(3)}px; }
    .lv-root .lv-ask-starter { display: flex; align-items: center; gap: ${theme.space(3)}px; width: 100%; min-height: 66px; text-align: left; cursor: pointer; background: ${theme.color.surface}; border: 1px solid ${theme.color.border}; border-radius: ${theme.radius.lg}px; padding: ${theme.space(3)}px ${theme.space(4)}px; font-family: ${theme.font.body}; transition: border-color ${theme.motion.duration.normal}ms ${theme.motion.easing}, box-shadow ${theme.motion.duration.normal}ms ${theme.motion.easing}, transform ${theme.motion.duration.fast}ms ${theme.motion.easing}; }
    .lv-root .lv-ask-starter:hover { border-color: ${theme.color.borderStrong}; box-shadow: ${theme.shadow.md}; transform: translateY(-1px); }
    .lv-root .lv-ask-starter-arrow { margin-left: auto; flex: 0 0 auto; color: ${theme.color.textSubtle}; transition: transform ${theme.motion.duration.normal}ms ${theme.motion.easing}, color ${theme.motion.duration.normal}ms ${theme.motion.easing}; }
    .lv-root .lv-ask-starter:hover .lv-ask-starter-arrow { transform: translateX(3px); color: ${theme.color.brand}; }
    /* The account page reads as an editorial settings list, not a stack of
       boxed forms: an identity band, then sections whose rows are separated by
       hairlines, each row a label on the left and its control on the right. */
    .lv-root .lv-acct { width: 100%; max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; gap: ${theme.space(6)}px; }
    .lv-root .lv-acct-band { position: relative; overflow: hidden; border: 1px solid ${theme.color.border}; border-radius: ${theme.radius.xl}px; padding: ${theme.space(5)}px; background: linear-gradient(135deg, ${theme.color.surfaceRaised} 0%, ${theme.tint.mint.wash} 170%); box-shadow: ${theme.shadow.sm}; display: flex; align-items: center; gap: ${theme.space(4)}px; flex-wrap: wrap; }
    .lv-root .lv-acct-band-actions { display: flex; gap: ${theme.space(2)}px; flex-wrap: wrap; margin-left: auto; }
    .lv-root .lv-acct-section { display: flex; flex-direction: column; gap: ${theme.space(2)}px; }
    .lv-root .lv-acct-rows { display: flex; flex-direction: column; margin-top: ${theme.space(3)}px; }
    .lv-root .lv-acct-row { display: grid; grid-template-columns: 1fr; gap: ${theme.space(2)}px; padding: ${theme.space(4)}px 0; border-top: 1px solid ${theme.color.border}; }
    .lv-root .lv-acct-row:first-child { border-top: none; padding-top: 0; }
    .lv-root .lv-acct-control { width: 100%; min-width: 0; }
    .lv-root .lv-acct-savebar { position: sticky; bottom: ${theme.space(4)}px; z-index: 20; display: flex; align-items: center; gap: ${theme.space(3)}px; flex-wrap: wrap; padding: ${theme.space(3)}px ${theme.space(4)}px; background: ${theme.color.surfaceRaised}; border: 1px solid ${theme.color.borderStrong}; border-radius: ${theme.radius.lg}px; box-shadow: ${theme.shadow.lg}; }
    .lv-root .lv-kpi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${theme.space(2)}px; }
    /* The richer stat tile (one that carries a tinted glyph) lifts on hover
       when it is a filter control. Plain tiles are unaffected. */
    .lv-root .lv-kpi-tile { transition: border-color ${theme.motion.duration.normal}ms ${theme.motion.easing}, box-shadow ${theme.motion.duration.normal}ms ${theme.motion.easing}, transform ${theme.motion.duration.fast}ms ${theme.motion.easing}; }
    .lv-root button.lv-kpi-tile:hover:not(:disabled) { box-shadow: ${theme.shadow.md}; transform: translateY(-1px); }
    .lv-root .lv-two-col { display: grid; grid-template-columns: 1fr; gap: ${theme.space(3)}px; align-items: start; }
    .lv-root .lv-three-col { display: grid; grid-template-columns: 1fr; gap: ${theme.space(3)}px; align-items: start; }
    .lv-root .lv-sidebar-layout { display: grid; grid-template-columns: 1fr; gap: ${theme.space(4)}px; align-items: start; }
    .lv-root .lv-field-grid { display: grid; grid-template-columns: 1fr; gap: ${theme.space(3)}px; }
    .lv-root .lv-hide-mobile { display: none; }
    /* Every overlay docks to the bottom on a phone: that is where a thumb is,
       and a centred card would sit under the on-screen keyboard. */
    /* The body scrolls, the commit does not: a dialog whose content is taller
       than the sheet must still show its primary action without scrolling to
       find it. */
    .lv-modal-panel { margin: auto 0 0; width: 100%; max-height: 92vh; overflow: hidden; display: flex; flex-direction: column; border-radius: ${theme.radius.xl}px ${theme.radius.xl}px 0 0; padding: ${theme.space(5)}px; }
    .lv-modal-panel .lv-modal-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
    .lv-modal-panel .lv-overlay-footer { flex: 0 0 auto; }
    /* A workflow long enough that a sheet would put the commit under the
       on-screen keyboard takes the whole phone instead: header and footer
       pinned, only the body scrolling. */
    .lv-modal-full { margin: 0; width: 100%; height: 100%; max-height: none; border-radius: 0; border: none; overflow: hidden; display: flex; flex-direction: column; }
    .lv-modal-full .lv-modal-body { flex: 1; min-height: 0; overflow-y: auto; }
    .lv-modal-full .lv-overlay-footer { margin-top: ${theme.space(4)}px; padding-top: ${theme.space(3)}px; border-top: 1px solid ${theme.color.border}; }
    .lv-drawer-panel { margin: auto 0 0; width: 100%; height: 92vh; border-radius: ${theme.radius.xl}px ${theme.radius.xl}px 0 0; padding: ${theme.space(5)}px; }
    .lv-sheet-panel { margin: auto 0 0; width: 100%; border-radius: ${theme.radius.xl}px ${theme.radius.xl}px 0 0; padding: ${theme.space(5)}px; }
    .lv-root .lv-sheet-handle { display: block; }
    /* Reversed, so the destructive commit is above and Cancel is the button
       nearest the thumb. */
    .lv-overlay-footer { flex-direction: column-reverse; flex-wrap: wrap; }
    .lv-overlay-footer > button { width: 100%; }
    .lv-root .lv-entry-grid { grid-template-columns: 1fr; }
    /* On a phone the header's buttons wrap onto their own line, so they take
       the full width rather than leaving a lone overflow dot hanging. */
    .lv-root .lv-profile-actions { flex: 1 0 100%; justify-content: flex-end; }
    .lv-root .lv-profile-actions > button { flex: 1; }
    /* A row's call to action drops to its own line on a phone rather than
       squeezing the name into a column narrow enough to break "LV-000005"
       across two lines. */
    /* A confirmation must not cover the six doors, so on a phone it sits just
       above the navigation bar and spans the width. */
    .lv-toast-stack { left: ${theme.space(4)}px; right: ${theme.space(4)}px; bottom: 84px; }
    /* The tab strip scrolls rather than wrapping: a second row of tabs reads
       as a second set of them. The scrollbar is hidden, the selected tab is
       scrolled into view, and the scrolling is contained to the strip so the
       page itself never moves sideways. */
    .lv-root .lv-tabs { flex-wrap: nowrap; gap: ${theme.space(4)}px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
    .lv-root .lv-tabs::-webkit-scrollbar { display: none; }
    .lv-root .lv-tabs > button { flex: 0 0 auto; }
    /* Ten steps side by side on a phone is ten unreadable labels. */
    .lv-root .lv-steps { flex-direction: column; gap: ${theme.space(2)}px; }
    .lv-root .lv-step { width: 100%; }
    /* The outcome chip wraps under the header rather than compressing the
       channel and the time it belongs to. */
    .lv-root .lv-activity-spacer { display: none; }
    .lv-root .lv-activity-outcome { flex: 1 0 100%; }
    /* One recommendation, then its action beneath at full width. */
    .lv-root .lv-nba-aside { flex: 1 0 100%; }
    .lv-root .lv-nba-aside > button { width: 100%; }
    .lv-root .lv-action-row { flex-wrap: wrap; }
    /* A file's state chip wraps below its name rather than squeezing it. */
    .lv-root .lv-document-row { flex-wrap: wrap; }
    .lv-root .lv-document-body { flex: 1 1 auto; }
    .lv-root .lv-document-state { flex: 1 0 100%; }
    .lv-root .lv-action-row-body { flex: 1 1 0; }
    .lv-root .lv-action-row-cta { flex: 1 0 100%; order: 1; }
    .lv-root .lv-action-row-cta > button { flex: 1; }
    /* ------------------------------------------------------------------
       The shell. Phone first: there is no sidebar at all, the six doors are
       a bar of their own at the foot, and the secondary sections live in a
       sheet behind the "more" control in the top bar.
       ------------------------------------------------------------------ */
    .lv-shell { display: flex; min-height: 100vh; }
    .lv-sidebar { display: none; }
    .lv-shell-body { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; }
    /* The photograph the product sits on. Fixed, so it never scales with the
       length of the page and stays visible around the panel while it scrolls. */
    /* The photograph is a band behind the top bar only, so the greeting and
       the cards sit on the panel's own ground and stay legible. It used to
       run 210-340px down the page, which washed out every hero title and left
       the cards floating on a mountain. */
    .lv-shell-photo { position: fixed; top: 68px; left: 0; right: 0; width: 100%; height: 128px; object-fit: cover; object-position: center 70%; opacity: 0.6; z-index: 0; pointer-events: none; }
    .lv-shell-veil { position: fixed; top: 68px; left: 0; right: 0; height: 128px; z-index: 0; pointer-events: none; }
    /* Sticky, and the photograph behind it is fixed, so search and the account
       stay reachable and the bar always sits on the mountains rather than
       sliding half out of view. */
    /* Above the bottom bar (30): the top bar creates a stacking context, and
       everything it opens — search on a phone, the notification panel, the
       account menu — has to paint over the navigation rather than under it. */
    .lv-topbar { position: sticky; top: 0; z-index: 40; background: ${theme.color.page}; display: flex; align-items: center; gap: ${theme.space(2)}px; padding: ${theme.space(3)}px ${theme.space(3)}px; }
    .lv-topbar-search { flex: 1; min-width: 0; }
    .lv-topbar-actions { display: flex; align-items: center; gap: ${theme.space(2)}px; flex: 0 0 auto; }
    .lv-topbar-identity { display: none; }
    .lv-topbar-account { padding: 2px; gap: 0; }
    .lv-topbar-more { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: 0 0 auto; }
    /* 'position: relative' and *no* z-index, deliberately.

       This carried 'z-index: 1', which bought nothing and cost a great deal: a
       z-index on a positioned element creates a stacking context, so every
       overlay rendered inside main — a sheet at 100, a full-screen modal at
       100, the search panel at 70 — was only ever compared against its
       siblings *within* main. Outside, the browser compared main itself
       (1) against the top bar (40), the door bar (30) and the desktop rail
       (3), and the chrome won every time. Three separate overlay bugs came
       out of this one declaration, and each was treated by raising a z-index
       somewhere, which cannot work: no number inside a trapped context beats
       anything outside it.

       Nothing needed the 1. Main is positioned and comes after .lv-shell-photo
       and .lv-shell-veil in the DOM, so with z-index: auto it still paints
       above them in the same layer, and no ancestor (.lv-root, .lv-shell,
       .lv-shell-body) creates a stacking context of its own. Overlays now
       compete at the root, where their z-index already says what it means.

       The chrome still steps aside for a full-screen modal and a sheet, a few
       rules below. That stays: it is the right behaviour on a phone and it
       keeps invisible chrome from being hit-testable. It is no longer the
       only thing holding the overlays up. */
    .lv-shell-main { position: relative; flex: 1; min-width: 0; box-sizing: border-box; padding: ${theme.space(4)}px ${theme.space(4)}px 96px; }
    .lv-shell-panel { border-radius: ${theme.radius.xl}px ${theme.radius.xl}px 0 0; margin-top: ${theme.space(2)}px; }
    .lv-shell-content { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: ${theme.space(5)}px; }
    .lv-bottomnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; background: ${theme.color.surfaceRaised}; border-top: 1px solid ${theme.color.border}; padding-bottom: env(safe-area-inset-bottom); }
    /* No gutters between the six cells: at 320px with a visible scrollbar the
       bar has 305px to divide, and every pixel of padding is a pixel taken
       from a word. The cells are still 44px+ targets, and the active pill
       separates them visually. */
    .lv-bottomnav-list { display: flex; gap: 0; margin: 0; padding: 6px 0; list-style: none; }
    /* Six doors share the width evenly. They fit because each door carries a
       shorter *word* for this bar, not a cropped one — see LV_DOOR_DEFINITIONS. */
    .lv-bottomnav-list > li { flex: 1 1 0; min-width: 0; }
    .lv-root .lv-bottomnav .lv-nav-item > button { flex-direction: column; gap: 2px; min-height: 54px; padding: 5px 0; font-size: 11px; line-height: 1.2; justify-content: center; letter-spacing: -0.02em; }
    .lv-bottomnav .lv-nav-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
    .lv-bottomnav .lv-nav-badge { position: absolute; top: 4px; right: 8px; }
    .lv-bottomnav .lv-nav-item { position: relative; }
    /* Stated rather than inherited, so neither mark can reappear if the
       sidebar's markup changes. */
    .lv-shell .lv-logo-mark, .lv-shell .lv-logo-lockup { display: none; }
    .lv-nav-group { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
    /* The default shape of a navigation row — a labelled line. The sidebar and
       the bottom bar reshape it; anywhere else (the "more" sheet) this is it. */
    .lv-root .lv-nav-item > button { flex-direction: row; gap: ${theme.space(3)}px; min-height: 44px; padding: 0 ${theme.space(3)}px; font-size: ${theme.font.size.md}px; }
    /* ---------------------- page header and record header ---------------- */
    .lv-page-header { display: flex; flex-direction: column; gap: ${theme.space(2)}px; }
    .lv-page-header-hero { padding-bottom: ${theme.space(2)}px; }
    .lv-page-header-hero .lv-page-title { font-size: clamp(28px, 7vw, 36px); }
    .lv-page-actions { display: flex; flex-wrap: wrap; gap: ${theme.space(2)}px; }
    .lv-page-actions > button { flex: 1 1 auto; }
    .lv-record-header { display: flex; flex-direction: column; gap: ${theme.space(4)}px; padding: ${theme.space(4)}px; }
    .lv-record-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${theme.space(3)}px; margin: 0; }
    .lv-record-actions { flex-wrap: wrap; }
    .lv-record-actions > button { flex: 1 1 auto; }
    .lv-section-nav { min-width: 0; }
    /* The contextual actions of a record become the sticky bar at the foot of
       a phone, above the navigation. */
    .lv-contextual-actions { border-radius: ${theme.radius.lg}px; padding: ${theme.space(3)}px; }
    .lv-contextual-sticky { position: fixed; left: 0; right: 0; bottom: 0; z-index: 31; border-radius: 0; padding: ${theme.space(3)}px ${theme.space(4)}px calc(${theme.space(3)}px + env(safe-area-inset-bottom)); }
    /* Two actions do not fit on one 320px line: a button will not shrink
       below its own label, so the row wraps rather than overflowing. */
    .lv-contextual-inner { max-width: 1280px; margin: 0 auto; flex-wrap: wrap; }
    .lv-contextual-inner > button { flex: 1 1 auto; }
    /* While a record pins its own actions, the six doors step aside rather
       than stacking two bars on top of each other. */
    .lv-shell:has(.lv-contextual-sticky) .lv-bottomnav { display: none; }
    /* And while a sheet is open it owns the bottom of the screen outright.
       The sheet carries z-index 100 and the bar 30, but the sheet renders
       inside the shell's stacking context, so the bar paints over its footer
       and the primary action cannot be tapped. Phase 11's width sweep does not
       catch this — overlap is not overflow — so it was found by hit-testing
       the footer: at 390 the bar starts at 777 and the footer sits at 779. */
    .lv-shell:has(.lv-sheet-panel) .lv-bottomnav { display: none; }
    /* A full-screen modal covers the phone entirely, so the chrome underneath
       is invisible — but still hit-testable, and it swallows the modal's own
       controls. .lv-shell-main carries z-index 1 and therefore its own
       stacking context, so the overlay's z-index 100 is only compared *inside*
       main, while the top bar (z-index 40) and the door bar (30) are compared
       against main itself and win. Raising the overlay cannot fix that; the
       chrome it covers steps aside instead, exactly as it does for a sheet.
       Measured at 390: the close button sat at y=37 under .lv-topbar-more, and
       a footer button at y=779 under a door bar starting at 778. */
    .lv-shell:has(.lv-modal-full) .lv-topbar { display: none; }
    .lv-shell:has(.lv-modal-full) .lv-bottomnav { display: none; }
    .lv-shell:has(.lv-contextual-sticky) .lv-shell-main { padding-bottom: 104px; }
    .lv-quick-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: ${theme.space(2)}px; margin: 0; padding: 0; list-style: none; }
    /* ------------------------------- the lead profile -------------------- */
    /* On a phone the photograph is the page's own hero: full bleed against
       the main region's gutter, with the identity card riding up over it. */
    .lv-lead-header { margin: -${theme.space(4)}px -${theme.space(4)}px 0; }
    .lv-lead-hero { position: relative; height: 200px; overflow: hidden; border-radius: 0 !important; }
    .lv-lead-hero-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .lv-lead-hero-veil { position: absolute; inset: 0; }
    .lv-lead-hero-controls { position: relative; z-index: 1; display: flex; align-items: center; gap: ${theme.space(2)}px; padding: ${theme.space(3)}px; }
    .lv-lead-identity-card { position: relative; margin-top: -${theme.space(6)}px; border-radius: ${theme.radius.xl}px ${theme.radius.xl}px 0 0 !important; padding: ${theme.space(5)}px ${theme.space(4)}px ${theme.space(4)}px; display: flex; flex-direction: column; gap: ${theme.space(4)}px; }
    .lv-lead-identity-top { display: flex; flex-direction: column; align-items: flex-start; gap: ${theme.space(3)}px; }
    /* The header's own buttons are the four-up quick row on a phone. */
    .lv-lead-header-actions { display: none; }
    .lv-lead-name { font-size: clamp(22px, 6.4vw, 28px); }
    /* Sits under the shell's own sticky bar once the header scrolls away. */
    .lv-lead-compact { position: sticky; top: 66px; z-index: 25; display: flex; align-items: center; gap: ${theme.space(3)}px; padding: ${theme.space(2)}px ${theme.space(3)}px; margin: -${theme.space(4)}px -${theme.space(4)}px 0; }
    .lv-lead-body { display: flex; flex-direction: column; gap: ${theme.space(4)}px; }
    /* Capture's source tiles: one column on a phone, two from a tablet. */
    .lv-root .lv-source-grid { display: grid; grid-template-columns: 1fr; gap: ${theme.space(3)}px; margin: 0; padding: 0; list-style: none; }
    .lv-root .lv-source-card { display: flex; align-items: flex-start; gap: ${theme.space(3)}px; padding: ${theme.space(4)}px; min-height: 96px; }
    .lv-root .lv-section-head { flex-wrap: wrap; }
    .lv-root .lv-section-head > h2 { flex: 1 1 100%; }

    /* CSV import. A mapping row is a stack on a phone — the column, what it
       holds, and what it becomes, each on its own line — and three aligned
       columns once there is width to align them in. A review row puts the
       decision under the row on a phone, where a control at the far right of
       a line is a control nobody reaches. */
    .lv-root .lv-map-row { display: flex; flex-direction: column; gap: ${theme.space(2)}px; padding: ${theme.space(3)}px 0; border-top: 1px solid ${theme.color.border}; }
    .lv-root .lv-map-target { min-width: 0; }
    .lv-root .lv-import-row { display: flex; flex-direction: column; gap: ${theme.space(3)}px; padding: ${theme.space(4)}px; border-radius: ${theme.radius.lg}px; border: 1px solid ${theme.color.border}; }
    .lv-root .lv-import-row-body { min-width: 0; flex: 1 1 auto; }
    .lv-root .lv-import-decision { flex: 0 0 auto; display: flex; }
    .lv-root .lv-import-decision > * { flex: 1 1 auto; }
    /* The ecosystem's kind switcher: the overview tiles already do this job
       on a phone, so the second copy only appears where there is room. */
    .lv-root .lv-kind-switch { display: none; }
    /* The active navigation item carries a pine bar on its leading edge,
       inside the pill so it rounds with it. */
    /* Rows in an attention list are divided, not boxed — the rule goes
       between them, so the first and last need no special case. */
    .lv-root .lv-button-sm { min-height: 44px; }
    .lv-root .lv-icon-button { min-height: 44px; min-width: 44px; }
    .lv-root .lv-text-button { min-height: 44px; }
    .lv-root .lv-chip-control { min-height: 44px; }
    .lv-root .lv-offline { position: fixed; top: 0; left: 0; right: 0; z-index: 200; }
    .lv-root:has(.lv-offline) .lv-topbar { top: 44px; }
    /* ------------------------- leadership & operations ------------------- */
    .lv-root .lv-kpi-row { grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); }
    .lv-root .lv-ops-grid { grid-template-columns: 1fr; }
    .lv-root .lv-sla-board { grid-template-columns: 1fr; }
    .lv-root .lv-topbar-account { min-height: 44px; }
    .lv-root .lv-action-row + .lv-action-row { border-top: 1px solid ${theme.color.border}; }
    .lv-root .lv-nav-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 0 3px 3px 0; }
    /* Messages. One column on a phone, where the inbox and a thread are
       separate screens reached by a real route so Back behaves. Two columns
       from 1024px, both in normal page flow — an independently scrolling
       list beside an independently scrolling thread is the nested scroll trap
       this brief warns about, and the page scrolling once is easier to use. */
    .lv-root .lv-messages { display: grid; grid-template-columns: 1fr; gap: ${theme.space(4)}px; align-items: start; }
    .lv-root .lv-messages-list { min-width: 0; }
    .lv-root .lv-messages-thread { min-width: 0; }
    .lv-root .lv-msg-row { display: flex; flex-direction: column; gap: ${theme.space(1)}px; }
    .lv-root .lv-msg-meta { display: flex; flex-wrap: wrap; align-items: center; gap: ${theme.space(2)}px; }

    /* Onboarding. The review workspace is one column on a phone, where the
       file opens full screen rather than competing with the decision, two
       once there is room for the evidence beside the list, and three on a
       desktop so the list, the file and the decision are all in sight. */
    .lv-root .lv-review-layout { display: grid; grid-template-columns: 1fr; gap: ${theme.space(4)}px; align-items: start; }
    .lv-root .lv-review-evidence { display: none; }
    .lv-root .lv-review-decision { min-width: 0; }
    .lv-root .lv-doc-card { min-width: 0; }
    .lv-root .lv-doc-actions > * { flex: 1 1 auto; }
    .lv-root .lv-preview-bar { flex-wrap: wrap; }
    .lv-root .lv-journey { display: flex; flex-direction: column; gap: ${theme.space(2)}px; margin: 0; padding: 0; list-style: none; }
    .lv-root .lv-segmented > button { min-height: 44px; }
    .lv-root .lv-import-decision .lv-segmented { width: 100%; }
    .lv-root .lv-import-decision .lv-segmented > button { flex: 1 1 0; justify-content: center; }
    /* The list row: identity and chevron on the first line, the state badges
       wrapped beneath rather than squeezed beside a name. */
    .lv-lead-row > button { flex-wrap: wrap; }
    .lv-lead-identity { flex: 1 1 auto; }
    .lv-lead-meta { flex: 1 0 100%; order: 1; flex-wrap: wrap; }
    .lv-hero-body { padding: ${theme.space(5)}px; }
    .lv-hero-aside { padding: ${theme.space(5)}px; }
    .lv-entry-card { gap: ${theme.space(4)}px; padding: ${theme.space(5)}px; min-height: 172px; }
    /* ------------------------------ global search ------------------------ */
    .lv-search-field { gap: ${theme.space(2)}px; min-height: 46px; padding: 0 ${theme.space(4)}px; border-radius: ${theme.radius.pill}px; background: ${theme.color.surfaceRaised}; border: 1px solid ${theme.color.border}; box-shadow: ${theme.shadow.sm}; }
    .lv-search-field input[type="search"]::-webkit-search-cancel-button { display: none; }
    /* The keyboard hint is a desktop affordance; a phone has no ⌘. */
    .lv-search-hint { display: none; }
    .lv-search-panel { border-radius: ${theme.radius.lg}px; overflow: hidden; }
    .lv-search > .lv-search-panel { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 70; }
    .lv-search-trigger { min-height: 44px; padding: 0 ${theme.space(3)}px; min-width: 0; overflow: hidden; white-space: nowrap; }
    /* On a phone search takes the screen: a dropdown and an on-screen keyboard
       cannot share 390px, and search is how a phone user navigates. */
    .lv-search-fullscreen { position: fixed; inset: 0; z-index: 90; display: flex; flex-direction: column; }
    .lv-search-fullscreen-bar { display: flex; align-items: center; gap: ${theme.space(1)}px; padding: ${theme.space(2)}px; }
    .lv-search-fullscreen-body { flex: 1; min-height: 0; overflow-y: auto; padding: ${theme.space(2)}px; }
    .lv-search-fullscreen .lv-search-field { box-shadow: none; }
    .lv-search-fullscreen .lv-search-panel { border: none; box-shadow: none; background: transparent; }
    .lv-root .lv-skeleton { background: linear-gradient(90deg, ${theme.color.surfaceSunken} 25%, ${theme.color.surface} 50%, ${theme.color.surfaceSunken} 75%); background-size: 200% 100%; animation: lv-shimmer 1.4s ease-in-out infinite; border-radius: ${theme.radius.md}px; }
    .lv-root .lv-fade-in { animation: lv-fade ${theme.motion.duration.normal}ms ${theme.motion.easing}; }
    .lv-root table { border-collapse: collapse; width: 100%; }
    .lv-root th { text-align: left; }
    @keyframes lv-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @keyframes lv-fade { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: none; } }
    @media (min-width: ${theme.breakpoint.md - 0.5}px) {
      .lv-root .lv-ask-starter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-root .lv-ask-input { min-height: 68px; font-size: ${theme.font.size.lg - 2}px; }
      .lv-root .lv-acct-row { grid-template-columns: 236px minmax(0, 1fr); gap: ${theme.space(6)}px; align-items: start; }
      .lv-root .lv-acct-control { max-width: 440px; }
      .lv-root .lv-entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-root .lv-map-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr); gap: ${theme.space(4)}px; align-items: start; padding: ${theme.space(3)}px 0; }
      .lv-root .lv-import-row { flex-direction: row; align-items: flex-start; gap: ${theme.space(4)}px; }
      .lv-root .lv-import-decision { width: 190px; }
      .lv-root .lv-kind-switch { display: flex; flex-wrap: wrap; gap: ${theme.space(2)}px; }
      .lv-contextual-inner { flex-wrap: nowrap; }
      .lv-root .lv-review-layout { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); }
      .lv-root .lv-review-evidence { display: block; }
      .lv-root .lv-doc-actions > * { flex: 0 0 auto; }
      .lv-root .lv-preview-bar { flex-wrap: nowrap; }
      .lv-root .lv-journey { flex-direction: row; flex-wrap: wrap; gap: ${theme.space(4)}px; }
      .lv-root .lv-segmented > button { min-height: 36px; }
      .lv-modal-panel { margin: auto; width: min(560px, 100%); max-height: 90vh; border-radius: ${theme.radius.xl}px; padding: ${theme.space(6)}px; }
      .lv-modal-panel .lv-overlay-footer { padding-top: ${theme.space(4)}px; border-top: 1px solid ${theme.color.border}; margin-top: ${theme.space(4)}px; }
      .lv-modal-full { margin: auto; width: min(680px, 100%); height: auto; max-height: 88vh; border-radius: ${theme.radius.xl}px; border: 1px solid ${theme.color.border}; }
      /* A drawer is a side panel once there is a side to put it on. */
      .lv-drawer-panel { margin: 0 0 0 auto; width: 60%; height: 100vh; max-height: 100vh; border-radius: 0; padding: ${theme.space(6)}px; }
      .lv-sheet-panel { margin: auto; width: min(440px, 100%); border-radius: ${theme.radius.xl}px; padding: ${theme.space(6)}px; }
      .lv-root .lv-sheet-handle { display: none; }
      .lv-overlay-footer { flex-direction: row; justify-content: flex-end; }
      .lv-overlay-footer > button { width: auto; }
      /* Tablet: the sidebar appears, as a column of icons. A 248px sidebar on
         a 1024px screen spends a quarter of the product on navigation. */
      .lv-bottomnav { display: none; }
      .lv-sidebar { display: flex; flex-direction: column; position: sticky; top: 0; align-self: flex-start; height: 100vh; width: 76px; flex: 0 0 76px; gap: ${theme.space(2)}px; padding: ${theme.space(4)}px ${theme.space(2)}px; z-index: 3; box-sizing: border-box; background: ${theme.color.page}; }
      .lv-sidebar-logo { display: flex; align-items: center; justify-content: center; height: 56px; padding: 0; margin-bottom: ${theme.space(2)}px; }
      .lv-sidebar .lv-nav-label { display: none; }
      .lv-sidebar .lv-nav-badge { position: absolute; top: 2px; right: 2px; }
      .lv-sidebar .lv-nav-item { position: relative; }
      .lv-root .lv-sidebar .lv-nav-item > button { justify-content: center; gap: 0; padding: 0; }
      .lv-nav-secondary { margin-top: ${theme.space(6)}px; }
      .lv-nav-settings { margin-top: ${theme.space(2)}px; }
      .lv-shell .lv-logo-mark { display: block; }
      .lv-shell .lv-logo-lockup { display: none; }
      .lv-account-card { justify-content: center; gap: 0; padding: ${theme.space(2)}px 0; }
      .lv-account-identity, .lv-account-chevron { display: none; }
      .lv-root .lv-button-sm { min-height: 36px; }
      .lv-root .lv-icon-button { min-height: 0; min-width: 0; }
      .lv-root .lv-text-button { min-height: 0; }
      .lv-root .lv-chip-control { min-height: 32px; }
      .lv-root .lv-kpi-row { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
      .lv-root .lv-ops-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-root .lv-sla-board { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-topbar-more { display: none; }
      /* From 768px .lv-modal-full is a centred panel, not the whole screen,
         so the top bar is visible beside it and must come back. */
      .lv-shell:has(.lv-modal-full) .lv-topbar { display: flex; }
      .lv-topbar-identity { display: block; }
      .lv-topbar-account { padding: 3px ${theme.space(3)}px 3px 3px; gap: ${theme.space(2)}px; }
      .lv-shell-photo, .lv-shell-veil { top: 70px; height: 148px; }
      .lv-topbar { padding: ${theme.space(4)}px ${theme.space(5)}px ${theme.space(2)}px; gap: ${theme.space(4)}px; }
      .lv-shell-main { padding: ${theme.space(2)}px ${theme.space(5)}px ${theme.space(8)}px; }
      .lv-shell-panel { padding: ${theme.space(6)}px; margin-top: ${theme.space(3)}px; min-height: 60vh; }
      .lv-shell-content { gap: ${theme.space(6)}px; }
      .lv-page-header { flex-direction: row; align-items: flex-end; flex-wrap: wrap; gap: ${theme.space(4)}px; }
      .lv-page-trail { flex: 1 0 100%; }
      .lv-page-headline { flex: 1 1 320px; }
      .lv-page-actions { flex: 0 0 auto; }
      .lv-page-actions > button { flex: 0 0 auto; }
      .lv-record-header { flex-direction: row; align-items: center; flex-wrap: wrap; padding: ${theme.space(5)}px; }
      .lv-record-identity { flex: 1 1 280px; }
      .lv-record-facts { grid-template-columns: repeat(4, minmax(0, 1fr)); flex: 2 1 380px; }
      .lv-record-actions { flex: 0 0 auto; }
      .lv-record-actions > button { flex: 0 0 auto; }
      .lv-contextual-sticky { position: static; border-radius: ${theme.radius.lg}px; padding: ${theme.space(3)}px ${theme.space(4)}px; }
      .lv-contextual-inner > button { flex: 0 0 auto; }
      .lv-contextual-inner { justify-content: flex-end; }
      .lv-shell:has(.lv-contextual-sticky) .lv-shell-main { padding-bottom: ${theme.space(8)}px; }
      .lv-hero-body { padding: ${theme.space(6)}px ${theme.space(7)}px; }
      .lv-hero-aside { padding: ${theme.space(7)}px; }
      /* From a tablet up the photograph is a band inside the card: a
         full-bleed image beside a sidebar reads as a banner advert. */
      .lv-lead-header { margin: 0; }
      .lv-lead-header { position: relative; }
      .lv-lead-hero { position: absolute; inset: 0; height: auto; border-radius: ${theme.radius.xl}px !important; }
      .lv-lead-hero-veil { background: linear-gradient(180deg, rgba(22, 38, 30, 0.1) 0%, rgba(22, 38, 30, 0) 55%) !important; }
      .lv-lead-identity-card { position: relative; background: transparent !important; border-radius: ${theme.radius.xl}px !important; }
      .lv-lead-identity-card::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(90deg, ${theme.color.surfaceRaised} 0%, ${theme.color.surfaceRaised}F2 46%, ${theme.color.surfaceRaised}00 80%); }
      .lv-lead-identity-card > * { position: relative; }
      .lv-lead-hero-controls { display: none; }
      .lv-lead-identity-card { margin-top: 0; padding: ${theme.space(5)}px; }
      .lv-lead-identity-top { flex-direction: row; align-items: center; gap: ${theme.space(4)}px; }
      .lv-lead-header-actions { display: flex; align-items: center; gap: ${theme.space(2)}px; flex: 0 0 auto; }
      .lv-lead-identity-card .lv-quick-actions { display: none; }
      .lv-lead-compact { display: none; }
      .lv-lead-body { gap: ${theme.space(5)}px; }
      .lv-root .lv-source-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-root .lv-section-head { flex-wrap: nowrap; }
      .lv-root .lv-section-head > h2 { flex: 1 1 auto; }
      .lv-lead-row > button { flex-wrap: nowrap; }
      .lv-lead-meta { flex: 0 0 auto; order: 0; }
      .lv-entry-card { gap: ${theme.space(5)}px; padding: ${theme.space(6)}px; min-height: 200px; }
      .lv-search-hint { display: inline-block; }
      .lv-root .lv-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: ${theme.space(3)}px; }
      .lv-root .lv-two-col { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-root .lv-field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .lv-root .lv-profile-actions { flex: 0 0 auto; }
      .lv-root .lv-profile-actions > button { flex: 0 0 auto; }
      .lv-toast-stack { left: auto; right: ${theme.space(6)}px; bottom: ${theme.space(6)}px; width: min(420px, 40vw); }
      .lv-root .lv-tabs { flex-wrap: wrap; overflow-x: visible; }
      .lv-root .lv-steps { flex-direction: row; flex-wrap: wrap; gap: ${theme.space(4)}px; }
      .lv-root .lv-step { width: auto; }
      .lv-root .lv-activity-spacer { display: block; }
      .lv-root .lv-activity-outcome { flex: 0 0 auto; }
      .lv-root .lv-nba-aside { flex: 0 0 auto; }
      .lv-root .lv-nba-aside > button { width: auto; }
      .lv-root .lv-action-row { flex-wrap: nowrap; }
      /* The row still wraps at every width — a rejection reason is a full
         line of its own, and forcing it onto the first line would push the
         page sideways. Only the state chip changes: beside the name where
         there is room, on its own line on a phone. */
      .lv-root .lv-document-state { flex: 0 0 auto; }
      .lv-root .lv-action-row-body { flex: 1 1 160px; }
      .lv-root .lv-action-row-cta { flex: 0 0 auto; order: 0; }
      .lv-root .lv-action-row-cta > button { flex: 0 0 auto; }
      .lv-root .lv-hide-mobile { display: initial; }
      .lv-root .lv-hide-desktop { display: none; }
    }
    @media (min-width: ${theme.breakpoint.lg - 0.5}px) {
      .lv-root .lv-messages { grid-template-columns: minmax(340px, 1fr) minmax(0, 1.5fr); }
      .lv-root .lv-messages-list { position: sticky; top: ${theme.space(4)}px; }
      .lv-root .lv-review-layout { grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.4fr) minmax(300px, 0.95fr); }
      .lv-drawer-panel { width: min(480px, 45%); }
      /* Desktop: the sidebar can afford its labels again. */
      .lv-sidebar { width: 248px; flex: 0 0 248px; padding: ${theme.space(5)}px ${theme.space(4)}px ${theme.space(4)}px; }
      .lv-sidebar-logo { justify-content: flex-start; height: 72px; padding: 0 ${theme.space(2)}px; margin-bottom: ${theme.space(4)}px; }
      .lv-sidebar .lv-nav-label { display: block; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .lv-sidebar .lv-nav-badge { position: static; }
      .lv-root .lv-sidebar .lv-nav-item > button { justify-content: flex-start; gap: ${theme.space(3)}px; padding: 0 ${theme.space(3)}px; }
      .lv-nav-group { gap: 3px; }
      /* A generous gap, not a rule: the second group recedes rather than
         reading as another section of navigation. */
      .lv-nav-secondary { margin-top: ${theme.space(8)}px; }
      .lv-nav-settings { margin-top: ${theme.space(3)}px; }
      .lv-shell .lv-logo-mark { display: none; }
      .lv-shell .lv-logo-lockup { display: block; }
      .lv-account-card { justify-content: flex-start; gap: ${theme.space(3)}px; padding: ${theme.space(2)}px; margin-top: auto; }
      .lv-account-identity { display: block; }
      .lv-account-chevron { display: inline-flex; }
      .lv-shell-photo, .lv-shell-veil { top: 74px; height: 168px; }
      .lv-topbar { padding: ${theme.space(5)}px ${theme.space(7)}px ${theme.space(2)}px; }
      .lv-shell-main { padding: ${theme.space(3)}px ${theme.space(7)}px ${theme.space(8)}px; }
      .lv-shell-panel { padding: ${theme.space(7)}px; }
      .lv-entry-card { padding: ${theme.space(7)}px; min-height: 218px; }
      .lv-root .lv-kpi-row { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
      .lv-root .lv-sla-board { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .lv-lead-body { display: block; column-count: 2; column-gap: ${theme.space(5)}px; }
      .lv-lead-body > * { break-inside: avoid; margin-bottom: ${theme.space(5)}px; }
      .lv-root .lv-entry-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .lv-root .lv-three-col { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .lv-root .lv-sidebar-layout { grid-template-columns: minmax(0, 1fr) minmax(280px, 360px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .lv-root * { animation: none !important; transition: none !important; }
    }
  `}</style>
);

// Kept for the surfaces written before the kit was generalised.
export const FocusStyles = LvStyles;

// The outermost element of every LV surface. The ground is the host page's
// (themed by lv-theme.css), so a short page does not end in a visible seam.
export const LvPage = ({ theme, children, maxWidth = 1280, className = '' }: { theme: LvTheme; children: ReactNode; maxWidth?: number; className?: string }) => {
  const s = layout(theme);

  return (
    <div className={`lv-root ${className}`.trim()} style={{ ...s.page, background: 'transparent', padding: 'clamp(12px, 2.5vw, 24px)' }}>
      <LvStyles theme={theme} />
      <div style={s.container(maxWidth)}>{children}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
export const Eyebrow = ({ theme, children, tone }: { theme: LvTheme; children: ReactNode; tone?: Tone }) => (
  <span style={{ ...theme.type.label, display: 'block', color: tone ? toneColour(theme, tone) : theme.color.textMuted }}>{children}</span>
);

export const PageHeader = ({
  theme,
  title,
  subtitle,
  eyebrow,
  right,
}: {
  theme: LvTheme;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
}) => (
  <header
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: theme.space(3),
      marginBottom: theme.space(4),
      paddingBottom: theme.space(3),
      borderBottom: `1px solid ${theme.color.border}`,
      position: 'relative',
    }}
  >
    <span aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: -1, width: 56, height: 2, background: theme.color.accent }} />
    <div style={{ minWidth: 0 }}>
      {eyebrow && <Eyebrow theme={theme}>{eyebrow}</Eyebrow>}
      <h1 style={{ ...theme.type.display, margin: 0, color: theme.color.heading }}>{title}</h1>
      {subtitle && <p style={{ ...theme.type.bodySmall, margin: `${theme.space(1)}px 0 0`, color: theme.color.textMuted }}>{subtitle}</p>}
    </div>
    {right && <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap', alignItems: 'center' }}>{right}</div>}
  </header>
);

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
export type LvButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

export const LvButton = ({
  theme,
  children,
  variant = 'secondary',
  size = 'md',
  onClick,
  type = 'button',
  disabled,
  busy,
  title,
  ariaLabel,
  ariaPressed,
  style,
  icon,
  href,
  target,
}: {
  theme: LvTheme;
  children: ReactNode;
  variant?: LvButtonVariant;
  size?: 'sm' | 'md';
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  // A real loading state: the button keeps its width and announces itself.
  busy?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  style?: CSSProperties;
  icon?: ReactNode;
  /**
   * Renders an anchor instead of a button. For navigation only — opening a
   * stored document, downloading a file — never for an action. A link the
   * browser must own (new tab, "copy link address", middle click) has to be a
   * real `<a>`; a button with an onClick that navigates takes all of that away.
   */
  href?: string;
  target?: '_blank';
}) => {
  const s = layout(theme);
  const base = s.button(variant);
  const geometry: CSSProperties = {
    ...base,
    // No minHeight here — `.lv-button-sm` sets it, so a phone keeps the
    // 44px floor and only md and up drops to 36px.
    ...(size === 'sm' ? { padding: `${theme.space(1)}px ${theme.space(3)}px`, fontSize: theme.font.size.sm } : {}),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    whiteSpace: 'nowrap',
    ...style,
  };

  if (href !== undefined) {
    return (
      <a
        href={href}
        target={target}
        // Without noreferrer the opened page can reach back through
        // window.opener, and these pages are signed document URLs.
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        aria-label={ariaLabel}
        title={title}
        className={size === 'sm' ? 'lv-button-sm' : undefined}
        style={{ ...geometry, textDecoration: 'none' }}
      >
        {icon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>}
        <span>{children}</span>
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
      className={size === 'sm' ? 'lv-button-sm' : undefined}
      style={geometry}
    >
      {icon && <span aria-hidden="true" style={{ display: 'inline-flex' }}>{icon}</span>}
      <span>{busy ? 'Working…' : children}</span>
    </button>
  );
};

// A row of actions that wraps on a phone. The first is the primary.
export const ActionBar = ({ theme, children, align = 'start' }: { theme: LvTheme; children: ReactNode; align?: 'start' | 'end' }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space(2), alignItems: 'center', justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }}>{children}</div>
);

// ---------------------------------------------------------------------------
// Badges and status
// ---------------------------------------------------------------------------
export const LvBadge = ({ theme, tone = 'neutral', children, title }: { theme: LvTheme; tone?: BadgeTone; children: ReactNode; title?: string }) => {
  const s = layout(theme);

  return (
    <span title={title} style={s.badge(tone)}>
      {children}
    </span>
  );
};

// The one status badge. Label and tone come from the unified status map.
export const LvStatusBadge = ({ theme, kind, value, title }: { theme: LvTheme; kind: StatusKind; value: string | null | undefined; title?: string }) => {
  const status = describeStatus(kind, value);

  return (
    <LvBadge theme={theme} tone={badgeToneOf(status.tone)} title={title}>
      {status.label}
    </LvBadge>
  );
};

export const statusToneToTone = (tone: StatusTone): Tone => badgeToneOf(tone);

// A small count pill for section headings.
export const CountPill = ({ theme, count, tone }: { theme: LvTheme; count: number; tone?: BadgeTone }) => (
  <LvBadge theme={theme} tone={tone ?? (count > 0 ? 'info' : 'neutral')}>
    {count}
  </LvBadge>
);

// Where a value came from. AI output is always labelled as such; nothing
// sparkles.
export const Provenance = ({ theme, source, detail, label: customLabel, inverse = false }: { theme: LvTheme; source: 'rules' | 'ai' | 'user' | 'system'; detail?: string; label?: string; inverse?: boolean }) => {
  const label = customLabel ?? (source === 'ai' ? 'AI GENERATED' : source === 'rules' ? 'COMPUTED · rules' : source === 'user' ? 'RECORDED' : 'SYSTEM');
  const colour = inverse ? (source === 'ai' ? theme.color.accent : 'rgba(243,239,231,0.85)') : source === 'ai' ? theme.color.accentInk : theme.color.textMuted;
  const border = inverse ? (source === 'ai' ? theme.color.accent : 'rgba(243,239,231,0.4)') : source === 'ai' ? theme.color.accentInk : theme.color.borderStrong;

  return (
    <span
      title={detail}
      style={{
        ...theme.type.caption,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: `1px ${theme.space(2)}px`,
        borderRadius: theme.radius.pill,
        border: `1px dashed ${border}`,
        color: colour,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: source === 'ai' ? theme.color.accent : theme.color.brandMuted }} />
      {label}
      {detail && <VisuallyHidden>: {detail}</VisuallyHidden>}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------
export const LvCard = ({
  theme,
  children,
  tone,
  padding,
  style,
  as: Tag = 'div',
  ariaLabel,
}: {
  theme: LvTheme;
  children: ReactNode;
  // A toned card carries a coloured top rule: the attention signal.
  tone?: Tone;
  padding?: number;
  style?: CSSProperties;
  as?: 'div' | 'section' | 'article' | 'aside';
  ariaLabel?: string;
}) => {
  const s = layout(theme);
  const { border: _border, ...card } = s.card as CSSProperties & { border?: string };

  return (
    <Tag
      aria-label={ariaLabel}
      style={{
        ...card,
        borderStyle: 'solid',
        borderWidth: tone ? '3px 1px 1px' : '1px',
        borderColor: tone ? `${toneColour(theme, tone)} ${theme.color.border} ${theme.color.border}` : theme.color.border,
        padding: padding ?? theme.space(4),
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
};

export const Section = ({
  theme,
  title,
  count,
  countTone,
  children,
  hint,
  actions,
  tone,
  id,
}: {
  theme: LvTheme;
  title: string;
  count?: number;
  countTone?: BadgeTone;
  children: ReactNode;
  hint?: string;
  actions?: ReactNode;
  tone?: Tone;
  id?: string;
}) => (
  <LvCard theme={theme} as="section" ariaLabel={title} tone={tone} padding={theme.space(3)} style={{ scrollMarginTop: 16 }}>
    <div id={id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.space(2), flexWrap: 'wrap', marginBottom: theme.space(2) }}>
      <h2 style={{ ...theme.type.subheading, margin: 0, color: theme.color.heading, display: 'flex', alignItems: 'baseline', gap: theme.space(2), flexWrap: 'wrap' }}>
        <span>{title}</span>
        {typeof count === 'number' && <CountPill theme={theme} count={count} tone={countTone} />}
        {hint && <span style={{ ...theme.type.caption, color: theme.color.textMuted, fontWeight: 400 }}>{hint}</span>}
      </h2>
      {actions && <div style={{ display: 'flex', gap: theme.space(2), flexWrap: 'wrap' }}>{actions}</div>}
    </div>
    {children}
  </LvCard>
);

// A dark-anchored panel: the hero of a page (Lead 360 identity, briefing).
export const InversePanel = ({ theme, children, style }: { theme: LvTheme; children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      background: theme.color.surfaceInverse,
      color: theme.color.surfaceInverseText,
      borderRadius: theme.radius.lg,
      padding: 'clamp(16px, 3vw, 24px)',
      boxShadow: theme.shadow.md,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}
  >
    <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${theme.color.accent}, transparent 70%)` }} />
    {children}
  </div>
);

// A definition list rendered as a responsive grid of label/value pairs.
export const Facts = ({ theme, items, columns = 2, onInverse }: { theme: LvTheme; items: { label: string; value: ReactNode; tone?: Tone }[]; columns?: 2 | 3; onInverse?: boolean }) => (
  <dl
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${columns === 3 ? 140 : 160}px, 1fr))`,
      gap: `${theme.space(3)}px ${theme.space(4)}px`,
      margin: 0,
    }}
  >
    {items.map((item) => (
      <div key={item.label} style={{ minWidth: 0 }}>
        <dt style={{ ...theme.type.label, color: onInverse ? 'rgba(243,239,231,0.7)' : theme.color.textMuted, marginBottom: 2 }}>{item.label}</dt>
        <dd style={{ ...theme.type.body, margin: 0, color: item.tone ? toneColour(theme, item.tone) : onInverse ? theme.color.surfaceInverseText : theme.color.text, overflowWrap: 'anywhere' }}>{item.value === null || item.value === undefined || item.value === '' ? '—' : item.value}</dd>
      </div>
    ))}
  </dl>
);

// Segmented control (lens switch, filter tabs). Real buttons, aria-pressed.
export const Segmented = ({ theme, options, value, onChange, label }: { theme: LvTheme; options: { key: string; label: string; count?: number }[]; value: string; onChange: (key: string) => void; label: string }) => (
  // The button height lives in the stylesheet, not here: an inline minHeight
  // would beat the media query and pin a 32px target — below even the compact
  // floor — onto every phone.
  <div className="lv-segmented" role="group" aria-label={label} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 2, padding: 2, borderRadius: theme.radius.pill, background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}` }}>
    {options.map((option) => {
      const active = option.key === value;

      return (
        <button
          key={option.key}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.key)}
          style={{
            border: '1px solid transparent',
            borderRadius: theme.radius.pill,
            padding: `${theme.space(1)}px ${theme.space(3)}px`,
            background: active ? theme.color.brand : 'transparent',
            color: active ? theme.color.textOnBrand : theme.color.textMuted,
            fontFamily: theme.font.body,
            fontSize: theme.font.size.sm,
            fontWeight: theme.font.weight.medium,
            boxShadow: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {option.label}
          {typeof option.count === 'number' && <span style={{ ...theme.type.caption, color: active ? 'inherit' : theme.color.textSubtle }}>{option.count}</span>}
        </button>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------
export const KpiTile = ({
  theme,
  label,
  value,
  emptyText,
  unavailableReason,
  tone,
  onClick,
  hint,
  icon,
  tint,
}: {
  theme: LvTheme;
  label: string;
  value: number | null;
  emptyText: string;
  unavailableReason?: string;
  tone?: Tone;
  onClick?: () => void;
  hint?: string;
  /**
   * A tinted glyph in the corner. Opting in turns the tile into the richer
   * variant — more air, a softer border, a hover lift when it is clickable.
   * Tiles that pass no icon render exactly as before.
   */
  icon?: LvIconName;
  tint?: LvTint;
}) => {
  const colour = toneColour(theme, tone);
  const unavailable = value === null;
  const zero = value === 0;
  const quiet = unavailable || zero;
  const rich = icon !== undefined;
  const chip = tint ? theme.tint[tint] : undefined;
  const status = unavailable ? emptyText : zero ? emptyText : (hint ?? (tone === 'danger' ? 'Needs action' : tone === 'warning' ? 'Needs attention' : ' '));
  const content = (
    <>
      <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.space(2) }}>
        <span style={{ ...theme.type.label, display: 'block', color: theme.color.textMuted }}>{label}</span>
        {rich && icon && (
          <span
            aria-hidden="true"
            style={{
              width: 34,
              height: 34,
              flex: '0 0 auto',
              borderRadius: theme.radius.md,
              background: chip ? chip.wash : theme.color.surfaceSunken,
              color: chip ? chip.ink : theme.color.textMuted,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LvIcon name={icon} size={17} />
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        style={{
          ...theme.type.figure,
          display: 'block',
          fontSize: unavailable ? theme.font.size.lg : theme.type.figure.fontSize,
          margin: `${theme.space(rich ? 2 : 1)}px 0 ${theme.space(1)}px`,
          color: quiet ? theme.color.textSubtle : tone ? colour : theme.color.heading,
        }}
      >
        {unavailable ? 'n/a' : value}
      </span>
      <span style={{ ...theme.type.caption, display: 'block', color: quiet ? theme.color.textSubtle : tone === 'danger' || tone === 'warning' ? colour : theme.color.textMuted, overflowWrap: 'anywhere' }}>{status}</span>
      <VisuallyHidden>{unavailable ? `${label}: unavailable. ${unavailableReason ?? emptyText}` : `${label}: ${value}. ${zero ? emptyText : status}`}</VisuallyHidden>
    </>
  );
  const base: CSSProperties = {
    background: quiet && !rich ? theme.color.surface : theme.color.surfaceRaised,
    borderStyle: 'solid',
    borderWidth: rich ? '1px' : '1px 1px 1px 4px',
    borderColor: rich ? theme.color.border : `${theme.color.border} ${theme.color.border} ${theme.color.border} ${quiet ? theme.color.border : colour}`,
    borderRadius: rich ? theme.radius.lg : theme.radius.md,
    boxShadow: quiet && !rich ? 'none' : theme.shadow.sm,
    padding: theme.space(rich ? 4 : 3),
    minWidth: 0,
    textAlign: 'left',
    fontFamily: theme.font.body,
    color: theme.color.text,
    width: '100%',
    position: 'relative',
  };

  return onClick && !unavailable ? (
    <button type="button" onClick={onClick} title={unavailableReason} className={rich ? 'lv-kpi-tile' : undefined} style={{ ...base, cursor: 'pointer' }}>
      {content}
    </button>
  ) : (
    <div title={unavailableReason} className={rich ? 'lv-kpi-tile' : undefined} style={base}>
      {content}
    </div>
  );
};

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export const EmptyState = ({
  theme,
  text,
  title,
  action,
  quiet = true,
  icon = 'check',
  tint = 'mint',
}: {
  theme: LvTheme;
  text: string;
  title?: string;
  action?: ReactNode;
  quiet?: boolean;
  // An empty state is a designed state, not a blank one: it says what is true
  // and offers the next move. The glyph names the kind of emptiness.
  icon?: LvIconName;
  tint?: LvTint;
}) =>
  quiet && !title ? (
    <p role="status" style={{ ...theme.type.bodySmall, margin: 0, padding: `${theme.space(2)}px 0`, color: theme.color.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
      <span aria-hidden="true" style={{ color: theme.color.success }}>
        ✓
      </span>
      {text}
    </p>
  ) : (
    <div role="status" style={{ padding: `${theme.space(6)}px ${theme.space(3)}px`, textAlign: 'center', color: theme.color.textMuted }}>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: theme.radius.pill,
          marginBottom: theme.space(3),
          background: theme.tint[tint].wash,
          color: theme.tint[tint].ink,
        }}
      >
        <LvIcon name={icon} size={22} />
      </span>
      {title && <p style={{ ...theme.type.subheading, margin: `0 0 ${theme.space(1)}px`, color: theme.color.heading }}>{title}</p>}
      <p style={{ ...theme.type.bodySmall, margin: 0 }}>{text}</p>
      {action && <div style={{ marginTop: theme.space(3), display: 'flex', justifyContent: 'center' }}>{action}</div>}
    </div>
  );

export const ErrorState = ({ theme, text, onRetry, title = 'Something went wrong' }: { theme: LvTheme; text: string; onRetry?: () => void; title?: string }) => (
  <div role="alert" style={{ background: theme.color.dangerMuted, border: `1px solid ${theme.color.danger}`, borderRadius: theme.radius.md, padding: theme.space(3), color: theme.color.text, display: 'flex', gap: theme.space(3), alignItems: 'center', flexWrap: 'wrap' }}>
    <span style={{ flex: 1, minWidth: 200 }}>
      <span style={{ ...theme.type.subheading, display: 'block', color: theme.color.danger }}>{title}</span>
      <span style={{ ...theme.type.bodySmall }}>{text}</span>
    </span>
    {onRetry && (
      <LvButton theme={theme} variant="secondary" onClick={onRetry}>
        Retry
      </LvButton>
    )}
  </div>
);

// Shown when the server said no. The text tells the person what they can do,
// never that the button was hidden — the permission lives on the server.
export const ForbiddenState = ({ theme, text = 'Your role does not have access to this. Ask an administrator if you need it.', title = 'Not available for your role' }: { theme: LvTheme; text?: string; title?: string }) => (
  <div role="status" style={{ background: theme.color.surfaceSunken, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: theme.space(4), color: theme.color.text }}>
    <span style={{ ...theme.type.subheading, display: 'block', color: theme.color.heading }}>{title}</span>
    <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{text}</span>
  </div>
);

// Reads a server message and decides which state to show.
export const isForbiddenMessage = (message: string | null | undefined): boolean => /forbidden|not allowed|permission|not permitted|403/i.test(message ?? '');

/**
 * 14.5 — a refusal.
 *
 * The server declined an action and said why. That is different from an error:
 * nothing broke, the answer was no. It is shown in the server's own words,
 * never paraphrased, because the reason is the whole value of a refusal — and
 * it is announced, because it is almost always the result of pressing
 * something.
 */
export const RefusalNotice = ({
  theme,
  reason,
  title = 'That was not allowed',
  action,
}: {
  theme: LvTheme;
  /** The server's sentence, verbatim. */
  reason: string;
  title?: string;
  action?: ReactNode;
}) => (
  <div
    role="alert"
    style={{
      background: theme.color.warningMuted,
      borderLeft: `3px solid ${theme.color.warning}`,
      borderRadius: theme.radius.md,
      padding: `${theme.space(3)}px ${theme.space(4)}px`,
      color: theme.color.text,
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.space(3),
      alignItems: 'center',
    }}
  >
    <span style={{ flex: 1, minWidth: 180 }}>
      <span style={{ ...theme.type.subheading, display: 'block', color: theme.color.heading }}>{title}</span>
      <span style={{ ...theme.type.bodySmall, color: theme.color.text, overflowWrap: 'anywhere' }}>{reason}</span>
    </span>
    {action}
  </div>
);

/**
 * 14.6 — the connection is gone.
 *
 * A bar rather than a page, because losing the connection does not invalidate
 * what is already on screen: the person can keep reading. It says nothing has
 * been lost, since the only thing this application writes is through a route
 * that either answered or did not.
 */
export const LvOfflineBanner = ({ theme, onRetry, retrying = false }: { theme: LvTheme; onRetry?: () => void; retrying?: boolean }) => (
  <div
    className="lv-offline"
    role="status"
    aria-live="polite"
    style={{
      background: theme.color.surfaceInverse,
      color: theme.color.surfaceInverseText,
      display: 'flex',
      alignItems: 'center',
      gap: theme.space(3),
      padding: `${theme.space(2)}px ${theme.space(4)}px`,
    }}
  >
    <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 auto' }}>
      <LvIcon name="warning" size={18} />
    </span>
    <span style={{ ...theme.type.bodySmall, flex: 1, minWidth: 0 }}>
      You are offline. Nothing has been lost — what is on screen is the last thing the server sent.
    </span>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="lv-button-sm"
        style={{
          ...theme.type.bodySmall,
          flex: '0 0 auto',
          background: 'transparent',
          border: `1px solid ${theme.color.surfaceInverseText}`,
          borderRadius: theme.radius.md,
          color: theme.color.surfaceInverseText,
          padding: `${theme.space(1)}px ${theme.space(3)}px`,
          cursor: 'pointer',
          fontFamily: theme.font.body,
        }}
      >
        {retrying ? 'Trying…' : 'Try again'}
      </button>
    )}
  </div>
);

export const LoadingState = ({ theme, rows = 3, label = 'Loading' }: { theme: LvTheme; rows?: number; label?: string }) => (
  <div aria-busy="true" role="status" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="lv-skeleton" style={{ height: 56, opacity: 1 - index * 0.18 }} />
    ))}
    <VisuallyHidden>{label}</VisuallyHidden>
  </div>
);

export const InlineNotice = ({ theme, tone = 'info', children }: { theme: LvTheme; tone?: Tone; children: ReactNode }) => (
  <div role={tone === 'danger' ? 'alert' : 'status'} style={{ ...theme.type.bodySmall, background: toneWash(theme, tone), borderLeft: `3px solid ${toneColour(theme, tone)}`, borderRadius: theme.radius.sm, padding: `${theme.space(2)}px ${theme.space(3)}px`, color: theme.color.text }}>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Lists and rows
// ---------------------------------------------------------------------------
export const RecordList = ({ children }: { children: ReactNode }) => <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{children}</ul>;

// A clickable record row. Renders as a button so it is keyboard reachable;
// the columns wrap on narrow screens instead of overflowing.
export const RecordRow = ({
  theme,
  primary,
  secondary,
  meta,
  tone,
  onClick,
  actions,
  badge,
}: {
  theme: LvTheme;
  primary: string;
  secondary?: string | null;
  meta?: string | null;
  tone?: Tone;
  onClick?: () => void;
  actions?: ReactNode;
  badge?: ReactNode;
}) => {
  const colour = toneColour(theme, tone);
  const inner = (
    <>
      <span aria-hidden="true" style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: tone ? colour : 'transparent', flex: '0 0 3px' }} />
      <span style={{ flex: '1 1 160px', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>{primary}</span>
        {secondary && <span style={{ ...theme.type.bodySmall, display: 'block', color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{secondary}</span>}
      </span>
      {badge}
      {meta && <span style={{ ...theme.type.caption, flex: '0 1 auto', color: tone ? colour : theme.color.textMuted, whiteSpace: 'nowrap' }}>{meta}</span>}
    </>
  );
  const style: CSSProperties = {
    display: 'flex',
    gap: theme.space(2),
    alignItems: 'center',
    width: '100%',
    padding: `${theme.space(2)}px ${theme.space(1)}px`,
    background: 'transparent',
    border: 'none',
    borderRadius: theme.radius.sm,
    textAlign: 'left',
    fontFamily: theme.font.body,
    fontSize: theme.font.size.md,
    color: theme.color.text,
    cursor: onClick ? 'pointer' : 'default',
    minHeight: 44,
  };

  return (
    <li className={onClick ? 'lv-row-hover' : undefined} style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: theme.space(2), borderBottom: `1px solid ${theme.color.border}` }}>
      {onClick ? (
        <button type="button" onClick={onClick} style={style}>
          {inner}
        </button>
      ) : (
        <div style={style}>{inner}</div>
      )}
      {actions}
    </li>
  );
};

export const Bars = ({ theme, rows, onSelect }: { theme: LvTheme; rows: { key: string; label: string; count: number; tone?: Tone }[]; onSelect?: (key: string) => void }) => {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
      {rows.map((row) => {
        const width = `${Math.max(2, Math.round((row.count / max) * 100))}%`;
        const body = (
          <>
            <span style={{ ...theme.type.bodySmall, flex: '0 0 44%', minWidth: 0, overflowWrap: 'anywhere', color: row.count > 0 ? theme.color.text : theme.color.textMuted }}>{row.label}</span>
            <span aria-hidden="true" style={{ flex: 1, height: 8, background: theme.color.surfaceSunken, borderRadius: 999, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width, background: row.count > 0 ? (row.tone ? toneColour(theme, row.tone) : theme.color.brand) : 'transparent', borderRadius: 999 }} />
            </span>
            <span style={{ ...theme.type.mono, flex: '0 0 32px', textAlign: 'right', color: row.count > 0 ? theme.color.text : theme.color.textSubtle }}>{row.count}</span>
          </>
        );

        return (
          <li key={row.key} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(row.key)} aria-label={`${row.label}: ${row.count}`} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), width: '100%', background: 'transparent', border: 'none', padding: '4px 0', color: theme.color.text, fontFamily: theme.font.body, cursor: 'pointer', textAlign: 'left', borderRadius: theme.radius.sm }}>
                {body}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), width: '100%' }} aria-label={`${row.label}: ${row.count}`}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

// A responsive table: real <table> on desktop, and on a phone each row
// becomes a card with label/value pairs (the header is hidden but announced).
export const LvTable = <Row,>({
  theme,
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  emptyText = 'Nothing here yet.',
}: {
  theme: LvTheme;
  columns: { key: string; label: string; render: (row: Row) => ReactNode; width?: string; align?: 'left' | 'right'; hideOnMobile?: boolean }[];
  rows: Row[];
  rowKey: (row: Row) => string;
  caption: string;
  onRowClick?: (row: Row) => void;
  emptyText?: string;
}) => {
  // useId() yields ":r1:"-style ids; the sandboxed renderer has no `CSS`
  // global to escape them, so the id used in the selector is made safe here.
  const id = `lv-table-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (rows.length === 0) {
    return <EmptyState theme={theme} text={emptyText} />;
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        #${id} td::before { display: none; }
        @media (max-width: ${theme.breakpoint.md - 1}px) {
          #${id} thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
          #${id} tr { display: block; border: 1px solid ${theme.color.border}; border-radius: ${theme.radius.md}px; margin-bottom: ${theme.space(2)}px; background: ${theme.color.surfaceRaised}; }
          #${id} td { display: flex; justify-content: space-between; gap: 12px; border: none !important; padding: 6px 12px !important; }
          #${id} td::before { display: block; content: attr(data-label); color: ${theme.color.textMuted}; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; }
          #${id} td.lv-hide-mobile { display: none; }
        }
      `}</style>
      <table id={id} style={{ ...theme.type.body, color: theme.color.text }}>
        <caption style={SR_ONLY}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" style={{ ...theme.type.label, color: theme.color.textMuted, padding: `${theme.space(2)}px ${theme.space(2)}px`, borderBottom: `1px solid ${theme.color.borderStrong}`, width: column.width, textAlign: column.align ?? 'left', whiteSpace: 'nowrap' }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'lv-row-hover' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((column) => (
                <td key={column.key} data-label={column.label} className={column.hideOnMobile ? 'lv-hide-mobile' : undefined} style={{ padding: `${theme.space(2)}px ${theme.space(2)}px`, borderBottom: `1px solid ${theme.color.border}`, verticalAlign: 'top', textAlign: column.align ?? 'left' }}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
export const Field = ({
  theme,
  label,
  children,
  help,
  error,
  required,
  htmlFor,
  span,
}: {
  theme: LvTheme;
  label: string;
  children: ReactNode;
  help?: string;
  error?: string | null;
  required?: boolean;
  htmlFor: string;
  // Spans both columns of a field grid.
  span?: boolean;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, gridColumn: span ? '1 / -1' : undefined }}>
    <label htmlFor={htmlFor} style={{ ...theme.type.bodySmall, fontWeight: theme.font.weight.medium, color: theme.color.heading }}>
      {label}
      {required && (
        <span aria-hidden="true" style={{ color: theme.color.danger, marginLeft: 3 }}>
          *
        </span>
      )}
    </label>
    {children}
    {help && !error && (
      <span id={`${htmlFor}-help`} style={{ ...theme.type.caption, color: theme.color.textMuted }}>
        {help}
      </span>
    )}
    {error && (
      <span id={`${htmlFor}-error`} role="alert" style={{ ...theme.type.caption, color: theme.color.danger }}>
        {error}
      </span>
    )}
  </div>
);

const control = (theme: LvTheme, invalid?: boolean): CSSProperties => ({
  ...layout(theme).input,
  ...(invalid ? { borderColor: theme.color.danger } : {}),
});

// Explicit props rather than a spread: the house lint rule forbids JSX prop
// spreading, and listing them keeps the accessibility wiring visible.
type ControlProps = {
  theme: LvTheme;
  id: string;
  invalid?: boolean;
  style?: CSSProperties;
  value?: string | number | readonly string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
  name?: string;
};

export const LvInput = ({ theme, id, invalid, style, value, placeholder, disabled, required, maxLength, autoComplete, name, type = 'text', min, max, onChange, onBlur }: ControlProps & { type?: string; min?: number | string; max?: number | string; onChange?: (event: ChangeEvent<HTMLInputElement>) => void; onBlur?: () => void }) => (
  <input
    id={id}
    name={name}
    type={type}
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    required={required}
    maxLength={maxLength}
    autoComplete={autoComplete}
    min={min}
    max={max}
    onChange={onChange}
    onBlur={onBlur}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? `${id}-error` : undefined}
    style={{ ...control(theme, invalid), ...style }}
  />
);

export const LvTextarea = ({ theme, id, invalid, style, value, placeholder, disabled, required, maxLength, name, rows, onChange }: ControlProps & { rows?: number; onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void }) => (
  <textarea
    id={id}
    name={name}
    value={value}
    placeholder={placeholder}
    disabled={disabled}
    required={required}
    maxLength={maxLength}
    rows={rows}
    onChange={onChange}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? `${id}-error` : undefined}
    style={{ ...control(theme, invalid), minHeight: 88, resize: 'vertical', ...style }}
  />
);

export const LvSelect = ({ theme, id, invalid, style, value, disabled, required, name, multiple, size, children, onChange }: ControlProps & { multiple?: boolean; size?: number; children: ReactNode; onChange?: (event: ChangeEvent<HTMLSelectElement>) => void }) => (
  <select id={id} name={name} value={value} disabled={disabled} required={required} multiple={multiple} size={size} onChange={onChange} aria-invalid={invalid || undefined} style={{ ...control(theme, invalid), ...style }}>
    {children}
  </select>
);

// Progressive disclosure: the essentials first, the rest behind one toggle.
export const Disclosure = ({ theme, label, children, defaultOpen = false, hint }: { theme: LvTheme; label: string; children: ReactNode; defaultOpen?: boolean; hint?: string }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div style={{ borderTop: `1px solid ${theme.color.border}`, paddingTop: theme.space(2) }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="lv-chip-control"
        style={{ ...theme.type.bodySmall, background: 'transparent', border: 'none', padding: `${theme.space(1)}px 0`, color: theme.color.brand, fontWeight: theme.font.weight.medium, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <span aria-hidden="true" style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: `transform ${theme.motion.duration.fast}ms` }}>
          ›
        </span>
        {label}
        {hint && <span style={{ ...theme.type.caption, color: theme.color.textMuted, fontWeight: 400 }}>{hint}</span>}
      </button>
      <div id={id} hidden={!open} style={{ marginTop: theme.space(2) }}>
        {open && children}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Attention items — the dashboard's reason to exist
// ---------------------------------------------------------------------------
export const AttentionItem = ({ theme, tone, title, detail, meta, onClick, action }: { theme: LvTheme; tone: Tone; title: string; detail?: string | null; meta?: string | null; onClick?: () => void; action?: ReactNode }) => (
  <li style={{ listStyle: 'none', display: 'flex', alignItems: 'stretch', gap: theme.space(2), background: theme.color.surfaceRaised, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, overflow: 'hidden' }}>
    <span aria-hidden="true" style={{ width: 4, background: toneColour(theme, tone), flex: '0 0 4px' }} />
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space(2), padding: `${theme.space(2)}px ${theme.space(2)}px ${theme.space(2)}px 0`, background: 'transparent', border: 'none', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', fontFamily: theme.font.body, color: theme.color.text, minHeight: 48 }}
    >
      <span style={{ flex: '1 1 180px', minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: theme.font.weight.medium, color: theme.color.heading, overflowWrap: 'anywhere' }}>{title}</span>
        {detail && <span style={{ ...theme.type.bodySmall, display: 'block', color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{detail}</span>}
      </span>
      {meta && <span style={{ ...theme.type.caption, color: toneColour(theme, tone), fontWeight: theme.font.weight.medium, whiteSpace: 'nowrap' }}>{meta}</span>}
    </button>
    {action && <span style={{ display: 'flex', alignItems: 'center', paddingRight: theme.space(2) }}>{action}</span>}
  </li>
);

export const kpiGrid = (theme: LvTheme): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: theme.space(3),
  marginBottom: theme.space(4),
});

export const twoColumn = (theme: LvTheme): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: theme.space(3),
  alignItems: 'start',
});

// The wordmark, set in the display face so it inherits colour and stays
// crisp at any size.
export const Wordmark = ({ theme, size = 13, tone = 'inherit' }: { theme: LvTheme; size?: number; tone?: 'inherit' | 'gold' }) => (
  <span style={{ fontFamily: theme.font.display, fontSize: size, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600, color: tone === 'gold' ? theme.color.accent : 'inherit', whiteSpace: 'nowrap' }}>La Vivenzia</span>
);

// ===========================================================================
// Reference-system primitives (UI-UX-AUDIT.md phase 0)
//
// The five approved boards are built from a small vocabulary that the original
// kit did not have: a face beside every name, a row that carries its own
// action, a counter rather than a chart, underline tabs, a search field that
// invites a sentence, and a progress card that names what is still missing.
// Each one is here so the surfaces stay compositions rather than bespoke CSS.
// ===========================================================================

// A person's face, or their initials when there is no photo. Decorative by
// default: the name is always beside it in the row, so a screen reader would
// otherwise hear it twice.
export const LvAvatar = ({
  theme,
  name,
  src,
  size = 40,
  tint,
}: {
  theme: LvTheme;
  name: string;
  src?: string | null;
  size?: number;
  tint?: LvTint;
}) => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const wash = tint ? theme.tint[tint].wash : theme.color.brandMuted;
  const ink = tint ? theme.tint[tint].ink : theme.color.brand;

  return src ? (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size, borderRadius: theme.radius.pill, objectFit: 'cover', flex: '0 0 auto', background: wash }}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: '0 0 auto',
        borderRadius: theme.radius.pill,
        background: wash,
        color: ink,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.font.body,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        fontWeight: theme.font.weight.bold,
        letterSpacing: '0.02em',
      }}
    >
      {initials || '·'}
    </span>
  );
};

// A tinted icon tile — the mark on an entry card, a counter or a category row.
export const LvIconTile = ({ theme, icon, tint, size = 44 }: { theme: LvTheme; icon: LvIconName; tint: LvTint; size?: number }) => (
  <span
    aria-hidden="true"
    style={{
      width: size,
      height: size,
      flex: '0 0 auto',
      borderRadius: theme.radius.pill,
      background: theme.tint[tint].wash,
      color: theme.tint[tint].ink,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <LvIcon name={icon} size={Math.round(size * 0.46)} />
  </span>
);

// The row the reference system repeats everywhere: a face, two lines of
// context, an optional urgent line, the action you would actually take, and a
// chevron into the record. The action is a separate control from the row, so
// "call Raj" and "open Raj" never become the same click.
export const LvActionRow = ({
  theme,
  title,
  subtitle,
  urgent,
  avatarName,
  avatarSrc,
  icon,
  tint = 'mint',
  action,
  onOpen,
  openLabel,
}: {
  theme: LvTheme;
  title: string;
  subtitle?: string | null;
  // The one line that explains why this row is in front of you today.
  urgent?: string | null;
  avatarName?: string | null;
  avatarSrc?: string | null;
  // Used instead of a face for rows that are not about a person.
  icon?: LvIconName;
  tint?: LvTint;
  action?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
}) => (
  <li
    className="lv-action-row"
    style={{
      listStyle: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: theme.space(4),
      // Room to breathe. At space(3) the three lines of a row ran together
      // with its neighbours into one block of text.
      padding: `${theme.space(5)}px 0`,
    }}
  >
    {icon ? <LvIconTile theme={theme} icon={icon} tint={tint} size={44} /> : <LvAvatar theme={theme} name={avatarName ?? title} src={avatarSrc} tint={tint} size={44} />}
    <span className="lv-action-row-body" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ display: 'block', ...theme.type.subheading, color: theme.color.heading, overflowWrap: 'anywhere' }}>{title}</span>
      {subtitle && <span style={{ display: 'block', ...theme.type.bodySmall, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{subtitle}</span>}
      {urgent && (
        // The reason is the quietest line, not the loudest. It was full-weight
        // danger at body size, which made three rows read as an emergency and
        // buried the names above it. A small marker carries the urgency; the
        // words only have to be readable.
        <span style={{ display: 'flex', alignItems: 'baseline', gap: theme.space(2), marginTop: 2, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{ flex: '0 0 auto', width: 5, height: 5, borderRadius: theme.radius.pill, background: theme.color.danger, transform: 'translateY(-2px)' }}
          />
          <span style={{ ...theme.type.caption, color: theme.color.textMuted, overflowWrap: 'anywhere', minWidth: 0 }}>{urgent}</span>
        </span>
      )}
    </span>
    {action && <span className="lv-action-row-cta" style={{ display: 'flex', alignItems: 'center' }}>{action}</span>}
    {/* One way in, not two. The chevron is the affordance only when the row
        has no button of its own; beside a "Review" button it was a second
        control doing the identical thing. */}
    {onOpen && !action && (
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel ?? `Open ${title}`}
        className="lv-icon-button"
        style={{
          flex: '0 0 auto',
          width: 36,
          height: 36,
          minWidth: 36,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
          border: '1px solid transparent',
          background: 'transparent',
          color: theme.color.textMuted,
          cursor: 'pointer',
        }}
      >
        <LvIcon name="chevronRight" size={18} />
      </button>
    )}
  </li>
);

// "4 Calls" — the reference system counts the work rather than charting it.
export const LvCounter = ({
  theme,
  icon,
  tint,
  count,
  label,
  onClick,
}: {
  theme: LvTheme;
  icon: LvIconName;
  tint: LvTint;
  count: number;
  label: string;
  onClick?: () => void;
}) => {
  const inner = (
    <>
      <LvIconTile theme={theme} icon={icon} tint={tint} size={36} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ ...theme.type.subheading, color: theme.color.heading, lineHeight: 1.1 }}>{count}</span>
        <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, overflowWrap: 'anywhere' }}>{label}</span>
      </span>
    </>
  );
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.space(2),
    padding: theme.space(2),
    minHeight: 56,
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderRadius: theme.radius.md,
    textAlign: 'left',
    fontFamily: theme.font.body,
    cursor: onClick ? 'pointer' : 'default',
  };

  return onClick ? (
    <button type="button" onClick={onClick} style={style}>
      {inner}
    </button>
  ) : (
    <div style={style}>{inner}</div>
  );
};

// Underline tabs (R3). `Segmented` stays for filtering; this is for switching
// the *view* of one record, which is a different idea and looks like one.
export const LvTabs = ({
  theme,
  tabs,
  value,
  onChange,
  label,
}: {
  theme: LvTheme;
  tabs: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (key: string) => void;
  label: string;
}) => {
  const strip = useRef<HTMLDivElement>(null);

  // On a phone the strip scrolls, so the selected tab has to be brought into
  // view — otherwise changing tab from a link or a reload leaves the marker
  // off-screen and the screen looks like it has no tabs at all.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  return (
  <div ref={strip} className="lv-tabs" role="tablist" aria-label={label} style={{ display: 'flex', borderBottom: `1px solid ${theme.color.border}` }}>
    {tabs.map((tab) => {
      const active = tab.key === value;

      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(tab.key)}
          style={{
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${active ? theme.color.brand : 'transparent'}`,
            padding: `${theme.space(2)}px 0 ${theme.space(2)}px`,
            marginBottom: -1,
            minHeight: 44,
            cursor: 'pointer',
            fontFamily: theme.font.body,
            fontSize: theme.font.size.md,
            fontWeight: active ? theme.font.weight.bold : theme.font.weight.regular,
            color: active ? theme.color.heading : theme.color.textMuted,
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.space(2),
          }}
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span style={{ ...theme.type.caption, color: theme.color.textSubtle, background: theme.color.surfaceSunken, borderRadius: theme.radius.pill, padding: '1px 7px' }}>{tab.count}</span>
          )}
        </button>
      );
    })}
  </div>
  );
};

// One wide search field that invites a sentence, not a keyword.
export const LvSearchField = ({
  theme,
  value,
  onChange,
  onSubmit,
  placeholder = 'Search anything…',
  label,
  busy,
}: {
  theme: LvTheme;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  label: string;
  busy?: boolean;
}) => {
  const id = useId();

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <label htmlFor={id} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {label}
      </label>
      <span aria-hidden="true" style={{ position: 'absolute', left: theme.space(3), top: '50%', transform: 'translateY(-50%)', color: theme.color.textSubtle, display: 'inline-flex' }}>
        <LvIcon name="search" size={18} />
      </span>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-busy={busy || undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onSubmit) {
            onSubmit();
          }
        }}
        style={{
          width: '100%',
          minHeight: 44,
          padding: `${theme.space(2)}px ${theme.space(3)}px ${theme.space(2)}px ${theme.space(9)}px`,
          borderRadius: theme.radius.pill,
          border: `1px solid ${theme.color.border}`,
          background: theme.color.surfaceRaised,
          color: theme.color.text,
          fontFamily: theme.font.body,
          fontSize: theme.font.size.md,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
};

// A progress bar that also says what is still missing and offers the one
// action that closes the gap (R3's onboarding card).
export const LvProgress = ({
  theme,
  percentage,
  caption,
  pending,
  action,
}: {
  theme: LvTheme;
  percentage: number;
  caption?: string;
  // Named items, not a count: "PAN", "Business proof".
  pending?: string[];
  action?: ReactNode;
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(2) }}>
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={caption ?? 'Progress'}
          style={{ flex: 1, height: 8, borderRadius: theme.radius.pill, background: theme.color.surfaceSunken, overflow: 'hidden' }}
        >
          <div style={{ width: `${clamped}%`, height: '100%', background: theme.color.brand, borderRadius: theme.radius.pill }} />
        </div>
        <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted, fontWeight: theme.font.weight.medium, whiteSpace: 'nowrap' }}>{clamped}%</span>
      </div>
      {caption && <span style={{ ...theme.type.bodySmall, color: theme.color.textMuted }}>{caption}</span>}
      {pending && pending.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {pending.map((item) => (
            <li key={item} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), ...theme.type.bodySmall, color: theme.color.text }}>
              <span style={{ color: theme.color.warning, display: 'inline-flex' }}>
                <LvIcon name="warning" size={15} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}
      {action && <span style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: theme.space(1) }}>{action}</span>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Steps — a multi-stage flow such as onboarding.
//
// Horizontal where there is room. On a phone the list turns vertical with only
// the current step expanded: ten onboarding steps laid out horizontally on a
// 390px screen is ten unreadable labels, and ten expanded vertically is a
// screenful of noise before the one thing you came to do.
// ---------------------------------------------------------------------------
export type LvStepState = 'done' | 'current' | 'blocked' | 'todo';

/**
 * `blocked` is the state onboarding needed: a stage that is neither finished
 * nor available, because something concrete is in its way. It carries its own
 * glyph and colour, and unlike `todo` it always shows its `detail` — a stage
 * that says it is blocked without saying by what is worse than no stage at
 * all.
 */
export type LvStep = { key: string; label: string; state: LvStepState; detail?: string | null; onOpen?: () => void };

const STEP_STATE_WORD: Record<LvStepState, string> = { done: 'Completed:', current: 'Current step:', blocked: 'Blocked:', todo: 'Not started:' };

export const LvSteps = ({ theme, steps, label }: { theme: LvTheme; steps: LvStep[]; label: string }) => (
  <ol className="lv-steps" aria-label={label} style={{ display: 'flex', margin: 0, padding: 0, listStyle: 'none' }}>
    {steps.map((step, index) => {
      const colour =
        step.state === 'done'
          ? theme.color.success
          : step.state === 'current'
            ? theme.color.brand
            : step.state === 'blocked'
              ? theme.color.warning
              : theme.color.textSubtle;
      const filled = step.state === 'done' || step.state === 'blocked';
      const body = (
        <>
          <span
            aria-hidden="true"
            style={{
              width: 24,
              height: 24,
              flex: '0 0 auto',
              borderRadius: theme.radius.pill,
              border: `1.5px solid ${colour}`,
              background: filled ? colour : 'transparent',
              color: filled ? theme.color.textOnBrand : colour,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
            }}
          >
            {step.state === 'done' ? <LvIcon name="check" size={13} /> : step.state === 'blocked' ? <LvIcon name="warning" size={13} /> : index + 1}
          </span>
          <span className="lv-step-label" style={{ minWidth: 0 }}>
            <span style={{ ...theme.type.bodySmall, color: step.state === 'todo' ? theme.color.textMuted : theme.color.heading, fontWeight: step.state === 'todo' ? theme.font.weight.regular : theme.font.weight.medium, display: 'block' }}>{step.label}</span>
            {step.detail && (step.state === 'current' || step.state === 'blocked') && (
              <span style={{ ...theme.type.caption, color: step.state === 'blocked' ? theme.color.warning : theme.color.textMuted, display: 'block' }}>
                {step.detail}
              </span>
            )}
          </span>
        </>
      );

      return (
        <li key={step.key} className="lv-step" aria-current={step.state === 'current' ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), minWidth: 0 }}>
          <VisuallyHidden>{STEP_STATE_WORD[step.state]}</VisuallyHidden>
          {step.onOpen ? (
            <button
              type="button"
              onClick={step.onOpen}
              style={{ display: 'flex', alignItems: 'center', gap: theme.space(2), minHeight: 44, background: 'transparent', border: '1px solid transparent', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: theme.font.body, minWidth: 0 }}
            >
              {body}
            </button>
          ) : (
            body
          )}
        </li>
      );
    })}
  </ol>
);

// ---------------------------------------------------------------------------
// Skeletons. They take the shape of what is coming, in the layout that width
// will actually use, so the page does not jump when the data lands.
// ---------------------------------------------------------------------------
export const LvSkeletonRow = ({ theme, width = '100%' }: { theme: LvTheme; width?: string | number }) => (
  <span className="lv-skeleton" aria-hidden="true" style={{ display: 'block', height: 14, width, borderRadius: theme.radius.sm }} />
);

export const LvSkeletonCard = ({ theme, lines = 3 }: { theme: LvTheme; lines?: number }) => (
  <div
    aria-hidden="true"
    style={{ display: 'flex', flexDirection: 'column', gap: theme.space(2), padding: theme.space(4), border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, background: theme.color.surface }}
  >
    <LvSkeletonRow theme={theme} width="55%" />
    {Array.from({ length: Math.max(1, lines - 1) }).map((_, index) => (
      <LvSkeletonRow key={index} theme={theme} width={index === lines - 2 ? '70%' : '100%'} />
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// A wait that names itself.
//
// Every long step in capture and import is a real server call with no
// progress to report, so this says what is happening and — where it matters —
// what has not happened yet. No looping bar, because a bar that does not
// track anything is a claim about time that nobody can keep.
//
// Same shape at every width: it is one icon, one line and one sentence, which
// a phone has room for. What changes is the padding the surrounding card
// gives it.
// ---------------------------------------------------------------------------
export const LvStageWait = ({
  theme,
  icon,
  tint = 'blue',
  title,
  detail,
  /** Announced to a screen reader, which cannot see the icon settle. */
  announce,
}: {
  theme: LvTheme;
  icon: LvIconName;
  tint?: LvTint;
  title: string;
  detail: string;
  announce?: string;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: theme.space(3) }} aria-busy="true">
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
        borderRadius: theme.radius.pill,
        background: theme.tint[tint].wash,
        color: theme.tint[tint].ink,
      }}
    >
      <LvIcon name={icon} size={26} />
    </span>
    <p style={{ ...theme.type.subheading, fontSize: 18, color: theme.color.heading, margin: 0 }}>{title}</p>
    <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: 0, maxWidth: 440 }}>{detail}</p>
    <VisuallyHidden>{announce ?? title}</VisuallyHidden>
  </div>
);
