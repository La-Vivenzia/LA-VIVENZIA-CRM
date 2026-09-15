# Day 7B — La Vivenzia Design System and CRM UI/UX Transformation

**Status:** implemented on Twenty 2.39.0, application `lavivenzia-crm`, plus one
documented core change (CM-005). **Date:** 2026-09-15.

The employee-facing CRM now reads as a La Vivenzia product — warm ivory
working surfaces, pine green as the primary, gold reserved for emphasis,
Cinzel for titles and figures, Sora for everything else, a dark mode that is
a deep pine night rather than an inverted light theme — without forking any
Twenty component, weakening any permission, or touching the data model.

---

## 1. Design audit — what it looked like before

Captured in Chromium before any change (`.notes/d7b/shots/before/`):

| Surface | Finding |
|---|---|
| Sign-in | Twenty "20" logo, "Welcome, Apple.", links to twenty.com Terms / DPA / Privacy |
| Sidebar | Workspace named **Apple** with Apple's logo; folders CRM / Work / Management / Automation plus Twenty's own root items (Opportunities, Dashboards, Workflows); Inter, grey, indigo accent |
| Record list | Auto-generated "All Partner onboardings" with **39** columns; blue isometric empty-state illustration; "Use our API or add … manually" |
| LV pages | Already on the Day 5 theme (`theme.ts`, `dashboard-kit.tsx`): correct brand hexes but light cards inside a grey shell, fonts declared but never loaded (Cinzel/Sora fell back to Georgia/system), hard-coded light hex values in the onboarding wizard and quick-add (broken in dark mode), five different button styles across pages |
| Status chips | Solid-fill badges in one page, Twenty tag colours in tables, raw `SNAKE_CASE` in places |
| Timeline author | System events attributed to "Twenty" |

Twenty surfaces identified as the shell the LV pages live in: navigation
drawer, top bar, command menu / search, record index tables, record show page
and tabs, side panel, dialogs, snackbars, sign-in / onboarding flow, empty
states, settings.

## 2. Design system

### 2.1 Tokens — one source, two consumers

`packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-core/ui/tokens.ts`
defines the semantic tokens for both schemes. Two things read it:

1. **LV front components** through `themeFor(scheme)` in `theme.ts` (the
   sandboxed renderer has no access to the host stylesheet, so components
   style themselves inline from the same values).
2. **The Twenty shell** through `packages/twenty-front/src/lv/lv-theme.css`,
   whose `--lv-*` blocks are generated from `tokens.ts` by
   `scripts/sync-lv-theme-css.mjs` and kept identical by
   `lv-core/ui/__tests__/tokens.test.ts`.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--lv-primary` | `#1F4D3A` | `#2C6B4F` | primary actions, active nav, links |
| `--lv-primary-hover` | `#163A2B` | `#357F5E` | |
| `--lv-primary-muted` | `#E3EBE5` | `#1C3328` | selected / soft chips |
| `--lv-sage` | `#6B846F` | `#6B846F` | secondary brand, neutral markers |
| `--lv-gold` / `--lv-gold-ink` | `#D4AF37` / `#9A7A2E` | `#D4AF37` / `#D9BB5C` | emphasis rule, AI provenance; ink variant is the readable text form |
| `--lv-bg` / `--lv-surface` / `--lv-surface-elevated` / `--lv-surface-sunken` | `#F3EFE7` / `#FCFAF6` / `#FFFFFF` / `#ECE5D8` | `#0D1611` / `#15221A` / `#1E2C22` / `#101C15` | page / card / raised / well |
| `--lv-surface-inverse` (+`-fg`) | `#1F4D3A` / `#F3EFE7` | `#132B1E` / `#F3EFE7` | the dark anchor panel (Lead 360 identity, Copilot briefing) |
| `--lv-heading` / `--lv-text` / `--lv-text-muted` / `--lv-text-subtle` | `#16261E` / `#1A1A1A` / `#6B6660` / `#8C8579` | `#F5F1E8` / `#F3EFE7` / `#9FAA9C` / `#7C8A7B` | |
| `--lv-border` / `--lv-border-strong` / `--lv-ring` | `#E1DCD0` / `#CBC3B2` / `#1F4D3A` | `#26362A` / `#3A4D3E` / `#CBA94E` | focus ring is gold in the dark |
| `--lv-danger` / `--lv-warning` / `--lv-success` / `--lv-info` (+ `-muted` washes) | `#8C2B23` / `#8A5A12` / `#2F6042` / `#2E4B66` | `#E58A82` / `#E2B45B` / `#7FC39A` / `#8FB4D2` | status; every pair passes 4.5:1 on its wash and on the surface |
| `--lv-shadow-sm/md/lg` | pine-tinted | black | elevation |

Contrast is asserted, not eyeballed: body, heading and muted text on every
surface (≥ 4.5:1), text on primary and on the inverse panel, each status
colour on its wash, focus ring on the page (≥ 3:1) — in both schemes.

### 2.2 Typography

Cinzel (display) and Sora (body) are **self-hosted** —
`packages/twenty-front/public/fonts/lv/` holds the variable WOFF2 files for
latin and latin-ext with their SIL OFL licences; no font CDN is contacted
(asserted by test). Fallback stacks keep the layout if a face fails to load.

Semantic scale (`LV_TYPE`): `display` (page titles, fluid 24–32px), `title`
(19–24px), `heading` (15px), `subheading` (Sora 600 14px — section headings),
`body` 13px, `bodySmall` 12px, `label` (10.5px uppercase, 0.1em tracking —
eyebrows and dt labels), `caption` 11px, `figure` (Cinzel, KPI numbers,
26–34px), `mono`. Cinzel is used for titles, figures and the wordmark only;
everything you read in quantity is Sora.

### 2.3 Primitives — `lv-core/ui/kit.tsx`

One kit replaces `dashboard-kit.tsx` (kept as a re-export for older imports):

`LvPage` · `LvStyles` (scoped stylesheet: focus-visible, hover, responsive
grids, skeleton shimmer, reduced motion) · `PageHeader` (eyebrow / title /
subtitle / actions) · `Eyebrow` · `LvButton` (primary, secondary, ghost,
danger, gold; `busy` keeps width; 44px targets) · `ActionBar` · `LvBadge` ·
`LvStatusBadge` (see 2.4) · `CountPill` · `Provenance` (COMPUTED · rules / AI
GENERATED / RECORDED / SYSTEM — a dashed chip, no sparkles) · `LvCard` (toned
top rule = attention signal) · `Section` · `InversePanel` · `Facts`
(responsive definition list) · `Segmented` · `KpiTile` · `EmptyState` ·
`ErrorState` · `ForbiddenState` · `LoadingState` · `InlineNotice` ·
`RecordList` / `RecordRow` · `AttentionItem` · `Bars` · `LvTable`
(real table on desktop, label/value cards on a phone) · `Field` · `LvInput` /
`LvTextarea` / `LvSelect` · `Disclosure` (progressive disclosure) · `Wordmark`.

Twenty's own primitives (buttons, tables, menus, dialogs, tags, snackbars)
are **themed through their tokens** rather than duplicated — see CM-005.

### 2.4 Unified status system — `lv-core/ui/status.ts`

`describeStatus(kind, value)` returns `{ label, tone }` for lead lifecycle,
priority, SLA, onboarding, document verification, task, relationship health,
AI insight, problem and severity. Five tones — critical / caution / progress /
positive / neutral — map to the badge colours, so "Breached", "Rejected",
"At risk" and "Critical" look the same everywhere, and an unknown value
renders as a neutral humanised label instead of raw `SNAKE_CASE`.

## 3. Global shell (CM-005)

- `lv-theme.css` redefines Twenty's `--t-*` neutral scale, accent scale, font
  family, shadows, snackbar colours and the SELECT tag palette in light and
  dark. The sidebar, top bar, tables, record pages, menus and dialogs are
  upstream code reading new values.
- Focus rings and selection colour follow the brand; `prefers-reduced-motion`
  is honoured shell-wide.
- Sign-in: LV mark, "Welcome to La Vivenzia", display face, internal-use
  notice instead of Twenty's legal links.
- PWA / favicon icons regenerated from the mark; default workspace logo is the
  LV mark; system timeline author is "La Vivenzia CRM".
- Workspace identity is data: `scripts/brand-workspace.mjs` names the
  workspace "La Vivenzia" and uploads the mark through the admin API (run
  once per environment; credentials from the environment only).

## 4. Navigation

Five groups, all existing routes and permissions (Twenty hides items a role
cannot open; nothing new is exposed):

| Group | Items |
|---|---|
| **Workspace** | My Dashboard · Notifications · Tasks · Quick add lead · Interactions · Notes |
| **Relationships** | Leads · Partner onboardings · Partners · People · Organisations · Experiences · Properties · Opportunities |
| **Intelligence** | Copilot (per-lead intelligence lives on the lead's Intelligence tab) |
| **Insights** | Control Tower · SLAs · Dashboards |
| **Administration** | Workflows · Workflow runs · Workflow versions |

Opportunities, Dashboards and the Workflow objects are Twenty's standard
objects; the LV application now ships its own sidebar entries for them so the
whole sidebar is application-owned. **Twenty's original root entries
(Opportunities, Dashboards, the Workflows folder) still exist as duplicates
until an admin removes them** — right-click › Delete in the sidebar's layout
customisation. They are not application-owned, so the SDK cannot remove them,
and a standard-application re-sync on a version upgrade may recreate them.

## 5. Page by page

| Page | Transformation |
|---|---|
| **My Dashboard** | "Needs attention now" panel first (overdue, breached, first-contact, due-today items with counts and the top five rows), then KPI tiles (quiet when zero, toned when not), work lists with status + priority badges, analytics. Segmented lens switch. |
| **Lead list** | The object's index view is now defined by the application with ten intentional columns (name, LV ID, organisation, status, owner, category, location, source, priority, next follow-up); the other 29 stay in the column picker. A second view, *Follow-up queue*, orders by next follow-up with next-action and priority. |
| **Lead 360** | Identity hero on the inverse panel (LV ID eyebrow, name in Cinzel, organisation, status / priority / health / unassigned / needs-attention badges, opportunity and last-interaction figures, key facts). Action bar of LV buttons (only what the server allows). Next action as a toned section (red when overdue, amber when nothing scheduled) with rules provenance on the suggestion. Sections keep their role-aware order: Overview (facts + data-quality eyebrow), Intelligence (figures + provenance), Relationship timeline (day groups, toned dots, AI decisions in gold), Tasks, Service levels (red when breached), Onboarding (progress bar with ARIA), Documents (amber when missing), Notes, Ownership, Lifecycle. |
| **Add interaction** | Progressive disclosure: channel, direction, date, outcome, summary, next action, next follow-up first; purpose, sentiment, objections, commitments and duration behind "More detail". Server validation reused unchanged. |
| **Tasks / follow-ups** | Twenty's task views under the themed shell; Lead 360 task rows carry due tone and priority badge. |
| **Onboarding wizard** | Same ten steps and logic; styles are now a function of the theme (dark mode works), progress bar is a `progressbar`, banners use the status washes, buttons are the LV pills. |
| **Document review** | Page header with verified count, reviewer section, one toned section per document (facts grid, flags as toggle pills, reason field with help), decision card gated on verification. |
| **Control Tower** | Health headline (Critical / Needs attention / Healthy) with group counts, then sections grouped **Critical → Needs attention → Operational flow → Quality**, breakdowns with status-toned bars, Notification health and System health, filters on the kit's form fields. Forbidden state for non-admins. |
| **Intelligence tab** | Page header with AI availability, every result carries a `Provenance` chip (COMPUTED · rules / AI GENERATED / AI SUGGESTION / AI DRAFT), score in the display face, inner cards on the raised surface. |
| **Copilot** | Briefing on the inverse panel with gold count chips and gold "Refresh briefing"; KNOWN / INFERRED / SUGGESTED as three visibly different blocks; proposals as an amber confirm card. |
| **Notifications** | Header with unread count and a segmented All / Unread filter; **Today / Earlier** groups; unread rows raised with a toned rule. |
| **Quick add** | Theme-driven styles, LV pills, status washes. |
| **Governance (Actions tab)** | Sections for current status and actions, danger-toned permanent-deletion card. |
| **Forms, modals, tables** | Kit fields with bound labels, help and error text; toned form shell; `LvTable` collapses to cards on a phone. |
| **Empty / loading / error / forbidden** | `EmptyState` (quiet tick line or titled block with an action), shimmer `LoadingState` with a live region, `ErrorState` with retry, `ForbiddenState` that says what to do — never that a button was hidden. |

## 6. Dark mode, responsive, accessibility, motion

- Dark is designed (deep pine grounds, lifted primary, gold ring), not
  inverted; every LV surface and the whole shell follow the user's Twenty
  colour-scheme setting.
- Layout is mobile-first: single column on phones, KPI grid two-up, `lv-two-col`
  / `lv-three-col` / `lv-sidebar-layout` widen at 768 / 1024. No horizontal
  overflow at 390 or 1440 (measured in the sweep).
- Real `<button>`s for every action, labels bound to inputs, `aria-pressed`
  on segmented controls, `role="progressbar"`, live regions for loading and
  errors, visually-hidden text for KPI tiles, 44px targets, visible
  focus-visible rings everywhere including the Twenty shell.
- Motion: 120–180ms colour transitions, a 180ms fade-in on loaded content, a
  skeleton shimmer; all disabled under `prefers-reduced-motion`.

## 7. Files

New: `lv-core/ui/tokens.ts`, `lv-core/ui/kit.tsx`, `lv-core/ui/status.ts`,
`lv-core/ui/__tests__/tokens.test.ts`, `lv-core/views/leads-follow-up-queue.view.ts`,
`navigation/{intelligence.folder,opportunities,dashboards,workflow-runs,workflow-versions}.navigation-menu-item.ts`,
`scripts/sync-lv-theme-css.mjs`, `scripts/brand-workspace.mjs`,
`packages/twenty-front/src/lv/lv-theme.css`, `packages/twenty-front/public/fonts/lv/*`,
`packages/twenty-front/public/images/lv/*`.

Changed: `lv-core/ui/theme.ts`, `lv-dashboard/front-components/dashboard-kit.tsx`
(re-export), every LV front component, `lv-core/views/leads-all.view.ts`,
all navigation items, `constants/universal-identifiers.ts`, and the core
files listed in CM-005.

## 8. Verification

See TESTING-QA.md § Day 7B for the before/after test counts, the browser
sweep (Admin, Hunter, Coordinator, Onboarding Expert × light / dark × 390 /
1440) and the regression suites.

## 9. Remaining visual issues

- **P1** Twenty's duplicate root sidebar entries (Opportunities, Dashboards,
  Workflows) remain until an admin deletes them (see §4).
- **P2** Settings pages still say "Twenty" in billing, MCP setup, community and
  the DPA generator (admin-only, mostly inapplicable to self-hosting).
- **P2** Cinzel renders lowercase as small caps by design; long titles in
  narrow side panels wrap to three lines — acceptable, but worth a shorter
  display name where a lead's name is very long.
- **P2** Twenty's global search still indexes only the lead name (platform
  limitation noted on Day 7); the intentional list view is the workaround.

## 10. Remaining Founder V1 gaps

- Employee legal pages (terms of use / privacy for staff) — the sign-in
  footer carries an internal-use notice until they exist.
- A corrected, transparent SVG of the brand lockup (the PNG lockup is used
  only as an asset; the mark is what the UI shows).
- Product decision on whether Opportunities (a Twenty standard object with no
  LV workflow) should stay in the sidebar at all.
