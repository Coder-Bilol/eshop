---
description: TASK-013 execution context for storefront product detail variant UI.
status: active
---
# TASK-013 Context

## Task

- Tier: `T2`
- Authoritative record: `.memory-bank/tasks/TASK-013.task.json`
- Feature: `FT-002`
- Mode: manual `/execute`
- Dependencies: `TASK-011` and `TASK-012` are `done`.
- Packet: `.memory-bank/packets/TASK-013.packet.json` (`ready`)

## Goal Interpretation

- Purpose: expose the backend product detail contract through buyer-facing
  product detail and product-card variant UI.
- Success outcome: the buyer can select exactly one sellable SKU and reach a
  narrow cart-action handoff; invalid selections remain blocked.
- Anti-goals: no durable cart, cart merge, checkout, auth, payment, order, or
  inventory reservation behavior.
- Allowed write scope: `apps/storefront/app/**`,
  `apps/storefront/src/**`, `apps/storefront/components/**`,
  `apps/storefront/lib/**`, and `apps/storefront/package.json`.
- Forbidden scope: backend contract changes, durable cart behavior, checkout,
  order, payment, auth, and inventory reservation.
- Stop conditions: backend contract cannot be consumed, FT-002 API semantics
  must change, or invalid/valid handoff states cannot be demonstrated.

## Normative Context

- `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/states/order-payment-inventory.md`
- `.memory-bank/workflows/tier-policy.md`
- `.memory-bank/tasks/plans/IMPL-FT-002.md`

## Boundary Notes

- Responsibility boundary: backend/PostgreSQL remains product, variant, price,
  and availability source of truth; storefront owns display and transient
  option-selection state.
- Cart boundary: FT-002 emits a validated handoff payload only. FT-003 owns
  durable cart mutation and persistence.
- Availability boundary: product detail blocks variants already reported
  unavailable, but does not reserve stock or claim final consistency.
- Boundary drift risk: implementing browser persistence or backend writes would
  exceed this task.

## Existing Worktree

Before TASK-013 execution, the worktree already contained uncommitted TASK-012
changes under `.memory-bank/`, `.protocols/TASK-012/`, `.tasks/TASK-012/`,
`apps/storefront/lib/product-detail.ts`, and storefront test-runner files.
These changes are dependencies and must be preserved.
