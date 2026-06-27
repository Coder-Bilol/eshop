---
description: Execution plan for TASK-002 backend database initialization.
status: active
---
# TASK-002 Plan

## Goal Interpretation
- Purpose: Provide the explicit database initialization task required for the local development foundation.
- Success outcome: The backend can initialize, seed, and smoke-test a local PostgreSQL database through the backend persistence boundary.
- Anti-goals:
  - Do not implement business domain schemas beyond scaffold/local seed needs.
  - Do not use production data.
  - Do not bypass backend persistence as the only verification path.
  - Do not use Docker or Docker Compose for local development.
- Allowed write scope:
  - `apps/backend/**`
  - `apps/backend/.env.example`
  - `apps/backend/scripts/**`
  - `README.md`
  - `.protocols/TASK-002/**` and `.tasks/TASK-002/**` as `/execute` artifacts
- Forbidden scope:
  - production database configuration
  - production data import
  - Medusa Core modifications
- Stop conditions:
  - Backend scaffold cannot support PostgreSQL initialization without a design change.
  - Verification cannot prove backend read/write persistence.
  - Implementation requires destructive or production database operations.

## Boundary Notes
- Linked boundary/contracts:
  - `.memory-bank/tech-specs/FT-011-windows-native-local-development.md`
  - `.memory-bank/architecture/system-architecture.md`
  - `.memory-bank/testing/index.md`
- Responsibility boundary:
  - Backend package owns local PostgreSQL configuration, preflight diagnostics, migration, seed, and DB smoke scripts.
  - Local PostgreSQL runs as a Windows service or local process outside Docker.
  - Docker is reserved for future remote server deployment work and is not part of `TASK-002`.
  - Local smoke data must remain non-sensitive and scaffold-only.
- Boundary drift risk:
  - Do not add Docker Compose, production DB settings, real provider secrets, or business domain tables in `TASK-002`.

## Implementation Steps
1. Keep backend `.env.example` local-only with PostgreSQL placeholders.
2. Add a backend-owned non-mutating local PostgreSQL preflight command.
3. Keep backend-owned idempotent migration/seed/smoke scripts.
4. Improve PostgreSQL connection errors so they point to Windows-native local setup, not Docker.
5. Update backend README with the local DB command path.
6. Run packet-sourced gates and store evidence under `.tasks/TASK-002/`.
7. Update protocol progress, verification, and handoff notes.

## Intended Local Gates
- `npm --workspace apps/backend run db:check`
- `npm --workspace apps/backend run db:migrate`
- `npm --workspace apps/backend run db:seed`
- `npm --workspace apps/backend run smoke:db`
- `node --check apps/backend/scripts/local-db.cjs`
- `node --check apps/backend/scripts/db-check.cjs`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff
- `/execute` does not run `/verify`, `/red-verify`, `/mb-sync`, or close the task.
- Next owner should start/provide local PostgreSQL, run `/verify TASK-002`, then scheduler/manual owner can decide closure and sync.
