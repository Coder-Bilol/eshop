---
description: Windows-native local development runbook for storefront, backend, and PostgreSQL.
status: active
owner: TASK-004
last_updated: 2026-06-24
source_of_truth:
  - .memory-bank/tech-specs/FT-011-windows-native-local-development.md
  - .memory-bank/tasks/TASK-004.task.json
---
# Local Development Runbook

## Scope

This runbook covers local development on Windows 10 using native Node.js/npm
processes and a local PostgreSQL service. Docker containers are not part of the
local development path. Docker may be designed later only for a remote server
deployment path.

## Prerequisites

- Windows 10.
- Node.js 20 or newer and npm on `PATH`.
- PostgreSQL installed and running locally as a Windows service or local process.
- Repository dependencies installed with `npm install`.
- Local config copied only when overrides are needed:
  - `.env.example` -> `.env`
  - `apps/backend/.env.example` -> `apps/backend/.env`
  - `apps/storefront/.env.example` -> `apps/storefront/.env`

Real `.env` files are ignored by git. Do not put production credentials,
production database URLs, live OAuth secrets, live YooKassa secrets, webhook
secrets, or production data in local templates or task evidence.

## Check Local Environment

Run:

```bash
npm run check:local-env
```

Expected result:
- Windows platform is detected.
- Node.js and npm are available.
- root/backend/storefront `.env.example` templates exist.
- real `.env` files are ignored.
- local PostgreSQL is reachable through backend `db:check`.
- output reports `dockerRequired:false`.

If PostgreSQL is not reachable, start the Windows PostgreSQL service and verify
that `DATABASE_URL` points to the local database, for example
`postgres://postgres:postgres@127.0.0.1:5432/eshop`.

## Start Local Services

For an automated bounded startup check:

```bash
npm run dev:local
```

For interactive development:

```bash
npm run dev:local:watch
```

Expected services:
- backend npm process from `apps/backend`;
- storefront npm process from `apps/storefront`;
- PostgreSQL remains the local Windows service or local process.

Stop interactive local services with `Ctrl+C` in the terminal that started
`npm run dev:local:watch`. Stopping Node processes must not delete local
PostgreSQL data.

## Run Local Smoke

Run one command:

```bash
npm run smoke:local
```

The smoke command verifies:
- local env prerequisites;
- backend migration path;
- backend seed path with non-production seed data;
- backend DB read/write smoke through the backend package boundary;
- backend TypeScript typecheck;
- storefront TypeScript typecheck.

Store task execution evidence under `.tasks/TASK-XXX/`, for example:

```bash
npm run smoke:local *> .tasks/TASK-004/execute-smoke-local.txt
```

## Port Conflicts

Default local ports:
- storefront: `3000`;
- backend: `9000`;
- PostgreSQL: `5432`.

If a port is busy, stop the process using that port or override the local value
in a real `.env` file. Keep overrides local-only and do not commit real `.env`
files.

## Local-Only Reset Behavior

The default stop path preserves local PostgreSQL data.

Do not use destructive reset as part of normal verification. If a local reset is
needed, it must be an explicit operator action against the local development
database only. Never run reset commands against production, staging, provider
systems, or live payment data as local proof.

## Troubleshooting

- `ECONNREFUSED 127.0.0.1:5432`: start PostgreSQL on Windows or fix
  `DATABASE_URL` in `apps/backend/.env`.
- `DATABASE_URL must include a database name`: ensure the URL path contains the
  local database name, for example `/eshop`.
- Port check fails for `3000` or `9000`: stop the process using the port or set
  local override values before starting services.
- Typecheck fails: fix the reported workspace code issue before treating local
  smoke as passing.

## Verification Gate

Before later feature work depends on the local foundation, run:

```bash
npm run check:local-env
npm run smoke:local
node scripts/mb-lint.mjs
```

All three commands must pass without Docker containers and without production
credentials.
