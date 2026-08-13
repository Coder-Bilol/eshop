---
description: Execution plan for TASK-041 real wishlist backend acceptance.
status: in_progress
---
# TASK-041 Plan

## Scope

1. Add a local-only phased acceptance script using real Medusa `exec` processes.
2. Create synthetic customers/products/categories/inventory through supported Medusa
   workflows and persist only opaque local fixture IDs between phases.
3. Exercise Store list/add/remove handlers over workflows, the Wishlist Module, and
   canonical product query boundaries.
4. Register the suite in the integration dispatcher and backend package.
5. Record the bounded change in the Memory Bank changelog and provide evidence.

## Acceptance Matrix

- Fresh process reads the durable favorite and removes it through Store API behavior.
- Two customers remain isolated for list/add/remove, including product ID reuse.
- Sequential duplicate and concurrent add converge to one row; remove is retry-safe.
- Guest, malformed input, exact item/projection, and sanitized unexpected failure paths
  match the API contract.
- Missing, unpublished, channel-invisible, and inactive-category products share one 404
  signature and are omitted from list; a restored product reappears with its row.
- Out-of-stock remains addable/listable and projects `is_available: false`.

## Intended Gates

- `npm --workspace apps/backend run test:integration -- wishlist-acceptance`
- `npm --workspace apps/backend run typecheck`
- `npm run smoke:local`
- `node scripts/mb-lint.mjs`

## Non-Goals

- No production wishlist/auth/catalog changes, storefront changes, or new behavior.
- No `/verify`, `/red-verify`, `/mb-sync`, lifecycle transition, task JSON, or packet
  edits from this worker.

## Rollback / Recovery

The change is acceptance-only. If the harness regresses, remove the TASK-041 script/
dispatcher/package entry and changelog entry, then rerun the prior wishlist API and
workflow suites. Any interrupted run must execute its `cleanup` phase; it deletes only
rows/customers/products/categories tagged by the synthetic TASK-041 run state.
