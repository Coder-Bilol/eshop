---
description: Execution plan for TASK-022 guest cart state orchestration.
status: complete
---
# TASK-022 Plan

## Goal Interpretation

- Purpose: provide one deterministic guest-cart state boundary before rendering
  and post-auth integration.
- Success outcome: storefront state can create, restore, mutate, and recover a
  backend-owned guest cart without browser-authoritative data.
- Anti-goals: no cart page markup, authenticated merge, OAuth, checkout, order,
  payment, or cached cart payloads in local storage.
- Allowed write scope:
  - `apps/storefront/lib/cart-state.ts`
  - `apps/storefront/components/cart-provider.tsx`
  - `apps/storefront/src/cart-state.test.cjs`
  - `apps/storefront/src/test-runner.cjs`
  - `.memory-bank/changelog.md`
- Forbidden scope:
  - cart page/product-detail rendering
  - authenticated merge or OAuth
  - backend, checkout, order, or payment behavior
- Stop conditions:
  - The Store client cannot expose required backend response state.
  - Persistence would require storing cart contents or auth credentials.
  - Recovery cannot distinguish stale reference from backend failure.

## Boundary Notes

- Linked boundary/contracts: FT-003 feature hub, cart runtime architecture, cart
  API/data contract, access/security contract, merge data spec, ownership/merge
  state spec, global API guidelines, and order/payment/inventory guardrails.
- Responsibility boundary: cart state orchestrates client calls, local loading
  and recoverable error states, and reference writes/clears. Backend cart
  responses remain the only cart payload truth.
- Boundary drift risk: adding UI rendering, product-detail integration,
  authenticated merge, target-reference switching, or custom backend behavior
  would exceed this task.

## Steps

1. Add a pure cart state controller over the TASK-018 Store client and reference
   adapter.
2. Persist only returned backend cart IDs after create/mutation responses.
3. Clear stale/not-found references while retaining references for backend
   failures and validation/conflict states.
4. Add a thin React provider for later UI slices without rendering cart markup.
5. Add focused cart-state tests and register the suite.
6. Update the Memory Bank changelog and record local gate evidence.

## Intended Local Gates

- `npm --workspace apps/storefront run test -- cart-state`
- `npm --workspace apps/storefront run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff

`/execute` records implementation documentation only. `/verify` and the explicit
closure owner decide task closure; `/mb-sync` follows that decision.
