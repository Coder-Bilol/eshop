---
description: TASK-026 execution plan for browser cart persistence and merge acceptance.
status: active
---
# TASK-026 Plan

## Goal Interpretation

- Purpose: provide buyer-visible acceptance evidence for guest cart persistence
  and the post-auth merge handoff.
- Success outcome: REQ-006 through REQ-008 pass in a real browser against local
  Medusa/PostgreSQL with exact merged quantities and no reusable consumed source.
- Anti-goals: no live OAuth providers, production data, checkout, order,
  inventory reservation, payment, backend production behavior, or browser-only
  proof of backend ownership/compensation.
- Allowed write scope:
  - `apps/storefront/package.json`
  - `apps/storefront/e2e/run-real-medusa-e2e.cjs`
  - `apps/storefront/lib/cart.ts`
  - `apps/storefront/src/cart-client.test.cjs`
  - `apps/storefront/.env.example`
  - `apps/backend/src/scripts/seed-catalog.ts`
  - `.memory-bank/changelog.md`
- Forbidden scope:
  - backend production behavior
  - live OAuth providers or credentials
  - production data
  - checkout, order, inventory reservation, or payment
- Stop conditions:
  - Browser flow cannot run against real local Medusa/PostgreSQL.
  - Authenticated fixture cannot prove backend-selected target.
  - Required evidence would depend on live provider or production mutation.

## Boundary Notes

- Linked boundary/contracts: FT-003 tech spec, cart API/data contract, cart
  access/security contract, testing index, implementation plan, and tier policy.
- Responsibility boundary: TASK-026 adds acceptance evidence in the storefront
  E2E runner only. It must not change backend merge semantics or storefront
  production runtime behavior.
- Boundary drift risk: adding provider-specific auth, a test-only backend route,
  production credentials, checkout/order/payment flow, or client-selected
  destination/customer identity would exceed scope.

## Intended Implementation

1. Extend the existing real-Medusa Playwright runner with a `cart` suite.
2. Keep catalog/product-detail runner behavior compatible, while routing explicit
   `cart` suite artifacts under `.tasks/TASK-026/playwright/`.
3. Use standard local Medusa emailpass bearer auth for a synthetic customer;
   no live OAuth providers or production credentials.
4. Prove guest product-detail add, cart update/remove, reload/new-context restore,
   backend-selected merge target switch, replay without duplicate quantity, and
   consumed-source ordinary Store not-found behavior.
5. Register a narrow package script alias for the cart E2E suite.
6. Record evidence and hand off to `/verify TASK-026` without changing task status.

## Approved Scope Extension

- The user explicitly authorized continuation after the blocked handoff.
- The extension is limited to `apps/storefront/lib/cart.ts` and its existing
  focused `cart-client` test.
- The user selected `Москва` as the Medusa Store default region. The extension
  includes only the local Medusa catalog seed update that writes
  `default_region_id` alongside the existing default sales channel.
- The user approved a narrow E2E-only trigger in
  `apps/storefront/components/cart-provider.tsx` so Playwright can invoke the
  actual `mergeAfterAuthentication()` handoff without adding provider login UI.
- No cart client region heuristic, new cart API, merge behavior, OAuth, checkout,
  order, inventory reservation, or payment behavior is permitted.
- `NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID` is public runtime configuration, sourced
  from local seed output for E2E and from storefront environment configuration
  for ordinary runtime. It is not customer identity or an authority selected by
  browser state.

## Intended Local Gates

- `npm run smoke:local`
- `npm --workspace apps/storefront run test:e2e -- cart`
- `npm run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff

- `/execute` records implementation evidence only.
- `/verify TASK-026`, per-task `/red-verify TASK-026`, T3 markers, and final
  status decision belong to later explicit owners.
