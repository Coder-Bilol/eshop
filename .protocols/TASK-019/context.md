---
description: Execution context for TASK-019 deterministic cart merge planning.
status: complete
---
# TASK-019 Context

## Routing

- Tier: `T2`
- Task record: `.memory-bank/tasks/TASK-019.task.json`
- Feature: `FT-003`
- Dependency: TASK-017 (`done`)
- Mode: manual `/execute`; implementation handoff only
- Indexed status at start: `planned`
- Execution authority: direct operator request for TASK-019; `/execute` does not
  change task status

## Authoritative Inputs

- `.memory-bank/packets/TASK-019.packet.json`
- `.memory-bank/tasks/plans/IMPL-FT-003.md`
- `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/contracts/cart-api-data-contract.md`
- `.memory-bank/domains/cart-merge-data.md`
- `.memory-bank/states/cart-ownership-merge.md`
- `.memory-bank/architecture/cart-runtime.md`

## Baseline

- TASK-017 provides the PostgreSQL-backed merge journal boundary.
- Medusa 2.16 Cart Module is the authoritative cart/line-item data source.
- No deterministic merge-planning implementation currently exists.
- The worktree contains unrelated prior changes that must be preserved.

## Packet Context

- Path: `.memory-bank/packets/TASK-019.packet.json`
- Status as read: `ready`
- Semantic gaps observed: none
- Structural packet validation/freshness is outside `/execute`; the preceding
  strict doctor completed with no errors
