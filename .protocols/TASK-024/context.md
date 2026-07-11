---
description: TASK-024 execution context for post-auth cart merge handoff.
status: active
---
# TASK-024 Context

## Command
- `/execute TASK-024`

## Role And Mode
- Role: GENERAL.
- Mode: `/execute` implementation handoff only.
- Task closure is out of scope for this run.

## Task Record
- Path: `.memory-bank/tasks/TASK-024.task.json`
- Title: Add post-auth cart merge handoff.
- Tier: T3.
- Status at preflight: planned.
- Dependencies: `TASK-021` done, `TASK-022` done.

## Packet Context
- Path: `.memory-bank/packets/TASK-024.packet.json`
- Packet status read by `/execute`: ready.
- Packet is derivative context only; structural freshness/hash validation belongs to `/verify`, `/red-verify`, `/mb-doctor`, or scheduler gates.

## Authoritative Inputs Used
- `.memory-bank/commands/execute.md`
- `.memory-bank/tasks/TASK-024.task.json`
- `.memory-bank/packets/TASK-024.packet.json`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/contracts/cart-api-data-contract.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/states/cart-ownership-merge.md`
- `.memory-bank/tasks/plans/IMPL-FT-003.md`
- `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/workflows/tier-policy.md`

## Preflight Result
- Task exists in `.memory-bank/tasks/index.json`.
- Task id matches `TASK-024`.
- Tier is `T3`.
- Task is not blocked, failed, or done.
- Required dependencies are done.
- Linked SDD specs exist and are concrete.
- No semantic contradiction found between task record, packet summary, FT-003 specs, and implementation plan.

## Worktree Note
- The worktree was already dirty before TASK-024 edits, including prior TASK-021..TASK-023 docs/protocols and storefront cart UI files.
- This run must preserve unrelated existing changes and only edit TASK-024 allowed scope plus required protocol/evidence artifacts.
