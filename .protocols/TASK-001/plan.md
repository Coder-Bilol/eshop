---
description: Execution plan for TASK-001 project workspace and app scaffold.
status: active
---
# TASK-001 Plan

## Goal Interpretation
- Purpose: Create the executable project scaffold that later feature tasks can build on.
- Success outcome: A clean checkout has a root workspace and separate storefront/backend app baselines ready for local setup.
- Anti-goals:
  - Do not implement business features.
  - Do not add production deployment scope.
  - Do not commit real provider credentials.
- Allowed write scope:
  - `package.json`
  - `package-lock.json`
  - `tsconfig.json`
  - `.gitignore`
  - `README.md`
  - `apps/storefront/**`
  - `apps/backend/**`
  - `.protocols/TASK-001/**` and `.tasks/TASK-001/**` as `/execute` artifacts
- Forbidden scope:
  - Medusa Core modifications
  - production deploy configuration
  - real provider secrets
- Stop conditions:
  - Selected scaffold contradicts FT-011 tech spec.
  - Implementation requires production credentials or production deploy decisions.
  - Scaffold requires changing Medusa Core.

## Boundary Notes
- Linked boundary/contracts:
  - `.memory-bank/contracts/boundary-map.md`
  - `.memory-bank/architecture/system-architecture.md`
  - `.memory-bank/tech-specs/FT-011-docker-compose-local-development.md`
- Responsibility boundary:
  - Root workspace owns package orchestration.
  - `apps/storefront` owns buyer UI baseline.
  - `apps/backend` owns Medusa v2 backend baseline.
- Boundary drift risk:
  - Do not include Docker Compose, DB migration/seed/smoke, provider integrations, or business flows in TASK-001.

## Implementation Steps
1. Add root npm workspace metadata and shared TypeScript config.
2. Add `.gitignore` for dependencies, build output, local env files, logs, and local data.
3. Add minimal Next.js storefront scaffold under `apps/storefront`.
4. Add minimal Medusa v2 backend scaffold under `apps/backend`.
5. Run task gates and store evidence under `.tasks/TASK-001/`.
6. Update protocol progress, verification, and handoff notes.

## Intended Local Gates
- `npm install`
- `npm run`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff
- `/execute` does not run `/verify`, `/red-verify`, `/mb-sync`, or close the task.
- Next owner should run `/verify TASK-001` and then scheduler/manual owner can decide closure and sync.
