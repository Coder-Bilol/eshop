---
description: Execution context for TASK-017 cart merge journal persistence.
status: complete
---
# TASK-017 Context

## Routing

- Tier: T2
- Task record: `.memory-bank/tasks/TASK-017.task.json`
- Feature: FT-003
- Dependency: TASK-016 (`done`)
- Mode: manual `/execute`; implementation handoff only

## Authoritative Inputs

- `.memory-bank/packets/TASK-017.packet.json`
- `.memory-bank/tasks/plans/IMPL-FT-003.md`
- `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/architecture/cart-runtime.md`
- `.memory-bank/domains/cart-merge-data.md`
- `.memory-bank/workflows/tier-policy.md`

## Baseline

- Medusa 2.16 backend is present and TASK-016 is complete.
- PostgreSQL is the only durable store.
- No custom cart-merge module currently exists.
- Existing catalog implementation and unrelated dirty worktree changes are out of
  scope and must be preserved.

## Packet Context

- Path: `.memory-bank/packets/TASK-017.packet.json`
- Status as read: `ready`
- Gaps: none observed semantically
- Structural freshness was handled by the prior feature/task-queue gate, not by
  this `/execute`.
