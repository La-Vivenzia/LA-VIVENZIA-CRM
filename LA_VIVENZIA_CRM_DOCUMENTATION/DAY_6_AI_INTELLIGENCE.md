# Day 6 — AI intelligence, CRM Copilot, data quality, next best action

Labels: **IMPLEMENTED** (code exists and is applied to the workspace),
**VERIFIED** (proven by a real execution recorded in TESTING-QA.md),
**LIMITATION** (works with a stated boundary), **NOT IMPLEMENTED** (absent;
shown as unavailable, never faked).

Modules: `packages/twenty-apps/internal/lavivenzia-crm/src/modules/lv-ai`
(provider, prompts, runtime, AI objects), `lv-intelligence` (engines, lead
routes, events, cron, lead UI), `lv-copilot` (query allowlist, intent rules,
routes, Copilot page). No Twenty core file changed; CORE-MODIFICATIONS.md is
unchanged. No paid / Enterprise feature; no vector database.

**Provider status in this environment:** no API key is configured, so every
model feature reports `AI_UNAVAILABLE`. Everything deterministic (score,
health, next best action, data quality, duplicates, structured Copilot,
briefing facts) works without a provider and is what the live tests verify.
The model path is verified with deterministic provider mocks (unit tests);
a real-provider smoke test is **NOT RUN** (no key) — see §26.

---

## 1. What was found before building (§3 audit)

| Existing | Finding | Day 6 |
|---|---|---|
| Twenty AI module (`metadata-modules/ai`: agents, `/rest/ai/generate-text`, model registry, billing) | Usable only with the `AI` settings permission (admins) and the platform's billing/usage layer; a Hunter's delegated call would be refused. No key configured. | Not used at runtime. The app has its own provider abstraction configured by application variables, so keys stay server-side and work for every role. |
| `lv-core/services/scoring.ts` | Deliberately unimplemented scorer with documented missing inputs; `lvLead.opportunityScore` / `relationshipHealth` columns empty | Replaced by `opportunity-score-v1` / `relationship-health-v1` engines (§5, §6); the score is mirrored onto `opportunityScore`; `relationshipHealth` (a number) stays empty — health is a state, stored on the insight. |
| `lv-core/utils/duplicate-detection.ts` + quick-add UI | Deterministic similarity used only at capture time | Extended into server-side duplicate intelligence for existing leads with a human MERGE / CREATE NEW / IGNORE decision (§7). |
| `lvLead.fieldProvenance` with `AI_SUGGESTED` value | Provenance vocabulary existed; nothing produced it | AI suggestions are separate rows (`lvAiInsight`); accepted classification writes the lead through the reviewer's token. |
| `lvInteraction.summary/sentiment/objections/commitments/nextAction` | Human-recorded fields | Conversation summary suggests values; "Apply to interaction" writes them with the reviewer's token. |
| Problem database | Named in DATA-MODEL.md, **did not exist** (objections were free text) | `lvProblem` created per DATA-MODEL.md; rows only from confirmed suggestions. |
| Copilot / chat / MCP / embeddings | None in the LV app | Structured-query Copilot; no vectors. |

## 2. Provider architecture

```
AiProvider  (lv-ai/provider/ai-provider.ts)
  generateText · structuredOutput · classify · summarize
    ├── HttpChatProvider   dialect openai (/chat/completions — OpenAI, gateways) | anthropic (/messages)
    └── UnavailableProvider  every call → AI_UNAVAILABLE, no network, no delay
createAiProvider(readAiConfig())
```

Configuration = application variables (`LV_AI_PROVIDER`, `LV_AI_API_KEY`
(secret), `LV_AI_BASE_URL`, `LV_AI_MODEL`, `LV_AI_TIMEOUT_MS`,
`LV_AI_MAX_OUTPUT_TOKENS`, `LV_AI_MAX_RETRIES`, `LV_AI_TEMPERATURE`) with
defaults and hard clamps (timeout 2–60 s, output 64–4000 tokens, retries 0–5).
Never in frontend code; never in a record or a log. **IMPLEMENTED / VERIFIED**
(unit: config, defaults, clamps, key never exposed).

Bounded requests: one timeout per call (AbortController), output cap,
exponential backoff retries only on 429 / 5xx / network / timeout, `401/403`
never retried. Typed failures: `AI_UNAVAILABLE`, `AI_TIMEOUT`,
`AI_RATE_LIMITED`, `AI_INVALID_RESPONSE`, `AI_EMPTY_RESPONSE`,
`AI_RETRY_EXHAUSTED`, `AI_REQUEST_REJECTED`, `AI_PROVIDER_ERROR`. Structured
output = JSON extracted (fences / prose tolerated) then validated by the
prompt's validator; anything else is `AI_INVALID_RESPONSE`, never coerced.
**VERIFIED** (unit: success, malformed JSON, schema failure, empty, rate
limit → retry → success, retry exhaustion, timeout, bad credentials, network
failure, Anthropic dialect, classify label allowlist).

## 3. AI operations and prompt versions

Prompts live in one registry (`lv-ai/prompts/prompt-registry.ts`); every
generated insight and run stores the version.

| Operation | Prompt / rules version | Origin | Trigger |
|---|---|---|---|
| Lead summary | `lead-summary-v1` | MODEL | on demand (Intelligence tab) |
| Classification | `lead-classification-v1` | MODEL | on demand; `lvLead.created` when configured and no category |
| Conversation summary + objections + problem candidates | `conversation-summary-v1` (one call → three insight types) | MODEL | on demand; `lvInteraction.created` when configured and notes ≥ 20 chars |
| Briefing prioritisation | `morning-briefing-v1` | MODEL (facts are rules) | Copilot page / "what should I work on" |
| Drafts (email / WhatsApp text) | `communication-draft-v1` | MODEL | on demand |
| Onboarding assistant | `onboarding-assist-v1` | MODEL | on demand |
| Copilot intent fallback / answer narrative | `copilot-intent-v1` / `copilot-answer-v1` | MODEL | only when the rule engine does not recognise the question |
| Opportunity score | `opportunity-score-v1` | RULES | tab load, interaction created, hourly cron |
| Relationship health | `relationship-health-v1` | RULES | same |
| Next best action | `next-best-action-v1` | RULES | same |
| Data quality | `data-quality-v1` | RULES | same |
| Duplicate intelligence | `duplicate-intelligence-v1` | RULES | tab load |

Every system prompt starts with the grounding rules: use only the supplied
context, never invent names / contact details / prices / availability /
policies / certifications / documents / dates, say "not available in CRM
data", cite only ids in the context.

## 4. Lead classification — IMPLEMENTED, model path VERIFIED with mocks

Input: lead fields (contact presence only; website / Instagram presence,
never the raw capture paste), up to three interaction notes and two notes,
and the allowed category / sub-category vocabulary. Output: category, sub-category, confidence, reasoning, evidence,
ambiguity. Server checks the answer against the taxonomy; anything outside is
"no suggestion". `REVIEW_REQUIRED` when confidence < 0.6 or no valid category.
The suggestion never changes the lead: **Accept / Edit / Reject** on the
Intelligence tab → `POST /ai/insight/decide` writes `category/subcategory`
with the reviewer's own token and records reviewer + time on the insight.
Live: without a provider the route answers `AI_UNAVAILABLE` and audits the
attempt (**VERIFIED**).

## 5. Opportunity Score v1 — IMPLEMENTED / VERIFIED (rules)

Day 1's objection stands: the ten-factor specification has no weights and no
data for six factors. v1 therefore scores only what the CRM records, with
weights written here and in `engines/opportunity-score.ts`:

| Component | Points | Rule |
|---|---|---|
| Funnel stage | 0–40 | table by status (NEW 4 … INTERESTED 28, NEGOTIATION 34, APPROVED/LIVE 40; FOLLOW_UP_LATER 10, NO_RESPONSE 4) |
| Responsiveness | 0–20 | ≥ 2 inbound 20 · 1 inbound 12 · outbound only 4 · none 0 |
| Recency | 0–15 | last interaction ≤ 3 d 15 · ≤ 7 d 11 · ≤ 14 d 7 · ≤ 30 d 3 |
| Qualification | 0–15 | `dataCompleteness` × 0.15 |
| Momentum | 0–10 | next follow-up scheduled and not overdue 6 · open onboarding progressing 4 |
| Penalties | to −25 | breached/escalated SLA −10 · overdue follow-up −6 · awaiting response > 7 d −5 · no contact channel −4 |

`SCORE_UNAVAILABLE` (never a number) when the lead is closed/archived, or
has no interaction, no completeness and status DISCOVERED/NEW. Output always
carries positive / negative / missing lists, `rulesVersion`, `generatedAt`.
"High opportunity" = ≥ 70 (Day 5 dashboards now count it). Strategic fit,
demand, reputation and quality are **NOT IMPLEMENTED** (no data) and are
not pretended. Verified by unit tests (exact arithmetic) and live (score
mirrored to `lvLead.opportunityScore`).

## 6. Relationship Health v1 — IMPLEMENTED / VERIFIED (rules)

State with precedence: `UNKNOWN` (no interaction ever) → `DORMANT`
(closed/archived, or > 60 days silence) → `AT_RISK` (unresolved SLA breach,
open HIGH/CRITICAL problem, NEGATIVE sentiment recorded on a recent
interaction, status NO_RESPONSE, 31–60 days silence) → `ATTENTION` (overdue
follow-up, waiting > 7 days for the partner, no next step on an engaged
lead, 15–30 days silence) → `HEALTHY`. Reasons carry the record ids. No
emotion is inferred: "negative" means a team member recorded it. UNKNOWN is
a first-class answer.

## 7. Duplicate intelligence — IMPLEMENTED / VERIFIED

Shortlist under the caller's token (shared duplicate keys, same primary
email / phone, the name's most distinctive word), ranked by the Day 1
engine: percent, STRONG (≥ 85 %) / POSSIBLE, matching fields, explanation,
suggested survivor (the older record). Human actions **MERGE / CREATE NEW /
IGNORE**, recorded on the insight. **LIMITATION:** Twenty has no record merge
for custom objects, so MERGE is a *soft merge* — the newer lead is marked
DUPLICATE through the existing lifecycle policy with the reviewer's token, a
`MARK_DUPLICATE` governance audit row names the survivor; no field-level
merge, no deletion. Candidates are limited to leads the caller can read
(CM-004) — a duplicate in another Hunter's private pipeline is an
administrator's finding.

## 8–10. Lead summary, conversation summary, objections — IMPLEMENTED (model), VERIFIED with mocks

Lead summary answers who / what / wants / happened / pending / problems /
next, with `insufficientData` when the context has fewer than two facts
beyond the name; citations outside the context are dropped and counted
(`uncitedReferencesDropped`). Conversation summary: summary, sentiment
(suggestion; `UNCLEAR` allowed), key points, commitments with
CERTAIN/UNCERTAIN, objections with category (OTHER allowed) / confidence /
evidence, next action, follow-up date, unresolved questions, ≤ 3 problem
candidates. Nothing is written to the interaction until **Apply to
interaction** (reviewer's token). Interactions without notes never reach the
model.

## 11. Problem intelligence — IMPLEMENTED / VERIFIED (decision path live)

`lvProblem` (type, severity, status, description, root cause, resolution,
AI recommendation, lead, interaction, reporter, source insight). Model output
only becomes a `PROBLEM_SUGGESTION` insight; a row is created only on
**Confirm problem** with the confirming person as reporter. Unresolved
problems feed relationship health and the Control Tower.

## 12. Next Best Action v1 — IMPLEMENTED / VERIFIED

Ordered rule ladder → one primary + up to three alternatives: ESCALATE
(breached SLA) → FOLLOW_UP (overdue task) → UPDATE_CONTACT_DATA →
CONTACT_LEAD → REQUEST_DOCUMENT / REVIEW_DOCUMENT → FOLLOW_UP (partner
replied, nothing planned) → FOLLOW_UP / WAIT_FOR_RESPONSE (awaiting reply,
> 5 d / ≤ 5 d) → SCHEDULE_MEETING (interested, nothing planned) →
START_ONBOARDING → FOLLOW_UP (quiet > 14 d) → QUALIFY_LEAD →
CLARIFY_REQUIREMENT. Each: action, title, reason, priority, target record,
suggested deadline (Now / Today / Tomorrow / This week), evidence + ids,
confidence HIGH (hard fact) / MEDIUM (pattern) / LOW (default), proposed
task. **Accept** creates the task through the task system assigned to the
accepting person (their token); **Dismiss** records the decision.

## 13. Morning briefing — IMPLEMENTED / VERIFIED (rules path live)

`POST /ai/briefing`: facts from the Day 5 dashboard engine under the caller's
lens and permissions (counts + the records behind them), ranked by a fixed
rule (breaches → overdue → high priority → approvals). With a provider the
model is asked only to pick and explain the top actions; a model action
naming a ref not in the facts is dropped. Every line deep-links. Numbers
are never produced by the model.

## 14. Communication drafting — IMPLEMENTED (model), VERIFIED with mocks

Kinds: follow-up / introduction email, reminder, document request,
onboarding reminder, meeting follow-up, WhatsApp text. Output is an **AI
DRAFT** in an editable box with a copy button; unknown facts become
`[placeholders]` listed for the sender. Nothing is sent: the CRM has no
outbound email transport for team mail (Day 4 SMTP is notification-only)
and **no WhatsApp transport exists** — the draft is text only, stated in the
UI. **LIMITATION.**

## 15. Onboarding assistant — IMPLEMENTED (model), VERIFIED with mocks

Context = descriptive partner answers only (bio, title, description,
inclusions, city/state, pricing figures, availability); identity, address
line, PIN, contact fields and documents are excluded. Output: improved
wording (facts from the input only), changes explained, missing information,
inconsistencies, questions. Labelled **USER PROVIDED** vs **AI SUGGESTED**;
**Accept wording** writes `answers[STEP][field]` with the reviewer's token.
Lives on the lead's Intelligence tab when the lead has an onboarding.

## 16. Data quality — IMPLEMENTED / VERIFIED (rules)

Issues (code, target object/record/field, severity, evidence, recommended
correction): missing contact / email / phone, malformed email / website,
inconsistent organisation name, missing category / location, stale lead,
missing next action / follow-up, overdue follow-up date, contradictory lead
vs onboarding status, incomplete idle onboarding, expired-but-verified
document. Nothing is modified automatically. Notifications for data-quality
issues are **NOT IMPLEMENTED** (no rule defines which issue warrants one).

## 17–18. CRM Copilot and structured query architecture — IMPLEMENTED / VERIFIED

```
question → intent (rules first; model only if unrecognised and configured)
        → validatePlan (allowlist: objects lead/task/interaction/onboarding/document/sla,
                        listed fields, operators eq/neq/in/gt/gte/lt/lte/is_null/is_not_null/contains,
                        limit ≤ 25, ≤ 8 filters, sortable fields only, enum vocabularies,
                        relative dates, member fields = "me" | "none" only)
        → executePlan with the CALLER's token (CM-004 at execution)
        → answer KNOWN / INFERRED / SUGGESTED (deterministic; model narrative optional, grounded in rows)
```

No SQL, no joins, no raw filters, no member ids or names in plans. Rule
engine covers the ten everyday questions plus record questions ("what
happened with LV-000003"), pricing / availability / certification questions
(answered only from partner-provided onboarding data or "not available in
CRM data"), the briefing, and task / note proposals. Consequential requests
(delete, merge, approve/reject, reassign / change owner, change price,
send) are never executed: they return the human path. "Act as admin",
"ignore your permissions", "sudo" are refused; the session is the identity.

Writes: a proposal (`lvAiRun` status PROPOSED, 15-minute expiry) that only
the **same person** can confirm, **once**; `POST /copilot/confirm` creates the
task / note with that person's token. Day 6 supports CREATE_TASK and
ADD_NOTE; field updates are suggestions only.

## 19. Permission / security model — VERIFIED

- Routes require a session (API keys → `NOT_AUTHENTICATED`); actor from the
  delegated token; nothing in a body names a member, role or `isAdmin`.
- The lead is loaded with the caller's token first: a lead CM-004 hides is
  `NOT_FOUND` for insights, generation, decisions and Copilot alike.
- `lvAiInsight`, `lvAiRun`, `lvProblem` are **denied** to every team role by
  object permission (Main Admin keeps read for audit); reads and writes go
  through the application role inside routes that have already proven lead
  access. Verified live: a Hunter's direct `lvAiInsights` query is refused.
- Every CRM write from an accepted suggestion (category, task, interaction
  fields, duplicate marking, onboarding answers) uses the reviewer's token —
  the platform's permission check is the one that counts.

## 20–21. Provenance and audit — IMPLEMENTED / VERIFIED

`lvAiInsight`: type, status (`AI_SUGGESTED` → `AI_CONFIRMED` / `AI_REJECTED`,
`AI_STALE` when the sources changed after a confirmation, `UNAVAILABLE`
with `errorCode`), origin MODEL / RULES, target object + record, lead,
provider, model, prompt / rules version, generatedAt, confidence (only where
the task supports it), source record ids, bounded payload, summary, source
fingerprint, reviewer, reviewedAt, human decision, decision note.
`lvAiRun`: actor, operation, prompt version, provider, model, status
(SUCCESS / FAILED / UNAVAILABLE / SKIPPED / PROPOSED / CONFIRMED / EXPIRED /
REFUSED), error code, latency, input / output tokens, target, source record
ids, bounded metadata — never prompts, responses, keys or personal data.
Console line per operation: `op=… prompt=… provider=… model=… status=…
latencyMs=… attempts=…`.

## 22. Failure behaviour — VERIFIED

No provider / provider down → `AI_UNAVAILABLE` (or the specific code) from
the routes, an UNAVAILABLE insight row and a FAILED / UNAVAILABLE run; lead
creation, interaction logging, onboarding, documents, tasks, notifications
and the SLA engine are untouched (the AI event functions are separate
functions that exit early). The Intelligence tab shows an error state with
Retry; the rest of the lead page never waits for it (verified in the
browser with an aborted request).

## 23. Privacy — IMPLEMENTED

Model context is built in one place (`services/model-context.ts`): email /
phone values are never sent (presence only), member ids are not sent, raw
capture input / provenance JSON / duplicate keys / audit trails are never
sent, free text is truncated, onboarding identity and document fields are
excluded. Unit tests assert the summary context contains no email, phone or
capture paste, and that the classification context drops a raw capture input
carrying an email, phone, URL and handle while keeping the structured
evidence.

## 24. Cost control — IMPLEMENTED / VERIFIED

Deterministic insights are re-persisted only when their source fingerprint
changes (a page view of an unchanged lead costs zero writes — unit + live);
model calls are on demand, plus two narrow triggers (`lvLead.created`
without a category; `lvInteraction.created` with ≥ 20 characters of notes),
both only when a provider is configured; hourly cron recomputes rules for at
most 100 open leads and calls no model; Copilot uses the model only for
unrecognised phrasing; every call bounded by timeout, output cap, retry
budget. The hourly refresh (`lv-ai-score-refresh`, `17 * * * *`) was
observed live: rules runs with no actor at 22:17 IST scored the three real
leads without any client involved.

## 25. UI — IMPLEMENTED / VERIFIED in the browser

Lead page → **Intelligence** tab (`lv-lead-intelligence`): Opportunity,
Relationship health, Next best action (Accept / Dismiss / Open target), AI
summary, AI classification (Accept / Edit / Reject), Data quality, Duplicate
signal (Merge / Create new / Ignore), Recent conversation summary (Summarise,
Apply, Confirm problem), Draft follow-up (AI DRAFT, editable, copy),
Onboarding assistant (when an onboarding exists). Every section labels its
origin (COMPUTED · rules / AI GENERATED / AI SUGGESTION / AI DRAFT), loads
independently, has loading / empty / error (Retry) / unavailable states.
Work → **Copilot** (`lv-copilot`): Today briefing + question box with
KNOWN / INFERRED / SUGGESTED answers, deep-linked rows, CONFIRM / Cancel for
proposals. Day 5 dashboards: "High-opportunity leads (score ≥ 70)" and
"Leads scored" are real once scores exist; Control Tower system health adds
unresolved problems and AI operations / failures (7 days).

## 26. Known limitations

1. No provider configured in this environment → all model features
   `AI_UNAVAILABLE`; verified with mocks, not with a real vendor.
2. Opportunity Score v1 measures engagement & readiness only; strategic
   fit / demand / reputation / quality remain unmeasured.
3. Duplicate MERGE is a soft merge (mark DUPLICATE + audit), no field merge.
4. No WhatsApp / email sending transport; drafts are copy-out text.
5. Copilot free-form phrasing needs the model; the rule set covers the
   documented questions.
6. AI objects are invisible to team roles (by design), including the
   read-only Management role; the Main Admin audits them.
7. Onboarding assistant lives on the lead's Intelligence tab, not on the
   onboarding record page.
8. `lvLead.relationshipHealth` (numeric column) stays empty — health is a
   state on the insight.
9. Data-quality notifications and Copilot field updates are not implemented.
10. Intelligence tab sections use the same fixed fallback fonts as Day 5.
