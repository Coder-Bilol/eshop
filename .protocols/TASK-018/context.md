---
description: Execution context for TASK-018 Store cart client and browser reference adapter.
status: complete
---
# TASK-018 Context

## Routing

- Tier: T2
- Task record: `.memory-bank/tasks/TASK-018.task.json`
- Feature: FT-003
- Dependencies: TASK-013 and TASK-016 (`done`)
- Mode: manual `/execute`; implementation handoff only

## Authoritative Inputs

- `.memory-bank/packets/TASK-018.packet.json`
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

- Medusa 2.16.0 Store cart routes are installed and expose the documented
  create/retrieve/add/update/delete contracts.
- Storefront has catalog and product-detail REST helpers but no cart client,
  reference adapter, or cart-client test suite.
- The worktree contains unrelated existing FT-003/backend changes, including
  TASK-019 artifacts; they are preserved and outside TASK-018.

## Packet Context

- Path: `.memory-bank/packets/TASK-018.packet.json`
- Status as read: `ready`
- Semantic gaps: none observed
- Structural freshness is owned by the prior doctor/scheduler gate, not
  `/execute`.
