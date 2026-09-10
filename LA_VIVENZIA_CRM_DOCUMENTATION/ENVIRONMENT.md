# Environment

Use a clean Git fork of the selected Twenty baseline.

Workflow: clone/fork → confirm baseline → install → start infrastructure → configure local env → verify unchanged Twenty → add LV modules incrementally → test → commit small logical units.

Environments: local, development, staging, production.

Secrets include DB, Redis, OAuth, email, AI, storage, webhooks and encryption keys. Never commit secrets.

Production requires backups, restore tests, monitoring, alerting, error tracking, migration runbook, rollback runbook and incident response.
