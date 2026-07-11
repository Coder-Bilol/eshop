---
description: Execution plan for TASK-023 product detail and guest cart UI.
status: complete
---
# TASK-023 Plan

## Goal Interpretation

- Purpose: turn guest-cart state orchestration into the buyer-visible add, view,
  update, remove, and reload flow.
- Success outcome: a buyer can use a persistent backend-owned guest cart from
  product detail through the cart page.
- Anti-goals: no authenticated merge, login, checkout, order, inventory
  reservation, payment, FT-002 validation replacement, or browser-authoritative
  cart data.
- Allowed write scope:
  - `apps/storefront/app/layout.tsx`
  - `apps/storefront/app/cart/**`
  - `apps/storefront/components/cart-view.tsx`
  - `apps/storefront/components/product-detail-selector.tsx`
  - `apps/storefront/src/cart-view.test.cjs`
  - `apps/storefront/src/product-detail.test.cjs`
  - `apps/storefront/src/test-runner.cjs`
  - `.memory-bank/changelog.md`
- Forbidden scope:
  - authenticated merge or OAuth
  - backend cart APIs
  - checkout, order, inventory reservation, or payment
- Stop conditions:
  - FT-002 no longer supplies a valid Product Variant ID.
  - Rendered success cannot be tied to a backend cart response.
  - Required UI behavior conflicts with the linked UX contract.

## Boundary Notes

- Linked boundary/contracts: FT-003 UX contract, cart runtime architecture,
  cart API/data contract, cart access/security, cart ownership/merge state, and
  FT-002 product-detail variant handoff.
- Responsibility boundary: product detail may call guest-cart add only after
  FT-002 returns a valid Medusa Product Variant ID; cart page may render only
  backend-returned cart fields and drive absolute update/remove through
  TASK-022 state functions.
- Boundary drift risk: custom backend route changes, local cart payload caching,
  auth/merge behavior, checkout/order/payment prompts, or replacing variant
  selection semantics would exceed scope.

## Steps

1. Wrap the app in the cart provider without global auto-restore so the cart
   page can distinguish empty from stale reference on reload.
2. Replace the product-detail stub with a real `addItem` call using
   `selected_variant_id` and preserving disabled/blocked selection states.
3. Add `/cart` page and a client cart view for restore, backend truth display,
   absolute quantity update, remove, empty/loading/stale/validation/conflict/
   backend failure states, and retry/clear actions.
4. Add focused source/component tests and update product-detail regression.
5. Run packet-sourced local gates and record evidence.
6. Hand off to `/verify TASK-023` without changing task status.

## Intended Local Gates

- `npm --workspace apps/storefront run test -- cart-view`
- `npm --workspace apps/storefront run test -- product-detail`
- `npm --workspace apps/storefront run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff

`/execute` records implementation documentation only. `/verify` and the explicit
closure owner decide task closure; `/mb-sync` follows that decision.
