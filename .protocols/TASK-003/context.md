# TASK-003 Context

## Task

- Task: `TASK-003`
- Tier: `T2`
- Task record: `.memory-bank/tasks/TASK-003.task.json`
- Packet: `.memory-bank/packets/TASK-003.packet.json`
- Packet status read during execute: `ready`
- Execute owner: `ROLE: GENERAL`
- Date: 2026-06-23

## Goal Interpretation

Purpose: provide the Windows-native local runtime path required by `REQ-030`.

Success outcome: a developer can start or verify local PostgreSQL, backend, and storefront on Windows 10 without Docker containers using non-secret env templates.

Anti-goals:
- Do not add remote server deployment configuration.
- Do not use Docker or Docker Compose for local development.
- Do not wire real payment/OAuth/email provider credentials.
- Do not replace Medusa Admin with a custom admin.

Allowed write scope:
- `.env.example`
- `.gitignore`
- `apps/storefront/.env.example`
- `apps/backend/.env.example`
- `package.json`
- `scripts/**`
- `README.md`

Forbidden scope:
- remote server deployment files
- real secrets
- live provider integration behavior

Stop conditions:
- Local Windows-native setup needs production secrets to start.
- Local runtime cannot verify PostgreSQL, backend, and storefront.
- Implementation requires adding an external managed service.

## Authoritative Context Used

- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/tasks/index.json`
- `.memory-bank/tasks/TASK-003.task.json`
- `.memory-bank/packets/TASK-003.packet.json`
- `.memory-bank/features/FT-011-windows-native-local-development.md`
- `.memory-bank/tech-specs/FT-011-windows-native-local-development.md`
- `.memory-bank/tasks/plans/IMPL-FT-011.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/contracts/boundary-map.md`
- `.memory-bank/workflows/tier-policy.md`

## Boundary Notes

Linked boundary/contracts:
- `.memory-bank/contracts/boundary-map.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/tech-specs/FT-011-windows-native-local-development.md`

Responsibility boundary:
- PostgreSQL remains a local Windows service outside Docker.
- Backend and storefront start through npm workspace commands.
- Provider credentials are placeholders only.
- No production deploy or live provider behavior is introduced.

Boundary drift risk: low after implementation. Changes stay inside local runtime scripts, env templates, README, and gitignore.

## Preflight Result

- Task exists in `.memory-bank/tasks/index.json`.
- Task id matches `TASK-003`.
- Tier is `T2`.
- Task status is `planned`, not `done`, `failed`, or `blocked`.
- Dependency `TASK-001` is `done`.
- Linked SDD specs exist and are concrete.
- No semantic contradiction found between task, packet, feature, implementation plan, and SDD specs.
