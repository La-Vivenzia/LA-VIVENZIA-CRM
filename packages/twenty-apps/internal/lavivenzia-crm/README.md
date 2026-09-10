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
