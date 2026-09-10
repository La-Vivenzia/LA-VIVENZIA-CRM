# Integrations

## Targets
Website, official email, Google Workspace, Calendar, WhatsApp, Instagram, LinkedIn, forms, analytics, payments, booking engine and customer platform.

## Principle
Integrations are modular. The CRM core must remain usable if an external integration is unavailable.

## Website registration
Website Registration → CRM → Verification → Classification → Lead Creation → Assignment → Action.

## API rules
Typed contracts, idempotent writes, retryable jobs, webhook signature verification, rate limiting, dead-letter/retry handling and audit events.

## Data boundary
CRM and consumer/product databases remain separate initially. Use APIs/events for partner activation, experience/property publication, customer/booking signals, revenue, availability and partner health.
