---
description: Execution context for TASK-002 backend database initialization.
status: active
---
# TASK-002 Context

## Task
- ID: TASK-002
- Tier: T2
- Task record: `.memory-bank/tasks/TASK-002.task.json`
- Packet: `.memory-bank/packets/TASK-002.packet.json`
- Feature: FT-011 Windows Native Local Development

## Authoritative Inputs
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/features/FT-011-windows-native-local-development.md`
- `.memory-bank/tech-specs/FT-011-windows-native-local-development.md`
- `.memory-bank/tasks/plans/IMPL-FT-011.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/workflows/tier-policy.md`

## Preflight
- Task is present in `.memory-bank/tasks/index.json`.
- Task record ID matches `TASK-002`.
- Status at execution start: `planned`.
- Tier: `T2`.
- Dependency `TASK-001` is `done`.
- Required SDD spec links are present.
- Packet context is present and semantically aligned with the task and FT-011 spec.
- Global backbone status is complete and routes local runtime to Windows-native Node.js/npm plus local PostgreSQL.

## Scope
- Allowed write scope from task: `apps/backend/**`, `apps/backend/.env.example`, `apps/backend/scripts/**`, `README.md`.
- Operational artifacts required by `/execute`: `.protocols/TASK-002/**`, `.tasks/TASK-002/**`.
- Forbidden scope: production database configuration, production data import, Medusa Core modifications.

## Existing Worktree Notes
- The worktree already contains unrelated Memory Bank/task/protocol changes from prior planning and `TASK-001`.
- Those existing changes are preserved and not reverted.
