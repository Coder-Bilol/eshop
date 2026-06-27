---
description: Implementation plan for FT-011 Windows native local development.
status: active
owner: prd-to-tasks
last_updated: 2026-06-23
source_of_truth:
  - .memory-bank/features/FT-011-windows-native-local-development.md
  - .memory-bank/tech-specs/FT-011-windows-native-local-development.md
  - .memory-bank/requirements.md
---
# IMPL-FT-011 Windows Native Local Development

## Goal

Create the local executable foundation for the MVP: root workspace, Next.js storefront baseline, Medusa v2 backend baseline, PostgreSQL-backed database initialization path, Windows-native npm startup scripts, env templates, and smoke verification.

## Source Artifacts

- [.memory-bank/features/FT-011-windows-native-local-development.md](../../features/FT-011-windows-native-local-development.md)
- [.memory-bank/tech-specs/FT-011-windows-native-local-development.md](../../tech-specs/FT-011-windows-native-local-development.md)
- [.memory-bank/requirements.md](../../requirements.md)
- [.memory-bank/epics/EP-005-local-development-foundation.md](../../epics/EP-005-local-development-foundation.md)
- [.memory-bank/architecture/system-architecture.md](../../architecture/system-architecture.md)
- [.memory-bank/contracts/boundary-map.md](../../contracts/boundary-map.md)
- [.memory-bank/testing/index.md](../../testing/index.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)

## Constitution Check

- Consistent with KISS and medium-scope MVP: use a simple local monolith workspace and Windows-native npm scripts, not Docker containers, microservices, or production deployment machinery.
- Consistent with no Medusa Core modification: generated backend scaffold may be configured, but Medusa Core must not be patched.
- Consistent with evidence-before-done: each T2 task requires `/verify` evidence and a ready execution packet.
- Blockers: none for local-only decomposition.

## Global Wave Classification

- W1: project-wide foundation that every later feature depends on.
- W2: core feature implementation after the local foundation exists.
- W3: polish, final acceptance, and cross-feature verification that should wait for key tasks from other features.

## Waves

| Wave | Task | Purpose |
|---|---|---|
| W1 | TASK-001 | Create root workspace and storefront/backend scaffold files. |
| W1 | TASK-002 | Initialize the backend database path, migrations/seed command, and DB smoke verification. |
| W1 | TASK-003 | Add Windows-native local runtime scripts and env templates for storefront/backend/PostgreSQL. |
| W1 | TASK-004 | Add local smoke scripts and runbook for repeatable developer verification. |

## Expected Touched Files

- `package.json`
- `package-lock.json`
- `tsconfig*.json`
- `.gitignore`
- `.env.example`
- `apps/storefront/**`
- `apps/backend/**`
- `scripts/**`
- `README.md`
- `.memory-bank/runbooks/local-development.md`

## Tests And Gates

- `node scripts/mb-lint.mjs`
- `npm install`
- `npm --workspace apps/backend run db:migrate`
- `npm --workspace apps/backend run db:seed`
- `npm --workspace apps/backend run smoke:db`
- local PostgreSQL preflight or documented Windows connection check
- `npm run dev:local` or equivalent Windows-native startup command
- `npm run smoke:local`

Implementation may adjust command names when the generated scaffold requires it, but task verification must still prove the same outcomes.

## UAT Steps

1. Clone a clean checkout.
2. Copy `.env.example` templates to local `.env` files without adding production secrets.
3. Run dependency installation.
4. Ensure local PostgreSQL is running on Windows 10.
5. Start backend and storefront with Windows-native npm scripts.
6. Confirm PostgreSQL, backend, and storefront are healthy.
7. Run DB-backed smoke verification through the backend boundary.
8. Stop local Node processes without deleting local PostgreSQL data by default.

## Acceptance Coverage

| Acceptance item | Covered by |
|---|---|
| Covers REQ-030 | TASK-001, TASK-002, TASK-003, TASK-004 |
| Windows-native local path starts/verifies storefront/backend/database | TASK-003, TASK-004 |
| Local setup supports later integration/e2e verification | TASK-002, TASK-004 |
| Database initialization exists | TASK-002 |
| Project scaffold files exist | TASK-001 |

## Handoff

- Next gate before execution: run `/mb-doctor` for the feature/task-queue boundary.
- Do not start `/execute` from this command.
