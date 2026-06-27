# TASK-005 Context

## Task

- Task: `TASK-005`
- Tier: `T2`
- Task record: `.memory-bank/tasks/TASK-005.task.json`
- Packet: `.memory-bank/packets/TASK-005.packet.json`
- Packet status read during execute: `ready`
- Packet source task hash matched: `sha256:4368f50dd31d28cd1fdbaf76a2ae3beb556279b5c56d19987951984069faf8a3`
- Execute owner: `ROLE: GENERAL`
- Date: 2026-06-24

## Goal Interpretation

Purpose: seed a local backend-owned catalog dataset that supports FT-001 browse, category, filter, and search work without Docker, production imports, or external search.

Success outcome: local PostgreSQL contains home goods catalog fixtures with curtain rods, categories, variants, prices, and filter attributes; a smoke command verifies the dataset through the backend/PostgreSQL boundary.

Anti-goals:
- Do not modify Medusa Core.
- Do not import production data.
- Do not introduce external search services.
- Do not require Docker for local catalog seed/smoke.

Allowed write scope:
- `apps/backend/scripts/**`
- `apps/backend/src/**`
- `apps/backend/test/**`
- `README.md`

Forbidden scope:
- Medusa Core modifications
- production data import
- external search service

Stop conditions:
- Catalog data cannot be seeded idempotently into local PostgreSQL.
- Smoke cannot prove browse/category/filter/search seed readiness through backend-owned scripts.
- Implementation requires Docker or production data.

## Authoritative Context Used

- `AGENTS.md`
- `.memory-bank/constitution.md`
- `.memory-bank/mbb/index.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/index.md`
- `.memory-bank/roles/general.md`
- `.memory-bank/tasks/index.json`
- `.memory-bank/tasks/TASK-005.task.json`
- `.memory-bank/packets/TASK-005.packet.json`
- `.memory-bank/features/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/tasks/plans/IMPL-FT-001.md`
- `.memory-bank/domains/core-domain.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/workflows/tier-policy.md`
- `.memory-bank/commands/execute.md`

## Boundary Notes

Responsibility boundary:
- Catalog seed belongs to local backend scripts and local PostgreSQL.
- The smoke check reads from the local database through backend-owned script boundaries.
- Data is non-production fixture data for local browse/filter/search development.

Boundary drift risk: low. Changes are limited to local backend scripts, package script registration, README local verification instructions, and execution artifacts.

## Preflight Result

- Task exists in `.memory-bank/tasks/index.json`.
- Task id matches `TASK-005`.
- Tier is `T2`.
- Task status is `planned`, not `done`, `failed`, or `blocked`.
- Dependency `TASK-004` is `done`.
- Linked SDD specs exist and are concrete.
- Packet hash matches the current task record.
- No semantic contradiction found between task, packet, feature, implementation plan, and SDD specs.
