---
description: Execution plan for TASK-037 wishlist workflows and projection.
status: complete
---
# TASK-037 Plan

## Goal Interpretation

- Purpose: implement deterministic domain behavior between Wishlist persistence and
  later authenticated HTTP routes.
- Success outcome: add/remove/list projection uses actor/product IDs, current catalog
  truth, idempotent uniqueness recovery, visibility guards, and out-of-stock display.
- Anti-goals: no authentication, Store routes, UI, cached product snapshots, lifecycle
  hooks, cleanup jobs, events, or Core changes.
- Responsibility boundary: workflow inputs receive server-supplied customer and sales
  channel IDs; workflows do not authenticate requests.

## Steps Completed

1. Added current-product lookup and exact `WishlistProductProjection` service helpers.
2. Added add workflow with visibility validation, duplicate/concurrent recovery, and
   exact item response.
3. Added remove workflow scoped by customer/product and idempotent absent behavior.
4. Added real Medusa/PostgreSQL workflow smoke plus hidden/out-of-stock projection
   assertions and registered its integration suite.

## Local Gates

- `npm --workspace apps/backend run test:integration -- wishlist-workflows`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`
- dispatcher syntax and `git diff --check`

## Handoff

`/execute` is complete. Next owner runs `/verify TASK-037`; status remains `ready`.
