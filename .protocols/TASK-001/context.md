---
description: Execution context for TASK-001 project workspace and app scaffold.
status: active
---
# TASK-001 Context

## Task
- ID: TASK-001
- Tier: T2
- Task record: `.memory-bank/tasks/TASK-001.task.json`
- Packet: `.memory-bank/packets/TASK-001.packet.json`
- Feature: FT-011 Docker Compose Local Development

## Authoritative Inputs
- `.memory-bank/constitution.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/features/FT-011-docker-compose-local-development.md`
- `.memory-bank/tech-specs/FT-011-docker-compose-local-development.md`
- `.memory-bank/tasks/plans/IMPL-FT-011.md`
- `.memory-bank/requirements.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/contracts/boundary-map.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/workflows/tier-policy.md`

## Preflight
- Task is present in `.memory-bank/tasks/index.json`.
- Task record ID matches `TASK-001`.
- Status at execution start: `ready`.
- Tier: `T2`.
- Dependencies: none.
- Required SDD spec links are present.
- Packet context is present and semantically aligned with the task and FT-011 spec.

## Scope
- Allowed write scope from task: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `README.md`, `apps/storefront/**`, `apps/backend/**`.
- Operational artifacts required by `/execute`: `.protocols/TASK-001/**`, `.tasks/TASK-001/**`.
- Forbidden scope: Medusa Core modifications, production deploy configuration, real provider secrets.

## Existing Worktree Notes
- The worktree had unrelated Memory Bank and protocol changes before execution.
- Those existing changes are preserved and not reverted.
