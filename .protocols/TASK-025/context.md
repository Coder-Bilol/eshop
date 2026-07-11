---
description: TASK-025 execution context for backend cart merge acceptance suite.
status: active
---
# TASK-025 Context

## Command
- `/execute TASK-025`

## Role And Mode
- Role: GENERAL.
- Mode: `/execute` implementation handoff only.
- Task closure is out of scope for this run.

## Task Record
- Path: `.memory-bank/tasks/TASK-025.task.json`
- Title: Add backend cart merge acceptance suite.
- Tier: T3.
- Status at preflight: planned.
- Dependencies: `TASK-021` done.

## Packet Context
- Path: `.memory-bank/packets/TASK-025.packet.json`
- Packet status read by `/execute`: ready.
- Packet is derivative context only; structural freshness/hash validation belongs to `/verify`, `/red-verify`, `/mb-doctor`, or scheduler gates.

## Authoritative Inputs Used
- `.memory-bank/commands/execute.md`
- `.memory-bank/tasks/TASK-025.task.json`
- `.memory-bank/packets/TASK-025.packet.json`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/architecture/cart-runtime.md`
- `.memory-bank/contracts/cart-api-data-contract.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/domains/cart-merge-data.md`
- `.memory-bank/states/cart-ownership-merge.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/tasks/plans/IMPL-FT-003.md`
- `.memory-bank/constitution.md`
- `.memory-bank/workflows/tier-policy.md`

## Preflight Result
- Task exists in `.memory-bank/tasks/index.json`.
- Task id matches `TASK-025`.
- Tier is `T3`.
- Task is not blocked, failed, or done.
- Required dependency `TASK-021` is done.
- Linked SDD specs exist and are concrete.
- No semantic contradiction found between task record, packet, FT-003 specs, implementation plan, and acceptance criteria.

## Worktree Note
- The worktree was already dirty before TASK-025 edits, including prior TASK-021..TASK-024 docs/protocols and storefront cart changes.
- This run must preserve unrelated existing changes and only edit TASK-025 allowed scope plus required protocol/evidence artifacts.
