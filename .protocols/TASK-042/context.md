---
description: Execution context for TASK-042 real-browser authenticated wishlist acceptance.
status: in_progress
---
# TASK-042 Context

## Role And Mode

- Role: Implementer.
- Task: `TASK-042`, scheduler mode, tier `T3`.
- Authoritative task record remains `in_progress`; `/execute` does not change it.
- `/verify`, `/red-verify`, `/mb-sync`, and lifecycle closure are explicitly out of
  this worker run.

## Authoritative Inputs

- `.memory-bank/tasks/TASK-042.task.json`
- `.memory-bank/packets/TASK-042.packet.json`
- `.memory-bank/tech-specs/FT-005-authenticated-wishlist.md`
- `.memory-bank/contracts/wishlist-api-security.md`
- `.memory-bank/domains/wishlist-data.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/tasks/plans/IMPL-FT-005.md`
- `.memory-bank/workflows/tier-policy.md`

## Dependency Evidence

- TASK-034 provides the real-browser FT-004 provider-double and session-cookie
  acceptance boundary.
- TASK-040 provides the catalog/detail controls and authenticated wishlist page.
- TASK-041 provides the real Medusa/PostgreSQL synthetic wishlist lifecycle fixtures,
  hidden-product behavior, restoration, and out-of-stock backend acceptance.

## Goal Interpretation

- Purpose: prove buyer-visible authenticated wishlist behavior through the real
  storefront, Medusa Store API, local PostgreSQL, and FT-004 session boundary.
- Success outcome: catalog/detail/wishlist add, reload, remove, isolation, guest
  denial, merge-blocked capability, visibility, unavailable state, logout, expiry,
  and storage privacy are observable without production data or sensitive evidence.
- Anti-goals: no production wishlist/auth/catalog changes, no live OAuth, no new
  bearer mechanism, no PII, cookies, tokens, session IDs, secrets, variant favorites,
  sharing, recommendations, or task lifecycle changes.

## Allowed Write Scope

- `apps/storefront/e2e/run-real-medusa-e2e.cjs`
- `apps/storefront/package.json`
- `.memory-bank/changelog.md`
- T3 protocol and operational evidence under `.protocols/TASK-042/` and
  `.tasks/TASK-042/`.

## Forbidden Scope

- Production wishlist/auth/catalog behavior.
- Backend production source, live providers, production data, task JSON, packet,
  scheduler state, lifecycle status, closure markers, `/verify`, `/red-verify`, and
  `/mb-sync`.

## Stop Conditions

- Real browser, storefront, Medusa, or PostgreSQL boundary is unavailable.
- Existing FT-004 session boundary cannot be reused without a new production bearer
  path.
- Required evidence would contain PII, production data, cookies, bearer values,
  OAuth tokens, session IDs, or secrets.

## Bounded Retry 1/2 (Historical)

- TASK-044 was available and consumed only after the real browser Google
  provider-double session returned its current synthetic customer actor ID.
- The runner passed that actor through `WISHLIST_ACCEPTANCE_BROWSER_CUSTOMER_ID` and
  parsed the phase's sanitized retained counts plus synthetic product IDs/handles.
- The phase returned `hidden=4`, `restored=1`, and `outOfStock=1`; its unconditional
  cleanup completed on every retry attempt.
- The real browser Store API then returned `404` for both retained fixture product
  handles and `count=0` for the actor's wishlist. The same result occurred when the
  initial fixture write was moved before long-lived backend startup.
- The required browser-positive lifecycle assertions therefore cannot be integrated
  safely inside TASK-042's allowed runner/package/changelog boundary. No direct
  database/module insertion, production route change, backend acceptance edit, or new
  auth/bearer path was attempted.
- That retry emitted a STOP_REPORT and did not run `/verify`, `/red-verify`,
  `/mb-sync`, or any lifecycle/marker operation.

## Bounded Retry 2/2 (Final)

- Consumed TASK-044 `browser-setup` through the current authenticated provider-double
  customer actor and TASK-045's publishable-key channel alignment.
- The real browser Store API observed the retained projection: hidden durable rows were
  omitted, the restored product reappeared with its current handle, and the visible
  out-of-stock item had `product.is_available === false`.
- The same run passed authenticated add/view/remove/reload, two-customer isolation,
  guest non-persistence, merge-blocked wishlist capability with checkout blocked,
  logout/session-expiry cleanup, browser storage privacy, and unconditional cleanup.
- Browser cleanup completed and both runtime ports were released. No sensitive values or
  direct browser database/module access were used.
- This `/execute` run records implementation evidence only. `/verify`, `/red-verify`,
  task lifecycle decisions, scheduler closure, and markers remain owner-controlled.
