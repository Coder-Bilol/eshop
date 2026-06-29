---
description: TASK-013 execution plan for storefront product detail variant UI.
status: active
---
# TASK-013 Plan

## Implementation

1. Extend the storefront product-detail data layer without changing the backend
   contract.
2. Add variant-aware product-card summaries and links to product detail.
3. Add a dynamic product page with loading, not-found/unpublished, no-variant,
   default-SKU, missing, impossible, unavailable, valid, and handoff-failure
   states.
4. Keep cart behavior as an in-memory validated handoff payload only.
5. Add focused storefront tests for data mapping, selection, handoff, and UI
   state coverage.

## Local Gates

- `npm --workspace apps/storefront run test -- product-detail`
- `npm --workspace apps/storefront run typecheck`
- `node scripts/mb-lint.mjs`
- Browser screenshot/trace for blocked and valid handoff states.

## Evidence

Store command output and browser artifacts under `.tasks/TASK-013/`.

## Handoff

- `/execute` records implementation evidence only.
- `/verify TASK-013` is the required next owner.
- MB-SYNC remains for the later closure owner after verification.
