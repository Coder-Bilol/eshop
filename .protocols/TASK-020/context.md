---
description: Execution context for TASK-020 compensatable cart merge lifecycle.
status: complete
---
# TASK-020 Context

## Routing

- Tier: T3
- Task record: `.memory-bank/tasks/TASK-020.task.json`
- Feature: FT-003
- Dependency: TASK-019 (`done`)
- Mode: manual `/execute`; implementation handoff only

## Authoritative Inputs

- `.memory-bank/packets/TASK-020.packet.json`
- `.memory-bank/tasks/plans/IMPL-FT-003.md`
- `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/architecture/cart-runtime.md`
- `.memory-bank/contracts/cart-api-data-contract.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/domains/cart-merge-data.md`
- `.memory-bank/states/cart-ownership-merge.md`
- `.memory-bank/constitution.md`
- `.memory-bank/workflows/tier-policy.md`

## Baseline

- TASK-017 provides the PostgreSQL-backed `CartMerge` journal.
- TASK-019 provides deterministic immutable planning and is closed `done`.
- Medusa 2.16 exposes Cart Module soft-delete/restore, the Locking Module, and
  the core ownership-transfer, add-to-cart, refresh, and inventory workflows.
- The worktree contains existing TASK-017..TASK-019 and TASK-018 changes; this
  run preserves them and edits only the TASK-020 scope.
- The first independent `/verify` failed because direct Cart Module line/customer
  mutations bypassed core pricing, tax, promotion, and workflow behavior.
- Remediation input:
  `.memory-bank/bugs/TASK-020-core-cart-workflow-bypass.md`.
- Per-task `/red-verify` on 2026-07-07 failed because TASK-020 rejected
  duplicate target same-variant lines that TASK-019 and the linked SDD model as
  aggregateable.
- Duplicate-line remediation input:
  `.memory-bank/bugs/TASK-020-duplicate-target-variant-lines.md`.

## Packet Context

- Path: `.memory-bank/packets/TASK-020.packet.json`
- Status as read: `ready`
- Semantic gaps: none observed
- Structural freshness is owned by the prior doctor/scheduler gate.
