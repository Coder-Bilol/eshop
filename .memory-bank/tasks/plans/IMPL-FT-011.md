---
description: Implementation plan for FT-011 Docker Compose local development.
status: active
owner: prd-to-tasks
last_updated: 2026-06-20
source_of_truth:
  - .memory-bank/features/FT-011-docker-compose-local-development.md
  - .memory-bank/tech-specs/FT-011-docker-compose-local-development.md
  - .memory-bank/requirements.md
---
# IMPL-FT-011 Docker Compose Local Development

## Goal

Create the local executable foundation for the MVP: root workspace, Next.js storefront baseline, Medusa v2 backend baseline, PostgreSQL-backed database initialization path, Docker Compose orchestration, env templates, and smoke verification.

## Source Artifacts

- [.memory-bank/features/FT-011-docker-compose-local-development.md](../../features/FT-011-docker-compose-local-development.md)
- [.memory-bank/tech-specs/FT-011-docker-compose-local-development.md](../../tech-specs/FT-011-docker-compose-local-development.md)
- [.memory-bank/requirements.md](../../requirements.md)
- [.memory-bank/epics/EP-005-local-development-foundation.md](../../epics/EP-005-local-development-foundation.md)
- [.memory-bank/architecture/system-architecture.md](../../architecture/system-architecture.md)
- [.memory-bank/contracts/boundary-map.md](../../contracts/boundary-map.md)
- [.memory-bank/testing/index.md](../../testing/index.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)

## Constitution Check

- Consistent with KISS and medium-scope MVP: use a simple local monolith workspace and Docker Compose, not microservices or production deployment machinery.
- Consistent with no Medusa Core modification: generated backend scaffold may be configured, but Medusa Core must not be patched.
- Consistent with evidence-before-done: each T2 task requires `/verify` evidence and a ready execution packet.
- Blockers: none for local-only decomposition.

## Waves

| Wave | Task | Purpose |
|---|---|---|
| W1 | TASK-001 | Create root workspace and storefront/backend scaffold files. |
| W1 | TASK-002 | Initialize the backend database path, migrations/seed command, and DB smoke verification. |
| W2 | TASK-003 | Add Docker Compose local stack and env templates for storefront/backend/PostgreSQL. |
| W3 | TASK-004 | Add local smoke scripts and runbook for repeatable developer verification. |

## Expected Touched Files

- `package.json`
- `package-lock.json`
- `tsconfig*.json`
- `.gitignore`
- `.env.example`
- `apps/storefront/**`
- `apps/backend/**`
- `docker-compose.yml`
- `scripts/**`
- `README.md`
- `.memory-bank/runbooks/local-development.md`

## Tests And Gates

- `node scripts/mb-lint.mjs`
- `npm install`
- `npm --workspace apps/backend run db:migrate`
- `npm --workspace apps/backend run db:seed`
- `npm --workspace apps/backend run smoke:db`
- `docker compose config`
- `docker compose up -d --build`
- `npm run smoke:local`

Implementation may adjust command names when the generated scaffold requires it, but task verification must still prove the same outcomes.

## UAT Steps

1. Clone a clean checkout.
2. Copy `.env.example` templates to local `.env` files without adding production secrets.
3. Run dependency installation.
4. Start the stack with Docker Compose.
5. Confirm PostgreSQL, backend, and storefront are healthy.
6. Run DB-backed smoke verification through the backend boundary.
7. Stop the local stack without deleting local data by default.

## Acceptance Coverage

| Acceptance item | Covered by |
|---|---|
| Covers REQ-030 | TASK-001, TASK-002, TASK-003, TASK-004 |
| Docker Compose starts storefront/backend/database | TASK-003, TASK-004 |
| Local setup supports later integration/e2e verification | TASK-002, TASK-004 |
| Database initialization exists | TASK-002 |
| Project scaffold files exist | TASK-001 |

## Handoff

- Next gate before execution: run `/mb-doctor` for the feature/task-queue boundary.
- Do not start `/execute` from this command.
