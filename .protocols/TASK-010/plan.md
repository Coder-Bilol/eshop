---
description: TASK-010 execution plan.
status: active
---
# TASK-010 Plan

## Scope
- Extend existing local catalog fixtures with product detail variant cases.
- Keep data local/test-only and PostgreSQL-backed.
- Add unavailable/default SKU cases required by FT-002.
- Add a product detail smoke command that reads seeded product detail data through the backend persistence boundary.

## Intended Changes
1. Update `apps/backend/scripts/catalog-fixtures.cjs`.
2. Update `apps/backend/scripts/db-seed.cjs` so variant `is_active` can be seeded.
3. Add `apps/backend/scripts/smoke-product-detail.cjs`.
4. Add the `smoke:product-detail` npm script.

## Local Gates
- `npm --workspace apps/backend run db:seed`
- `npm --workspace apps/backend run smoke:product-detail`
- `node scripts/mb-lint.mjs`

## Additional Regression Gates
- `npm --workspace apps/backend run smoke:catalog`
- `npm --workspace apps/backend run test:integration -- catalog`
- `npm --workspace apps/backend run typecheck`

## Stop Conditions Checked
- Stop if seed path cannot write/read through backend persistence boundary.
- Stop if implementation needs production data.
- Stop if variant data model contradicts FT-002 tech spec.
- Stop if scope requires durable cart/order/inventory/payment behavior.

## MB-SYNC Handoff
- `/execute` does not run `/mb-sync` or close the task.
- Verification owner should reconcile the package-script scope gap before closure.
