# La Vivenzia CRM

The La Vivenzia application for Twenty. All La Vivenzia functionality lives in this
one package, as nine internal modules — see `docs/IMPLEMENTATION-STATUS.md` Part B
for the module boundaries and the one-way dependency rule.

Twenty core is not modified. If that ever changes, it must be recorded in
`LA_VIVENZIA_CRM_DOCUMENTATION/CORE-MODIFICATIONS.md`.

## What is built (Lead Management layer)

| Module | Contents |
|---|---|
| `lv-core` | `lvLead` object, lifecycle + taxonomy vocabulary, duplicate detection, routing attributes on `workspaceMember` |
| `lv-capture` | Deterministic normalisers, the single `buildLeadDraft` path for all capture modes, Quick Add Lead UI |
| `lv-assignment` | Scoring engine, eligibility + smart round robin, `selectAssignee`, orchestrator, `lvAssignmentHistory`, `lvAssignmentRule` |
| `lv-notifications` | `lvNotification` object and idempotent notification drafts |
| `lv-whatsapp` | Meta WhatsApp Business Cloud API inbound webhook, signature validation, lead creation via `readCaptureInput`, Trip Butler & corridor concierge |

Not yet started: `lv-onboarding`, `lv-sla`, `lv-intelligence`, `lv-copilot`, `lv-analytics`.

## Assignment precedence

Highest first. Every branch is deterministic and auditable — no model is consulted.

1. **MANUAL** — a human named an owner
2. **RULE** — an admin-configured `lvAssignmentRule` matched
3. **EXISTING_RELATIONSHIP** — the prior owner is available, so continuity wins
4. **SCORED** — weighted factors (existing relationship 30, category 20, geography 20, expertise 15, language 15)
5. **ROUND_ROBIN** — nothing discriminated, so balance by workload

Workload is deliberately not an additive weight. It is a hard capacity filter and the
primary round-robin tie-break, so an idle member never outranks a genuinely expert one.

## No fabricated AI

Phase 1 ships no model calls. Where `AI-INTELLIGENCE.md` puts capability in Phase 2,
this package defines a typed seam with a deterministic default instead:

- `ImageFieldExtractor` — **no implementation.** An image or visiting-card capture is
  stored with its attachment and parked at `DISCOVERED` for a human, rather than
  having its fields invented.
- `LeadClassifier` — keyword rules only; returns `null` rather than guessing a category.
- `OpportunityScorer` — `opportunityScore` stays empty. The honest Phase 1 signal is
  `dataCompleteness`, a plain percentage of populated qualification fields.

Duplicate detection is a real algorithm (Sørensen–Dice over character bigrams blended
with token containment), not a model.

## Commands

Run from the monorepo root, which already has the toolchain installed:

```bash
node node_modules/vitest/vitest.mjs run --project unit   # unit tests
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node_modules/.bin/oxlint -c .oxlintrc.json .
node ../../../twenty-sdk/dist/cli.cjs dev:build .        # manifest + build
```

## Generated files

Two files are generated and must not be hand-edited:

```bash
node scripts/generate-select-options.mjs    # src/modules/lv-core/constants/select-options.generated.ts
node scripts/generate-relation-fields.mjs   # the 12 relation / routing field files
```

Option ids are deterministic UUIDv5 values derived from the option name, so
regenerating produces identical ids and never orphans existing records.

## Meta WhatsApp Business Cloud API Integration (LA-10, LA-11, LA-13)

### Native Twenty Webhook Route
The webhook is implemented as a server-route logic function (`universalIdentifier`: `e3e5b3c2-19e4-4d87-8bc1-12c82305a411`).
Twenty natively mounts server-route logic functions at:
```
GET  /webhooks/server/e3e5b3c2-19e4-4d87-8bc1-12c82305a411
POST /webhooks/server/e3e5b3c2-19e4-4d87-8bc1-12c82305a411
```

- **Meta Callback URL:** Point the Meta WhatsApp Business App Webhook subscription to:
  `https://<YOUR_TWENTY_SERVER_HOST>/webhooks/server/e3e5b3c2-19e4-4d87-8bc1-12c82305a411`
- **Reverse Proxy Vanity Route:** If routing through `/api/webhooks/whatsapp` is preferred for external URLs, configure an edge reverse proxy (such as Nginx, Caddy, or Cloudflare Ingress) to rewrite:
  `https://<PUBLIC_CRM_HOST>/api/webhooks/whatsapp` -> `https://<TWENTY_SERVER_INTERNAL>/webhooks/server/e3e5b3c2-19e4-4d87-8bc1-12c82305a411`
  *Important:* Ensure all query parameters (for GET verification: `hub.mode`, `hub.verify_token`, `hub.challenge`) and headers (for POST: `x-hub-signature-256`) are forwarded untouched. Note: No public domain or reverse proxy is pre-configured in this repository.

### Required Environment Variables
Configure the following in the server deployment environment (e.g. Docker environment, systemd, or orchestration secrets):
- `WHATSAPP_VERIFY_TOKEN`: Shared secret token matching the verify token configured in Meta App Dashboard for GET challenge verification.
- `WHATSAPP_APP_SECRET`: Meta App Secret used for HMAC-SHA256 signature verification (`x-hub-signature-256`) on all inbound POST requests.
- `WHATSAPP_ACCESS_TOKEN`: Meta Graph API System User access token with `whatsapp_business_messaging` permission for outbound WhatsApp messages.
- `WHATSAPP_PHONE_NUMBER_ID`: The sender phone number ID assigned by Meta Business Manager.
- `WHATSAPP_API_URL`: (Optional, defaults to `https://graph.facebook.com`) Base URL for Meta Graph API.

### Duplicate Delivery and Idempotency Handling
- Inbound messages are deduplicated using `captureKey = "whatsapp:<wamid>"`.
- If an existing lead matches the capture key, or a race condition occurs, `createWhatsAppLead` returns `{ ok: true, replayed: true, leadId }`.
- In `whatsapp-webhook.logic-function.ts`, duplicate webhook deliveries (`replayed === true`) preserve the existing lead record and suppress sending redundant WhatsApp acknowledgment messages (`ackSent: false`), preventing duplicate messages to guests.

### TripArchitectView Integration
- The guest trip confirmation workflow in `lavivenzia-platform` (`src/components/trips/TripArchitectView.tsx`) produces a Master Trip Voucher containing a WhatsApp deep-link (`https://api.whatsapp.com/send?text=...`) prefilled with trip title, booking reference, party size, region, and concierge activation request.
- When the guest sends this message, the CRM webhook parses the curated trip format, links or creates a `Person` record by phone number, generates a `HIGH`-priority `EXPERIENCE / CURATOR` lead, and dispatches the Trip Butler activation acknowledgment.
- **Architectural Note:** There is no server-to-server booking event bus between the platform frontend and Twenty CRM; trip activation operates through the guest-directed deep link.

### Location-Aware Recommendations vs Proactive Alerts
- **Reactive Recommendations:** Fully supported. Guest inquiries referencing pilot corridors (Amanora, Seasons, Magarpatta, Hadapsar, Viman Nagar) and preferences (craft beer, rooftop dining, spa, gaming) receive instant tailored venue recommendations.
- **Proactive Background Alerts:** Proactive in-journey alerts (e.g. pushing a message as a guest enters a geographic area) require mobile GPS telemetry streaming, a background geofence evaluation daemon, and Meta-approved Outbound Message Templates (for messaging outside the 24-hour customer service window). These external systems are not part of the CRM core and are reserved for Phase 2 mobile integration.
