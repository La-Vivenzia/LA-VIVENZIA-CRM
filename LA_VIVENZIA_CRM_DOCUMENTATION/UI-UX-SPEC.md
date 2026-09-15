# Approved UI/UX Specification

## Brand tokens
Pine Green `#1F4D3A`
Sage Green `#6B846F`
Warm Gold `#D4AF37`
Sand Beige `#F3EFE7`
Charcoal `#1A1A1A`

## Theme
Light and dark modes. Use semantic tokens so the primary hue can later change from green to blue without component redesign.

## Typography
Luxury serif display direction similar to Cinzel; modern sans UI/body direction similar to Sora. Use approved/licensed equivalents in implementation.

## Product feeling
Premium, editorial, calm, sophisticated, spacious, human, travel/lifestyle oriented and high trust. Avoid generic enterprise SaaS visual language.

## Visual reference
`https://lavivenziademo.vercel.app` is the approved consumer visual reference. It is separate from the CRM product UI.

## CRM principles
Mobile-first, desktop-capable, fast task completion, strong hierarchy, minimal noise, clear next actions, reusable cards/tables/record pages and premium typography/whitespace.

## Responsive QA
320, 375, 390, 430, 768, 1024, 1280, 1440, 1920px.

## Required screens
Sign in, MFA, Join, Become a Host, Dashboard, Lead list, Lead profile, Lead capture, Timeline, Onboarding, Tasks, Notifications, Search, Copilot, Analytics, Settings, Categories and Workflows.

## Reference assets
Inspect every actual image in `public/ui-reference/`. Recreate using real React/HTML/CSS, never screenshots.

---

## Implementation notes (Day 7B, 2026-09-15)

The specification above is implemented as documented in
`DAY_7B_DESIGN_SYSTEM.md`. Decisions taken where the spec left room:

- **Type faces.** Cinzel and Sora are used directly (both are SIL Open Font
  License) and **self-hosted** in `packages/twenty-front/public/fonts/lv/`
  — no font CDN. Cinzel is reserved for page titles, KPI figures and the
  wordmark; Sora carries all reading text. Cinzel sets lowercase as small
  caps by design.
- **Semantic tokens.** `--lv-primary`, `--lv-primary-hover`,
  `--lv-primary-muted`, `--lv-sage`, `--lv-gold`, `--lv-gold-ink`, `--lv-bg`,
  `--lv-surface`, `--lv-surface-elevated`, `--lv-surface-sunken`,
  `--lv-surface-inverse`, `--lv-heading`, `--lv-text`, `--lv-text-muted`,
  `--lv-text-subtle`, `--lv-border`, `--lv-border-strong`, `--lv-ring`,
  `--lv-danger`, `--lv-success`, `--lv-warning`, `--lv-info` (+ `-muted`
  washes) and `--lv-shadow-*`. The source of truth is
  `lv-core/ui/tokens.ts`; the shell stylesheet is generated from it. A hue
  change (green → blue) is a change to that one file.
- **Dark mode** is designed on deep pine grounds, following the consumer
  reference's dark palette, not an inversion.
- **Reference assets.** `public/ui-reference/` does not exist in this
  repository; the visual references used were the consumer site, the SaaS
  repository's `DESIGN.md` / `globals.css` and its brand assets
  (`logo-lavivenzia.png`, `logo-mark.png`).
- **Responsive QA** was run at 390 and 1440 in Chromium for every LV surface
  in both schemes (see TESTING-QA.md); the layout rules are mobile-first with
  breakpoints at 768 and 1024.
- **Required screens** covered here: Sign in, Dashboard, Lead list, Lead
  profile (Lead 360), Lead capture (Quick add), Timeline, Onboarding, Tasks,
  Notifications, Search (Twenty command menu, themed), Copilot, Analytics
  (Control Tower), Settings (Twenty, themed), Workflows (Twenty, themed).
  MFA, Join and Become a Host are Twenty / consumer-site flows outside the
  CRM application and inherit the shell theme only.
