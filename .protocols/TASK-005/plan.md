# TASK-005 Plan

## Implementation Plan

1. Extend local DB helpers with backend-owned catalog tables for categories, products, and variants.
2. Add deterministic catalog fixtures for home goods, including curtain rods, categories, prices, and filter attributes.
3. Extend `db:migrate` and `db:seed` so local catalog schema/data can be prepared idempotently.
4. Add `smoke:catalog` to validate browse/category/filter/search seed readiness through PostgreSQL.
5. Document local catalog seed verification in `README.md`.
6. Run task gates and store execution evidence under `.tasks/TASK-005/`.

## Intended Local Gates

- `node --check apps/backend/scripts/local-db.cjs`
- `node --check apps/backend/scripts/db-migrate.cjs`
- `node --check apps/backend/scripts/db-seed.cjs`
- `node --check apps/backend/scripts/catalog-fixtures.cjs`
- `node --check apps/backend/scripts/smoke-catalog.cjs`
- `npm --workspace apps/backend run db:migrate`
- `npm --workspace apps/backend run db:seed`
- `npm --workspace apps/backend run smoke:catalog`
- `npm --workspace apps/backend run smoke:db`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff

`/execute` does not close `TASK-005`. After `/verify TASK-005` passes and closure ownership is explicit, `/mb-sync` should reconcile task state, changelog, and queue readiness.
