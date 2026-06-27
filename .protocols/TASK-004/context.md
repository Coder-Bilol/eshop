# TASK-004 Context

## Task

- Task: `TASK-004`
- Tier: `T2`
- Task record: `.memory-bank/tasks/TASK-004.task.json`
- Packet: `.memory-bank/packets/TASK-004.packet.json`
- Packet status read during execute: `ready`
- Execute owner: `ROLE: GENERAL`
- Date: 2026-06-24

## Goal Interpretation

Purpose: make the local foundation repeatably verifiable by developers and later agents.

Success outcome: a developer can follow the runbook and run one local smoke command that verifies the Windows-native local runtime is usable.

Anti-goals:
- Do not make smoke checks depend on live providers.
- Do not use destructive data reset as the default verification path.
- Do not mark the feature complete without Windows-native local runtime evidence.

Allowed write scope:
- `scripts/**`
- `package.json`
- `README.md`
- `.memory-bank/runbooks/local-development.md`
- `.memory-bank/changelog.md`

Forbidden scope:
- production deploy instructions as an implemented target
- real provider credentials
- live payment mutation

Stop conditions:
- Smoke checks cannot verify all required local services.
- Runbook requires production secrets or live provider credentials.
- Verification would delete local data without explicit operator action.

## Authoritative Context Used

- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/tasks/index.json`
- `.memory-bank/tasks/TASK-004.task.json`
- `.memory-bank/packets/TASK-004.packet.json`
- `.memory-bank/features/FT-011-windows-native-local-development.md`
- `.memory-bank/tech-specs/FT-011-windows-native-local-development.md`
- `.memory-bank/tasks/plans/IMPL-FT-011.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/workflows/tier-policy.md`
- `.protocols/FT-011/plan.md`
- `.protocols/FT-011/decision-log.md`

## Boundary Notes

Responsibility boundary:
- Local smoke remains Windows-native and uses npm/local PostgreSQL only.
- Runbook documents local setup and verification, not remote deployment.
- Reset behavior is explicit and local-only, never default.

Boundary drift risk: low. Changes are limited to smoke summary metadata, runbook, README pointer, changelog, and evidence/protocol files.

## Preflight Result

- Task exists in `.memory-bank/tasks/index.json`.
- Task id matches `TASK-004`.
- Tier is `T2`.
- Task status is `planned`, not `done`, `failed`, or `blocked`.
- Dependency `TASK-003` is `done`.
- Linked SDD specs exist and are concrete.
- No semantic contradiction found between task, packet, feature, implementation plan, and SDD specs.
