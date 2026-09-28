# La Vivenzia CRM — screen inventory

**Purpose:** a complete count of the distinct surfaces in the CRM, so that one visual reference can be produced for each before the new UI direction is finalised.
**Source of truth:** the implemented CRM — 26 front components, 11 page layouts (45 tabs), 24 saved views, 34 HTTP routes, 16 objects, 8 roles, and the new `packages/lv-app` screens.
**Status:** read-only audit. No code, design or configuration was changed.

**Type key** — **Full** = a screen of its own · **Detail** = a record view reached from a list · **Step** = one stage of a multi-step flow · **Modal** = a dialog or sheet over a screen · **State** = a condition of a screen that looks different enough to need its own reference.

---

## 1. Workspace shell (4)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 1.1 | Sign in | Email + password against the workspace | Full |
| 1.2 | Six-door home | The entry cards: Today, My Leads, Capture, Onboarding, Messages, Ask LV | Full |
| 1.3 | Shell chrome — sidebar + top bar | Persistent frame: doors, global search, bell, avatar | Full (frame) |
| 1.4 | Account / session | Who is signed in, role, sign out | Full |

## 2. Today (5)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 2.1 | Today | Greeting, attention rows, counters, AI summary | Full |
| 2.2 | Today — empty queue | Nothing overdue or waiting | State |
| 2.3 | Today — AI unavailable | Headline written from CRM data, assistant off | State |
| 2.4 | Daily briefing detail | The ranked actions with their reasons | Full |
| 2.5 | Notifications panel | Bell: assignment, SLA, document, mention | Modal |

## 3. Leads (11)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 3.1 | My Leads — list | All relationships, each row with its action | Full |
| 3.2 | Leads — follow-up queue | The saved view for today's chasing | Full |
| 3.3 | Leads — empty / no match | No lead in this view | State |
| 3.4 | **Lead profile — Overview** | Identity header, next best action, About, Relationship | Detail |
| 3.5 | Lead profile — Onboarding tab | Progress, steps, pending documents | Detail |
| 3.6 | Lead profile — Conversations tab | Interactions with channel, outcome, sentiment | Detail |
| 3.7 | Lead profile — Documents tab | Files, type, verification status | Detail |
| 3.8 | Lead profile — Timeline tab | Everything that happened, in order | Detail |
| 3.9 | Lead profile — Intelligence | Score factors, health, duplicates, data quality, AI suggestions | Detail |
| 3.10 | Lead profile — Lifecycle & governance | Allowed transitions, ownership, delete impact | Detail |
| 3.11 | Lead profile — restricted | A role that may view but not act | State |

## 4. Lead actions (6 modals)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 4.1 | Log an interaction | Channel, direction, when, outcome, sentiment, summary | Modal |
| 4.2 | Create a follow-up | Title, due, priority | Modal |
| 4.3 | Add an internal note | Free text on the relationship | Modal |
| 4.4 | Change the status | Allowed statuses only, with reason | Modal |
| 4.5 | Assign / reassign owner | Assignment engine result or manual pick | Modal |
| 4.6 | Refusal / permission | The server refused, with the real reason | State |

## 5. Capture (10)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 5.1 | Capture — method tiles | Photo, Instagram, Voice, Website, Type (20 methods behind them) | Full |
| 5.2 | Capture — camera / upload | Taking or attaching the image | Step |
| 5.3 | Capture — extraction running | AI reading the card, screenshot or page | State |
| 5.4 | Capture — extracted fields | What was read, per-field confidence, edit before creating | Step |
| 5.5 | Capture — manual entry | The full form when nothing was extracted | Step |
| 5.6 | Capture — classification | Suggested category / sub-category with confidence | Step |
| 5.7 | Capture — duplicate found | Match card, similarity, link / merge / create anyway | Step |
| 5.8 | Capture — assignment & confirm | Who owns it, final confirmation | Step |
| 5.9 | Capture — created | The new LV ID, first task, what happens next | State |
| 5.10 | Capture — extraction unavailable | Handle kept, rest by hand | State |

## 6. Import (5)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 6.1 | Import — upload CSV | Choose the file | Step |
| 6.2 | Import — map columns | Column to field mapping | Step |
| 6.3 | Import — validate | Row-level errors and warnings | Step |
| 6.4 | Import — review & commit | What will be created, duplicates flagged | Step |
| 6.5 | Import — result | Created, skipped, failed | State |

## 7. Onboarding (9)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 7.1 | Onboarding list | Partners in onboarding, by stage | Full |
| 7.2 | Onboarding record — progress | Status, percentage, current step, health | Detail |
| 7.3 | Onboarding wizard — step | One of the ten steps, save & resume | Step |
| 7.4 | Onboarding — documents | Uploaded files, type, expiry | Detail |
| 7.5 | Document upload | Choosing and registering a file | Modal |
| 7.6 | Document review | Verify / reject with a reason code | Detail |
| 7.7 | Document preview | The file itself | Modal |
| 7.8 | Onboarding transition | Submit, request changes, approve, activate | Modal |
| 7.9 | Onboarding — waiting for partner | Nothing to do until they reply | State |

*The ten wizard steps (Basic information, About, Experience, Location, Pricing, Availability, Images, Documents, Policies, Final review) share one layout; one reference covers the pattern, and a second shows a file-upload step.*

## 8. Ecosystem — partners, properties, experiences (8)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 8.1 | Partners list | Prospective through active | Full |
| 8.2 | Partner 360 | Contact, organisation, lead, listings, readiness | Detail |
| 8.3 | Properties list | Stays, by status | Full |
| 8.4 | Property 360 | Capacity, rooms, pricing, amenities, manager | Detail |
| 8.5 | Experiences list | Experiences, by status | Full |
| 8.6 | Experience 360 | Duration, capacity, host, inclusions | Detail |
| 8.7 | Activation readiness | What blocks going live, reason by reason | Detail |
| 8.8 | Ecosystem transition | Approve, activate, pause, retire | Modal |

## 9. Messages (4) — *transport not integrated; drafts only*

| # | Screen | Purpose | Type |
|---|---|---|---|
| 9.1 | Conversations list | Every thread in one place | Full |
| 9.2 | Conversation thread | The exchange with one relationship | Detail |
| 9.3 | AI draft | The written message, editable before sending | Modal |
| 9.4 | Messages — nothing yet | No conversation logged | State |

## 10. Ask LV / intelligence (5)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 10.1 | Ask LV | The question box | Full |
| 10.2 | Ask LV — answer | Known / inferred / suggested, with the records cited | Full |
| 10.3 | Ask LV — confirmation | An action the answer proposes, before it runs | Modal |
| 10.4 | AI insight decision | Accept or reject a suggestion, recorded | Modal |
| 10.5 | AI unavailable / quota | Honest state when the assistant cannot answer | State |

## 11. Work management (6)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 11.1 | Tasks — today | Due now | Full |
| 11.2 | Tasks — overdue | Past due | Full |
| 11.3 | Tasks — upcoming | Scheduled | Full |
| 11.4 | Tasks — completed | Done | Full |
| 11.5 | Interactions log | Every conversation, filterable | Full |
| 11.6 | Notes | Internal notes across relationships | Full |

## 12. Leadership & operations (6)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 12.1 | Control Tower | Team workload, backlog, ecosystem, system health | Full |
| 12.2 | Pipeline & conversion | Lifecycle counts and movement | Full |
| 12.3 | SLA board | Clocks: on track, due, breached, escalated | Full |
| 12.4 | Channel & activity analytics | Where relationships come from and how they move | Full |
| 12.5 | Document verification backlog | What reviewers owe | Full |
| 12.6 | Audit trail | Who did what, when, and why | Full |

## 13. People & organisations (4)

| # | Screen | Purpose | Type |
|---|---|---|---|
| 13.1 | People list | Contacts behind the relationships | Full |
| 13.2 | Person detail | One contact, their leads and interactions | Detail |
| 13.3 | Organisations list | Partner businesses | Full |
| 13.4 | Organisation detail | One business, its people and listings | Detail |

## 14. Cross-cutting states (7)

Each one looks different enough on any screen to be worth a single shared reference.

| # | State | Where it appears |
|---|---|---|
| 14.1 | Loading / skeleton | Every screen's first paint |
| 14.2 | Empty | Lists and sections with nothing in them |
| 14.3 | Error / retry | A route failed |
| 14.4 | Forbidden | The role may not see this |
| 14.5 | Refusal | The server declined an action, with its reason |
| 14.6 | Offline / connection lost | The app cannot reach the server |
| 14.7 | Search — no results | Global search found nothing |

## 15. Administration — stays on Twenty (5, no new reference needed)

Settings, members & roles, workflows, API keys / integrations, admin panel. Administrators use Twenty's own screens; ordinary team members never see them. Listed for completeness only.

---

## Totals

| Module | Screens |
|---|---|
| 1. Workspace shell | 4 |
| 2. Today | 5 |
| 3. Leads | 11 |
| 4. Lead actions | 6 |
| 5. Capture | 10 |
| 6. Import | 5 |
| 7. Onboarding | 9 |
| 8. Ecosystem | 8 |
| 9. Messages | 4 |
| 10. Ask LV / intelligence | 5 |
| 11. Work management | 6 |
| 12. Leadership & operations | 6 |
| 13. People & organisations | 4 |
| 14. Cross-cutting states | 7 |
| **Total needing a visual reference** | **90** |
| 15. Administration (Twenty, excluded) | 5 |

**By type:** Full screens 38 · Detail views 15 · Steps 14 · Modals 12 · States 11.

**Mobile:** every one of the 90 also has a phone rendering. The boards draw capture as a phone, so a second reference is worth producing for the screens where the phone layout genuinely differs rather than merely narrows — the shell (bottom bar), Today, the lead profile (rail moves below), capture (steps 5.1–5.9), and the action modals (bottom sheets). That is **about 20 additional mobile references**, not 90.

---

## How to cut this down

Ninety references is more than a design pass needs. Three practical reductions:

1. **Twelve patterns cover most of it.** Page header, action row, card, tab set, right rail, list with filters, wizard step, upload, timeline, progress, dialog, empty/error state. Design those twelve properly and ~55 of the 90 are compositions rather than new designs.
2. **The eight that decide the product** — Sign in, Six-door home, Today, Lead profile (Overview), Capture (extracted fields), Capture (duplicate), Onboarding document review, Control Tower. If these eight are right, the rest follow.
3. **Twelve are already built and running** in `packages/lv-app` (sign in, home, Today, My Leads, lead profile with five tabs, account, and four action modals) — they can be photographed rather than drawn.

**Recommended set to commission: 20 references** — the 8 decisive screens above, 7 cross-cutting states, and 5 phone renderings — rather than 90.
