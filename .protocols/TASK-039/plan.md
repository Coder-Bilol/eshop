---
description: Implementation plan for TASK-039 storefront wishlist state.
status: active
---
# TASK-039 Plan

## Implementation Steps

1. Add a session-cookie wishlist client for backend list/add/remove contracts with
   strict response validation and sanitized error mapping.
2. Add an in-memory state controller that associates data with the current customer,
   adopts list/add truth, isolates product pending/errors, suppresses duplicate
   product mutations, and invalidates stale responses on session changes.
3. Add a client provider connected only to AuthProvider current-customer capability;
   mount it inside the existing CartProvider/AuthProvider boundary without coupling
   to cart merge or checkout status.
4. Add focused client/state tests for credentials, API shape/errors, merge-blocked
   independence, backend truth, per-product concurrency, guest no-op, session expiry,
   logout clearing, stale response invalidation, and browser-storage absence.
5. Run the packet-assigned storefront tests, storefront typecheck, Memory Bank lint,
   and scoped syntax/diff checks when feasible; record evidence without closure.

## Intended Gates

- `npm --workspace apps/storefront run test -- wishlist-client`
- `npm --workspace apps/storefront run test -- wishlist-state`
- `npm --workspace apps/storefront run typecheck`
- `node scripts/mb-lint.mjs`

## Scope Guard

- Do not edit auth, cart, backend, page, catalog, product-detail, or payment files.
- Do not add localStorage/sessionStorage access, wishlist snapshots, product IDs,
  customer IDs, or pending intent persistence.
- Do not add a second auth/session or cart-merge state machine.

## Handoff

- `/execute` returns implementation evidence only. Scheduler/reviewer owns
  `/verify`, `/red-verify`, T3 markers, lifecycle, and `/mb-sync`.
