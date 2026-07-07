---
description: Execution plan for TASK-018 Store cart client and browser reference adapter.
status: complete
---
# TASK-018 Plan

## Goal Interpretation

- Purpose: provide the narrow browser-to-Medusa boundary for guest cart
  persistence before cart UI integration.
- Success outcome: storefront code can use built-in Store cart CRUD and recover
  a cart through a safe opaque browser reference.
- Anti-goals: no cart UI, authenticated merge, OAuth, custom backend cart CRUD,
  checkout, order, or payment behavior.
- Allowed write scope:
  - `apps/storefront/lib/cart.ts`
  - `apps/storefront/src/cart-client.test.cjs`
  - `apps/storefront/src/test-runner.cjs`
  - `.memory-bank/changelog.md`
- Forbidden scope: custom backend cart CRUD, OAuth/login, checkout/order/payment.
- Stop conditions: installed Store contract conflict, need to persist cart
  payload/auth data, or inability to distinguish reference from cart truth.

## Boundary Notes

- Linked contracts/specs: cart API/data contract, cart runtime architecture,
  access/security contract, and FT-003 feature hub.
- Responsibility boundary: the client owns REST transport and error
  normalization; the adapter owns only `{ version, cart_id }`.
- Boundary drift risk: adding UI orchestration, merge semantics, ownership
  decisions, or browser-authoritative cart snapshots would exceed scope.

## Steps

1. Confirm installed Medusa 2.16 route handlers and response shapes.
2. Add a typed REST client for create/retrieve/add/update/remove.
3. Add exact, versioned reference read/write/clear and stale-404 recovery.
4. Add a focused unit suite and register it in the existing runner.
5. Run packet-sourced local gates and record evidence.
6. Hand off to `/verify TASK-018` without changing task status.

## Intended Local Gates

- `npm --workspace apps/storefront run test -- cart-client`
- `npm --workspace apps/storefront run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff

`/execute` records implementation documentation only. `/verify` and the explicit
closure owner decide task closure; `/mb-sync` follows that decision.
