---
description: Execution context for TASK-039 storefront wishlist state.
status: active
---
# TASK-039 Context

## Authoritative Inputs

- Task: `.memory-bank/tasks/TASK-039.task.json` (`T3`, `in_progress`).
- Packet: `.memory-bank/packets/TASK-039.packet.json` (`ready` derivative context;
  packet readiness is owned by the scheduler/doctor and is not repaired here).
- Feature contract: `.memory-bank/tech-specs/FT-005-authenticated-wishlist.md`.
- API/security contract: `.memory-bank/contracts/wishlist-api-security.md`.
- Auth/session state: `.memory-bank/states/customer-auth-session.md`.
- Auth/session security: `.memory-bank/contracts/auth-session-security.md`.
- Plan: `.memory-bank/tasks/plans/IMPL-FT-005.md`.
- Global routing: `.memory-bank/spec-backbone.md`, `.memory-bank/spec-index.md`,
  `.memory-bank/workflows/tier-policy.md`.

## Goal Interpretation

- Purpose: provide one session-aware in-memory wishlist boundary for storefront
  controls and future wishlist pages.
- Success outcome: a successful current-customer session loads and mutates backend
  wishlist truth, including while cart readiness is `merge_blocked`; each product
  has independent pending/error state; guest, logout, and expired-session paths
  retain no wishlist state or customer association.
- Anti-goals: no wishlist markup/page/catalog/detail controls, backend/API/auth
  changes, guest merge, orders/payments, or browser wishlist persistence.
- Allowed write scope: `apps/storefront/lib/wishlist.ts`,
  `apps/storefront/lib/wishlist-state.ts`,
  `apps/storefront/components/wishlist-provider.tsx`,
  `apps/storefront/app/layout.tsx`, the two scoped wishlist tests,
  `apps/storefront/src/test-runner.cjs`, and `.memory-bank/changelog.md`.
- Forbidden scope: backend API/auth, cart merge semantics, checkout, wishlist UI
  markup, guest favorite merge, browser storage, orders, and payments.
- Stop conditions: current-customer success/401 cannot be consumed truthfully,
  wishlist becomes coupled to cart merge/checkout readiness, backend response
  truth cannot be adopted, or implementation requires browser-persisted data.

## Boundary Notes

- AuthProvider owns current-customer/session capability. WishlistProvider consumes
  successful `session_established` plus the opaque customer ID and does not invoke
  cart merge or create another auth lifecycle.
- StoreWishlistClient owns session-cookie Store API transport, response validation,
  and sanitized stable errors. Backend remains the only durable wishlist source.
- Wishlist state owns only transient items, customer association, list error, and
  per-product pending/error state. It must never read or write browser storage.
- Logout is cleared only after AuthProvider confirms the session transition by
  removing the customer association; session-expiry `401` from wishlist operations
  clears the in-memory boundary immediately.

## Dependency Evidence

- TASK-030 implementation/verification handoff proves `credentials: include`,
  current-customer success/401 behavior, logout/session cleanup, and no token
  storage: `.tasks/TASK-030/TASK-030-S-VERIFY-final-report-code-07.md` and
  `.protocols/TASK-030/handoff.md`.
- TASK-038 handoff/verification proves authenticated wishlist list/add/remove
  routes, actor-derived ownership, exact response shape, stable `401`, and
  session-cookie HTTP behavior: `.tasks/TASK-038/TASK-038-S-IMPL-final-report-code-04.md`,
  `.tasks/TASK-038/TASK-038-S-VERIFY-final-report-code-05.md`, and
  `.protocols/TASK-038/handoff.md`.

## Preflight

- No TASK-039 protocol or storefront wishlist source existed before this run.
- Existing unrelated dirty changes are preserved; no dirty allowed-scope source
  file was present before implementation.
- Task status, packet, scheduler state, and closure markers are outside this run.
