---
description: Windows-native local development runbook for storefront, backend, and PostgreSQL.
status: active
owner: TASK-004
last_updated: 2026-07-01
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

## Prepare Medusa Backend

After installing dependencies or creating a new local database, run:

```bash
npm --workspace apps/backend run db:migrate:medusa
npm --workspace apps/backend run db:migrate
npm --workspace apps/backend run db:seed
npm --workspace apps/backend run seed:medusa:catalog
```

The first command creates and updates the canonical Medusa module schema. The
second and third commands maintain infrastructure-only local smoke records. The
fourth command idempotently creates the local catalog through supported Medusa
workflows: categories, product types, products, options, variants, prices,
inventory levels, sales-channel links, and a publishable API key. Its JSON
output includes the local `publishable_api_key` value required by Store API
clients. All commands target the local `DATABASE_URL`; do not run local setup
commands against production or staging.

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

To verify and run the compiled Medusa backend:

```bash
npm --workspace apps/backend run build
npm --workspace apps/backend run start
```

Expected endpoints:
- backend health: `http://localhost:9000/health`;
- Medusa Admin: `http://localhost:9000/app`;
- Store API routes under `http://localhost:9000/store/*`.

Store API routes require the `x-publishable-api-key` emitted by
`seed:medusa:catalog`. The key scopes catalog visibility and inventory
availability to its linked sales channel.

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

Run the canonical catalog checks separately when catalog behavior changes:

```bash
npm --workspace apps/backend run smoke:catalog
npm --workspace apps/backend run smoke:product-detail
```

Run buyer-flow browser verification through the compiled Medusa Store runtime:

```bash
npm --workspace apps/storefront run test:e2e -- catalog product-detail
```

The E2E runner builds the backend, repeats the idempotent canonical seed, reads
the local publishable key from seed output, starts compiled `medusa start`,
passes the key to Next.js, and verifies both missing-key rejection and
key-scoped success. It writes trace/screenshots under
`.tasks/TASK-016/playwright/` and must report `processCleanup:
ports-released`.

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
- Missing Medusa tables such as `region_country`, `tax_provider`, or
  `payment_provider`: run
  `npm --workspace apps/backend run db:migrate:medusa`.
- `Could not find index.html in the admin build directory`: run the backend
  build again and start it through the workspace `start` script, which launches
  from `.medusa/server`.
- Port check fails for `3000` or `9000`: stop the process using the port or set
  local override values before starting services.
- Typecheck fails: fix the reported workspace code issue before treating local
  smoke as passing.

## Verification Gate

Before later feature work depends on the local foundation, run:

```bash
npm run check:local-env
npm run smoke:local
npm --workspace apps/backend run build
node scripts/mb-lint.mjs
```

All commands must pass without Docker containers and without production
credentials.
