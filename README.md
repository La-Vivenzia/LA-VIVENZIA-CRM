<h2 align="center">La Vivenzia CRM</h2>

<p align="center">
  The relationship operating system for the La Vivenzia experience ecosystem.
</p>

<p align="center">
  <strong>Discover → Connect → Curate → Onboard → Activate → Experience → Learn → Grow</strong>
</p>

---

## What this is

La Vivenzia CRM captures hosts, partners, stays, experiences, businesses and
community members; classifies and routes them to the right person; and makes
follow-up visible, owned and auditable.

It is built on **Twenty**, an open-source CRM platform, which provides the
underlying application platform: authentication, RBAC, the metadata-driven data
model, the record UI, email and calendar sync, the workflow engine and the agent
runtime. La Vivenzia-specific functionality lives in a single application
package rather than in that platform.

## Attribution and licence

This product is a modified distribution of Twenty
(<https://github.com/twentyhq/twenty>), used under the **GNU Affero General
Public License v3.0**. The full licence text — including the qualifications that
apply to parts of the codebase — is in [`LICENSE`](./LICENSE), unchanged.

La Vivenzia is **not affiliated with or endorsed by Twenty**. The product has
been renamed precisely so that this modified version is not mistaken for
official Twenty software; Twenty's own trademark position is preserved in
[`.github/TRADEMARK.md`](./.github/TRADEMARK.md). Upstream copyright notices and
licence headers throughout the source are retained as the licence requires.

> **AGPL note:** if this CRM is made accessible over a network to anyone outside
> La Vivenzia, AGPL section 13 obliges you to offer those users the
> corresponding source. Take legal advice before any such launch.

## Repository layout

| Path | Contents |
|---|---|
| `packages/twenty-server` | Platform backend (NestJS, PostgreSQL, Redis, GraphQL) |
| `packages/twenty-front` | Platform frontend (React, Vite) |
| `packages/twenty-shared`, `twenty-ui`, `twenty-sdk` | Shared types, design system, application SDK |
| `packages/twenty-apps/internal/lavivenzia-crm` | **All La Vivenzia functionality** |
| `packages/twenty-docker` | Docker Compose, Helm chart, k8s manifests |
| `docs/` | Engineering audit and implementation status |
| `LA_VIVENZIA_CRM_DOCUMENTATION/` | Product, architecture, UX and security documentation |

Package directory names still begin with `twenty-` because they are the upstream
package identifiers used by tens of thousands of import paths. Renaming them
would break every import in the monorepo without changing anything a user sees.

## Running locally

```bash
# infrastructure
docker compose -f packages/twenty-docker/docker-compose.dev.yml up -d

# database
npx nx database:reset twenty-server

# app
yarn start          # server on :3000, frontend on :3001
```

See `docs/IMPLEMENTATION-STATUS.md` for the current state, known environment
issues and the verified local run recipe.

## Building the container image

The Compose file builds the image locally rather than pulling it, because
`lavivenziacrm/lavivenzia-crm` is not published to any registry:

```bash
docker compose -f packages/twenty-docker/docker-compose.yml build
```

Set `LV_IMAGE` to publish under a different repository.
