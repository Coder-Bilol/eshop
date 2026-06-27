# TASK-006 Plan

## Implementation Plan

1. Add a backend-owned catalog query module that reads seeded local catalog tables from PostgreSQL.
2. Add a thin read-only storefront-facing catalog route under `apps/backend/src/api/store/catalog/`.
3. Support query parameters required by FT-001:
   - `category`
   - `q`
   - `price_min`
   - `price_max`
   - `color`
   - `material`
   - `size_length`
   - `product_type`
   - `mounting_method`
   - `page`
   - `limit`
4. Return product card data, category navigation, selected filter state, available filter values, empty state, and pagination metadata.
5. Add backend integration tests for category browse, search, filters, combined search+filters, empty result, missing optional attributes, and pagination.
6. Run packet gates and store execution evidence under `.tasks/TASK-006/`.

## Route Decision

Decision: use a thin read-only catalog facade.

Rationale: FT-001 explicitly allows a thin custom read-only catalog route when native Medusa APIs cannot expose required MVP filters cleanly. The current foundation has local seeded catalog tables from `TASK-005`, but no native Medusa catalog query contract implemented yet. The facade keeps KISS, remains backend/PostgreSQL-owned, and avoids external search infrastructure.

## Intended Local Gates

- `node --check apps/backend/test/run-integration.cjs`
- `node --check apps/backend/test/integration/catalog.test.cjs`
- `npm --workspace apps/backend run test:integration -- catalog`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`
- `node scripts/mb-doctor.mjs --strict`

## MB-SYNC Handoff

`/execute` does not close `TASK-006`. After `/verify TASK-006` passes and closure ownership is explicit, `/mb-sync` should reconcile task state, changelog, and queue readiness.
