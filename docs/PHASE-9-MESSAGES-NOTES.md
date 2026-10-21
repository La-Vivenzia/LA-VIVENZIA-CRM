# Phase 9 — Messages

Built on the Phase 0–8 system. No new visual language.

Screens: `packages/lv-app/src/screens/MessagesScreen.tsx`,
`screens/messages/{parts,draft}.tsx`. Contracts: `api/messages.ts`.

---

## What a message is here, and what it is not

This needs saying first, because the word misleads.

**La Vivenzia sends and receives nothing.** No mail, no chat, no transport of
any kind is integrated — the screen inventory says so in its own heading for
section 9: *"transport not integrated; drafts only"*.

An `lvInteraction` is the **record of a contact that already happened**: its
channel, its direction, what was said, what was objected to, what was
committed to and what happens next. There is no message body, no delivery
state, no read receipt and no inbox that fills by itself. Every row got there
because a person logged it.

So a *conversation* is the run of interactions with one lead, and the workflow
the backend actually supports is:

```
INBOX ──▶ THREAD ──▶ DRAFT ──▶ (you send it yourself) ──▶ LOG
```

The draft route confirms this in its own reply: it returns
`transport: 'MANUAL_EMAIL'` or `'NONE'`. **There is therefore no composer**,
and none was built. A Send button here would do nothing, and a screen that
offers one is lying about the product.

---

## The four screens

| # | Screen | Where |
| --- | --- | --- |
| 9.1 | Conversations list | `/messages` |
| 9.2 | Conversation thread | `/messages/:leadId` |
| 9.3 | AI draft | `DraftDialog`, over either |
| 9.4 | Nothing yet | `NothingYet`, when no interaction exists at all |

The thread is a real route rather than a panel state, so the browser's Back
button moves between inbox and thread on a phone — the only inbox model that
works on a small screen — and a colleague can be sent straight to a thread.
From 1024px both columns are on screen at once and the same URLs still
address them.

---

## What the data supports, and what it does not

| The brief asks for | Here |
| --- | --- |
| unread state | **Does not exist.** The closest honest signal is *the last contact came from them and nothing has gone back*, which the backend already treats as the one case worth notifying the owner about (`on-interaction-created` raises `LEAD_REPLIED`). Shown as **Waiting on us**, by weight rather than a dot. |
| search | Client-side over the loaded page — name, reference, place and what was said. |
| filters | Everything / Waiting on us / Mine / Had a reply. Each derives from a real field. |
| sorting | Most recent contact first. |
| pagination | One read of the most recent 300 interactions, folded into threads here. When that cap is hit the inbox says so and points at the lead's own timeline. |
| assignment | The lead's owner, shown. Not changeable from Messages — that is Lead Actions. |
| status | The lead's status, shown on the thread header. |
| attachments | **Not supported.** `lvInteraction` has no attachment field. Nothing was invented. |
| message status | **Not supported**, and cannot be: nothing is sent. |

An **internal note** is excluded from "waiting on us", because the backend
excludes it from last-contact and from the SLA clock — it is a record for the
team, not contact with the partner.

---

## The composer question

There is no composer. What exists instead:

- **Draft a message** (9.3) calls `POST /ai/lead/generate { type: 'DRAFT' }`
  with a kind, a tone and optional instructions. The result is editable, and
  the dialog copies the subject and body out.
- Square-bracketed gaps the model left are counted and listed, because
  `[their name]` reaching a partner is how these drafts embarrass people.
- **I have sent it — log it** hands over to Phase 4's existing *Log an
  interaction* surface rather than duplicating it.

To make that handover work, `ProfileScreen` now reads an `action` search
parameter and consumes it on arrival, so `/leads/:id?action=interaction` opens
that surface directly. That is the only change to a previous phase's screen,
and it is plumbing rather than a redesign.

When no model provider is configured the route answers `AI_UNAVAILABLE`, and
that is shown through `LvAiUnavailable` in the provider's own words. No
fallback text is fabricated.

---

## Shared components

Reused: `LvPageHeader`, `LvContextualActions`, `LvSectionCard`, `LvModal`,
`LvModalFooter`, `LvSearchField`, `Segmented`, `EmptyState`, `ErrorState`,
`LoadingState`, `InlineNotice`, `LvBadge`, `LvButton`, `LvTextarea`,
`LvSelect`, `LvStageWait`, `Provenance`, `LvAiUnavailable`.

Added: `ConversationRow`, `MessageEntry`, `NothingYet` (screen-level
compositions), plus two layout classes — `.lv-messages` and
`.lv-messages-list`.

**On nested scrolling:** the two columns sit in normal page flow and the page
scrolls once. An independently scrolling list beside an independently
scrolling thread is the nested scroll trap the brief warns about, and it is
worse on a trackpad than a single long page.

---

## Three faults found while verifying

1. **Every summary read as missing.** `lvInteraction.summary` is a
   `RICH_TEXT` field, so it comes back as `{ markdown }`, not a string.
   Selected as a scalar it returned an object and the thread said *"No summary
   was written for this contact"* for rows that had one. Fixed in the query
   and the mapper.

2. **The draft dialog crashed** with
   `Cannot read properties of undefined (reading 'matchAll')` and vanished,
   leaving a blank sheet. Guarded — and the underlying cause was worse:

3. **`callRoute` treated a route crash as success.** When a logic-function
   sandbox dies, the platform answers with its own envelope —
   `{ statusCode: 500, code: 'ROUTE_TRIGGER_USER_UNCAUGHT_ERROR' }` — which
   has **no `ok` field at all**. `callRoute` only threw on `ok === false`, so
   every screen in every phase would have read fields off an error object
   instead of showing an error. It now rejects any reply carrying
   `statusCode >= 400`, quoting the platform's own message.

   This is a shared-layer fix affecting Today, Leads, Lead Actions, Capture,
   Import, Onboarding, Ecosystem and Messages alike.

4. **The empty state claimed too much.** It said *"No conversation has been
   logged yet"*, which is false for most roles. Interactions are
   record-scoped: measured against the same 21 rows,

   | Signed in as | Interactions visible |
   | --- | --- |
   | Administrator | 21, across 4 leads |
   | Experience Hunter | 7, across the 1 lead they work |
   | Onboarding Expert | 0 |

   An empty list therefore does not mean an empty CRM. It now reads *"No
   conversations to show"* and explains that you see the relationships you can
   work — true whichever case it is, and it does not say how many exist
   elsewhere, because that is precisely what the scoping withholds.

---

## Permissions

Nothing was changed and nothing was bypassed. Messages reads `lvInteractions`
through GraphQL as the signed-in person, so record scoping (CM-004) decides
what appears — verified above across three roles.

Drafting calls `/ai/lead/generate`, which requires the caller to be able to
open the lead; the handover to *Log an interaction* goes through Phase 4's
surface, which the log route already gates (`'Your role cannot log
interactions.'`).

---

## Verified

**Widths** — 320, 360, 375, 390, 430, 768, 820, 1030, 1280, 1440. Zero
horizontal overflow, zero console errors, zero failed API requests on any
Messages screen.

**Populated**, not just empty: 21 interactions across four conversations,
written through the real `/interactions/log` — two threads ending inbound so
*Waiting on us* has something true to show, one internal-notes-only thread,
and channels spanning email, phone, WhatsApp, Instagram, a site visit and
internal notes.

**The draft, both ways.** The Gemini provider is intermittently returning 503,
which made it possible to see each path for real:

- *Success* — "AI DRAFT" provenance, the manual-transport notice, an editable
  body that genuinely reads the thread (it cited the terrace pricing question
  and the photographs the partner had sent), and on one run the placeholder
  warning fired: *"One gap is still to fill in: [confirm date]."*
- *Failure* — `AI_RETRY_EXHAUSTED: The AI provider failed (503).` shown in the
  provider's own words, no crash, the form kept so it can be retried.

**No message mutation was verified, because none exists.** There is no send
path to test. What can be tested — drafting, and logging a contact — was.

---

## Known limitations

- **The provider is unreliable in this environment.** Roughly one draft in two
  returns a 503. That is the provider, not the screen; the screen shows it.
- **The inbox reads one page of 300 interactions** and folds it client-side.
  With more history than that the oldest conversations fall off, and the inbox
  says so rather than pretending to be complete.
- **The dev backend's logic-function sandbox degrades** after a few hours,
  answering every route with `Exited with code 3221225794`. Restarting the
  server clears it. This is environmental, but it is what exposed the
  `callRoute` fault above, so it earned its place here.
