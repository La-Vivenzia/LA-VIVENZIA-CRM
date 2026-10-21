# La Vivenzia design system — Phase 0

**What this is:** the component foundation the whole CRM is built from. Not a theme over Twenty — a purpose-built product system that happens to talk to Twenty as a backend.

**Where it lives:** `packages/lv-app/src/design/`.

**How to look at it:** run the app and open `/design`. Every component appears there once, alongside the responsive contract, and the page names the width you are currently viewing it at. Resize the window and the components and the promises change together.

**Status:** typecheck, lint, unit tests and the production build all pass. See *Verification* at the end.

---

## 1. What Phase 0 changes

The CRM's interface was rejected by the CTO as "outdated, cheap and far too complicated". The diagnosis was not that the colours were wrong. It was that the product was Twenty's interface with La Vivenzia's palette on it — Twenty's navigation, Twenty's record pages, Twenty's generic tables.

So the rule for this phase, and every phase after it: **Twenty is a backend.** Its metadata engine, the sixteen LV objects, the thirty-four `/s/*` routes, the nine roles and their permission gating, the audit trail, the SLA engine and the AI layer are all reused exactly as they are. Everything a person sees is ours.

This phase did not touch business logic. No route changed, no object changed, no rule changed. What changed is the vocabulary every screen is written in.

---

## 2. Architecture

### 2.1 Three layers, one direction

```
tokens.ts     values      — brand, two colour schemes, type scale, radii, motion, breakpoints
   ↓
theme.ts      roles       — LvTheme: semantic colour roles, tints, spacing fn, layout primitives
   ↓
components    surfaces    — kit, overlay, data, feedback, documents, intelligence, charts, profile, shell
```

Nothing reaches past its layer. A component never hard-codes a hex value; it asks the theme for a role. That is what makes dark mode a data change rather than a rewrite, and what lets a unit test prove the two schemes cannot drift apart.

### 2.2 The modules

| Module | Holds |
|---|---|
| `tokens.ts` | The values. Brand colours, both schemes, the type scale, radii, motion, breakpoints. |
| `theme.ts` | `LvTheme` — the roles components read, plus shared layout primitives. |
| `responsive.ts` | **The responsive contract.** Every family's desktop, tablet and mobile behaviour, as typed data. |
| `use-tier.ts` | `useLvTier()` / `useIsPhone()` — for the few components whose *markup* differs, not just their box. |
| `icons.tsx` | 45 inline SVG glyphs. No icon library. |
| `status.ts` | The one status vocabulary: lifecycle value → label and badge tone. |
| `kit.tsx` | Primitives and the global stylesheet: buttons, inputs, cards, tabs, steps, badges, states, skeletons. |
| `overlay.tsx` | Modal, drawer, sheet, confirmation, menu — all sharing one focus-trap scaffold. |
| `data.tsx` | Data table, filters, breadcrumbs, pagination. |
| `feedback.tsx` | Notifications, toasts, banners. |
| `documents.tsx` | Document rows, file chips, upload zone and queue. |
| `intelligence.tsx` | AI panel, answer with provenance and citations, confidence, unavailable state. |
| `charts.tsx` | Bar, donut, ring, sparkline — hand-drawn SVG, no chart library. |
| `profile.tsx` | Profile header, next best action, timeline, activity card, related list. |
| `shell.tsx` | The frame: rail, top bar, hero, entry cards, the six doors. |

### 2.3 Decisions, and why

**No CSS framework, no component library, no chart library.** The CRM needs roughly forty components and a dozen rectangles drawn as bars. A UI library would bring a design language we would then spend the project fighting, and a chart library would be the largest thing in the bundle. The whole system compiles to 364 KB raw / 107 KB gzipped including React, the router and every screen.

**Inline styles for what never changes, a stylesheet for what does.** This is the most important rule in the system, and it was learned the expensive way: *an inline React style beats a media query.* Every rule that turned the 240px rail into a bottom bar was being silently overridden by an inline `width: 240` on the same element, so a phone got the desktop sidebar squeezed into a third of the screen — while the stylesheet said otherwise. Layout that differs by width now lives in `LvStyles`; inline styles carry colour and geometry that is constant. A test asserts that every width-dependent class has both a narrow and a wide rule.

**Mobile-first CSS.** The base block is the phone. Media queries only ever add. A test asserts the base block contains no `@media` at all, so the phone layout can never become the exception.

**`useLvTier()` is the exception, not the tool.** Three components render genuinely different markup by width — the table (rows vs. cards), the menu (popover vs. sheet), the upload zone (drag-and-drop vs. camera). Everything else is CSS. Rendering both copies and hiding one would ship both to every screen reader.

**Native `<select>`.** A custom listbox would be worse than the picker the phone already has, and would cost keyboard and screen-reader behaviour we would then have to rebuild.

**Status is said, not only coloured.** Every badge, chip and state carries its word. Colour is the second signal, never the only one.

**Provenance is mandatory on anything a model produced.** `Provenance` labels it, and a suggestion always carries its reason in full, at every width. An instruction whose reason is cut off cannot be checked, and an unverifiable instruction will not be trusted.

**Refusals keep their reason.** When the server declines, the screen shows what the server said. A refusal without its reason is a dead end for whoever has to act on it.

---

## 3. Foundations

### Colour

Semantic tokens in two schemes — warm ivory by day (`#F3EFE7` ground, pine green `#1F4D3A` primary, gold scarce and reserved for emphasis) and a deep pine night that is a designed dark theme rather than an inverted light one. In dark mode a lifted pine takes the primary role, because `#1F4D3A` is unreadable on a dark ground.

Five **category tints** — mint, blue, peach, lavender, pink — label a *kind* of thing without implying the urgency a status colour does. Each carries an ink that reads on it. They are never used for body text.

Both schemes are asserted to carry exactly the same token set, and every tint is asserted to have an ink.

### Typography

Cinzel for display, Sora for working text, DM Mono for identifiers. The scale was raised one step across the board — body 15/1.55, small 13, caption 12, label 11 — because the difference between the approved boards and the old CRM is mostly type size and line height. Display and title use `clamp()` so they interpolate on viewport width without a breakpoint.

Nothing drops below 11px at any width, and body text stays at 15px so iOS does not zoom the page when a field takes focus. Both are asserted by test.

### Spacing, radii, elevation, motion

A 4px step (`theme.space(n)`). Radii from 3 to 18 plus a pill. Three shadows: resting card, raised panel, overlay. Motion is 120/180ms on a single easing curve, and every animation is disabled under `prefers-reduced-motion`.

### Breakpoints

| Tier | Width | The shell |
|---|---|---|
| Mobile | up to 767px | Bottom bar of six doors |
| Tablet | 768–1023px | 72px icon rail |
| Desktop | 1024px and wider | 240px labelled rail |

The tablet tier is a real design decision, not an interpolation: a 240px sidebar on a 1024px screen spends a quarter of the product on navigation.

---

## 4. The responsive contract

Mobile is a product, not a narrowed desktop. Every family below declares what it does at each width, what the interaction *becomes*, how it stacks, what happens to overflow, and how large the thing you touch is.

The contract is typed data in `packages/lv-app/src/design/responsive.ts`. A unit test asserts that every family is covered, that all three widths are decided, that no component ships its desktop behaviour to a phone, and that nothing interactive drops below a 36px target.

<!-- generated:contract -->

*Generated from `packages/lv-app/src/design/responsive.ts` — 37 families. Edit that file, then re-run `node packages/lv-app/scripts/generate-contract-doc.mjs`.*

| Family | Kind | Phone behaviour in one line | Touch |
|---|---|---|---|
| [typography](#typography) | foundation | Display floors at 26px and title at 21px; body, label and caption never change size, because shrinking them is what made the old CRM read as dense. | — |
| [color](#color) | foundation | Identical | — |
| [spacing](#spacing) | foundation | Page gutter space(4) = 16px, and the main region reserves 76px at the bottom so the navigation bar never covers the last row. | — |
| [elevation](#elevation) | foundation | Dialogs docked to the bottom edge drop their lower shadow, since there is no edge below them to lift away from. | — |
| [surfaces](#surfaces) | component | Full width; nested surfaces lose one level of padding so content is not indented twice. | — |
| [cards](#cards) | component | One column | 44px |
| [buttons](#buttons) | component | A row of actions becomes full-width buttons stacked in the order of importance; the primary action is never the one that gets clipped. | 44px |
| [inputs](#inputs) | component | One per row, full width | 44px |
| [selects](#selects) | component | The native control opens the platform picker — a custom listbox here would be worse than the one the phone already has. | 44px |
| [tabs](#tabs) | component | The strip scrolls horizontally with the active tab scrolled into view, and the scrollbar is hidden, and every segment grows to a full 44px so a finger can hit it | 44px |
| [tables](#tables) | component | The table becomes a list of cards — one card per record, each field on its own labelled line | 44px |
| [lists](#lists) | component | Avatar, name and chevron stay on the first line; the call to action drops to its own full-width line beneath | 44px |
| [filters](#filters) | component | One "Filters" button carrying the active count opens a bottom sheet; applied filters still show as removable chips above the list so the state is never hidden. | 44px |
| [search](#search) | component | The field keeps its place in the bar but shortens its placeholder to "Search"; it never collapses into an icon, because search is how a phone user navigates. | 44px |
| [breadcrumbs](#breadcrumbs) | component | Collapses to a single back affordance naming the parent — "‹ My Leads" — because a trail that wraps to three lines is noise. | 44px |
| [drawers](#drawers) | component | Becomes a full-height bottom sheet with a drag handle — there is no room beside anything on a phone. | 44px |
| [modals](#modals) | component | Docked to the bottom edge, full width, rounded only at the top — that is where a thumb is, and a centred card would sit under the keyboard. | 44px |
| [bottom-sheets](#bottom-sheets) | component | A sheet from the bottom edge with a grab handle, dismissed by the backdrop, Escape, or the close button. | 44px |
| [timelines](#timelines) | component | The rail narrows and the time moves above the title, so the entry text keeps the full width. | 36px |
| [activity-cards](#activity-cards) | component | The chip wraps to its own line under the header rather than compressing the channel and time. | — |
| [status-chips](#status-chips) | component | Identical size; chips wrap onto their own line rather than shrinking, because an 11px chip is unreadable at arm’s length. | — |
| [progress](#progress) | component | The step list becomes vertical with the current step expanded and the rest collapsed to a title, so ten onboarding steps do not become ten lines of noise. | 44px |
| [documents](#documents) | component | Icon and name on the first line, type and expiry beneath, state chip wrapping to its own line, and the rejection reason always in full. | 44px |
| [upload](#upload) | component | Becomes full-width buttons — take a photo, or choose a file — because there is nothing to drag on a phone | 44px |
| [waiting-states](#waiting-states) | component | The same one glyph, one line and one sentence, but the card loses its outer padding so the sentence keeps its full width rather than wrapping to five lines. | — |
| [column-mapping](#column-mapping) | component | Each column of the file becomes a stacked block — header, then its real values, then the field picker full width — and the row decision moves below the row rather than sitting at an edge a thumb cannot reach. | 44px |
| [document-preview](#document-preview) | component | The inline panel is gone entirely; the file opens full screen from a button, so it is never competing with the decision for a 390px column. | 44px |
| [verification-decision](#verification-decision) | component | The whole decision becomes a bottom sheet over the list, with the action pinned in its footer, so the choice is never below a document the length of a page. | 44px |
| [activation-readiness](#activation-readiness) | component | Areas stack and each reason takes its own line at full width rather than sharing a row, because a truncated reason is the one thing this surface cannot afford; the status change becomes a bottom sheet. | 44px |
| [ai-surfaces](#ai-surfaces) | component | The action drops below the reason at full width, and cited records become a wrapped chip list. | 44px |
| [charts](#charts) | component | Bars turn horizontal so the category labels stay readable, and every chart is followed by the same numbers as text for anyone who cannot see it. | — |
| [navigation](#navigation) | component | The rail becomes a fixed bottom bar of the six doors, icon over label, each an equal share of the width | 44px |
| [notifications](#notifications) | component | The bell opens a full bottom sheet, and toasts span the width just above the navigation bar so they never cover it. | 44px |
| [empty-states](#empty-states) | component | Same copy, full-width action | 44px |
| [loading-states](#loading-states) | component | Skeletons follow the phone layout — card-shaped where a table will become cards, so the page does not jump when the data lands. | — |
| [error-states](#error-states) | component | Full width, retry as a full-width button | 44px |
| [confirmation](#confirmation) | component | A bottom sheet with stacked full-width buttons, cancel nearest the thumb. | 44px |

### typography

*Cinzel for display, Sora for working text, one semantic scale.*

Implemented by `LV_TYPE`, `LV_FONT`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Display and title clamp to their maximum (36px / 27px); body 15px/1.55. |
| Tablet · 768–1023px | The clamp interpolates on viewport width, so titles land mid-scale without a breakpoint. |
| Phone · up to 767px | Display floors at 26px and title at 21px; body, label and caption never change size, because shrinking them is what made the old CRM read as dense. |

- **Interaction change:** None — the same interaction at every width.
- **Stacking:** Headings and body share the same measure; long words break rather than pushing the page sideways.
- **Overflow:** overflow-wrap: anywhere on names and identifiers; ellipsis only where a single line is guaranteed.
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### color

*Semantic tokens for two schemes: warm ivory by day, deep pine by night.*

Implemented by `LV_TOKENS`, `BRAND`, `lvVar`, `themeFor`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Identical at every width — colour never carries layout. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | Identical. Dark mode follows the system preference, not the viewport. |

- **Interaction change:** None — the same interaction at every width.
- **Stacking:** n/a
- **Overflow:** n/a
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### spacing

*A 4px step. space(n) is the only way a gap is chosen.*

Implemented by `theme.space`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Page gutter space(8) = 32px; section gap space(6). |
| Tablet · 768–1023px | Page gutter space(6) = 24px. |
| Phone · up to 767px | Page gutter space(4) = 16px, and the main region reserves 76px at the bottom so the navigation bar never covers the last row. |

- **Interaction change:** None — the same interaction at every width.
- **Stacking:** n/a
- **Overflow:** n/a
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### elevation

*Three shadows: resting card, raised panel, overlay.*

Implemented by `theme.shadow`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | sm on cards, md on menus, lg on dialogs. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | Dialogs docked to the bottom edge drop their lower shadow, since there is no edge below them to lift away from. |

- **Interaction change:** None — the same interaction at every width.
- **Stacking:** n/a
- **Overflow:** n/a
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### surfaces

*The grounds a screen is composed from: page, section, inverse panel.*

Implemented by `LvPage`, `Section`, `InversePanel`, `LvSectionCard`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Content is capped at 1280px and centred; sections keep their own padding. |
| Tablet · 768–1023px | Full width inside the page gutter. |
| Phone · up to 767px | Full width; nested surfaces lose one level of padding so content is not indented twice. |

- **Interaction change:** None — the same interaction at every width.
- **Stacking:** Sections are a vertical stack at every width; only their internal grids change.
- **Overflow:** Vertical scroll on the page, never horizontal.
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### cards

*A bounded piece of the product: a record, a figure, a door.*

Implemented by `LvCard`, `KpiTile`, `LvEntryCard`, `LvEntryGrid`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Entry cards in three columns; KPI tiles auto-fit at a 150px minimum. |
| Tablet · 768–1023px | Entry cards in two columns; KPI tiles auto-fit. |
| Phone · up to 767px | One column. KPI tiles stay two-up, because a single column of numbers reads as a list and loses the comparison. |

- **Interaction change:** A clickable card is a real button at every width; on a phone the whole card is the target rather than a chevron inside it.
- **Stacking:** Grid to single column.
- **Overflow:** Titles wrap; long identifiers break rather than overflowing.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### buttons

*Primary, secondary, ghost, danger and gold, in two sizes.*

Implemented by `LvButton`, `ActionBar`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Intrinsic width, sitting inline with the thing they act on. |
| Tablet · 768–1023px | Identical, wrapping to a second line before shrinking. |
| Phone · up to 767px | A row of actions becomes full-width buttons stacked in the order of importance; the primary action is never the one that gets clipped. |

- **Interaction change:** Hover styling is dropped on touch; the pressed state carries the feedback instead.
- **Stacking:** ActionBar wraps, then goes full width.
- **Overflow:** Labels never truncate; the button grows and the row wraps.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### inputs

*A labelled control with help text and an error that is announced.*

Implemented by `Field`, `LvInput`, `LvTextarea`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Two fields per row inside a field grid. |
| Tablet · 768–1023px | Two per row. |
| Phone · up to 767px | One per row, full width. Font size stays at 15px so iOS does not zoom the page on focus. |

- **Interaction change:** Labels are always visible, never placeholders standing in for them.
- **Stacking:** Field grid collapses to one column.
- **Overflow:** Help and error text wrap under the control.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### selects

*A choice from a closed list, rendered by the platform.*

Implemented by `LvSelect`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A styled native select, so the list is keyboard- and screen-reader-native. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | The native control opens the platform picker — a custom listbox here would be worse than the one the phone already has. |

- **Interaction change:** Platform picker on touch.
- **Stacking:** Full width inside its field.
- **Overflow:** The closed control truncates with an ellipsis; the open picker is the platform’s.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### tabs

*Sections of one record, and filters over one list.*

Implemented by `LvTabs`, `Segmented`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | All tabs visible on one line with their counts. |
| Tablet · 768–1023px | All tabs visible; counts kept. |
| Phone · up to 767px | The strip scrolls horizontally with the active tab scrolled into view, and the scrollbar is hidden, and every segment grows to a full 44px so a finger can hit it. Tabs are never collapsed into a select, because that hides where you are. |

- **Interaction change:** Swipe to reach a tab; arrow keys still move between them.
- **Stacking:** Single row at every width.
- **Overflow:** Horizontal scroll, contained to the strip so the page itself never scrolls sideways.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### tables

*Many records compared column by column.*

Implemented by `LvTable`, `LvDataTable`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A real table with a sticky header and every column. |
| Tablet · 768–1023px | The table keeps its shape; columns marked secondary are dropped. |
| Phone · up to 767px | The table becomes a list of cards — one card per record, each field on its own labelled line. A table that scrolls sideways on a phone is a table nobody reads. |

- **Interaction change:** Row click becomes a full-card tap; row actions move into the card footer.
- **Stacking:** Rows to cards.
- **Overflow:** No horizontal scroll at any width; columns are dropped, not squeezed.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### lists

*Records in one column, each with the action you would actually take.*

Implemented by `RecordList`, `RecordRow`, `LvActionRow`, `LvRelatedList`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Avatar, body, action and open chevron on one line. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | Avatar, name and chevron stay on the first line; the call to action drops to its own full-width line beneath. Squeezing it inline is what once broke an identifier across two lines. |

- **Interaction change:** The whole row opens the record; the action button stops that propagating.
- **Stacking:** Action wraps below the body.
- **Overflow:** Names wrap; supporting lines clamp to two.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### filters

*Narrowing a list, and showing plainly what is currently narrowing it.*

Implemented by `LvFilterBar`, `LvFilterChip`, `LvFilterSheet`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A bar of chips beside the search field, with a clear-all when anything is active. |
| Tablet · 768–1023px | Same bar; the chip row wraps to a second line. |
| Phone · up to 767px | One "Filters" button carrying the active count opens a bottom sheet; applied filters still show as removable chips above the list so the state is never hidden. |

- **Interaction change:** Inline toggles become a sheet with Apply and Clear.
- **Stacking:** Chips wrap; the control collapses to a single button.
- **Overflow:** Chips wrap rather than scroll, so none is hidden off-screen.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes

### search

*One field across the CRM, in the top bar and over a list.*

Implemented by `LvSearchField`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A 560px field in the top bar with the full placeholder. |
| Tablet · 768–1023px | The field flexes to the space left by the bar’s icons. |
| Phone · up to 767px | The field keeps its place in the bar but shortens its placeholder to "Search"; it never collapses into an icon, because search is how a phone user navigates. |

- **Interaction change:** Enter submits; a clear button appears once there is a value.
- **Stacking:** Single row.
- **Overflow:** Placeholder truncates before the field does.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### breadcrumbs

*Where this record sits, and the way back out.*

Implemented by `LvBreadcrumbs`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | The full trail, each step a link. |
| Tablet · 768–1023px | The full trail; middle steps truncate before the first or last. |
| Phone · up to 767px | Collapses to a single back affordance naming the parent — "‹ My Leads" — because a trail that wraps to three lines is noise. |

- **Interaction change:** Trail becomes one back link.
- **Stacking:** Single row at every width.
- **Overflow:** Middle steps are replaced by an ellipsis, never the current page.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### drawers

*A side panel for detail that should not cost you your place in the list.*

Implemented by `LvDrawer`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Slides in from the right at 480px, the list still visible beside it. |
| Tablet · 768–1023px | Slides in at 60% of the width. |
| Phone · up to 767px | Becomes a full-height bottom sheet with a drag handle — there is no room beside anything on a phone. |

- **Interaction change:** Side panel becomes a bottom sheet; Escape and the backdrop close both.
- **Stacking:** Over the page, never pushing it.
- **Overflow:** The panel body scrolls; the page behind it is locked.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes

### modals

*One decision or one short form, with the page held still behind it.*

Implemented by `LvModal`, `LvModalFooter`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A 560px card centred in the viewport. |
| Tablet · 768–1023px | Centred, capped at 560px. |
| Phone · up to 767px | Docked to the bottom edge, full width, rounded only at the top — that is where a thumb is, and a centred card would sit under the keyboard. |

- **Interaction change:** Focus is trapped and returned to the opener; Escape closes at every width.
- **Stacking:** Footer buttons go full width and stack on a phone.
- **Overflow:** The body scrolls within a 92vh cap; the header and footer stay put.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes

### bottom-sheets

*The phone form of a menu, a filter set or a picker.*

Implemented by `LvSheet`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Renders as a popover anchored to its trigger. |
| Tablet · 768–1023px | Popover. |
| Phone · up to 767px | A sheet from the bottom edge with a grab handle, dismissed by the backdrop, Escape, or the close button. |

- **Interaction change:** Popover becomes a sheet.
- **Stacking:** Items in one column with full-width targets.
- **Overflow:** The sheet body scrolls; it never grows past 88vh.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes

### timelines

*Everything that happened to a relationship, in order.*

Implemented by `LvTimeline`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A rail with a marker per entry, time and title on one line. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | The rail narrows and the time moves above the title, so the entry text keeps the full width. |

- **Interaction change:** An entry that points at a record is a button at every width.
- **Stacking:** Time above title on a phone, beside it otherwise.
- **Overflow:** Details wrap; nothing truncates, because a truncated history is a misleading one.
- **Touch target:** 36px minimum
- **Bottom sheet on a phone:** No

### activity-cards

*One logged interaction: channel, direction, outcome, what was said.*

Implemented by `LvActivityCard`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Channel, direction and time on one line with the outcome chip pushed to the right. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | The chip wraps to its own line under the header rather than compressing the channel and time. |

- **Interaction change:** None — the same interaction at every width.
- **Stacking:** Header wraps; body and any concern stay full width.
- **Overflow:** Summary wraps in full.
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### status-chips

*A state, said in a word and coloured to match — never coloured only.*

Implemented by `LvBadge`, `LvStatusBadge`, `LvChip`, `CountPill`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Inline beside the thing it describes. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | Identical size; chips wrap onto their own line rather than shrinking, because an 11px chip is unreadable at arm’s length. |

- **Interaction change:** None — the same interaction at every width.
- **Stacking:** Wraps.
- **Overflow:** Never truncates; the label is the meaning.
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### progress

*How far along something is, and what is still outstanding.*

Implemented by `LvProgress`, `LvSteps`, `LvRing`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A bar with the percentage beside it, and the steps listed horizontally. |
| Tablet · 768–1023px | Bar with horizontal steps; labels shorten before they wrap. |
| Phone · up to 767px | The step list becomes vertical with the current step expanded and the rest collapsed to a title, so ten onboarding steps do not become ten lines of noise. |

- **Interaction change:** A completed step is a link back to it at every width. A blocked step carries its own glyph, colour and reason — it always shows what is in the way, unlike an upcoming one.
- **Stacking:** Steps horizontal to vertical.
- **Overflow:** Pending items list up to three, then "and N more".
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### documents

*A file, its type, its verification state and the reason it was refused.*

Implemented by `LvDocumentRow`, `LvDocumentList`, `LvFileChip`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Icon, name and type, expiry, state chip and actions on one line. |
| Tablet · 768–1023px | Identical; actions collapse into an overflow menu. |
| Phone · up to 767px | Icon and name on the first line, type and expiry beneath, state chip wrapping to its own line, and the rejection reason always in full. |

- **Interaction change:** Row actions move into a bottom sheet on a phone.
- **Stacking:** Row to two lines plus wrapped chip.
- **Overflow:** File names break anywhere; a refusal reason never truncates.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes

### upload

*Getting a file in, and showing honestly how that is going.*

Implemented by `LvUploadZone`, `LvUploadItem`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A drop zone with a browse button and drag-and-drop. |
| Tablet · 768–1023px | Drop zone with browse; drag is still supported. |
| Phone · up to 767px | Becomes full-width buttons — take a photo, or choose a file — because there is nothing to drag on a phone. A zone that cannot take a photograph, such as the CSV import, drops the camera rather than offering a dead end. |

- **Interaction change:** Drag-and-drop becomes camera capture and the file picker; `camera={false}` leaves only the picker.
- **Stacking:** Zone to stacked buttons; the queue below stays one per line.
- **Overflow:** Names truncate in the middle so the extension stays visible.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### waiting-states

*A wait that names the stage it is in, where there is no progress to report.*

Implemented by `LvStageWait`, `LvSkeletonRow`, `LvSkeletonCard`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A centred glyph, the stage in one line and a sentence on what has and has not happened, inside a generous card. |
| Tablet · 768–1023px | Identical, in a card with less padding. |
| Phone · up to 767px | The same one glyph, one line and one sentence, but the card loses its outer padding so the sentence keeps its full width rather than wrapping to five lines. |

- **Interaction change:** Nothing is interactive; the stage is announced to a screen reader instead of animated.
- **Stacking:** Always a single centred column.
- **Overflow:** The sentence wraps within a 440px measure and never truncates.
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### column-mapping

*Deciding what a spreadsheet column becomes, and what happens to each row of it.*

Implemented by `lv-map-row`, `lv-import-row`, `lv-import-decision`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Three aligned columns — the file’s header, the values it holds, and the field it becomes — with the per-row decision at the right of the row. |
| Tablet · 768–1023px | Same three columns, narrower, with the sample values allowed to wrap. |
| Phone · up to 767px | Each column of the file becomes a stacked block — header, then its real values, then the field picker full width — and the row decision moves below the row rather than sitting at an edge a thumb cannot reach. |

- **Interaction change:** The field picker is a native select at every width, so a phone gets its own wheel.
- **Stacking:** Three columns to a stack; decision from beside the row to beneath it.
- **Overflow:** Headers and cell values break anywhere; a taken field stays listed but disabled rather than disappearing.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### document-preview

*The evidence itself: an uploaded document, shown as what it actually is.*

Implemented by `LvDocumentPreview`, `DocumentPreviewDialog`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A tall panel beside the document list and the decision, so the file, its name and the choice being made are all in sight at once. |
| Tablet · 768–1023px | The panel stays beside the list but the decision moves below both, since three columns at 768px leaves none of them readable. |
| Phone · up to 767px | The inline panel is gone entirely; the file opens full screen from a button, so it is never competing with the decision for a 390px column. |

- **Interaction change:** Opening the file is a real link on every width, so a new tab, a download and a middle click all still work.
- **Stacking:** Three columns to two to none — the preview leaves the page rather than shrinking.
- **Overflow:** An image is contained, never cropped; a PDF scrolls inside its own frame; a type a browser cannot render is offered as a download instead of an empty box.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### verification-decision

*A decision with consequences for a partner: each outcome named, with what it does and a reason where one is required.*

Implemented by `LvDecisionPanel`, `TransitionDialog`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A column beside the evidence: the allowed outcomes as radio rows, the optional problem flags, the reason box, then the action. |
| Tablet · 768–1023px | The same column, full width under the list and the file. |
| Phone · up to 767px | The whole decision becomes a bottom sheet over the list, with the action pinned in its footer, so the choice is never below a document the length of a page. |

- **Interaction change:** Only the transitions the state machine allows from the current state are offered; the reason box appears when the server would refuse without one.
- **Stacking:** Outcomes are always one per line, never a row of buttons — they are not equivalent choices.
- **Overflow:** A consequence and a rejection reason wrap in full and never truncate.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes

### activation-readiness

*Whether a record can go live, and every reason it cannot — grouped by where the fix is made.*

Implemented by `LvReadinessPanel`, `LvListings`, `LvConnections`, `EcosystemTransitionSheet`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | The verdict, the passing-checks bar and every failing reason grouped by area, beside the record’s other sections. |
| Tablet · 768–1023px | The same, full width under the record header. |
| Phone · up to 767px | Areas stack and each reason takes its own line at full width rather than sharing a row, because a truncated reason is the one thing this surface cannot afford; the status change becomes a bottom sheet. |

- **Interaction change:** Only the transitions the server returned as settable are offered, and a readiness-gated one says in advance that it will be refused.
- **Stacking:** Verdict, then progress, then one group per area — never side by side.
- **Overflow:** A reason wraps in full and is never shortened; a long record name breaks anywhere.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes

### ai-surfaces

*What the assistant suggests, why, and what it is unsure about.*

Implemented by `LvNextBestAction`, `LvAiPanel`, `LvAiAnswer`, `LvConfidence`, `LvAiUnavailable`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A tinted panel with the recommendation, its reason, and the action to the right. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | The action drops below the reason at full width, and cited records become a wrapped chip list. |

- **Interaction change:** Accepting or rejecting a suggestion is recorded at every width; nothing runs without a confirmation step.
- **Stacking:** Aside wraps below the body.
- **Overflow:** Reasons wrap in full — a suggestion whose reason is cut off cannot be checked, and an unverifiable instruction will not be trusted.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### charts

*A small, honest picture of a count or a trend. No chart library.*

Implemented by `LvBarChart`, `LvSparkline`, `LvDonut`, `Bars`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Full width with axis labels and a value on each bar. |
| Tablet · 768–1023px | Labels shorten; values stay. |
| Phone · up to 767px | Bars turn horizontal so the category labels stay readable, and every chart is followed by the same numbers as text for anyone who cannot see it. |

- **Interaction change:** Values are always printed, so no tooltip is required to read the chart.
- **Stacking:** Vertical bars to horizontal.
- **Overflow:** Categories beyond the tenth are grouped as "Other".
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### navigation

*The frame: the six doors, global search, notifications, the account.*

Implemented by `LvShell`, `LvSidebarItem`, `LvHero`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A 240px rail with the logo, labelled doors, and profile and settings at the foot. |
| Tablet · 768–1023px | The rail collapses to 72px of icons with accessible names, giving the content back its width; the secondary list moves into the account menu. |
| Phone · up to 767px | The rail becomes a fixed bottom bar of the six doors, icon over label, each an equal share of the width. The logo, the greeting and the secondary list live on the screens themselves. |

- **Interaction change:** Rail to icon rail to bottom bar.
- **Stacking:** Vertical to horizontal.
- **Overflow:** Door labels ellipsize; the sixth door is never pushed off the edge.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### notifications

*Assignment, SLA, document and mention notices, and the result of what you just did.*

Implemented by `LvNotificationList`, `LvNotificationItem`, `LvToast`, `LvToastStack`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | The bell opens a 380px popover; toasts appear bottom-right. |
| Tablet · 768–1023px | Popover at 380px; toasts bottom-right. |
| Phone · up to 767px | The bell opens a full bottom sheet, and toasts span the width just above the navigation bar so they never cover it. |

- **Interaction change:** Popover becomes a sheet; a toast is dismissible by tap at every width.
- **Stacking:** One notice per line.
- **Overflow:** The list scrolls; toasts stack to three and then queue.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes

### empty-states

*Nothing here — and what to do about it.*

Implemented by `EmptyState`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Centred within the section, with the action beneath. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | Same copy, full-width action. The text is never shortened, because an empty state is mostly text. |

- **Interaction change:** None — the same interaction at every width.
- **Stacking:** Action goes full width.
- **Overflow:** n/a
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### loading-states

*The shape of what is coming, announced politely.*

Implemented by `LoadingState`, `LvSkeletonRow`, `LvSkeletonCard`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | Skeletons in the layout the content will occupy. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | Skeletons follow the phone layout — card-shaped where a table will become cards, so the page does not jump when the data lands. |

- **Interaction change:** aria-busy and a polite live region at every width.
- **Stacking:** Matches the content it stands in for.
- **Overflow:** n/a
- **Touch target:** Not interactive
- **Bottom sheet on a phone:** No

### error-states

*What failed, in the server’s own words, and the way forward.*

Implemented by `ErrorState`, `ForbiddenState`, `InlineNotice`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A bordered panel with the reason and a retry. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | Full width, retry as a full-width button. The server’s reason is shown in full — a refusal without its reason is a dead end. |

- **Interaction change:** Announced assertively to screen readers at every width.
- **Stacking:** Action below the message.
- **Overflow:** The message wraps; it is never truncated.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** No

### confirmation

*The pause before something irreversible, naming what will happen.*

Implemented by `LvConfirm`.

| Width | Behaviour |
|---|---|
| Desktop · 1024px and wider | A compact dialog; the destructive action is never the default focus. |
| Tablet · 768–1023px | Identical. |
| Phone · up to 767px | A bottom sheet with stacked full-width buttons, cancel nearest the thumb. |

- **Interaction change:** Dialog becomes a sheet; the confirm button states the actual verb, never "OK".
- **Stacking:** Buttons stack.
- **Overflow:** The consequence line wraps in full.
- **Touch target:** 44px minimum
- **Bottom sheet on a phone:** Yes
<!-- /generated:contract -->

---

## 5. Accessibility

Held to as invariants rather than a checklist:

- Anything clickable is a real `<button>` or `<a>`. Never a `div` with a handler.
- A visible focus ring on everything focusable, at a 2px offset.
- Overlays trap focus, close on Escape, lock the page behind them, and return focus to whatever opened them.
- Every input has a bound `<label>`; help and error text are associated, not merely adjacent.
- Loading is `aria-busy` with a polite live region; errors are announced assertively.
- Charts print their numbers as text as well as drawing them, so no one needs a tooltip — or sight — to read one.
- Status is carried by a word, not only a colour.
- Touch targets are 44px, or 36px for a secondary control inside a dense row.
- Icons are `aria-hidden` by default; the label lives on the control around them.

---

## 6. Remaining Twenty UI dependencies

Honest accounting of what is still Twenty's interface.

### 6.1 Deliberately left with Twenty

These are administrator surfaces. Ordinary team members never see them, and rebuilding them would be weeks spent on screens used by two people.

| Surface | Where |
|---|---|
| Workspace settings, members and roles | Twenty at `:3102/settings/*` |
| Workflow builder | Twenty |
| API keys and integrations | Twenty |
| Admin panel | Twenty |
| Raw record tables for the 16 LV objects | Twenty |

They are reached by URL. The LV app does not link to them, and its navigation does not include them.

### 6.2 To be removed

| Item | What it is | Status |
|---|---|---|
| `packages/twenty-apps/internal/lavivenzia-crm/src/**/front-components/*` | 26 front components from the abandoned in-Twenty attempt. Still applied to the workspace. | **Superseded.** To be deleted once `lv-app` covers every door (end of the 6-day plan). |
| `packages/twenty-front/src/lv/lv-theme.css` | A stylesheet that restyled the Twenty shell with LV tokens. | **Superseded.** Only affects Twenty's own admin screens now. |
| `packages/twenty-front/src/lv/useIsLvWorkspacePage.ts` + patches to `DefaultLayout.tsx`, `StandalonePageLayoutPage.tsx` | Fork patches that hid Twenty's chrome around the front components. | **Superseded.** To be reverted with the front components. |
| The header comments in `tokens.ts` | Still describe the front-component/host-stylesheet parity arrangement. | Stale prose, not stale code. To be rewritten when the above is deleted. |

### 6.3 Structural dependencies that stay

These are not UI, and they are the point of the architecture:

- **Authentication** — `getLoginTokenFromCredentials` → `getAuthTokensFromLoginToken`. The LV app owns the sign-in screen; Twenty owns the tokens.
- **GraphQL** for plain record reads, and the 34 `/s/*` routes for anything with a rule behind it. Permissions, capabilities and lenses are computed by the server and obeyed by the UI — never recomputed in the browser.
- **File storage**, notifications and the audit trail.

### 6.4 Not yet built

Phase 0 is the foundation. Against the 90-surface inventory in `UI-SCREEN-INVENTORY.md`, the LV app currently implements sign-in, the six-door home, Today, My Leads, the lead profile with five tabs, the account screen, four action dialogs and the design system page. Capture, onboarding, messages, Ask LV, import, the ecosystem records, work management and the leadership boards are scheduled for Days 2–6 and will be composed from this system rather than designed again.

---

## 7. Verification

Run from `packages/lv-app`:

```bash
yarn typecheck   # tsc --noEmit
yarn lint        # oxlint
yarn test        # vitest — the design system's own invariants
yarn build       # tsc -b && vite build
```

Phase 0 results:

| Check | Result |
|---|---|
| Typecheck (`lv-app`) | Clean |
| Typecheck (`lavivenzia-crm` app package) | Clean |
| Lint (`lv-app`, 29 files) | 0 warnings, 0 errors |
| Lint (app package, 428 files) | 0 warnings, 0 errors |
| Design-system tests | 16 passed |
| App package unit tests | 1056 passed, 51 files |
| Production build | 364 KB raw / 107 KB gzipped |
| Horizontal overflow at 390 / 768 / 820 / 1030px | None |

The width check is worth keeping: a page that scrolls sideways on a phone is the clearest symptom of a desktop layout that was merely narrowed. It caught one real defect during this phase — a rejection reason forced onto a non-wrapping row pushed the page 53px wider than the viewport.
