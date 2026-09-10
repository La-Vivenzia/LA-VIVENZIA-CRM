# Twenty CRM Gap Analysis

## Audited baseline
Twenty 2.39.0 source drop; Nx/Yarn 4 monorepo; NestJS/PostgreSQL/Redis backend; React 19 frontend; no .git directory in the inspected source drop.

## Recommendation
Re-fork the official Twenty baseline with Git history before production work.

## Do not rebuild
Auth/TOTP MFA, RBAC foundation, metadata/custom fields, record UI, timeline, tasks/notes, email/calendar sync, workflow engine, AI runtime, merge UI, CSV import, APIs, deployment primitives and existing tests.

## Major LV gaps
1. Notifications: complete notification entity/service/centre is missing.
2. Partner onboarding: native Twenty onboarding is for workspace users, not external partners.
3. Assignment engine and round robin.
4. True SLA clocks/escalation.
5. Natural-language semantic search.
6. OCR capture flow.
7. Fuzzy duplicate similarity.
8. Mobile camera/offline capture.

## Audit estimate
The prior audit estimated roughly 21% of MVP requirements available immediately, about 67% reachable after configuration, and about 33% requiring custom development. These are requirement-count estimates, not engineering-hour estimates.

## Licensing/entitlement risk
Row-level permissions and enterprise audit-log functionality require explicit entitlement/licensing verification for the chosen deployment. UI filtering must never be treated as security.

## Implementation rule
Build LV-specific gaps as modular extensions first. Core changes are exceptions.
