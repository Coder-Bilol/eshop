---
description: Implementation plan for TASK-042 real-browser wishlist acceptance.
status: in_progress
---
# TASK-042 Plan

## Scope

Implement only browser acceptance in the existing real Medusa E2E runner, its
wishlist package entry, changelog navigation, and T3 execution evidence.

## Plan

1. Reuse the existing compiled Medusa/PostgreSQL runtime and FT-004 provider double.
2. Create bounded synthetic wishlist lifecycle fixtures through the existing TASK-041
   acceptance script and guarantee cleanup in the runner `finally` path.
3. Authenticate two browser contexts through Google/VK provider doubles and assert
   catalog/detail/wishlist add, reload, remove, isolation, and guest routing.
4. Assert browser Store API hidden-product error uniformity, omission, restored-product
   visibility, and out-of-stock visible/unavailable state.
5. Assert a valid customer can mutate wishlist while merge is blocked and checkout
   remains blocked.
6. Assert logout/session-expiry clearing and scan browser storage without persisting
   wishlist/customer/product state or emitting sensitive values.
7. Run the task gates when feasible and record only coarse sanitized evidence.

## Intended Gates

- `npm --workspace apps/storefront run test:e2e -- wishlist`
- `npm --workspace apps/storefront run test`
- `npm run typecheck`
- `npm run build`
- `node scripts/mb-lint.mjs`
- `node --check apps/storefront/e2e/run-real-medusa-e2e.cjs`

## Bounded Retry 1/2 Outcome (Historical)

- The runner now calls TASK-044 `browser-setup` after browser authentication, passes
  the current actor ID through the existing local provider-double boundary, and parses
  only sanitized fixture IDs/handles.
- The runner also performs the existing TASK-041 `read` before setup, preserving all
  prior backend assertion groups without consuming the browser actor's retained rows.
- A coarse real-browser projection probe fails immediately after setup: both retained
  fixture product details return `404`, and the authenticated wishlist list is empty.
- Moving fixture `write` before long-lived backend startup did not change that result.
  The required acceptance phase is not observable through the real browser Store API
  within the assigned scope, so the retry stops rather than adding a forbidden bypass.
- Retry evidence is recorded in `.tasks/TASK-042/` and remains non-closure evidence.

## Handoff

The scheduler/reviewer owns `/verify`, `/red-verify`, human checkpoint, final
rollback review, lifecycle decision, task record/packet updates, and `/mb-sync`.

## Final Bounded Retry 2/2 Outcome

- The runner consumed the retained TASK-044 browser setup and TASK-045
  publishable-key-selected sales channel without widening the allowed source scope.
- Browser-positive lifecycle assertions passed through the long-lived Store API for
  hidden omission, restored current-handle visibility, and out-of-stock
  `product.is_available === false`.
- All prior authenticated, isolation, guest, merge-blocked, logout, expiry, storage,
  and cleanup assertions passed. The local implementation gates are recorded under
  `.tasks/TASK-042/` and remain non-closure evidence.
