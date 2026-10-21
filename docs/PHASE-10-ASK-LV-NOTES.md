# Phase 10 — Ask LV / Intelligence

Built on the Phase 0–9 system. No new visual language, and no new AI provider.

Screens: `packages/lv-app/src/screens/AskScreen.tsx`,
`screens/ask/{parts,insights}.tsx`. Contracts: `api/ask.ts`.

---

## What Ask LV is, and what it is not

It is not a chatbot, and the screen is deliberately not a chat.

`/copilot/ask` takes a question, turns it into an **intent**, validates a
**query plan**, and runs that plan **as the person asking** — so every row
comes back through their own role and record scoping. The route states its own
security model in one line:

> *"The session is the only identity: 'act as admin' in the text changes
> nothing, an ownerId in the text is never used."*

There is no transcript, no persona, no typing indicator and no memory between
questions, because the backend has none. Rendering a chat log would imply a
continuity that does not exist. One question, one answer, and the answer is
the screen.

---

## The five screens

| # | Screen | Where |
| --- | --- | --- |
| 10.1 | Ask LV — the question box | `/ask`, idle state |
| 10.2 | Ask LV — the answer | `/ask`, answered state |
| 10.3 | Ask LV — confirmation | `ProposalSheet` |
| 10.4 | AI insight decision | `InsightDecisions`, on the lead's Intelligence tab |
| 10.5 | AI unavailable / quota | `AiUnavailableState` |

**10.4 lives on the relationship, not on Ask LV.** `/ai/lead/insights`
requires a `leadId` — there is no cross-lead insight query — so a suggestion
can only be decided where its record is. It was mounted at the foot of the
existing Intelligence tab, which previously showed deterministic scores from
the 360 payload and never fetched stored insights at all. That is an addition
to an existing screen, not a redesign of one.

---

## The trust model, as the backend actually exposes it

The answer arrives already separated into three parts, and they are kept
apart on screen because they carry different weight:

| Part | What it is |
| --- | --- |
| **Known** | Read out of records the asker can open. |
| **Inferred** | Arithmetic over those same records. |
| **Suggested** | The assistant's opinion. |

`LvAiAnswer` has laid these out since Phase 0, so Phase 10 reuses it rather
than inventing a second answer layout.

Two further signals the route genuinely returns, both shown quietly:

- **`answerOrigin`** — whether the prose was assembled from the rows
  (`RULES`) or written by the model (`MODEL`). Shown as *"Read directly from
  your records"* or *"Written by the assistant from your records"*.
- **`intentSource`** — whether a rule recognised the question or the model had
  to interpret it. Only mentioned when the model was involved.

**No trust signal is invented.** There is no confidence meter on an answer,
because `/copilot/ask` returns no confidence. A confidence figure appears on a
stored insight only when that insight actually recorded one.

---

## Actions

A consequential request **does not run when it is asked for**. It comes back
as a `proposal` with a fifteen-minute life, and `/copilot/confirm` executes it
exactly once, with the same person's token. The proposal sheet says what will
actually happen — one task, or one note, and nothing else touched.

`UNSUPPORTED_ACTION` is shown with the route's own `whyNot` and no action
buttons at all, rather than a disabled button that implies it might work
later.

**No autonomous action exists and none was added.** The only writes Phase 10
can cause are the two the confirm route performs, and the insight decisions,
each of which requires a person to choose.

---

## Entity references

`rows[]` carry a `target: { object, recordId }`. A row is a link only when
this application has a screen for that object — leads, conversations,
onboardings, documents, partners, properties, experiences. Anything else is
named but not linked, rather than sent somewhere that does not exist.

The rows are whatever the plan returned under the asker's own permissions, so
the list cannot become a side channel: a record a role cannot open never
appears in it.

---

## Shared components

Reused: `LvAiAnswer`, `LvAiUnavailable`, `Provenance`, `LvStageWait`,
`LvPageHeader`, `LvSectionCard`, `LvSheet`, `LvTextarea`, `LvButton`,
`ErrorState`, `EmptyState`, `InlineNotice`, `LoadingState`, `Field`.

Added: `ResultRows`, `AnswerProvenance`, `ProposalSheet`,
`AiUnavailableState`, `NoResult`, `InsightDecisions`.

**No new CSS class was needed.** Phase 10 is composition over the Phase 0
primitives.
