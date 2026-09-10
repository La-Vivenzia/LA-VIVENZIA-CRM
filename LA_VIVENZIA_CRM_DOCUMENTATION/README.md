# La Vivenzia CRM Documentation

This is the working product, architecture, UX and engineering documentation set for the La Vivenzia CRM built on Twenty CRM.

North star: **Discover → Connect → Curate → Onboard → Activate → Experience → Learn → Grow**

## Source-of-truth order
1. PRODUCT-REQUIREMENTS.md
2. UI-UX-SPEC.md
3. TWENTY-GAP-ANALYSIS.md
4. ARCHITECTURE.md and DATA-MODEL.md
5. SECURITY-RBAC.md
6. ROADMAP.md

## Strategy
Use Twenty as the platform foundation. Do not rebuild authentication, record UI, metadata/custom fields, timeline, tasks/notes, email/calendar, workflows, APIs, import/export or the existing AI runtime unless a documented gap requires it.

La Vivenzia-specific functionality should live in modular LV extensions/apps. Keep the CRM database separate from the main consumer/product database initially and integrate through APIs/events.

AI is an internal operational capability, not the product differentiator. Human approval remains mandatory for critical decisions.
