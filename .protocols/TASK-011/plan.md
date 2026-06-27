---
description: TASK-011 execution plan.
status: active
---
# TASK-011 Plan

## Plan
1. Inspect existing catalog facade, local DB schema, fixtures, and integration runner.
2. Add a backend product-detail query helper using existing local catalog tables.
3. Add a read-only product-detail store route.
4. Add integration coverage for valid configurable product, unavailable variant, default SKU product, not-found/unpublished handling, and no internal DB ID exposure.
5. Run task gates and store output under `.tasks/TASK-011/`.
6. Write implementation handoff report without changing final task status.

## Intended Local Gates
- `npm --workspace apps/backend run test:integration -- product-detail`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## Verification Targets
- `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md#product-detail-data-contract`
- `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md#availability-and-inventory-boundary`
- `.memory-bank/contracts/api-guidelines.md#naming-and-shape`

## MB-SYNC Handoff
- `/execute` will not run `/verify`, `/mb-sync`, or close the task.
- Next owner should run `/verify TASK-011` and perform any task status/sync decisions.

## 2026-06-27 Remediation Plan

1. Correct default selection to apply only to one concrete sellable variant.
2. Base `requires_selection` on the concrete variant count.
3. Add PostgreSQL-backed integration coverage for multiple variants with exactly
   one sellable SKU.
4. Rerun packet-sourced gates and the previously failing verifier case.
5. Hand off to a fresh `/verify TASK-011`.
