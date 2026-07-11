---
description: Execution context for TASK-022 guest cart state orchestration.
status: complete
---
# TASK-022 Context

## Routing

- Tier: T2
- Task record: `.memory-bank/tasks/TASK-022.task.json`
- Feature: FT-003
- Dependencies: TASK-018 (`done`)
- Mode: manual `/execute`; implementation handoff only

## Authoritative Inputs

- `.memory-bank/packets/TASK-022.packet.json`
- `.memory-bank/tasks/plans/IMPL-FT-003.md`
- `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/architecture/cart-runtime.md`
- `.memory-bank/contracts/cart-api-data-contract.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/domains/cart-merge-data.md`
- `.memory-bank/states/cart-ownership-merge.md`
- `.memory-bank/states/order-payment-inventory.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/workflows/tier-policy.md`

## Baseline

- TASK-018 provides the Store cart client and reference-only browser adapter in
  `apps/storefront/lib/cart.ts`.
- `apps/storefront/lib/cart-state.ts`, `components/cart-provider.tsx`, and
  `src/cart-state.test.cjs` do not exist at execution start.
- `apps/storefront/src/test-runner.cjs` has catalog, cart-client, and
  product-detail suites registered.
- `git` is not available in the current PowerShell PATH, so scope is tracked
  against the task's explicit allowed file list.

## Packet Context

- Path: `.memory-bank/packets/TASK-022.packet.json`
- Status as read: `ready`
- Semantic gaps: none observed
- Structural freshness is owned by the prior doctor/scheduler gate, not
  `/execute`.
