# La Vivenzia CRM — the 20 visual references

**Why twenty and not ninety.** `docs/UI-SCREEN-INVENTORY.md` counts 90 surfaces. Most of them are the same twelve patterns arranged differently. These twenty references pin down every pattern, every state and every phone behaviour the other seventy inherit; drawing the rest would be drawing the same header, the same row and the same card again.

**Source of truth:** the implemented CRM. Every reference below names the route and the component that exists today.
**Status:** read-only. No code, UI, configuration or design was changed.

**Two codebases appear in the "component" column** — screens already rebuilt live in `packages/lv-app` (the new front-end); screens not yet rebuilt still live in `packages/twenty-apps/internal/lavivenzia-crm` (marked *legacy*). Both are the same functionality; the reference is drawn for the new front-end.

---

## A. Eight decisive desktop screens

### A1 — Sign in
| | |
|---|---|
| **Route / component** | `/` when signed out · `packages/lv-app/src/screens/SignInScreen.tsx` |
| **Functionality** | Email + password against the workspace (Twenty's own credential mutation); shows the server's refusal verbatim ("Wrong password", origin not allowed) |
| **Pattern inherited by** | Any future auth surface: password reset, invitation accept, MFA challenge, expired-session return, workspace picker — **4–5 screens** |
| **Device** | Desktop (split: form left, photograph right) |
| **Why in the set** | It is the first impression of the product and the only screen with no chrome around it. It fixes the brand lockup, the form field, the primary button and the error treatment that every other screen reuses |

### A2 — Six-door home
| | |
|---|---|
| **Route / component** | `/` · `packages/lv-app/src/screens/HomeScreen.tsx` + `src/design/shell.tsx` (`LvShell`, `LvEntryGrid`, `LvHero`) |
| **Functionality** | The navigation contract: Today · My Leads · Capture · Onboarding · Messages · Ask LV, with the greeting hero, global search, bell and avatar |
| **Pattern inherited by** | The shell wraps **all 38 full screens**; the entry card also governs any future door or dashboard tile |
| **Device** | Desktop |
| **Why in the set** | This is the single screen the CTO's complaint was about — it decides whether the product reads as simple. Everything else is drawn inside it |

### A3 — Today
| | |
|---|---|
| **Route / component** | `/today` · `packages/lv-app/src/screens/TodayScreen.tsx` · data from `/ai/briefing` and `/dashboard/summary` |
| **Functionality** | Greeting, "N things need your attention" with a per-row action (Call / Review / WhatsApp), Today's work counters, the AI summary line |
| **Pattern inherited by** | Action row and counter appear on **My Leads, Messages, Notifications, the related rails, SLA board, follow-up queues** — **~15 screens** |
| **Device** | Desktop |
| **Why in the set** | It is the landing screen and the home of the action row — the one component the reference boards repeat most |

### A4 — Lead profile · Overview
| | |
|---|---|
| **Route / component** | `/leads/:leadId` · `packages/lv-app/src/screens/ProfileScreen.tsx` + `src/design/profile.tsx` · data from `/leads/360` |
| **Functionality** | Identity header with status and one-click Call / WhatsApp, the Next Best Action banner with its reason, five tabs, About / Relationship / Onboarding / AI cards, timeline and related rails |
| **Pattern inherited by** | **Partner 360, Property 360, Experience 360, Person and Organisation detail, Onboarding record, the other four lead tabs** — **~12 screens** |
| **Device** | Desktop |
| **Why in the set** | The board calls it "the one screen that defines the CRM". It fixes the header, the recommendation banner, the tab set, the card and the rail in one drawing |

### A5 — Capture · extracted information
| | |
|---|---|
| **Route / component** | Capture flow phase `REVIEW` · *legacy* `.../lv-capture/front-components/capture-lead/capture-lead.tsx` (state machine `capture-state.ts`, phases `CHOOSE → INPUT → EXTRACTING → REVIEW → CHECKING → DECIDE → CREATING → SUCCESS`) · routes `/capture/extract`, `/capture/preflight` |
| **Functionality** | What the AI read from a visiting card, screenshot, Instagram handle or website — field by field, with confidence — and the human confirmation before anything is created |
| **Pattern inherited by** | The extracted-field list, confidence chip and "looks right?" confirmation carry to **capture phases CHOOSE / INPUT / CREATING / SUCCESS, the import mapping and validation steps, and the AI suggestion cards** — **~10 screens** |
| **Device** | Desktop (phone version is M4) |
| **Why in the set** | It is the product's promise — "no manual data entry" — and the only screen where a machine's output is handed to a person for approval. The confidence and edit affordances need deciding once |

### A6 — Capture · duplicate detection
| | |
|---|---|
| **Route / component** | Capture flow phase `DECIDE` · same component · route `/capture/preflight` (match) then `/capture/create` |
| **Functionality** | A possible match against an existing lead or partner, with what matched, and three explicit choices: view existing, link, or create anyway |
| **Pattern inherited by** | Every "we found something, you decide" moment: **merge, link partner to lead, re-assignment conflict, import duplicate rows, delete-impact** — **~6 screens** |
| **Device** | Desktop |
| **Why in the set** | It is the clearest example of the rule that **AI suggests and a person decides**. Getting its tone right sets how every other decision moment looks |

### A7 — Onboarding · document review
| | |
|---|---|
| **Route / component** | Onboarding record, Document review tab · *legacy* `.../lv-onboarding/front-components/document-review.front-component.tsx` · routes `/onboarding/documents/review`, `/onboarding/transition` |
| **Functionality** | Each uploaded file with its type, expiry and status (Pending → Under review → Verified / Rejected), and the reviewer's decision with a reason code |
| **Pattern inherited by** | **Document upload, document preview, onboarding steps, activation readiness, approval gates, the Documents tab on every profile** — **~9 screens** |
| **Device** | Desktop |
| **Why in the set** | The only screen where a person makes a decision with consequences for a partner's livelihood. It must look serious, show the evidence, and make the reason mandatory |

### A8 — Control Tower
| | |
|---|---|
| **Route / component** | *legacy* `.../lv-dashboard/front-components/control-tower.front-component.tsx` · route `/control-tower/summary` |
| **Functionality** | The management view: team workload, backlog, SLA health, ecosystem counts, document queue, notification and system health |
| **Pattern inherited by** | **Pipeline & conversion, SLA board, channel analytics, verification backlog, audit trail, My Dashboard's analytical sections** — **~8 screens** |
| **Device** | Desktop |
| **Why in the set** | It is the only dense, data-heavy screen in the product. The reference decides how density is handled *without* returning to the "outdated admin panel" look the CTO rejected |

## B. Seven UI states

Each is a shared component today, so one reference governs every screen that uses it.

### B1 — Loading / skeleton
| | |
|---|---|
| **Route / component** | `LoadingState` and the `.lv-skeleton` shimmer · `packages/lv-app/src/design/kit.tsx` |
| **Functionality** | First paint while a route is fetched; announced to screen readers |
| **Inherited by** | **All 38 full screens and 15 detail views** |
| **Device** | Both |
| **Why** | Every screen shows it first. Skeleton-versus-spinner is a whole-product decision, not a per-screen one |

### B2 — Empty
| | |
|---|---|
| **Route / component** | `EmptyState` · `src/design/kit.tsx`; live example: Today with a clear queue (`TodayScreen.tsx`) |
| **Functionality** | Nothing to show — and whether that is good news ("your queue is clear") or a prompt to act |
| **Inherited by** | **~20 lists and sections** |
| **Device** | Both |
| **Why** | A new workspace is empty everywhere; on a young CRM this is the most-seen state of all |

### B3 — Error / retry
| | |
|---|---|
| **Route / component** | `ErrorState` · `src/design/kit.tsx`; raised by `callRoute` in `src/api/client.ts` |
| **Functionality** | A route failed; the real message is shown with a way back |
| **Inherited by** | **Every screen that calls the server — all 38** |
| **Device** | Both |
| **Why** | The product's honesty rule lives here: a refusal shows its reason rather than a generic apology |

### B4 — Success / completed
| | |
|---|---|
| **Route / component** | Capture phase `SUCCESS` (*legacy* `capture-lead.tsx`); onboarding `ACTIVATED` via `/onboarding/transition`; `InlineNotice` (`src/design/kit.tsx`) |
| **Functionality** | The work landed: the new LV ID, the first task created, what happens next |
| **Inherited by** | **Capture, import, onboarding activation, document verified, interaction logged, task created** — **~8 moments** |
| **Device** | Both |
| **Why** | It is the only moment the product celebrates, and the boards lean on it ("Great work, Saumay!"). Overdo it and the product looks cheap; skip it and the work feels unacknowledged |

### B5 — Confirmation / destructive action
| | |
|---|---|
| **Route / component** | `LvModal` + `LvModalFooter` · `src/design/overlay.tsx`; consequence data from `/records/delete-impact`; reason-required transitions via `/leads/lifecycle` |
| **Functionality** | Before something irreversible: what will happen, what is linked to it, and a required reason |
| **Inherited by** | **Delete, reject a document, change status negatively, reassign, offboard a partner, permanent delete** — **~7 moments** |
| **Device** | Both (bottom sheet on a phone — see M5) |
| **Why** | These are the moments that can damage data or a relationship. They need a distinct, slower visual language than an ordinary dialog |

### B6 — AI processing / intelligence
| | |
|---|---|
| **Route / component** | Capture phase `EXTRACTING`; `TodayScreen.tsx` "AI says"; *legacy* `lead-intelligence.tsx` · routes `/ai/lead/generate`, `/ai/lead/insights`, `/ai/briefing` |
| **Functionality** | The assistant is working, has answered, or is unavailable (quota, provider down) — always labelled as a suggestion, never as fact |
| **Inherited by** | **Capture extraction, classification, conversation summaries, drafts, briefing, Ask LV, insight accept/reject** — **~10 surfaces** |
| **Device** | Both |
| **Why** | AI is the product's centre and its biggest trust risk. One reference must settle how a suggestion is marked, how waiting looks, and how "the assistant cannot answer" is said without breaking the screen |

### B7 — No results / filtered
| | |
|---|---|
| **Route / component** | `packages/lv-app/src/screens/LeadsScreen.tsx` — the "No lead matches this view" branch with the filter chips still visible |
| **Functionality** | The data exists, this filter or search just does not match it — and the way back |
| **Inherited by** | **Every list with filters or search: leads, tasks, interactions, partners, properties, experiences, onboarding, global search** — **~12 screens** |
| **Device** | Both |
| **Why** | Different from empty: the answer is "change the filter", not "add data". Confusing the two is how lists lose people |

## C. Five mobile references

### M1 — Mobile shell / navigation
| | |
|---|---|
| **Route / component** | `src/design/shell.tsx` with the phone rules in `src/design/kit.tsx` (`LvStyles`): the 240px rail becomes a fixed bottom bar, icon over label, logo and Profile/Settings hidden |
| **Functionality** | Reaching the six doors with a thumb |
| **Inherited by** | **All 38 full screens on a phone** |
| **Device** | Mobile |
| **Why** | The layout genuinely changes here rather than merely narrowing — and it decides how much vertical space every other mobile screen has |

### M2 — Mobile Today
| | |
|---|---|
| **Route / component** | `/today` · `TodayScreen.tsx` at ≤767px — hero, stacked attention rows, counters in one column |
| **Functionality** | The same day's work, one-handed |
| **Inherited by** | **My Leads, Messages, Notifications, task queues on a phone** — **~10 screens** |
| **Device** | Mobile |
| **Why** | The action row has to keep its button and its chevron on a 360px screen without the text collapsing. Solve it once |

### M3 — Mobile lead profile
| | |
|---|---|
| **Route / component** | `/leads/:leadId` · `ProfileScreen.tsx` at ≤767px — header wraps, tabs scroll horizontally, the timeline and related rails move below the content |
| **Functionality** | The whole relationship on a phone, in the field |
| **Inherited by** | **Partner / Property / Experience 360, Onboarding record, Person and Organisation detail on a phone** — **~8 screens** |
| **Device** | Mobile |
| **Why** | This is what an Experience Hunter actually holds while standing at a property. If one screen must be right on a phone, it is this one |

### M4 — Mobile capture flow
| | |
|---|---|
| **Route / component** | *legacy* `capture-lead.tsx`, phases `CHOOSE → INPUT → EXTRACTING → REVIEW` on a phone · routes `/capture/extract`, `/capture/preflight`, `/capture/create` |
| **Functionality** | Photograph a visiting card or paste a handle and have a lead in under a minute |
| **Inherited by** | **All ten capture screens and the five import steps on a phone** |
| **Device** | Mobile |
| **Why** | The reference board draws capture *as a phone*. It is the one flow designed mobile-first, so the phone version is the source and the desktop is the adaptation |

### M5 — Mobile modal / bottom sheet
| | |
|---|---|
| **Route / component** | `LvModal` with `.lv-modal-panel` phone rules (`src/design/kit.tsx`): docks to the bottom, full width, rounded top, ≤92vh; live examples in `src/screens/profile/LeadActions.tsx` |
| **Functionality** | Logging an interaction, creating a follow-up, changing status, adding a note — from a phone, above the keyboard |
| **Inherited by** | **All 12 modals** |
| **Device** | Mobile |
| **Why** | Every write action on a phone goes through this shape. It also has to survive the on-screen keyboard, which a centred dialog does not |

---

## Coverage check

| Reference set | Screens it settles |
|---|---|
| 8 decisive desktop screens | ~55 of the 90, through the twelve shared patterns |
| 7 states | the 11 state variants, on every screen |
| 5 mobile | the ~20 screens whose phone layout genuinely differs |
| **Total drawn** | **20** — covering **all 90** |

## Notes for whoever draws these

- **Twelve of the twenty already exist and run** — A1, A2, A3, A4, B1, B2, B3, B6 (partly), B7, M1, M2, M5 are live in `packages/lv-app` on `http://localhost:3200`. They can be screenshotted and marked up rather than drawn from nothing.
- **Eight are still on the legacy surface** — A5, A6, A7, A8, B4, B5 (partly), M3 (partly), M4. Those are the ones that most need a drawing, because they are being rebuilt next.
- **Three things the boards show that the data does not have yet**: a person's photograph, a rating like "4.8 (32)", and Instagram follower counts. Photo and rating fields were approved for adding; the Instagram counts cannot be sourced. Whoever draws A4 and M3 should know which of those three will be real.
