---
description: Execution context for TASK-023 product detail and guest cart UI.
status: complete
---
# TASK-023 Context

## Routing

- Tier: T2
- Task record: `.memory-bank/tasks/TASK-023.task.json`
- Feature: FT-003
- Dependencies: TASK-022 (`done`)
- Mode: manual `/execute`; implementation handoff only

## Authoritative Inputs

- `.memory-bank/packets/TASK-023.packet.json`
- `.memory-bank/tasks/plans/IMPL-FT-003.md`
- `.memory-bank/features/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/architecture/cart-runtime.md`
- `.memory-bank/contracts/cart-api-data-contract.md`
- `.memory-bank/contracts/cart-access-security.md`
- `.memory-bank/domains/cart-merge-data.md`
- `.memory-bank/states/cart-ownership-merge.md`
- `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/states/order-payment-inventory.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/workflows/tier-policy.md`

## Baseline

- TASK-022 has been verified and closed as `done`.
- `apps/storefront/lib/cart-state.ts` and
  `apps/storefront/components/cart-provider.tsx` provide the guest-cart state
  boundary.
- `apps/storefront/components/product-detail-selector.tsx` still has the
  FT-002 local handoff failure stub.
- `/cart` route and `components/cart-view.tsx` do not exist at execution start.
- `git` is not available in the current PowerShell PATH, so scope is tracked
  against the task's explicit allowed file list.

## Packet Context

- Path: `.memory-bank/packets/TASK-023.packet.json`
- Status as read: `ready`
- Semantic gaps: none observed
- Structural freshness is owned by the prior doctor/scheduler gate, not
  `/execute`.
