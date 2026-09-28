# La Vivenzia CRM — exact-match UI rebuild plan

**Goal:** the CRM looks and behaves exactly like the five approved reference boards in `new ui ux ref images/`. Not "inspired by" — the same layout, the same navigation, the same screens, the same interaction model.
**Constraint:** no backend rewrite. Business logic, permissions, audit, SLA, AI and the 34 LV routes stay as they are.
**Status:** plan only — nothing in this document is implemented yet.

---

## 1. What "exact" means technically

The boards show a product with **its own shell**: a light sidebar with a logo and six items, a top bar with one wide search, and a content area with no other chrome. Today the CRM is the opposite — LV screens are widgets *inside* Twenty's record pages, wrapped in Twenty's sidebar, tabs and headers.

So an exact match requires three structural changes:

| # | Change | Where | Why it is unavoidable |
|---|---|---|---|
| **S1** | The LV app **owns the whole viewport** — one full-bleed component renders sidebar + top bar + content | `twenty-apps/…/lavivenzia-crm` page layouts | The boards have no Twenty chrome anywhere |
| **S2** | Twenty's own sidebar, top bar and record-page headers are **hidden** for LV routes | `twenty-front` (fork — we already own it) | Otherwise two navigations stack on top of each other |
| **S3** | Navigation between the six doors happens **inside** the LV shell | LV app state, not Twenty routing | The sandbox has no router; the doors switch a view, not a URL |

Everything else — data, permissions, AI, audit — stays exactly as built. **No route, no object, no logic function changes.**

## 2. Screens to build (from the boards)

| # | Screen | Board | Replaces today |
|---|---|---|---|
| 1 | **Today** — greeting, "N things need your attention", Today's work counters, AI says | R1, R2, R4-1 | My Dashboard |
| 2 | **Home / six entry cards** — 3×2 tinted cards | R2 | — (new) |
| 3 | **My Leads** — list of relationships, each row with its action | R2 door 2 | Leads record index (Twenty table) |
| 4 | **Profile (lead / partner)** — identity header, Next Best Action, 5 tabs, 4 cards, timeline + related rails | **R3** | Lead 360 inside a Twenty record page |
| 5 | **Capture** — 5 method tiles → AI extracted card → duplicate card → create | R4-2/3/4 | Capture lead form |
| 6 | **Onboarding** — progress, documents, review | R3 card + R4 | Onboarding wizard + document review |
| 7 | **Messages** — conversations, AI draft bubble, send/edit | R2 door 5, R4-5 | — (does not exist) |
| 8 | **Ask LV** — one question box, action-shaped answers | R2 door 6, R5 | Copilot |

Supporting, not on the boards but required: Profile/Settings (bottom of sidebar), notifications panel (bell), and everything currently under Insights/Administration, reached from Settings.

## 3. Design specification extracted from the boards

These are the values every screen will be built from. They are not negotiable per-screen; a change means changing the token.

**Layout**
- Sidebar: 240px, surface `#FFFFFF`, 1px right border, logo block 72px tall, items 44px tall with 12px radius, active item = mint wash + pine text, icons 20px, Profile + Settings pinned to the bottom.
- Top bar: 64px, search pill 44px tall / 12px radius / max 560px wide, bell with red count dot, avatar 36px + greeting.
- Content: 32px padding, max 1280px, 24px gap between blocks.
- Entry cards: 3 columns × 2 rows, 20px gap, each card 16px radius, tinted ground, icon tile 44px, title 18px, one-line description 14px, coloured chevron bottom-right.

**Type** (Sora; Cinzel only for the wordmark)
| Role | Size / weight |
|---|---|
| Screen greeting | 28px / 600 |
| Card & section title | 18px / 600 |
| Row title (person name) | 16px / 600 |
| Body, descriptions | 14–15px / 400 |
| Meta, timestamps | 13px / 400 |
| Micro label | 12px / 500, **sentence case — no ALL CAPS** |

**Colour**
- Ground `#FFFFFF` / page `#F7F6F2`; primary pine `#1F4D3A` (buttons, active nav); WhatsApp green `#25D366` only on WhatsApp actions; overdue red for the urgency line; **gold is not used on buttons** — accent only.
- Category tints (already added in Step 1): mint, blue, peach, lavender, pink.

**Depth & shape** — cards 16px radius + `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(31,77,58,.06)`; pills fully round; no gradients, no glass.

**Rows** — avatar 40px + name + context line + red urgency line + action button + chevron. This one pattern repeats on Today, My Leads, Messages and the related rails.

## 4. Component library (built once, used everywhere)

Done in Step 1: `LvAvatar`, `LvIconTile`, `LvActionRow`, `LvCounter`, `LvTabs`, `LvSearchField`, `LvProgress`, 36 icons, tints, type scale.

Still needed: `LvShell` (sidebar + top bar + content slot), `LvSidebarItem`, `LvTopBar`, `LvEntryCard`, `LvProfileHeader`, `LvNextBestAction`, `LvTimeline`, `LvRelatedList`, `LvChip`, `LvMessageBubble`, `LvMethodTile`, `LvExtractedField`, `LvDuplicateCard`, `LvModal`, `LvDrawer`, `LvMenu`, `LvEmpty`.

## 5. Data mapping — what the boards show vs what the CRM has

Everything below is already returned by existing routes unless marked otherwise.

| Board element | Source | Status |
|---|---|---|
| Greeting, date | session + clock | ✅ |
| "N things need your attention" rows | `/ai/briefing` → `topActions[]`, `/dashboard/summary` → `actions` | ✅ |
| Today's work counters (Calls, WhatsApps, Onboardings, Overdue) | `/dashboard/summary` → `channels`, `actions` | ✅ |
| "AI says" paragraph | `/ai/briefing` → `headline` | ✅ |
| Lead rows (name, category, location, status) | `/leads/360`, lead list | ✅ |
| Next Best Action + reason | `/leads/360` → `intelligence.nextBestAction` | ✅ |
| Onboarding % + pending documents | `/leads/360` → `onboarding` | ✅ |
| Timeline with channel icons | `/leads/360` → `timeline[]` | ✅ |
| Related counts (Experiences, Documents, Tasks) | `/leads/360` → `ecosystem`, `openTasks` | ✅ |
| AI insights card | `/leads/360` → `intelligence` | ✅ |
| AI drafted message | `/ai/lead/generate` type `DRAFT` | ✅ |
| Capture methods, AI extraction, duplicate decision | `/capture/*` | ✅ |
| **Person photo / avatar** | Twenty `person.avatarUrl` exists; **leads have no photo field** | ⚠️ add a field, or initials |
| **Rating "4.8 (32)"** | not in the data model | ⚠️ add fields or drop from the design |
| **"8 years exp"** | collected in onboarding step 2, not on the lead | ⚠️ surface from onboarding answers |
| **Instagram stats (684 posts, 12.4K followers)** | not collected — Instagram is not scraped | ❌ cannot match; show the handle only |
| **"87% Match" duplicate score** | duplicates match on keys, no percentage | ⚠️ compute a score (small server change) or show "Possible match" |
| **Send on WhatsApp** | no messaging transport in V1 | ❌ button drafts + copies; sending needs an integration |
| **Voice note capture** | not built | ❌ out of scope unless added |

The four ⚠️ items are small; the three ❌ items are the only places where "exact" is impossible without new capability — each one needs your decision (see §8).

## 6. Phases

| Phase | Work | Days |
|---|---|---|
| **P0 — Foundations** *(done)* | type scale, tints, radius, 36 icons, 7 primitives, tests | ✅ |
| **P1 — The shell** | `LvShell`: sidebar (6 doors), top bar (search, bell, avatar), content slot, in-shell navigation; Twenty chrome hidden for LV routes | 3 |
| **P2 — Today + entry cards** | attention rows with per-row actions, counters, AI says, 3×2 entry cards | 2 |
| **P3 — Profile (R3)** | identity header, NBA banner, 5 tabs, About/Relationship/Onboarding/AI cards, timeline + related rails | 4 |
| **P4 — My Leads + Capture** | list with action rows and filters; 5 method tiles, extraction card, duplicate card | 3 |
| **P5 — Onboarding + Messages** | progress + documents + review; conversation list, draft bubble, edit/copy | 3 |
| **P6 — Ask LV + polish** | question box, action answers; responsive pass, accessibility pass, side-by-side review against every board | 3 |
| | **Total** | **~18 working days** |

Each phase ends with screenshots taken at the board's own viewport and placed **side by side** with the reference image. A phase is not done until the two match.

## 7. How it is verified

1. Side-by-side screenshot against the board, at 1440px and at phone width.
2. Every value read from a token — no literal colours or sizes in screens.
3. Role check: all nine roles see a correct screen; `capabilities` still gates every action.
4. Regression: capture, duplicate decision, lifecycle, onboarding, document review, AI accept/reject.
5. Everything runs locally on the dev workspace with real data; AWS stays off until you approve the result.

## 8. Decisions — taken 27 September 2026

| # | Decision | Consequence |
|---|---|---|
| 1 | **Sidebar is the six doors only** — Today, My Leads, Capture, Onboarding, Messages, Ask LV, plus Profile and Settings at the bottom | Reverses the earlier "nothing is removed" instruction. Nothing is deleted from the product: the previous 26 entries stay reachable through Settings and global search, and every object, view and route keeps working |
| 2 | **Photo fields are added** to lead and partner; property/experience images (onboarding step 7) are surfaced | Small metadata change; real faces and property photos on every board that shows one. Initials remain the fallback when a record has no photo |
| 3 | **Rating and review-count fields are added**; years of experience is read from the onboarding answers | The profile header matches the board line "4.8 (32) · 8 years exp". Fields start empty until data exists |

Still open, and the only three places where an exact match is not possible today:

4. **WhatsApp sending** — the button drafts and copies the message; real sending needs a WhatsApp Business API integration that is not in V1.
5. **Instagram statistics** (posts / followers) — Instagram is not scraped, so the capture card shows the handle without the counts.
6. **Voice capture** — the fifth capture tile has no speech-to-text behind it yet.

Each of these is shown in the UI exactly as the board draws it, but with honest behaviour (a draft that is copied rather than sent, a handle without counts, a tile that is visibly unavailable) until the capability exists.

## 9. Risks

- **R-1 Twenty chrome hiding** touches the host package; every change needs an image rebuild when we eventually redeploy. Locally it is free.
- **R-2 In-shell navigation** means the browser back button no longer maps to CRM screens unless we sync the URL; plan is to mirror the active door into the URL so links keep working.
- **R-3 The sandbox** forbids Tailwind/component libraries; every pixel is inline styles + one injected stylesheet. This is already how the kit works, so it is a constraint, not a blocker.
- **R-4 Twenty's own screens** (settings, workflows, admin) will still look like Twenty. The boards do not cover them; they stay behind Settings.
- **R-5 Scope** — the boards show a finished product; the CRM has capabilities the boards do not show (SLA, governance, Control Tower, import). Those get a home in the new shell rather than disappearing.
