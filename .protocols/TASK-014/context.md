---
description: TASK-014 execution context.
status: active
---
# TASK-014 Context

## Task
- ID: `TASK-014`
- Title: Add FT-002 integration and e2e verification
- Tier: `T2`
- Task record: `.memory-bank/tasks/TASK-014.task.json`
- Packet: `.memory-bank/packets/TASK-014.packet.json`
- Packet status read by `/execute`: `ready`

## Mode
- Command: `/execute TASK-014`
- Role: `GENERAL`
- `/execute` does not close the task, run `/verify`, run `/red-verify`, run `/mb-sync`, or write final task status.

## Preflight
- Task is indexed in `.memory-bank/tasks/index.json`.
- Task record exists and `id` matches `TASK-014`.
- Tier is valid: `T2`.
- Status at execute start: `planned`.
- Dependencies:
  - `TASK-009`: `done`
  - `TASK-013`: `done`
- Required packet exists and was read as derivative context.
- Linked SDD specs exist and were read before implementation.

## Context Used
- `AGENTS.md`
- `.memory-bank/commands/execute.md`
- `.memory-bank/spec-backbone.md`
- `.memory-bank/spec-index.md`
- `.memory-bank/tasks/TASK-014.task.json`
- `.memory-bank/packets/TASK-014.packet.json`
- `.memory-bank/features/FT-002-product-detail-variant-selection.md`
- `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md`
- `.memory-bank/tasks/plans/IMPL-FT-002.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/workflows/tier-policy.md`
- `.memory-bank/requirements.md`
- Existing backend/storefront product-detail implementation and tests.

## Goal Interpretation
- Purpose: Provide executable acceptance evidence for FT-002 as a feature.
- Success outcome: Product detail, variant selection, unavailable/default SKU cases, and selected variant handoff are verified through local integration/e2e evidence.
- Anti-goals:
  - Do not mark FT-002 complete from unit tests alone.
  - Do not use production data or live providers.
  - Do not implement FT-003 durable cart persistence or cart merge.
  - Do not implement checkout, order, payment, or inventory behavior.
- Allowed write scope:
  - `apps/backend/test/**`
  - `apps/storefront/tests/**`
  - `apps/storefront/e2e/**`
  - `package.json`
  - `README.md`
  - `.memory-bank/changelog.md`
- Forbidden scope:
  - production data
  - live provider integrations
  - durable cart persistence or cart merge
  - checkout/order/payment implementation
- Stop conditions:
  - Windows-native local runtime is unavailable.
  - Tests cannot prove variant behavior through seeded backend data.
  - E2E coverage requires scope outside FT-002 acceptance criteria.

## Boundary Notes
- Linked boundary/contracts:
  - `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md`
  - `.memory-bank/testing/index.md`
  - `.memory-bank/workflows/tier-policy.md`
- Responsibility boundary:
  - TASK-014 owns verification harness/tests/evidence for FT-002, not product behavior expansion.
  - FT-002 owns variant/SKU selection and a narrow cart-action handoff only.
  - FT-003 owns durable cart persistence and merge.
- Boundary drift risk:
  - E2E must not convert the cart handoff stub into durable cart behavior.
  - Browser evidence must use seeded backend/PostgreSQL data, not hardcoded frontend-only data.

## Dirty Worktree Note
- Pre-existing uncommitted changes related to `TASK-009` closure were present before TASK-014 edits.
- They are treated as user/existing changes and must not be reverted.
