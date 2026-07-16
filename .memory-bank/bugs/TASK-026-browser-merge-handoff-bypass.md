---
description: Archived resolved TASK-026 blocker where browser acceptance bypassed the storefront post-auth merge handoff.
status: archived
owner: verify
last_updated: 2026-07-12
source_of_truth:
  - .memory-bank/tasks/TASK-026.task.json
  - .memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/contracts/cart-api-data-contract.md
  - apps/storefront/e2e/run-real-medusa-e2e.cjs
  - apps/storefront/lib/cart-merge.ts
  - apps/storefront/components/cart-provider.tsx
---
# TASK-026 Browser Merge Handoff Bypass

## Summary

TASK-026's Playwright suite passes its backend merge route assertions, but it
does not exercise the storefront post-auth handoff that the task must provide
buyer-visible evidence for.

The E2E runner calls the merge endpoint directly from the browser and manually
writes the returned target ID into local storage. It therefore bypasses
`mergeAfterAuthentication()`, `mergeAuthenticatedCartReference()`, and their
response-validation and state-restoration behavior.

## Impact

The current evidence proves that the backend merge API and manually switched
browser reference can produce the expected cart. It does not prove that the
storefront handoff atomically adopts a validated backend-selected target after
authentication.

This is material because TASK-026 is the real-browser acceptance task for the
post-auth merge handoff and FT-003 UX contract. A regression in the actual
handoff can remain hidden while the E2E suite passes.

## Evidence

- `apps/storefront/e2e/run-real-medusa-e2e.cjs` calls `mergeCartInBrowser()` for
  the source cart and then `writeBrowserCartReference()` for the response target.
- `mergeCartInBrowser()` uses direct `page.evaluate` fetch to
  `POST /store/carts/{source_cart_id}/merge` with a synthetic bearer token.
- `writeBrowserCartReference()` directly writes `{ version, cart_id }` into
  `localStorage`.
- `apps/storefront/components/cart-provider.tsx` exposes the intended
  `mergeAfterAuthentication()` handoff, which calls
  `mergeAuthenticatedCartReference()` and restores the provider state after
  success.
- `apps/storefront/lib/cart-merge.ts` owns request/response validation before
  the target reference is written.
- Fresh `npm --workspace apps/storefront run test:e2e -- cart` passes, confirming
  the gap is a false-success acceptance harness issue rather than a runtime
  failure.

## Required Resolution

- Change the browser acceptance path to exercise the actual storefront
  post-auth merge handoff and observe its state/reference transition.
- Keep synthetic local Medusa authentication; do not add live OAuth providers,
  a test-only backend merge route, production data, checkout, order, inventory
  reservation, or payment scope.
- Preserve checks for backend-selected target identity, consumed-source Store
  not-found, and replay without duplicate quantity.
- Rerun `/verify TASK-026`, then per-task `/red-verify TASK-026` after a
  functional PASS.

## Resolution

Resolved on 2026-07-12:

- The user approved a narrow E2E-only trigger in `CartProvider`, gated by
  `NEXT_PUBLIC_E2E_CART_HANDOFF=true` and absent from ordinary runtime behavior.
- The Playwright runner now dispatches that trigger, which calls the existing
  `mergeAfterAuthentication()` provider handoff.
- A synthetic local emailpass bearer fixture is injected only into the E2E merge
  request boundary; the production merge client remains provider-agnostic.
- The browser suite verifies the actual handoff result includes backend-selected
  source/target IDs, `merged`/`already_merged` outcome, reference switch, and
  restored provider state.
- Replay runs in a stale browser context that retains the consumed source
  reference, then invokes the same actual handoff and verifies the target is
  adopted without duplicate quantity.
- Fresh E2E, Windows-native smoke, workspace typecheck, and Memory Bank lint
  pass.
