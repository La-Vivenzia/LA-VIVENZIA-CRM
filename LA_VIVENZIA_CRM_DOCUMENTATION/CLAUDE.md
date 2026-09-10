# Claude Code Rules — La Vivenzia CRM

1. Inspect before modifying.
2. Prefer Twenty configuration/apps over core edits.
3. Never reimplement a Twenty primitive without evidence.
4. Preserve existing tests and behaviour.
5. Keep LV modules isolated and documented.
6. Keep CRM DB separate from consumer/product DB.
7. Enforce permissions server-side.
8. Never expose secrets.
9. Never fabricate partner facts with AI.
10. Audit important actions.

## UI
Follow UI-UX-SPEC.md: Pine Green #1F4D3A, Sage #6B846F, Gold #D4AF37, Sand #F3EFE7, Charcoal #1A1A1A, light/dark, mobile-first, responsive, semantic tokens.

Inspect `public/ui-reference/` and the approved visual reference before UI implementation.

## Modules
lv-core, lv-notifications, lv-onboarding, lv-assignment, lv-sla, lv-intelligence, lv-capture, lv-copilot, lv-analytics.

## Core changes
Only if no supported extension/configuration path exists, the requirement is critical, tests are added and the change is documented in CORE-MODIFICATIONS.md.

## Definition of done
Feature works on mobile and desktop, has loading/error/empty states, respects permissions, handles audit implications, includes critical tests, introduces no regression and updates documentation.
