# La Vivenzia â€” Pune Pilot CRM Documentation Hub

This directory contains the complete technical specifications, architectural decisions, testing records, and manual QA protocols for the **Pune Pilot CRM Sprint**.

---

## Directory Structure

```text
docs/pune-pilot-crm/
â”œâ”€â”€ README.md               # Master sprint documentation index
â”œâ”€â”€ task-1/                 # Task 1: Leads Zone/Vibe Filters & Capture Pilot Zone (Complete)
â”‚   â”œâ”€â”€ task-1-pune-pilot-crm-implementation.md
â”‚   â”œâ”€â”€ task-1-pune-pilot-crm-technical-decisions.md
â”‚   â”œâ”€â”€ task-1-pune-pilot-crm-test-report.md
â”‚   â”œâ”€â”€ task-1-pune-pilot-crm-manual-qa.md
â”‚   â””â”€â”€ task-1-pune-pilot-crm-release-readiness.md
â”œâ”€â”€ task-2/                 # Task 2: Onboarding Workflow & SLA Tracking (Upcoming)
â”‚   â””â”€â”€ README.md
â””â”€â”€ task-3/                 # Task 3: Sandbox Importer & Visiting-Card OCR (Upcoming)
    â””â”€â”€ README.md
```

---

## Task Overview & Status

| Task | Name / Focus | Status | Branch | Primary Documentation |
|---|---|---|---|---|
| **Task 1** | **Pune Pilot Leads & Vibe Filters** | **`READY FOR REVIEW`** | `feature/shlok-pune-pilot-crm` | [Task 1 Implementation](./task-1/task-1-pune-pilot-crm-implementation.md) |
| **Task 2** | **Onboarding Workflow & SLA Widget** | `UPCOMING` | TBD | [Task 2 Index](./task-2/README.md) |
| **Task 3** | **Sandbox Importer & Visiting-Card OCR** | `UPCOMING` | TBD | [Task 3 Index](./task-3/README.md) |

---

## Task 1 Documentation Quick Links

1. **[Implementation Specification](./task-1/task-1-pune-pilot-crm-implementation.md):** Architecture, data flow, user-visible changes, and complete change inventory.
2. **[Technical Decisions Log](./task-1/task-1-pune-pilot-crm-technical-decisions.md):** Detailed rationale for all 12 key design decisions (separate `pilotZone` field, deterministic UUIDv5 options, defensive taxonomy, no name-guessing heuristics).
3. **[QA Test Report & Verification Record](./task-1/task-1-pune-pilot-crm-test-report.md):** Exact test commands, 53 passing automated tests, baseline failure analysis, typecheck, and lint verification.
4. **[Manual QA Checklist](./task-1/task-1-pune-pilot-crm-manual-qa.md):** 41-test manual verification protocol with step-by-step instructions across 5 categories and a 4-record fictional QA dataset template.
5. **[Release Readiness & Handover Protocol](./task-1/task-1-pune-pilot-crm-release-readiness.md):** Readiness matrix, deployment instructions, metadata sync prerequisites (`syncApplication`), and sign-off criteria.
