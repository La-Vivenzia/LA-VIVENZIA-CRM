# Integrations

## Targets
Website, official email, Google Workspace, Calendar, WhatsApp, Instagram, LinkedIn, forms, analytics, payments, booking engine and customer platform.

## Principle
Integrations are modular. The CRM core must remain usable if an external integration is unavailable.

## Website registration
Website Registration → CRM → Verification → Classification → Lead Creation → Assignment → Action.

## API rules
Typed contracts, idempotent writes, retryable jobs, webhook signature verification, rate limiting, dead-letter/retry handling and audit events.

## WhatsApp

Meta WhatsApp Business Cloud API inbound webhook and lead capture (LA-10, LA-11, LA-13).

- **Native Twenty Webhook Route:**
  `GET  /webhooks/server/e3e5b3c2-19e4-4d87-8bc1-12c82305a411`
  `POST /webhooks/server/e3e5b3c2-19e4-4d87-8bc1-12c82305a411`
- **Reverse Proxy Route:** An ingress reverse proxy can route `https://<PUBLIC_CRM_HOST>/api/webhooks/whatsapp` to the native Twenty server path above, forwarding all query parameters and `x-hub-signature-256`. No public domain or proxy is pre-configured.
- **Security:** GET handshake validated via `WHATSAPP_VERIFY_TOKEN`; inbound POST validated using constant-time HMAC-SHA256 (`x-hub-signature-256`) against `WHATSAPP_APP_SECRET`.
- **Environment Variables:**
  - `WHATSAPP_VERIFY_TOKEN`: Verification handshake token.
  - `WHATSAPP_APP_SECRET`: Meta App Secret for HMAC-SHA256 signature verification.
  - `WHATSAPP_ACCESS_TOKEN`: Meta Graph API System User bearer token.
  - `WHATSAPP_PHONE_NUMBER_ID`: Sender phone number identifier.
  - `WHATSAPP_API_URL`: Optional (default `https://graph.facebook.com`).
- **Idempotency & Replay Protection:**
  - Leads deduplicated on `captureKey = "whatsapp:<wamid>"`.
  - Duplicate delivery (`replayed: true`) returns the existing lead and suppresses duplicate outbound WhatsApp acknowledgments (`ackSent: false`).
- **Intake & Classification:**
  - Ingested via canonical `readCaptureInput()` pipeline.
  - Default classifications: `source: WHATSAPP`, `pilotZone: <extracted | PUNE_PILOT>`, `status: NEW`.
  - Extracts zones: Amanora Mall, Seasons Mall, Magarpatta City, Hadapsar, Viman Nagar.
  - Extracts cravings: craft beer, rooftop dining, spa/wellness, arcade/gaming.
  - Inbound curated trip confirmations from `TripArchitectView` create `HIGH`-priority `EXPERIENCE / CURATOR` leads, link/create `Person` records, and activate the WhatsApp Butler.
- **Architectural Scope:**
  - Trip confirmation utilizes the client-directed WhatsApp deep-link (`https://api.whatsapp.com/send?text=...`) rendered on `TripArchitectView` voucher. There is no separate server-to-server booking event bridge between the customer platform and Twenty CRM.
  - Location-aware responses handle reactive recommendations upon inquiry. Automatic proactive background alerts while travelling require mobile GPS streaming, a geofencing evaluation daemon, and WhatsApp template approval, which remain external to the CRM.

## Data boundary
CRM and consumer/product databases remain separate initially. Use APIs/events for partner activation, experience/property publication, customer/booking signals, revenue, availability and partner health.
