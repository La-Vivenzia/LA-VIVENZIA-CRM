# Phase 1 — shell transformation: reference study

**Status: implemented.** The shell described below was built in Phase 1; this file remains the
record of what the reference screens establish and why the shell is shaped the way it is.

Two decisions changed during the build, both because the references could not be followed
literally:

- **The photograph is a top band, not a full-viewport cover.** `hero-ghats.jpg` is 1040x347.
  Stretched over a 1440x900 viewport it upscales 2.6x and shows mostly haze. It is now a fixed
  band -- 210px on a phone, 290 on a tablet, 340 on a desktop -- with the veil settling it into
  the page ground, which is where the references show it anyway.
- **The top bar carries no logo on a phone.** At 320px the bar has to hold search, the bell, the
  account and the sections control; a mark cost the word "Search". The six-door home moved into
  the sections sheet instead, where it is more discoverable than a logo.

## Reference folders

| Folder | Contents |
|---|---|
| `new ui ux screens/` | 12 PNGs — the Phase 1 direction. 1–8 light scheme, 9–12 a dark variant. 8 and 12 are mobile. |
| `new ui ux ref images/` | 5 JPEGs — the original approved boards (Today, the Experience Hunter journey). |

Studied: all 12 PNGs, 2 of the 5 JPEGs. The remaining three JPEGs are marketing boards of the
same Today screen and are unlikely to change the conclusions, but should be checked.

## The shell, as the references establish it

### Sidebar (desktop, ~225px)

- Warm cream ground, no hard border — it reads as a different surface, not a panel.
- Logo lockup at top: mountain mark + LA VIVENZIA + the tagline, generous padding.
- **Primary group — the six doors:** Today, My Leads, Capture, Onboarding, Messages, Ask LV.
- **Active state is a filled pine-green rounded rectangle with white text and icon**, inset from
  the sidebar edges. Not a left border, not a tint. This is the single strongest shell signature.
- A generous blank gap — not a rule — separates the six doors from the secondary group.
- **Secondary group:** People, Organisations, Experiences, Tasks, Analytics. Same row shape,
  muted text, no badge. This is how the references solve "keep it accessible without recreating
  Twenty's navigation".
- **Settings** sits alone below the secondary group.
- **Bottom: an account card**, not a menu item — avatar, name, role ("Experience Hunter"),
  chevron. Anchored to the sidebar foot.

### Top bar

- **The top bar has no background of its own: a mountain photograph runs behind it**, bleeding
  from the right, birds in flight. This is the boldest departure from every generic admin shell
  and is what makes the product recognisable in one glance.
- Search is a large pill field, left-aligned, roughly 690px, placeholder
  "Search anything… (e.g. leads, partners, stays, documents)". The dark variants show a `⌘K`
  chip at its right edge.
- Right: bell with a red count badge, then avatar + "Good morning, Saumay" + chevron.

### Content

- The page content is a **large rounded panel laid over the photograph**, top corners rounded,
  so the image shows above and to the right of it. The panel is the product; the photograph is
  the window behind it.
- Two page-header variants:
  1. **Top-level** (Control Tower): large display-serif title directly on the photograph, a
     subtitle beneath, and a control on the right (date range). No breadcrumb.
  2. **In-flow** (Capture New Lead, Partner Onboarding): inside the panel, a back arrow, then
     either a plain title or a breadcrumb `← Onboarding › Villa Serenità`, with right-aligned
     actions and a kebab.
- A record header below the breadcrumb: thumbnail, name, type chip, location, rating, then a row
  of labelled facts (Partner, Organisation, Status, Progress) and a kebab.
- **Section navigation is an underline tab row** (Overview, Pipeline, Partners, …) — never a
  second sidebar. The dark variants do show nested sidebar sub-items under an expanded door,
  which is the alternative and should be treated as secondary.
- Steppers are horizontal: numbered circle + label + sub-label, done = green check, current =
  filled pine, future = grey outline.
- Flow pages carry a **sticky footer action bar**: Back on the left, primary on the right.

### Mobile (screens 8 and 12)

- **No sidebar at any point.** A record screen opens with a full-bleed hero photograph, a
  floating circular back button, a floating circular overflow, and a photo counter chip.
- A white rounded card overlaps the hero: thumbnail, name, type chip, location, rating.
- **A four-up quick-action row** — Call, Email, Schedule, More — icon over label in soft tiles.
- Underline tabs, horizontally scrollable.
- **On scroll the header compacts** to: circular back, small thumbnail, title + subtitle,
  circular overflow. This compact bar is sticky.
- **A sticky bottom action bar replaces the bottom navigation on detail screens** — either one
  full-width primary plus a square secondary, or three buttons with the last one primary.
- Quick Stats are four tinted tiles in a row (peach, mint, gold, mint).
- Related records are horizontal card rails with "View All →".
- Flow screens: back chevron + centred title + step counter ("3/4"), sticky primary at the foot.

## What this means for the build

The Phase 0 system already carries the tokens, the type scale, the tints and most primitives.
What Phase 1 has to add or change:

1. **`LvShell` needs the photographic header band.** Currently the top bar is a plain raised
   surface. The hero image exists (`/lv/hero-ghats.jpg`) but is only used inside `LvHero`.
2. **The sidebar needs the three groups** (six doors / secondary / settings) and the account
   card at its foot. It currently has one group plus Profile and Settings.
3. **Active state must become the filled pine pill.** It is currently a mint tint.
4. **The content panel needs to be a rounded surface over the image**, not a flat main region.
5. **`PageHeader` needs the two variants** (on-image top-level, in-panel in-flow) plus the
   record-header form with facts.
6. **`GlobalSearch` does not exist** — the shell has a search field that navigates to
   `/leads?q=`. Needs its own component with empty / loading / results / recent states,
   ⌘K, keyboard navigation, and a mobile form.
7. **`NotificationCenter` and `AccountMenu` exist as Phase 0 primitives but are not wired**
   into the shell — the bell and the avatar currently call `onNotifications` / `onProfile`
   with no panel behind them.
8. **`SectionNavigation` and `ContextualActions` do not exist.**
9. **Mobile needs the compact sticky header, the quick-action row, and the sticky footer bar**,
   and detail screens must swap the bottom nav for contextual actions.
10. **Breadcrumbs exist** (`LvBreadcrumbs`, Phase 0) but are not used by any screen.

## Verification widths still to run

320, 360, 375, 390, 430, 768, 1024, 1280, 1440. Phase 0 verified 390 / 768 / 820 / 1030 only;
320 and 360 have never been checked and are the likeliest to break the six-door bottom bar,
whose labels already ellipsize at 390.
