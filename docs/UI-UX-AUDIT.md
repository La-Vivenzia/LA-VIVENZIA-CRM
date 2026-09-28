# LA VIVENZIA CRM — UI/UX AUDIT

**Scope:** read-only audit of the implemented CRM UI against the approved reference screens in `new ui ux ref images/`.
**Date:** 24 September 2026 · **Auditor:** engineering · **Status:** AUDIT ONLY — no application code, config, database, API or package was modified.
**Evidence base:** `packages/twenty-apps/internal/lavivenzia-crm/src` (LV application, 4,871 LOC of logic + 8,740 LOC of front components), `packages/twenty-front/src` (Twenty shell + `src/lv/lv-theme.css`), the five approved reference images, and the live production build at `https://crm.lavivenzia.com`.

> **Reference folder note.** The brief names a folder `ui ux/`. The repository does not contain that path; the approved screens are in **`new ui ux ref images/`** (5 JPEG boards, added 24 Sep 2026). This audit treats those five boards as the target UI/UX system. If further screens exist elsewhere, sections 4–6 must be re-run against them.

---

## 1. Executive Summary

**The gap is not visual. It is architectural.**

The La Vivenzia brand has already been applied to the product at token level and is live in production: the deployed CSS bundle contains `--t-color-blue:#1f4d3a` (pine green replacing Twenty's indigo), the `--lv-*` token block, and the self-hosted Cinzel/Sora faces (`/fonts/lv/sora-latin.woff2` returns 200). A complete LV component kit exists — 33 exported primitives in `src/modules/lv-core/ui/kit.tsx` (943 LOC) built on a semantic token set (`tokens.ts`, `theme.ts`) with light/dark parity enforced by a unit test. Nine substantial LV surfaces are built on that kit and running.

What the reference boards demand, and the product does not have, is a different **information architecture and operating model**:

| The product today | The approved target |
|---|---|
| 26 sidebar entries in 5 folders, the full object-centric CRM | **6 doors**: Today · My Leads · Capture · Onboarding · Messages · Ask LV |
| Object-first: you pick an object, then a record, then a tab | Person-first: you land on *what needs your attention*, act from there |
| LV surfaces live *inside* Twenty record-page tabs (Lead 360 is tab 1 of 7) | The profile **is** the screen: header + next best action + tabs, no host chrome |
| AI is a tab and a route you go to | AI is the spine — on every surface, drafting, summarising, recommending |
| No "Messages" surface; drafts are produced but not sent | Messages is one of the six doors; conversations in one place |
| Capture is a good multi-method form inside a Twenty page | Capture is a first-class, phone-shaped, camera-first flow |
| Desktop-first; mobile works but is not the design target | Mobile-friendly is a stated product property |

This is why the founder's reaction to the live system was *"yeh exact same Twenty jaisa lag raha hai"* even though the colours and fonts are correct: **Twenty's shell is the product's skeleton, and the reference system replaces that skeleton.**

**Three findings drive the whole migration plan:**

1. **P0 — the shell, not the pages.** Until navigation collapses from 26 entries to 6 doors and LV surfaces stop being tabs inside Twenty record pages, every redesigned page will still *feel* like Twenty. No page-level work should start before the shell decision is made.
2. **The kit is a genuine asset — keep it.** `kit.tsx` already provides the target's visual language (calm ivory ground, pine primary, scarce gold, tonal status badges, KPI tiles, attention items, empty/error/loading/forbidden states, focus rings, reduced-motion support). It needs ~8 new primitives, not a rewrite. Throwing it away would cost ~3 weeks and lose the accessibility work already in it.
3. **The riskiest thing in this migration is the sandbox, not the CSS.** LV front components run inside Twenty's sandboxed renderer, which mirrors the DOM into the host page. That constraint (inline styles + one injected `<style>`, no Tailwind, no component library, no router, no portals) is what shapes every UI decision in this codebase. Any migration plan that assumes "we'll add Tailwind and shadcn" is not executable against the current runtime, and would require either a host-side app shell or a change in how the app is delivered — a decision to be taken **before** Phase 1.

**Recommended sequencing:** tokens & primitives (already ~80 % done) → shell & navigation (the 6 doors) → Today → Lead 360 as a full-page workspace → Capture → Onboarding → Messages (needs a transport decision) → Ask LV → Control Tower/analytics → responsive & accessibility polish.

**Effort estimate:** 6 phases, ~7–9 working weeks for one engineer, of which Phase 1 (shell/navigation) is the only phase that touches the Twenty host package and therefore the only one with deployment risk.

---

## 2. Existing CRM UI Architecture

### 2.1 Two rendering worlds

The UI a La Vivenzia user sees is produced by **two different systems**:

| Layer | Where it lives | Technology | Who owns it |
|---|---|---|---|
| **Host shell** — sidebar, top bar, command menu, record index tables, record pages, settings, auth, mobile home | `packages/twenty-front/src` | React + **Linaria** (`@linaria/react` 7.x — no Tailwind in the repo), theme via `--t-*` CSS custom properties, `ThemeProvider` reading them at runtime | Twenty upstream, restyled by `src/lv/lv-theme.css` (507 lines, imported in `src/index.tsx:17`) |
| **LV surfaces** — Lead 360, My Dashboard, Control Tower, Capture, Onboarding wizard, Document review, Intelligence, Governance, Copilot, Notification centre, Partner/Property/Experience 360 | `packages/twenty-apps/internal/lavivenzia-crm/src/modules/*/front-components/*.tsx` | React rendered in **Twenty's sandboxed front-component renderer**; styling is **inline styles + one injected `<style>` scoped to `.lv-root`** | La Vivenzia |

**The sandbox is the central architectural fact.** `kit.tsx` documents it: *"The components run inside Twenty's sandboxed renderer, which mirrors the DOM (including `<style>` elements) into the host page, so inline styles carry the tokens and a small injected stylesheet (LvStyles) supplies what inline styles cannot: `:focus-visible`, `:hover`, media queries and reduced motion."* Consequences that constrain every design decision:

- No CSS framework, no utility classes, no external component library inside LV surfaces.
- Media queries only via the injected `LvStyles` block → responsive behaviour is centralised in six named grid classes (`lv-kpi-grid`, `lv-two-col`, `lv-three-col`, `lv-sidebar-layout`, `lv-field-grid`, `lv-hide-mobile`).
- No client-side router inside a surface; navigation between LV screens goes through the host.
- Data reaches a surface only through `callRoute()` (`lv-core/utils/call-route.ts`) → `POST {API}/s<path>` with the signed-in user's delegated token. **Identity is never in the body**; the server resolves the actor. Refusals arrive as `200 { ok: false }` and are surfaced with their `detail`/AI `code`.

### 2.2 Design system (LV)

- **Tokens** — `src/modules/lv-core/ui/tokens.ts`: brand constants (`pineGreen #1F4D3A`, `sage #6B846F`, `warmGold #D4AF37`, `sand #F3EFE7`, `charcoal`), a full semantic set per scheme (`primary`, `primary-hover/-muted/-fg`, `gold`, `gold-ink`, `gold-muted`, `bg`, `surface`, `surface-elevated/-sunken/-inverse`, `heading`, `text`, `text-muted/-subtle`, `border`, `border-strong`, status colours + muted washes, `ring`, three shadows), `LV_RADIUS`, `LV_MOTION`, `LV_TYPE`, `LV_FONT`, `LV_BREAKPOINT = { sm: 480, md: 768, lg: 1024 }`.
- **Single source of truth** — the same token file generates the host stylesheet's `--lv-*` block; a unit test keeps `lv-theme.css` and `tokens.ts` identical. This is a real strength and must be preserved.
- **Theme object** — `theme.ts` exposes `color`, `shadow`, `space(n) = n*4`, `radius`, `motion`, `type`, `font` (`size: xs 11 / sm 12 / md 13 / lg 18 / xl 24`), `breakpoint`, plus `layout(theme)` primitives so "responsive" is one decision.
- **Kit primitives (33)** — `LvPage`, `PageHeader`, `Eyebrow`, `LvButton`, `ActionBar`, `LvBadge`, `LvStatusBadge`, `CountPill`, `Provenance`, `LvCard`, `Section`, `InversePanel`, `Facts`, `Segmented`, `KpiTile`, `EmptyState`, `ErrorState`, `ForbiddenState`, `LoadingState`, `InlineNotice`, `RecordList`, `RecordRow`, `Bars`, `LvTable`, `Field`, `LvInput`, `LvTextarea`, `LvSelect`, `Disclosure`, `AttentionItem`, `Wordmark`, `VisuallyHidden`, `LvStyles`.
- **Status vocabulary** — `ui/status.ts` maps domain status → tone, so a lead status, an onboarding status and a document status render consistently.

### 2.3 Page composition

LV surfaces are placed by **page layouts** (`definePageLayout`, 10 files) as `FRONT_COMPONENT` widgets inside Twenty record pages or standalone pages. Example: `lead-profile.page-layout.ts` declares 7 tabs (Lead 360 · Details · Follow-ups · Relationship · Notes & files · Intelligence · Actions), with a comment recording a Twenty constraint — *"Position 1, not 0: Twenty renders a record page's first tab as the narrow left column"*. **This is the structural coupling the target design removes.**

### 2.4 Navigation (26 entries, 5 folders)

`src/navigation/*.navigation-menu-item.ts`:

| Folder | Items |
|---|---|
| **Workspace** | My Dashboard, Capture lead, Tasks, Interactions, Notes, Notifications |
| **Relationships** | Leads, People, Organisations, Partners, Partner onboardings, Properties, Experiences, Opportunities |
| **Insights** | Dashboards, Control Tower, SLAs |
| **Intelligence** | Copilot |
| **Administration** | Workflows, Workflow runs, Workflow versions |
| *(host)* | Settings (21 sections), Search, Command menu, Ask AI |

### 2.5 Roles

Nine LV roles (`src/roles/`): Main Admin, Management, Operations, Lead Coordinator, Experience Hunter, Onboarding Expert, Experience Team, Marketing, plus the default role. Surfaces are **lens-aware**: `/leads/360` returns a `caller.lens` (`ADMIN` | …) and a `capabilities` object (`canEdit`, `canLogInteraction`, `canChangeStatus`, `canGovern`, `canReviewDocuments`, `canViewIntelligence`, …) that the component renders from. Permission-driven UI is therefore **server-computed, not client-guessed** — a significant asset to preserve.

---

## 3. Current Screen Inventory

### 3.1 LV-owned surfaces (9 components, 13 entry points)

| # | Surface | File | LOC | Where it appears | Composition |
|---|---|---|---|---|---|
| S1 | **My Dashboard** | `lv-dashboard/front-components/my-dashboard.front-component.tsx` | 374 | Workspace › My Dashboard | KPI tiles; sections: Pipeline, Conversion pipeline, Communication activity, Onboarding health, lens-specific block, Ecosystem, Recent activity |
| S2 | **Control Tower** | `lv-dashboard/front-components/control-tower.front-component.tsx` | 542 | Insights › Control Tower | 12 numbered management sections incl. Leads by status, Document verification backlog, Ecosystem × 4, Contact data, Notification health, System health, Administrators only |
| S3 | **Lead 360** | `lv-core/front-components/lead-360.front-component.tsx` + `lead-360/sections.tsx` (701) + `forms.tsx` (553) | 1,610 | Lead record page, tab 1 of 7 | Overview, Next action, Open tasks & follow-ups, Relationship timeline, Interactions, Service levels, Onboarding, Documents, Intelligence, Internal notes, Ownership, Lifecycle, Ecosystem progression |
| S4 | **Capture lead** | `lv-capture/front-components/capture-lead/capture-lead.tsx` (825) + `capture-state.ts` + `import-leads.tsx` (386) | 1,211 | Workspace › Capture lead | Method segmented control (20 methods), extraction, review fields, duplicate decision, assignment, CSV import (inspect → validate → commit) |
| S5 | **Onboarding wizard** | `lv-onboarding/front-components/onboarding-wizard.front-component.tsx` (579) + `document-upload-field.tsx` (303) | 882 | Onboarding record page | 10 steps, save & resume, per-step fields, document upload |
| S6 | **Document review** | `lv-onboarding/front-components/document-review.front-component.tsx` | 541 | Onboarding record page | Document list, preview, verify/reject with reason codes |
| S7 | **Lead intelligence** | `lv-intelligence/front-components/lead-intelligence.tsx` | 747 | Lead record page, Intelligence tab | Opportunity score + factors, health, duplicates, data quality, AI suggestions with accept/reject |
| S8 | **Lead governance** | `lv-governance/front-components/lead-governance.front-component.tsx` | 230 | Lead record page, Actions tab | Lifecycle transitions with reasons, ownership change, delete impact |
| S9 | **Copilot** | `lv-copilot/front-components/copilot.front-component.tsx` | 302 | Intelligence › Copilot | Question input, structured answer (known / inferred / suggested), confirm step |
| S10 | **Notification centre** | `lv-notifications/front-components/notification-centre.front-component.tsx` | 329 | Workspace › Notifications | List, mark read / mark all read |
| S11–13 | **Partner / Property / Experience 360** | `lv-core/front-components/ecosystem-360/*` (shared 422, listing 261, partner 260) | 943 | Partner/Property/Experience record pages | Header, readiness, linked records, commercial facts |

### 3.2 Twenty-owned surfaces the user also sees (not LV-styled beyond tokens)

Record index pages (table/board/gallery views, filters, sorts, search, pagination, bulk actions) · record show pages (field panels, tabs, timeline, tasks, notes, files) · command menu (⌘K) · global search · **Ask AI chat panel** · notifications (host) · 21 settings sections (incl. members, roles, API keys, AI, data model, integrations, admin panel) · auth pages · `MobileHomePage` · onboarding (workspace setup) · workflows builder and runs.

### 3.3 Non-obvious surfaces

- **Twenty's own AI chat** (`src/pages/ai-chat`) — parallel to LV Copilot, now enabled with Gemini. Two AI entry points exist today; the reference system has one ("Ask LV").
- **Workflows** (3 sidebar entries) — a developer-facing builder exposed to all users.
- **Opportunities, Notes, People, Organisations** — Twenty objects surfaced in the LV sidebar with no LV-designed screen behind them.
- **`MobileHomePage`** — a separate mobile entry that LV has never designed for.
- **25 saved views** (`*/views/*.view.ts`) — Leads all / follow-up queue, Partners × 5, Properties × 4, Experiences × 5, Follow-ups × 4, Interactions, SLA attention. These *are* UI (columns, filters, order) even though they are declarative files.

---

## 4. `new ui ux ref images/` Reference Inventory

| # | Board | Purpose | What it specifies |
|---|---|---|---|
| **R1** | *Stop building a CRM. Build a work assistant.* | Positioning + the "old way vs LV way" contrast | Explicitly shows a 16-item dark sidebar + dense leads table as **the anti-pattern**. The LV side: light sidebar (6 items), greeting header with date/bell/avatar, "3 things need your attention" cards with a **primary action button per row** (Call / Review / WhatsApp) and a chevron, "Today's work" counters (4 Calls, 3 WhatsApps, 2 Onboardings, 1 Overdue), an "AI says" panel |
| **R2** | *The La Vivenzia CRM should have only 6 doors.* | **Navigation contract** | Sidebar: Today · My Leads · Capture · Onboarding · Messages · Ask LV, with Profile + Settings pinned at the bottom. Top bar: one wide global search ("Search anything… e.g. villa in Lonavala, Rahul, pending onboarding"), bell with count, avatar + greeting. Body: 6 entry cards in a 3×2 grid, each with a tinted icon tile, title, one-line description, and a coloured chevron. Left rail of the board lists **role-based views** (Experience Hunters, Onboarding Team, Marketing, Leadership, Admins). Bottom: the 13 "behind the scenes" systems (People, Organisations, Leads, Activities, Tasks, Documents, Workflows, AI Services, Integrations, Permissions, Analytics, Audit Logs, Settings) — **explicitly not sidebar items** |
| **R3** | *The one screen that defines the La Vivenzia CRM* | **Lead/partner profile contract** | Full-width identity header (avatar, name, status pill, role · location, meta row: location / experience / rating, **Call + WhatsApp primary buttons + overflow ⋮**), then a **Next Best Action banner** (icon, one-sentence action, "Reason: …", and a secondary "View Message Suggestions"), then tabs (Overview · Onboarding · Conversations · Documents · Timeline), then a 2+1 column body: ABOUT card with tag chips, RELATIONSHIP card (last contact, sentiment, concern), ONBOARDING card with progress bar + pending documents + "Help Complete" CTA, AI INSIGHTS card with a recommendation and "View full analysis →"; right rail: TIMELINE (dot-and-line, icon per channel) and RELATED (Experiences / Documents / Tasks with counts). Left/right annotations name the five principles: **Context · Memory · Intelligence · Action · Zero friction** |
| **R4** | *A day in the life of an Experience Hunter* | **Task-flow contract** (8 steps) | Today → Capture (phone-shaped, Photo/Instagram/Voice/Website/Type as big tiles) → AI extracted information (field list with per-field icons + "Looks good? Create Lead →" and "Edit before creating") → Duplicate check (match card, 87 % Match badge, "View Existing" vs "Create New Anyway") → AI suggested message (WhatsApp-styled draft bubble, "Send on WhatsApp" / "Edit Message") → Track progress (tabs Timeline/Notes/Tasks/Files with channel-icon entries) → Next best action card with Schedule Call / Mark as Done → End of day summary (counters + encouragement) |
| **R5** | *AI is not a feature. It is the heart.* | **AI contract** | Input (any format: voice, photo, Instagram, website, text, email, WhatsApp) → one intelligence layer (Understands / Remembers / Qualifies / Recommends / Executes) → smart output (enriched profile, AI summary, next best action, draft message, task created, onboarding progress, insights & warnings). Bottom: the AI connects to CRM database, communications, onboarding, workflows, integrations, analytics, security & permissions |

### 4.1 Design principles inferred (not descriptions — rules)

1. **Six doors, everything else behind them.** Objects still exist; they are reached *through* a person, a lead or a search, never from a menu. R2 states this twice ("The complexity still exists — behind the scenes").
2. **Every list row carries its action.** R1 and R4 never show a row you must open to act on: the action (Call / Review / WhatsApp / Schedule) is on the row.
3. **One recommendation per screen, with its reason.** The Next Best Action banner (R3) always pairs the action with "Reason: …". AI is never a bare assertion.
4. **AI is ambient, labelled, and always editable.** Drafts appear as drafts ("Edit Message"); analysis links to "View full analysis". Nothing auto-sends.
5. **Progressive disclosure over density.** R3 shows 5 tabs and 4 cards, not 13 sections. The rest lives one click deeper.
6. **Warm, light, photographic.** Ivory/white grounds, pine green for primary actions, soft tinted tiles (mint/blue/peach/lavender/pink) for *category* cues, photography in hero areas, generous radius (12–16 px), soft shadows. No dark sidebar (R1 marks that as the old way), no gradients-as-decoration, no glassmorphism.
7. **Human tone.** "Good morning, Saumay 👋", "Here's what needs your attention today", "Great work, Saumay!". Copy is part of the design system.
8. **Mobile is a first-class shape.** R4's capture flow is drawn as a phone. R2 lists "Mobile friendly" as a property.
9. **Counters beat charts for daily work.** R1/R4 use counters with icons ("4 Calls"); charts are reserved for leadership views.
10. **Status is a quiet pill, not a colour flood.** One tonal pill per record (Interested / New / Qualified), never a coloured row.

---

## 5. Design Language Analysis

| Dimension | Current implementation | Target (R1–R5) | Verdict |
|---|---|---|---|
| **Ground** | Sand `#F3EFE7` page, `#FCFAF6` surfaces, `#FFFFFF` elevated | Ivory/white with mint-tinted accent panels, photographic hero strips | **Close.** Add tinted category panels + hero imagery slot |
| **Primary** | Pine `#1F4D3A` (light) / `#2C6B4F` (dark) | Pine green buttons, identical | **Match** |
| **Accent** | Gold `#D4AF37`, `gold-ink #9A7A2E` for text | Gold used sparingly in marketing chrome only; UI accent is the tinted tile set | **Partial** — need a 5-hue soft tint scale (mint/blue/peach/lavender/pink) that does not exist today |
| **Type** | Sora (body) + Cinzel (display), sizes 11/12/13/18/24 | Serif-ish display for hero words, humanist sans for UI, **noticeably larger body** (~14–15 px) and larger names/headings | **Gap.** Current body 13 px with 11/12 px sub-text reads as "dense enterprise"; the target reads as "calm assistant" |
| **Radius** | `LV_RADIUS` (sm/md/lg) | 12–16 px cards, fully-round pills and icon tiles | **Partial** — need `xl` + `pill` |
| **Shadow** | 3 levels, subtle | Soft, wide, low-opacity card shadows | **Match** |
| **Density** | Section-per-topic, 13 sections on Lead 360 | 4 cards + 5 tabs + right rail | **Largest single gap** |
| **Iconography** | Twenty's `Icon*` set in nav; almost no icons inside LV surfaces | Icon per row, per channel, per category; tinted icon tiles | **Gap** |
| **Imagery** | None | Avatars everywhere, property photos, hero landscape strips | **Gap** — avatars/photos are not modelled in any LV surface |
| **Motion** | `lv-fade`, `lv-shimmer`, reduced-motion respected | Restrained; nothing animated in the boards | **Match** |
| **Voice** | Functional ("Open tasks & follow-ups", "Ecosystem progression") | Human ("Here's what needs your attention today") | **Gap** — copy rewrite is part of the migration, not a separate task |

---

## 6. Current vs Target Gap Analysis

### 6.1 Shell & navigation — **P0**

**Current:** 26 sidebar entries across 5 folders; LV surfaces are tabs inside Twenty record pages; two AI entry points (LV Copilot + Twenty Ask AI); Twenty's command menu and global search; a `MobileHomePage` nobody designed.
**Target (R2):** 6 doors + Profile/Settings; one global search with natural-language placeholder; greeting + bell + avatar top bar; role-based views behind the same six doors.
**Gap:** the single largest. Object menus (People, Organisations, Opportunities, Notes, Tasks, Interactions, SLAs, Workflows ×3, Dashboards) must move behind the doors or behind search; Workflows and Audit/Permissions belong under Settings per R2's "behind the scenes" strip.
**Why P0:** every other screen is rendered *inside* this shell. Redesigning pages first means redesigning them twice.

### 6.2 Today — **P0/P1**

**Current:** *My Dashboard* (S1) — KPI tiles + 7 analytical sections (Pipeline, Conversion, Communication activity, Onboarding health, Ecosystem, Recent activity). Data is correct and lens-aware; the framing is a report.
**Target (R1/R4-1):** "Good morning, {name} 👋 · Here's what needs your attention today" → **3 things need your attention** (row = avatar + name + context line + red overdue line + primary action button + chevron) → "Today's work" counters (Calls / WhatsApps / Onboardings / Overdue) → "AI says" panel with one prioritised paragraph.
**Gap:** attention-first composition, per-row actions, counters instead of charts, AI summary block, human copy, avatars. The *data* for all of this already exists (`/dashboard/summary` returns `kpis`, `pipeline`, `actions`, `quality`, `channels`, `health`, `activity`; `/ai/briefing` returns `today[]`, `headline`, `topActions[]` with refs). **No backend work needed — this is a composition change.**
**Why P0/P1:** it is the landing surface and the first thing the founder and every employee sees.

### 6.3 Lead 360 / profile — **P1 (highest-value page)**

**Current:** 13 stacked sections inside tab 1 of a 7-tab Twenty record page; identity rendered as a `PageHeader` + `Facts` grid; no avatar; actions in an `ActionBar`; timeline is a merged list of 30 mixed items; intelligence lives in a *different tab*; onboarding and documents are separate sections.
**Target (R3):** identity header with avatar/photo, status pill, meta row, **Call + WhatsApp as primary buttons**, overflow menu → **Next Best Action banner with reason** → 5 tabs (Overview · Onboarding · Conversations · Documents · Timeline) → 2-column body of 4 cards (About with chips, Relationship, Onboarding with progress + pending docs + "Help Complete", AI Insights with recommendation) → right rail (Timeline dot-list + Related counts).
**Gap:** structure (13 sections → 4 cards + 5 tabs + rail), the NBA banner, avatars/photos, tag chips, channel icons in the timeline, "Related" counts, one-click Call/WhatsApp, intelligence promoted onto the page.
**Server support:** `/leads/360` already returns everything needed — `lead`, `capabilities`, `nextAction.{task,suggestion}`, `openTasks[]`, `interactions[]`, `notes[]`, `timeline[30]`, `onboarding.{progressPercentage,documents,pendingDocuments}`, `intelligence.{opportunity,health,nextBestAction,dataQuality}`, `ecosystem.{partner,properties,experiences}`, `attention` flags, `slas[]`, `capture` provenance. **Again: composition, not backend.**

### 6.4 Capture — **P1**

**Current:** 20 methods in a `Segmented` control, then a long review form; CSV import as a separate flow; works on mobile widths but is designed for a desktop form.
**Target (R4-2/3/4):** 5 large tiles (Photo · Instagram · Voice · Website · Type) in a phone-shaped flow → "AI Extracted Information" list with a per-field icon and confidence, → "Looks good? Create Lead →" / "Edit before creating" → duplicate card with **87 % Match** badge and two explicit buttons.
**Gap:** tile-first method choice, extraction presented as a *result card* rather than a form, similarity **percentage** (currently keys match but no score is shown), phone-first layout. **Voice capture does not exist** (not built — see §13 and the PLANNED list).

### 6.5 Onboarding — **P1**

**Current:** 10-step wizard + separate document review surface; progress shown as a percentage; reviewer actions with reason codes (strong).
**Target (R3 card + R4):** progress bar with pending documents listed inline and a single "Help Complete" CTA that takes the employee to the exact missing step; document states as quiet pills.
**Gap:** mostly composition + an entry point from the profile. The wizard itself is close to target.

### 6.6 Messages — **P1, blocked**

**Current:** **does not exist.** Drafts are generated (`DRAFT` insights: WhatsApp follow-up, meeting follow-up, onboarding reminder) and shown inside Lead 360/Intelligence; there is no conversation surface and no send transport.
**Target (R2 door 5 / R4-5):** all conversations in one place; WhatsApp-styled draft bubble; "Send on WhatsApp" / "Edit Message".
**Gap:** a whole surface **plus a product decision**: WhatsApp Business API / Instagram messaging is not integrated (V1 scope note). A read-only "conversation log + draft + copy-to-WhatsApp" surface is achievable without any transport; true sending is not. **This must be marked PLANNED / FUTURE in any founder-facing artefact.**

### 6.7 Ask LV — **P2**

**Current:** LV Copilot (structured: known / inferred / suggested + confirm) *and* Twenty's Ask AI chat. Two doors to AI, different interaction models.
**Target (R2 door 6 / R5):** one "Ask LV" with a natural-language box and action-oriented answers.
**Gap:** consolidation decision + restyle. LV Copilot's permission-scoped structured answers are the safer base; Twenty's chat should be hidden from non-admin roles.

### 6.8 Analytics / Control Tower — **P2**

**Current:** 12 numbered sections, numbered titles ("11 · Notification health") leaking internal ordering into the UI; dense.
**Target:** Leadership is a *role-based view* behind the same doors (R2 left rail), not a separate menu.
**Gap:** re-frame as "Leadership view of Today", drop the numbering, keep the data.

### 6.9 Priority classification rationale

| Priority | Meaning | Assigned to | Why |
|---|---|---|---|
| **P0** | Foundational; blocks other UI work | Tokens/primitives gaps (§7), Shell & navigation (6 doors), Today | Every page renders inside the shell and reuses the primitives; Today is the landing surface and the demo's first impression |
| **P1** | Major CRM surface used daily by the target roles | Lead 360 / profile, Capture, Onboarding + Document review, Messages (blocked) | These are the four surfaces R1–R5 actually draw; they carry the daily work of Experience Hunters and the Onboarding team |
| **P2** | Secondary surface | Ask LV consolidation, Control Tower / leadership view, Partner/Property/Experience 360, Notification centre | Important but used weekly, by fewer roles, or already close to target |
| **P3** | Polish | Saved views (columns/filters), settings, empty-state copy pass, motion, icon set completion, dark mode re-check | Visible but non-blocking; best done once patterns are frozen |

---

## 7. Design System Audit

| Element | Current | Target | Action |
|---|---|---|---|
| Typography scale | 11/12/13/18/24, Sora + Cinzel | Larger base (14–15), display sizes for names, clear 6-step scale | **REDESIGN** (token change; touches every surface) |
| Colour — brand | Pine/sage/gold/sand/charcoal, full semantic set, light+dark | Same | **KEEP** |
| Colour — category tints | Missing | 5 soft tints (mint, blue, peach, lavender, pink) for icon tiles/entry cards | **CREATE** |
| Spacing | `space(n)=n*4` | Same rhythm, more generous defaults on cards | **KEEP** (adjust component padding) |
| Grid / containers | 6 named grid classes; `LvPage maxWidth=1280` | 2-col + right rail; entry-card 3×2 | **KEEP**, add `lv-rail-layout`, `lv-entry-grid` |
| Border radius | sm/md/lg | + `xl` (16) and `pill` | **CREATE** |
| Shadows | sm/md/lg | Same | **KEEP** |
| Buttons | `LvButton` (variants, sizes, loading) | + icon-leading buttons, WhatsApp-green variant, icon-only round | **REDESIGN** (extend) |
| Inputs / textarea / select | `LvInput`, `LvTextarea`, `LvSelect` with `Field` wrapper and bound labels | Same + search field with leading icon | **KEEP** + **CREATE** `LvSearchField` |
| Checkbox / radio / switch | **Missing** (native inputs used ad hoc) | Needed for filters, consent, settings | **CREATE** |
| Tabs | `Segmented` (pill group) | Underline tabs (R3) | **CREATE** `LvTabs` (keep `Segmented` for filters) |
| Badges / status | `LvBadge`, `LvStatusBadge`, `CountPill`, `status.ts` tone map | Same, quieter | **KEEP** |
| Avatars | **Missing** | Everywhere (rows, headers, timeline) | **CREATE** `LvAvatar` (+ initials fallback) |
| Tables | `LvTable` (sticky header, empty state) | Rarely used in target; lists preferred | **KEEP** (demote to Leadership/admin surfaces) |
| Lists / rows | `RecordList`, `RecordRow`, `AttentionItem` | Row = avatar + 2 lines + action button + chevron | **REDESIGN** `AttentionItem` → `LvActionRow` |
| Cards | `LvCard`, `Section`, `InversePanel` | Card with title row + optional "→" affordance | **KEEP** + add header-action slot |
| KPI | `KpiTile`, `Bars` | Counter row with icon tiles | **REDESIGN** → `LvCounter` (keep `KpiTile` for leadership) |
| Dropdowns / menus | **Missing** (no overflow menu primitive) | ⋮ overflow on profile header, row actions | **CREATE** `LvMenu` (sandbox-safe, no portal) |
| Tooltips | **Missing** | Light use | **CREATE** (or rely on `title` + visible text) |
| Dialogs / drawers | **Missing** in LV kit (host has its own) | Document preview, message editor | **CREATE** `LvModal` / `LvDrawer` (sandbox: inline, focus-trapped, no portal) |
| Pagination | **Missing** (lists are capped server-side) | "View all →" links | **CREATE** `LvViewAllLink` |
| Date picker | Native `date` inputs | Same | **KEEP** |
| Search | None in LV surfaces (host search only) | Prominent global search | **CREATE** (shell-level) |
| Filters | `Segmented` + server filters | Quiet chips | **CONSOLIDATE** |
| Breadcrumbs | None (host provides) | Not in target | **KEEP** (none) |
| Progress | Inline bar in onboarding section | Progress bar + pending list + CTA | **CREATE** `LvProgress` |
| Timeline | Bespoke list in `sections.tsx` | Dot-and-line with channel icons | **CREATE** `LvTimeline` (extract from Lead 360) |
| Charts | `Bars` only | Leadership only | **KEEP** |
| Notifications / toasts | Host snackbar; LV uses `InlineNotice` | Inline + bell count | **KEEP** |
| Loading / skeleton | `LoadingState` + `lv-skeleton` shimmer | Same | **KEEP** |
| Empty / error / forbidden | `EmptyState`, `ErrorState`, `ForbiddenState` | Same, warmer copy | **KEEP** (copy pass) |
| Icons | Twenty icons in nav only | Icon per row/channel/category | **CREATE** a sandbox-safe inline SVG icon set (~30 glyphs) |

**Summary: KEEP 17 · REDESIGN 5 · CREATE 12 · CONSOLIDATE 1.** The kit survives; it grows by about a third.

---

## 8. Component Audit — duplication, inconsistency, criticality

**Duplicated / near-duplicate patterns (consolidation candidates):**
- Section-with-title-and-hint appears as `Section` in the kit *and* as ad-hoc headed `<div>`s in `control-tower.front-component.tsx` and `lead-intelligence.tsx`.
- Record/attention rows exist in three shapes: `RecordRow`, `AttentionItem`, and bespoke rows inside Control Tower.
- Fact grids: `Facts` in the kit vs bespoke label/value pairs in `ecosystem-360/shared.tsx`.
- Timeline rendering exists only in `lead-360/sections.tsx` but is needed by partner/property/experience 360 → extract.
- Two AI surfaces (LV Copilot, Twenty Ask AI) — product-level duplication.

**Inconsistent:**
- Numbered section titles in Control Tower ("11 · Notification health") vs plain titles elsewhere.
- Some surfaces use `Segmented` for filtering, others use `LvSelect`.
- Sub-text sizes vary between 11 and 12 px across surfaces.

**Business-critical — DO NOT restyle without the owning test:**
- `capture-lead.tsx` + `capture-state.ts` — 20 methods, provenance, duplicate decision, assignment mode; the review step is the **human approval gate** for every non-manual capture.
- `document-review.front-component.tsx` — the verification decision UI (reason codes map 1:1 to server enums).
- `lead-governance.front-component.tsx` — lifecycle transitions carry required reasons; the allowed set comes from the server (`settableStatuses`).
- `onboarding-wizard` + `document-upload-field.tsx` — multi-part upload → register → review chain with `fieldMetadataId` coupling.
- `lead-intelligence.tsx` — accept/reject writes `humanDecision` to AI insights (audit-visible).

---

## 9. Navigation & Information Architecture Audit

**Current IA is object-centric** (26 doors). **Target IA is task-centric** (6 doors). Mapping:

| Target door | Serves today's | Fate of the current entry |
|---|---|---|
| **Today** | My Dashboard + `/ai/briefing` + SLAs + Notifications | Merge; Notifications becomes the bell; SLAs becomes a Today block + leadership view |
| **My Leads** | Leads (+ views: follow-up queue), Tasks, Interactions, Notes | Leads list keeps saved views; Tasks/Interactions/Notes become tabs/sections of a lead, reachable from Today |
| **Capture** | Capture lead + CSV import | Keep, redesign to tiles |
| **Onboarding** | Partner onboardings + Partners + Properties + Experiences | Onboarding becomes the door; ecosystem records reached from the partner profile and search |
| **Messages** | *(nothing today)* | New surface; needs transport decision |
| **Ask LV** | Copilot (+ Twenty Ask AI) | Consolidate to one |
| *(Settings)* | Settings, Workflows ×3, Audit, Permissions, Dashboards/Control Tower for leadership | Move under Settings / role-gated leadership view, per R2's "behind the scenes" strip |

**Known IA defects today:** 26 items exceed the ~7±2 scannable limit; three workflow entries are developer tools shown to everyone; "Opportunities" is a Twenty object with no LV meaning; "Dashboards" and "My Dashboard" and "Control Tower" are three dashboard-ish doors; "Interactions" and "Notes" duplicate what a lead page already shows.

---

## 10. Responsive UX Audit

**How responsiveness is implemented today:** entirely through the six grid classes in `LvStyles`, with breakpoints `sm 480 / md 768 / lg 1024`. Below `md` everything collapses to one column; `lv-hide-mobile` hides secondary content; the sidebar layout becomes a stack below `lg`.

| Viewport | Current behaviour | Target | Findings |
|---|---|---|---|
| Desktop ≥1280 | `LvPage maxWidth=1280`; two/three-column grids; Lead 360 uses a 1fr + 280–360 px rail | Same + right rail | **OK** |
| Laptop 1024–1280 | Rail active from `lg`; Control Tower's 12 sections become long | OK | **Minor**: Control Tower scroll length |
| Tablet 768–1024 | Rail drops to stacked; KPI grid `auto-fit minmax(150px)`; Lead 360 becomes a very long single column (13 sections) | Tabs keep it short | **Problem**: no tab structure to absorb the collapse |
| Mobile <768 | Single column everywhere; `lv-hide-mobile` content disappears entirely rather than relocating; Twenty's own record-index tables and filter bars are the host's and **do scroll horizontally**; `MobileHomePage` is undesigned | Capture designed phone-first; six doors as a bottom/stacked nav | **Problems**: (a) LV tables inside `LvTable` have no card-fallback at small widths; (b) hidden-not-moved content loses information; (c) capture's long review form is tall on a phone; (d) host tables are the worst offender and are not LV code |

**Touch targets:** `LvButton` small size and row chevrons are below the 44 px guidance in several surfaces; icon-only affordances do not exist yet but will need 44 px.

---

## 11. Accessibility Audit

**Already good (evidence in `kit.tsx`):** real `<button>` elements for anything clickable; visible `:focus-visible` rings using the `ring` token; status conveyed by text *and* colour (`LvStatusBadge` renders a label, not just a dot); headings for sections; labels bound to inputs via `useId` in `Field`; live regions for loading and error; `VisuallyHidden` helper; `@media (prefers-reduced-motion: reduce)` disables all animation; 14 component test files and `aria-`/`role` usage in 14 of the 25 TSX files.

**Findings to fix during migration:**

| # | Finding | Severity | Where |
|---|---|---|---|
| A1 | Body text at 13 px and sub-text at 11 px is below comfortable reading size for a data-dense product | High | tokens (`font.size`) — affects everything |
| A2 | Gold `#D4AF37` on ivory fails AA for normal text; `gold-ink #9A7A2E` exists but is not used consistently | High | kit + surfaces using accent text |
| A3 | No skip link into the LV surface from the host shell | Medium | shell |
| A4 | `lv-hide-mobile` removes content from the accessibility tree on small screens rather than relocating it | Medium | `LvStyles` |
| A5 | No focus trap / escape handling primitive — needed before any modal or drawer is introduced | Medium (blocking for new work) | kit (missing `LvModal`) |
| A6 | Tab order across a 13-section Lead 360 is very long with no landmarks (`<nav>`, `<main>`, `<aside>`) | Medium | Lead 360 |
| A7 | Chevron-only row affordances (planned) must carry an accessible name | Medium | new `LvActionRow` |
| A8 | Error messages are rendered in colour + text (good) but are not always `aria-describedby`-linked to the offending field | Low | `forms.tsx`, capture review |
| A9 | Emoji in target copy ("👋") needs `aria-hidden` when decorative | Low | Today |
| A10 | Dark-mode contrast for `gold-ink #D9BB5C` on `#15221A` surfaces not formally verified | Low | tokens |

*No WCAG audit tooling has been run against the product; the above is a code-level inspection.*

---

## 12. UI Performance Audit

| # | Finding | Impact | Evidence |
|---|---|---|---|
| P1 | Lead 360 renders **13 sections + a 30-item timeline in one pass**; every state change re-renders the whole surface (no memoisation boundaries in `sections.tsx`) | Slow interaction on a rich lead | `lead-360/sections.tsx` 701 LOC single component tree |
| P2 | `control-tower.front-component.tsx` (542 LOC) fetches and renders 12 sections in one payload; there is no lazy/tab split | Long first paint for management | `/control-tower/summary` returns 12 groups |
| P3 | Each LV surface injects its **own** `<style>` block (`LvStyles`); several surfaces on one page duplicate the CSS | Minor DOM/CSS bloat | `LvStyles` per component |
| P4 | Inline style objects are recreated on every render (`layout(theme)` called in render paths) | Minor GC churn | `theme.ts` `layout()` usage |
| P5 | No virtualisation anywhere; lists are capped server-side instead (safe today, brittle as data grows) | Latent | `openTasks`, `timeline` caps |
| P6 | Skeletons exist (`lv-skeleton`) but several surfaces render `LoadingState` (a spinner-ish block) instead, so layout shifts on load | Perceived slowness | dashboard, control tower |
| P7 | Route calls are sequential in some surfaces (e.g. insights then generate) rather than parallel | Slower first meaningful paint | `lead-intelligence.tsx` |
| P8 | Photography/avatars (target) will add image weight with no image component, sizing or lazy-loading strategy | Future | not yet built |

---

## 13. Technical Risk Assessment

| # | Risk | Severity | Detail / mitigation |
|---|---|---|---|
| **R-01** | **Sandbox constraints** — no Tailwind/CSS-in-JS/component library/portals inside LV surfaces | **Critical** | Every target pattern must be expressible as inline styles + one `<style>` block. Modals/menus must be inline and focus-trapped, not portalled. **Decide before Phase 1** whether the 6-door shell is built (a) by restyling the Twenty host (touches `twenty-front`, needs an image rebuild + deploy) or (b) as an LV "Today" page that fakes a shell (no deploy risk, weaker result) |
| **R-02** | **Navigation change touches the host package** | High | The 6 doors require editing `src/navigation/*` (app-side, safe) **and** hiding host sidebar sections (host-side, needs rebuild/redeploy of the image). Deployment path already proven (web:7/worker:6) but each rebuild is ~40 min + rollout |
| **R-03** | **Permission-sensitive UI** | High | `capabilities`/`lens` from `/leads/360`, `/dashboard/summary` etc. drive what renders. A redesign that stops reading `capabilities` would silently expose actions a role cannot perform (server would still refuse, but the UX would lie). Every migrated surface must keep the capability gate and its test |
| **R-04** | **Business-critical components** (capture review, document review, governance, onboarding upload) | High | Restyling must not change the enums, reason codes, `fieldMetadataId` coupling or the human-approval gates. Migrate these **last** within their phase and re-run their unit tests |
| **R-05** | **Messages door has no transport** | High (scope) | WhatsApp/Instagram sending is not integrated. Either scope Messages as read-only + draft + copy, or accept a separate integration project. Do not ship a "Send on WhatsApp" button that does not send |
| **R-06** | **Typography token change is global** | Medium | Raising the base size shifts every layout in both LV surfaces and (if tokens propagate) the host. Do it in Phase 0 with a visual sweep, never mid-migration |
| **R-07** | **`lv-theme.css` ↔ `tokens.ts` parity test** | Medium | A token change that updates only one side fails the unit test (by design). Keep editing `tokens.ts` only |
| **R-08** | **Two AI surfaces** | Medium | Consolidating Ask LV must not remove admin access to Twenty's agent tooling; hide by role, don't delete |
| **R-09** | **Page-layout tab coupling** | Medium | `lead-profile.page-layout.ts` encodes a Twenty quirk (tab position 1, not 0). Moving Lead 360 to a full page changes routing and any deep links |
| **R-10** | **Avatars/photos are not in the data model** | Medium | R1/R3/R4 rely on people photos and property images. `person.avatarUrl` exists in Twenty; **property/experience images are collected during onboarding (step 7) but are not surfaced**. Needs a small read path, not a schema change |
| **R-11** | **Saved views are UI** | Low | 25 view files define columns/filters; a redesign that ignores them will look inconsistent with the lists users saved |
| **R-12** | **Dark mode** | Low | Full dark token set exists and is tested; the reference boards are light-only. Dark must be re-checked after every token change or it will silently rot |

---

## 14. Screen-by-Screen Migration Matrix

| Screen | Current State | Target Reference | Gap | Priority | Dependencies | Risk |
|---|---|---|---|---|---|---|
| Shell / sidebar | 26 entries, 5 folders, Twenty chrome | R2 — 6 doors + Profile/Settings | IA collapse, top bar with search/bell/avatar | **P0** | Tokens; host-vs-app shell decision | R-01, R-02 |
| Global search | Host command menu (⌘K) | R2 — wide NL search bar | Placement, placeholder, NL phrasing | P0 | Shell | R-02 |
| Today | My Dashboard (7 analytic sections) | R1, R4-1 — attention list + counters + AI says | Composition, per-row actions, avatars, copy | **P0** | Shell, `LvActionRow`, `LvAvatar`, `LvCounter` | R-03 |
| Lead 360 → Profile | 13 sections in tab 1 of 7 | R3 — header + NBA + 5 tabs + 4 cards + rail | Structure, NBA banner, tabs, rail, chips, icons | **P1** | Today patterns, `LvTabs`, `LvTimeline`, `LvProgress` | R-03, R-09, P1 |
| Capture | 20-method segmented + long form | R4-2/3/4 — 5 tiles, extraction card, duplicate card | Tiles, result card, match %, phone-first | **P1** | `LvTiles`, icon set | R-04 |
| Duplicate step | Keys matched, decision buttons | R4-4 — match card + % + two actions | Similarity score display | P1 | Capture | R-04 |
| Onboarding wizard | 10 steps, save & resume | R3 card + R4 | Progress card, "Help Complete" entry, pill states | **P1** | `LvProgress` | R-04 |
| Document review | List + verify/reject + reasons | R3 Documents tab | Preview, quiet pills, reason UI restyle | **P1** | `LvModal` (preview) | R-04, A5 |
| Messages | **Does not exist** | R2 door 5, R4-5 | Whole surface + transport | **P1 (blocked)** | Transport decision | **R-05** |
| Intelligence | Separate tab, 747 LOC | R3 AI Insights card + "View full analysis" | Promote summary onto profile; detail behind link | P1 | Profile | R-03 |
| Ask LV | Copilot + Twenty Ask AI | R2 door 6, R5 | Consolidate, restyle, NL answers | **P2** | Shell | R-08 |
| Partner / Property / Experience 360 | Shared ecosystem components | R3 pattern applied | Reuse profile pattern | P2 | Profile pattern | R-10 |
| Control Tower | 12 numbered sections | Leadership role view | Re-frame, de-number, split | **P2** | Today patterns | P2 |
| Notification centre | List + mark read | Bell + panel | Becomes bell surface | P2 | Shell | — |
| Governance / Actions | Lifecycle + ownership + delete impact | Overflow menu on profile | Move into ⋮ menu | P2 | `LvMenu` | R-04 |
| Record index lists (Leads etc.) | Twenty tables + 25 saved views | R1 marks dense tables as the old way | Card/list mode for mobile, quieter columns | **P3** | Shell, views | R-11 |
| Settings | 21 host sections | R2 "behind the scenes" | Absorb Workflows/Audit/Permissions | P3 | Shell | R-02 |
| Mobile home | Undesigned host page | Mobile-friendly doors | Route to Today | P3 | Shell | — |

---

## 15. Component Migration Matrix

| Component | Current | Target | Action | Used By | Priority |
|---|---|---|---|---|---|
| Tokens (colour) | Full semantic set, light+dark | + 5 category tints | **CREATE** (extend) | everything | P0 |
| Tokens (type) | 11/12/13/18/24 | 6-step scale, larger base | **REDESIGN** | everything | P0 |
| Tokens (radius) | sm/md/lg | + xl, pill | **CREATE** | cards, tiles, pills | P0 |
| `LvStyles` | 6 grid classes | + rail + entry grid; relocate instead of hide | **REDESIGN** | all surfaces | P0 |
| `LvPage`, `PageHeader`, `Eyebrow` | Present | Profile header with avatar + actions | **REDESIGN** (`LvProfileHeader`) | profiles | P1 |
| `LvButton` | Variants/sizes/loading | + icon-leading, WhatsApp variant, icon-only | **REDESIGN** | all | P0 |
| `LvBadge`, `LvStatusBadge`, `CountPill` | Tone-mapped | Quieter pills | **KEEP** | all | — |
| `LvCard`, `Section` | Present | + header action slot ("→") | **REDESIGN** (minor) | all | P1 |
| `InversePanel` | Dark panel | Hero/photo strip | **REDESIGN** | Today, profiles | P1 |
| `KpiTile`, `Bars` | Charts/tiles | Leadership only | **KEEP** | Control Tower | P2 |
| `AttentionItem`, `RecordRow`, `RecordList` | Three row shapes | One row: avatar + 2 lines + action + chevron | **CONSOLIDATE** → `LvActionRow` | Today, profiles, lists | P0 |
| `LvTable` | Sticky header table | Demote; add card fallback <768 | **REDESIGN** | leadership, import | P2 |
| `Facts` | Label/value grid | About/Relationship cards | **KEEP** | profiles | P1 |
| `Segmented` | Pill group | Keep for filters | **KEEP** | capture, dashboards | — |
| `LvTabs` | **Missing** | Underline tabs (R3) | **CREATE** | profiles | P1 |
| `LvAvatar` | **Missing** | Rows, headers, timeline | **CREATE** | Today, profiles | P0 |
| `LvCounter` | **Missing** | "4 Calls" style | **CREATE** | Today | P0 |
| `LvTimeline` | Inline in Lead 360 | Dot-and-line + channel icons | **CREATE** (extract) | profiles | P1 |
| `LvProgress` | Inline bar | Progress + pending + CTA | **CREATE** | onboarding, profile | P1 |
| `LvMenu` (⋮) | **Missing** | Overflow actions | **CREATE** | profiles, rows | P1 |
| `LvModal` / `LvDrawer` | **Missing** | Document preview, message editor | **CREATE** | documents, messages | P1 |
| `LvSearchField` | **Missing** | Global + in-page search | **CREATE** | shell | P0 |
| `LvTiles` (capture methods) | `Segmented` | 5 big tiles | **CREATE** | capture | P1 |
| Icon set | Host icons only | ~30 inline SVG glyphs | **CREATE** | all | P0 |
| Checkbox / radio / switch | Ad hoc natives | Kit primitives | **CREATE** | filters, settings | P2 |
| `EmptyState`, `ErrorState`, `ForbiddenState`, `LoadingState`, `InlineNotice` | Present, accessible | Warmer copy | **KEEP** | all | P3 |
| `Field`, `LvInput`, `LvTextarea`, `LvSelect` | Present, labelled | + `aria-describedby` on errors | **KEEP** (+A8) | forms | P2 |
| `Disclosure` | Present | Keep | **KEEP** | dense sections | — |
| `Wordmark`, `Provenance`, `VisuallyHidden` | Present | Keep | **KEEP** | all | — |
| Twenty Ask AI chat | Host component | Hidden for non-admin | **REPLACE** (by Ask LV) | shell | P2 |

---

## 16. Recommended Migration Architecture

1. **One design system, two consumers.** Keep `tokens.ts` as the single source; keep the generated `--lv-*` block in `lv-theme.css` and the parity test. Everything new reads tokens — no literal colours in surfaces.
2. **Kit-first, screens-second.** A screen may only be migrated after the primitives it needs exist and are tested. This is what prevents "a collection of individually redesigned pages" (§12 of the brief).
3. **Pattern contracts.** Freeze five reusable patterns before page work: *page header*, *action row*, *card*, *tab set*, *right rail*. Every screen composes these; deviations require a kit change, not a local style.
4. **Server composition stays.** Surfaces keep rendering from one `callRoute` payload with `capabilities`/`lens`. No screen starts issuing its own GraphQL.
5. **Shell decision first.** Option A (restyle the Twenty host: real 6-door sidebar, real top bar) gives the target result and costs an image rebuild per change. Option B (LV "Today" page as a pseudo-shell, sidebar trimmed to 6 app-side entries) is deployable without touching `twenty-front` and gets ~70 % of the effect. **Recommendation: B first (cheap, immediate), A when the patterns are stable.**
6. **Copy is part of the system.** A `copy.ts` per module for the human voice ("Here's what needs your attention today") so tone is reviewable and translatable, not scattered in JSX.
7. **Nothing behind a flag that cannot be turned off.** Each migrated surface ships behind the existing page-layout indirection so a bad rollout is a layout revert, not a code revert.

---

## 17. Phase-Wise UI Migration Plan

*(No phase is implemented as part of this audit.)*

### PHASE 0 — Design foundations
- **Objective:** make the token layer and primitive layer able to express the reference system.
- **Screens affected:** none directly (visual sweep across all).
- **Components affected:** `tokens.ts`, `theme.ts`, `LvStyles`, `LvButton`, icon set, `LvAvatar`, `LvCounter`, `LvActionRow`, `LvSearchField`, radius/tint tokens.
- **Design system changes:** type scale (larger base), 5 category tints, `radius.xl`/`pill`, icon set, relocate-not-hide responsive rule.
- **Dependencies:** none.
- **Risks:** R-06 (global type change), R-07 (parity test), R-12 (dark mode).
- **Expected output:** extended kit + updated `lv-theme.css` block, all existing surfaces still rendering.
- **Validation:** kit unit tests; token/CSS parity test; dark-mode pass; visual sweep of all 13 surfaces at 3 widths; contrast check of gold/ink pairs (A2).

### PHASE 1 — Shell & navigation (the 6 doors)
- **Objective:** replace the 26-entry object menu with the six doors + top bar.
- **Screens affected:** sidebar, top bar, search entry, settings grouping, mobile home routing.
- **Components affected:** `src/navigation/*` (app), optionally `twenty-front` sidebar/top bar (host), `LvSearchField`.
- **Design system changes:** none new (consumes Phase 0).
- **Dependencies:** Phase 0; **the Option A/B shell decision**.
- **Risks:** R-01, R-02 (host rebuild + deploy), deep links to removed menu items.
- **Expected output:** six doors; Workflows/Audit/Permissions under Settings; one AI entry point visible per role.
- **Validation:** every role signs in and reaches its daily work in ≤2 clicks; no orphaned route; permissions unchanged; production smoke (`/healthz`, key routes) after any host rebuild.

### PHASE 2 — Today
- **Objective:** turn My Dashboard into the attention-first Today surface (R1).
- **Screens affected:** My Dashboard → Today; Notifications becomes the bell.
- **Components affected:** `my-dashboard.front-component.tsx`, `LvActionRow`, `LvCounter`, `LvAvatar`, AI-says block.
- **Design system changes:** none new.
- **Dependencies:** Phases 0–1. **No backend change** — `/dashboard/summary` + `/ai/briefing` already return attention items, counters and a headline.
- **Risks:** R-03 (lens/capability gating must survive), AI unavailability must degrade to a quiet state.
- **Expected output:** "Good morning, {name}" + 3 attention rows with primary actions + counters + AI summary.
- **Validation:** each of the 9 roles sees a correct, non-empty Today; AI-off state verified; 3 viewport widths; keyboard-only run-through.

### PHASE 3 — Profile (Lead 360 → the one screen)
- **Objective:** implement R3 as the canonical record workspace; reuse for partner/property/experience.
- **Screens affected:** Lead 360, Intelligence tab (folded in), Governance (into ⋮), Partner/Property/Experience 360.
- **Components affected:** `LvProfileHeader`, `LvTabs`, `LvTimeline`, `LvProgress`, `LvMenu`, `Facts`, `LvCard`.
- **Design system changes:** none new.
- **Dependencies:** Phases 0–2; page-layout change for the lead record page (R-09).
- **Risks:** R-03, R-04, R-09; the 13→4+5 reduction must not lose an action any role depends on (map every current section to its new home before coding).
- **Expected output:** header + NBA banner + 5 tabs + 4 cards + right rail; intelligence summarised on-page with "View full analysis".
- **Validation:** section-to-home mapping signed off; capability matrix tested per role; deep links preserved or redirected; Aaranya demo lead renders fully.

### PHASE 4 — Capture & Onboarding
- **Objective:** phone-first capture (R4) and the onboarding progress card + "Help Complete".
- **Screens affected:** Capture, CSV import, onboarding wizard, document review.
- **Components affected:** `LvTiles`, extraction result card, duplicate card with match %, `LvProgress`, `LvModal` (document preview).
- **Design system changes:** none new.
- **Dependencies:** Phases 0–3.
- **Risks:** **R-04 (highest)** — these are the approval gates; enums, reason codes and the upload chain must be untouched. Similarity % display requires the server to expose a score (currently key-based) → confirm before designing.
- **Expected output:** capture in ≤5 taps on a phone; verification decisions unchanged but calmer.
- **Validation:** full capture regression (all 20 methods), document lifecycle regression, upload chain test, mobile device pass.

### PHASE 5 — Messages & Ask LV
- **Objective:** the fifth and sixth doors.
- **Screens affected:** Messages (new), Ask LV (consolidated).
- **Components affected:** conversation list, message bubble, draft editor (`LvDrawer`), Copilot restyle.
- **Design system changes:** message bubble pattern.
- **Dependencies:** Phases 0–4; **transport decision (R-05)**.
- **Risks:** shipping a send button without a transport; duplicate AI entry points (R-08).
- **Expected output:** conversations + drafts in one place, clearly labelled as drafts if sending is not integrated.
- **Validation:** no action implies a capability the system lacks; role gating; AI-off state.

### PHASE 6 — Leadership, lists, responsive & accessibility polish
- **Objective:** Control Tower as a leadership view, list/table mobile fallback, copy pass, a11y fixes.
- **Screens affected:** Control Tower, record index lists + 25 saved views, settings, empty states.
- **Components affected:** `LvTable` card fallback, `KpiTile`, copy files, skip link, landmarks.
- **Dependencies:** all previous.
- **Risks:** R-11 (saved views), R-12 (dark mode drift).
- **Expected output:** consistent product; a11y findings A1–A10 closed.
- **Validation:** full keyboard pass, contrast report, 4 viewports, dark mode, all roles.

---

## 18. Phase Dependencies

```
Phase 0  Foundations ──► Phase 1  Shell & navigation ──► Phase 2  Today
                                                             │
                                                             ▼
                                               Phase 3  Profile (R3 pattern)
                                                             │
                                          ┌──────────────────┴──────────────────┐
                                          ▼                                     ▼
                              Phase 4  Capture & Onboarding        Phase 5  Messages & Ask LV
                                          └──────────────────┬──────────────────┘
                                                             ▼
                                        Phase 6  Leadership · lists · responsive · a11y
```

**Why each edge exists:** Phase 1 needs the primitives Phase 0 creates (search field, icons, avatar) or the shell will be built twice. Phase 2 must follow the shell because Today's framing (greeting, bell, doors) only makes sense inside it, and Today establishes the row/counter patterns Phase 3 reuses. Phase 3 must precede 4 and 5 because the profile defines the card/tab/rail contract that capture, onboarding and messages compose against. Phase 6 must be last: polish applied before the patterns freeze is polish done twice.

---

## 19. Validation Strategy

1. **Per-primitive:** unit tests in `src/modules/lv-core/ui/__tests__` (the kit already has this habit), including a token/CSS parity test and light+dark render.
2. **Per-surface:** the existing component tests must still pass unchanged where behaviour is unchanged; any changed assertion must be justified in the PR.
3. **Per-role:** a capability matrix run — sign in as each of the 9 roles and confirm the visible action set equals the server's `capabilities`.
4. **Regression on critical paths:** capture (20 methods) · duplicate decision · assignment · interaction logging · lifecycle transitions · onboarding step save/resume · document upload→register→review · AI accept/reject. These are the business gates (R-04).
5. **Visual:** 4 viewports (360 / 768 / 1280 / 1600) × light+dark, screenshots attached to each phase PR.
6. **Accessibility:** keyboard-only pass per surface; focus-visible check; contrast check of every new colour pair; `prefers-reduced-motion` verified.
7. **Demo data:** the Aaranya Trails & Stays dataset renders correctly on every migrated surface (it exercises interactions, onboarding, documents, AI insights, ecosystem links).
8. **Production:** after any host rebuild, `/healthz` + a route smoke (dashboard, briefing, Copilot, Lead 360) before declaring a phase done.

---

## 20. Definition of Done (per phase)

- Every new/changed component lives in the kit and reads tokens — **no literal colours, sizes or radii in a surface file**.
- The surface renders correctly in light and dark, at 4 widths, with keyboard only.
- Server contracts untouched: no new GraphQL from a surface, no changed route payload, `capabilities`/`lens` still gate every action.
- Tests: kit unit tests green; the surface's existing tests green or consciously updated; critical-path regression green.
- Copy reviewed against the reference voice (human, specific, no internal jargon such as "Ecosystem progression" or "11 · Notification health").
- No new accessibility finding; at least one prior finding closed.
- A screenshot pair (before/after) attached, and the phase's target board referenced.
- Deployment: if the host package changed, the image is rebuilt, rolled out, and the production smoke passes.

---

## 21. Risks & Recommendations

**Top five risks:** R-01 sandbox constraints · R-05 Messages without transport · R-03 permission-sensitive UI · R-04 business-critical approval gates · R-02 host rebuilds.

**Recommendations**

1. **Decide the shell strategy before anything else** (host restyle vs app-side pseudo-shell). Everything downstream depends on it. Recommended: app-side first.
2. **Do not rewrite the kit.** Extend it. The accessibility, dark mode and token-parity work in `kit.tsx`/`tokens.ts` is worth weeks and matches the target's visual language already.
3. **Treat the 26→6 navigation collapse as the product decision it is**, not a UI tweak: confirm with the founder which objects may disappear from the menu (People, Organisations, Opportunities, Notes, Interactions, SLAs, Workflows, Dashboards) before Phase 1.
4. **Scope Messages explicitly** as read-only + drafts until a WhatsApp/Instagram transport is funded; label it in the UI and in any founder artefact.
5. **Raise the type scale in Phase 0**, not later — it is the single change that will most move the product from "enterprise CRM" to "calm assistant", and it is cheapest before layouts are re-cut.
6. **Add avatars and property images early** (Phase 0/2). Photography is a large part of why the reference boards feel premium; the images already arrive via onboarding step 7 but are never shown.
7. **Keep one AI door.** Two AI entry points is the clearest contradiction with R2/R5.
8. **Freeze the five patterns** (header, action row, card, tabs, rail) in writing before Phase 3, and review every later screen against them — this is the only reliable defence against the "collection of redesigned pages" failure mode named in the brief.
9. **Budget for dark mode in every phase.** The reference boards are light-only; dark exists and is tested today. Either commit to maintaining it or decide, explicitly, to drop it.
10. **Do not start any phase without its regression list.** The CRM's value is its correctness; a beautiful surface that loses the duplicate gate or the document reason codes is a net loss.

---

### Appendix A — Evidence index

| Claim | Source |
|---|---|
| Sandbox rendering model, inline styles + injected `<style>` | `src/modules/lv-core/ui/kit.tsx:1–116` |
| Token set, brand constants, breakpoints | `src/modules/lv-core/ui/tokens.ts` (`LV_BREAKPOINT = { sm: 480, md: 768, lg: 1024 }`, line 199) |
| Theme shape, `space(n)=n*4`, font sizes | `src/modules/lv-core/ui/theme.ts` |
| Host stylesheet + parity with tokens | `packages/twenty-front/src/lv/lv-theme.css` (507 lines), imported `src/index.tsx:17` |
| Branding live in production | deployed `/assets/index-CNF2OzvO.css` contains `--t-color-blue:#1f4d3a`, `--lv-primary`, `Cinzel`, `Sora`; `/fonts/lv/sora-latin.woff2` → 200 |
| 26 navigation entries in 5 folders | `src/navigation/*.navigation-menu-item.ts` |
| Data access model, refusal handling | `src/modules/lv-core/utils/call-route.ts` |
| Lead page tab structure + Twenty quirk | `src/modules/lv-core/page-layouts/lead-profile.page-layout.ts` |
| Lead 360 section list (13) | `src/modules/lv-core/front-components/lead-360/sections.tsx` |
| Control Tower numbered sections | `src/modules/lv-dashboard/front-components/control-tower.front-component.tsx` |
| Roles (9) | `src/roles/*.ts` |
| Styling system of the host (Linaria, no Tailwind) | `packages/twenty-front/package.json` (`@linaria/core`, `@linaria/react`); no `tailwind.config` in the repo |
| Component LOC inventory | `find src -name "*.tsx" | xargs wc -l` — 8,740 total |
