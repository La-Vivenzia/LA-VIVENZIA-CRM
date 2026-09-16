# Day 10 — Final V1 gap closure, AI activation, integrations, production readiness

**Status:** verification day on Twenty 2.39.0, application `lavivenzia-crm`. **No new core
modification.** **Date:** 2026-09-16. Full audit: `.notes/d10/audit.md`; final readiness
report: `.notes/d10/final-report.md`.

## 1. What Day 10 changed in the product

| Change | Why | Where |
|---|---|---|
| `AI_QUOTA_EXHAUSTED` failure code | The real OpenAI run showed an exhausted credit balance arrives as HTTP 429, which the provider treated as a retryable rate limit — two pointless retries and a misleading `AI_RETRY_EXHAUSTED`. The 429 body is now inspected (`insufficient_quota` / credit / billing) and the failure is reported once, clearly, without retry. | `lv-ai/provider/ai-provider.ts`, `http-provider.ts` (+ unit test) |
| Provider-aware Day 6 live test | The Day 6 suite assumed no provider; it now branches on the workspace's real availability so it stays truthful with or without a key. | `src/__tests__/lv-ai.integration-test.ts` |
| REAL PROVIDER smoke test | Provider-level proof against the vendor, separate from the mock unit tests; skipped without a key; account-side conditions reported BLOCKED. | `src/__tests__/lv-ai-real-provider.integration-test.ts` |
| AI matrix + privacy suite | Every AI feature end to end through the real routes with real sessions; privacy / security assertions always run. | `src/__tests__/lv-ai-day10.integration-test.ts` |
| `callRoute` shows AI failure reasons | A model failure comes back as `{ code, message }`; the front helper only read `error`, so the Intelligence tab said "The server refused that action". It now shows `AI_QUOTA_EXHAUSTED: The AI provider account has no credits or quota remaining.` with Retry. | `lv-core/utils/call-route.ts` |
| Visiting-card fixture | A legible synthetic card (fictional business) for the real OCR test. | `.notes/d10/make-card.mjs` → `.notes/d10/fixtures/` |

Nothing else in the product changed: Days 1–9 stand as the implementation baseline and were
verified against the code, not the reports.

## 1b. Provider migration — Gemini is the primary provider

Business decision: AI is a supporting layer; no OpenAI spend at this stage. Google Gemini became the
active provider **through the existing abstraction** — one new dialect (`gemini`) in `HttpChatProvider`,
one entry in `AI_PROVIDER_KINDS` / defaults, `dialectFor()` in the factory. No AI feature, prompt,
context builder, decision route, Copilot rule or capture flow changed: they call `AiProvider` as before.
OpenAI and Anthropic dialects are untouched and selectable by configuration.

| Concern | Gemini implementation |
|---|---|
| Endpoint / auth | `POST {base}/models/{model}:generateContent`, `x-goog-api-key` header; key in a closure, never in a body, message or log |
| generateText / summarize | `systemInstruction` + one user turn; text of `candidates[0].content.parts` |
| structuredOutput / classify | `responseMimeType: application/json`, then the **same** `extractJson` → prompt validator → CRM rules → human decision chain; a wrong shape or a label outside the allowlist is `AI_INVALID_RESPONSE` |
| Images (OCR, visiting card) | `inlineData` parts after the text — the capture pipeline (confidence, review, duplicate check, provenance, no silent creation) is unchanged |
| Limits | `maxOutputTokens`, `temperature`, timeout, retry budget as configured; `thinkingBudget: 0` so the cap is the answer, not hidden reasoning |
| Errors | 400 `API_KEY_INVALID` / 401 / 403 → `AI_REQUEST_REJECTED` (vendor sentence attached, key redacted); 404 model → `AI_REQUEST_REJECTED`; 429 per-minute → `AI_RATE_LIMITED` + backoff; 429 per-day → `AI_QUOTA_EXHAUSTED`; `SAFETY` / `RECITATION` → `AI_REQUEST_REJECTED`; `MAX_TOKENS` on JSON → `AI_INVALID_RESPONSE`; empty → `AI_EMPTY_RESPONSE`; network / abort → `AI_UNAVAILABLE` / `AI_TIMEOUT` |
| Browser | Day 6 suite (the only one that names the provider in a header check) re-run under Gemini: 32/32; Intelligence tab shows a real AI GENERATED summary labelled `gemini · gemini-3.5-flash-lite` |
| Switch test | `readAiConfig({LV_AI_PROVIDER: 'openai'})` still yields the OpenAI dialect (unit-tested); the smoke test ran against OpenAI in the morning and Gemini in the afternoon with no code change outside `lv-ai/provider` |

**Real Gemini result (2026-09-16):** REAL PROVIDER smoke 12/12 (`gemini-3.6-flash`, repeated on
`gemini-3.5-flash-lite`); **13/13 CRM AI features produced real output** through their own routes and
human gates (TESTING-QA.md, Day 10 addendum). Two earlier keys came from a Google project that Google
had denied ("contact support") — those refusals were surfaced honestly by the CRM and are recorded, not
hidden. `gemini-2.5-flash` (the brief's preferred model) is closed to new projects (404), so the default
is `gemini-3.6-flash`; the lite model behaved identically in every test.

Production considerations: this project's free tier is **20 requests per day per model** plus a
per-minute limit (measured from the quota detail) — the CRM maps them to `AI_QUOTA_EXHAUSTED` /
`AI_RATE_LIMITED` and stays usable, but a team needs billing enabled on the Google project (no daily cap,
no training on prompts). `gemini-3.7-flash` was returning 503 during verification; do not pin it today.

## 2. AI activation (OpenAI attempt, superseded by §1b)

The workspace now carries `LV_AI_PROVIDER=openai` and an encrypted `LV_AI_API_KEY`; the app
reports `available: true, provider: openai, model: gpt-4o-mini`. The key is stored by Twenty
(`enc:v2`), reaches only the logic functions, is absent from every response, run row, log line,
screenshot and document, and is not in any tracked file.

**Real provider result:** authentication works (a wrong key is rejected with 401 and never
retried; the real key passes auth) but the OpenAI account has **no credits** — every completion
answers `429 insufficient_quota (credit_balance_exhausted)`. Consequently text generation,
structured output, classification, summarisation, timeout handling and the eight feature steps
that need the model are **BLOCKED**, reported as skipped with the code. The CRM behaves exactly
as designed under the failure: routes answer `AI_QUOTA_EXHAUSTED`, runs are audited FAILED, the
Intelligence tab shows the failed attempt with Retry, and no record is touched.

Unblocking is a Founder action: add credits at platform.openai.com → Settings → Organization →
Billing, then re-run `npx vitest run --project integration src/__tests__/lv-ai-real-provider.integration-test.ts src/__tests__/lv-ai-day10.integration-test.ts`
(the key sourced from `.notes/lv-dev-users.env`). The development key was pasted into a chat
during setup; rotate it after the re-run.

## 3. Founder V1 coverage (summary of the audit)

| Area | DONE | PARTIAL | MISSING |
|---|---|---|---|
| Lead management (12) | 12 | — | — |
| Capture (8) | 5 | 1 (Instagram: handle kept, profile not scraped) | 2 (voice capture; brochure untested with real media) |
| Partner / Experience / Property (5) | 3 | 1 (partner health N/A) | 1 (taxonomy admin) |
| Onboarding (7) | 5 | 1 (assistant blocked on credits) | 1 (AI document extraction) |
| Operations (2) | 2 | — | — |
| Security (9) | 7 | — | 2 config (MFA enforcement, backups) |
| UX (3) | 2 | 1 (no formal WCAG audit) | — |
| AI (13 features) | 5 verified live | 8 BLOCKED on credits | — |

## 4. Integrations

LIVE: AI provider (architecture and configuration; execution blocked on credits).
READY FOR CONFIGURATION: notification email (SMTP; Resend as SMTP), file storage (Cloudflare R2
through Twenty's S3 driver, `docs/STORAGE-R2.md`).
ARCHITECTURE READY: calendar (Twenty core sync, unused by LV).
FUTURE: website registration form → CRM (no public route; URL capture exists), WhatsApp /
Instagram messaging (drafts only, by design), voice capture, AI document extraction.

## 5. Production readiness in one paragraph

The upstream image, entrypoint (migrations, upgrade, cron registration), worker, health checks
and secrets model are production-shaped and unchanged. Two things are not automatic and must be
in the runbook: (1) the LV application is installed by `twenty-sdk apply` against the running
server after every image upgrade — nothing in the image or CI does it; (2) backups and a restore
test are infrastructure work not yet done. Configuration to set: `ENCRYPTION_KEY`,
`SERVER_URL`, database / Valkey URLs, R2 storage variables, and the app variables `LV_SMTP_*`,
`LV_APP_BASE_URL`, `LV_AI_*`; enforce 2FA in Settings → Security. Full list and blockers:
`.notes/d10/final-report.md` §8, §11, §12.
