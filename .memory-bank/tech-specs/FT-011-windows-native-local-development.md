---
description: Feature tech spec for FT-011 Windows native local development.
status: active
owner: prd-to-tasks
last_updated: 2026-06-23
source_of_truth:
  - .memory-bank/features/FT-011-windows-native-local-development.md
  - .memory-bank/requirements.md
  - .memory-bank/architecture/system-architecture.md
  - .memory-bank/testing/index.md
---
# FT-011 Windows Native Local Development

## Scope

FT-011 creates the executable local development foundation for the MVP:

- root workspace and application scaffold files;
- Next.js storefront app baseline;
- Medusa v2 backend app baseline;
- local Windows PostgreSQL database service;
- backend-owned database initialization, migration, and seed/smoke path;
- Windows-native npm scripts and local process model for storefront and backend;
- local environment templates without production secrets;
- smoke verification that later integration/e2e tasks can reuse.

FT-011 does not implement catalog, cart, auth, checkout, payment, order, inventory, notification, or production deployment behavior beyond the minimum scaffold needed to start services.

Docker is not part of the local development path. Docker may be introduced later only for a future remote server deployment path, and that work is outside FT-011.

## Normative Inputs

- [.memory-bank/features/FT-011-windows-native-local-development.md](../features/FT-011-windows-native-local-development.md): feature scope and acceptance criteria.
- [.memory-bank/requirements.md](../requirements.md): REQ-030 and RTM smoke expectation.
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md): modular monolith, Windows-native local runtime, PostgreSQL storage, and no current remote deploy implementation.
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md): local Windows runtime config, backend, storefront, and integration boundary constraints.
- [.memory-bank/testing/index.md](../testing/index.md): smoke and integration readiness gates.
- [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md): T2 routing for cross-service local runtime and persistence tasks.
- [.memory-bank/constitution.md](../constitution.md): KISS, no Medusa Core modification, no secrets, and evidence-before-done principles.

## Design Decisions

| Area | Decision | Rationale |
|---|---|---|
| Repository scaffold | Use a simple root workspace with `apps/storefront` and `apps/backend`, root package scripts, TypeScript config, and generated app baselines. | Gives later features stable paths without adding enterprise tooling. |
| Package manager | Use npm workspaces unless implementation discovers a hard Medusa/Next scaffold constraint. | No package manager is currently present; npm keeps the baseline low-maintenance. |
| Local runtime | Windows-native npm scripts own local backend/storefront process startup; PostgreSQL runs as a local Windows service or local process. | REQ-030 requires a reproducible local path without Docker containers. |
| Database initialization | PostgreSQL is initialized through the backend/Medusa-supported migration and seed path, with a smoke check that exercises read/write through the backend persistence boundary. | Prevents a DB-only proof that bypasses the backend source of truth. |
| Seed data | Include only non-sensitive local seed data needed for service health and later smoke/integration tests. | Keeps local verification useful without committing production data. |
| Environment configuration | Commit `.env.example` templates and ignore real `.env` files. Use placeholders for OAuth, YooKassa, webhook, and email values. | Satisfies local configuration needs without committing secrets. |
| Provider behavior | FT-011 may include mock/placeholders for YooKassa/webhook/email config but must not create live provider integrations or process real payments. | Payment correctness belongs to later payment tasks; live secrets are out of scope. |
| Ports | Use conventional local defaults and allow overrides through env values. Document port conflict recovery. | Keeps setup predictable while supporting local conflicts. |
| Docker boundary | Docker is not used for local development. Docker may be designed later only for remote server deployment. | Preserves the user decision while leaving future deploy work possible. |
| Tier hints | Scaffold, DB init, and Windows-native runtime tasks are T2 because they touch multiple modules, local runtime, and persistence. Remote deploy/Docker server work, live secrets, destructive data, auth, and payments remain T3 stop conditions. | Aligns with tier policy while keeping FT-011 scoped to local development. |

## Local Service Contract

The local runtime must provide these services:

| Service | Responsibility | Required local proof |
|---|---|---|
| local PostgreSQL | Durable local database for Medusa/backend state, installed/running on Windows 10 outside Docker. | Service is reachable and backend can run migrations/seed plus read/write smoke. |
| backend npm process | Medusa v2 backend baseline and future API/module host. | Backend starts against local PostgreSQL and exposes a health or equivalent smoke endpoint/command. |
| storefront npm process | Next.js buyer UI baseline. | Storefront starts and can reach configured backend URL or report configured health state. |

Medusa Admin may be exposed through the backend-supported local path if the selected Medusa scaffold provides it. FT-011 must not create a custom admin replacement.

## Database Initialization Requirements

- Database setup must be owned by backend scripts or supported Medusa commands, not by ad hoc direct SQL as the only source of truth.
- The implementation must include a deterministic local path for:
  - checking local PostgreSQL prerequisites and configured connection URL;
  - applying backend/Medusa migrations;
  - loading minimal local seed data when needed;
  - verifying a read/write path through the backend persistence boundary.
- The smoke check must fail when the backend cannot connect to PostgreSQL.
- Local PostgreSQL data must be preserved by default. A destructive reset path may be documented, but it must be explicit and local-only.

## Environment And Secrets

- Commit only examples/templates, such as root `.env.example` and app-level `.env.example` files.
- Real `.env` files and provider credentials must be gitignored.
- Placeholder values must make secret fields obvious without resembling real credentials.
- Local YooKassa/webhook settings may be documented as mock/tunnel placeholders only. Real payment credentials and real webhook processing are out of scope for FT-011.
- Remote server deployment, Docker deployment files, production origins, domains, deploy targets, and production secrets are not designed here.

## Verification Targets

Generated `/prd-to-tasks FT-011` records should include evidence for:

- root workspace and app scaffold paths exist;
- backend scaffold uses a PostgreSQL-backed local configuration path;
- database migration/seed/smoke path exists and exercises backend read/write persistence;
- local Windows PostgreSQL prerequisite check exists;
- local backend and storefront startup/smoke path exists without Docker containers;
- backend and storefront smoke checks pass locally;
- `.env.example` templates exist and real `.env` files are ignored;
- Memory Bank lint passes after task updates.

Recommended checks:

- `node scripts/mb-lint.mjs` after Memory Bank/task updates;
- `npm install` after scaffold task implementation;
- `npm --workspace apps/backend run db:migrate` or equivalent supported backend migration command;
- `npm --workspace apps/backend run db:seed` when seed data exists;
- `npm --workspace apps/backend run smoke:db` for DB-backed read/write smoke;
- a local PostgreSQL preflight command or documented `pg_isready`/connection check on Windows;
- `npm run dev:local` or equivalent Windows-native local startup command when implemented;
- `npm run smoke:local` or equivalent local smoke script.

## Anti-goals

- Do not modify Medusa Core.
- Do not introduce microservices, Kubernetes, external managed databases, or enterprise deployment tooling.
- Do not use Docker or Docker Compose as the local development runtime.
- Do not commit real provider secrets, OAuth credentials, payment credentials, webhook secrets, or production data.
- Do not implement live YooKassa, OAuth, email provider, order, inventory, or checkout behavior in FT-011.
- Do not treat a direct database connection check as sufficient proof for backend persistence; include backend boundary evidence.
- Do not add remote server deployment or Docker server deployment scope.

## Open Questions

None blocking for task decomposition. Exact scaffold commands, package versions, and Windows PostgreSQL service name are implementation details, but the resulting repo must preserve the service boundaries, local-only scope, and verification targets above.
