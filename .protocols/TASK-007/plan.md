# TASK-007 Plan

## Implementation Plan

1. Replace the placeholder storefront baseline with a buyer-facing catalog screen as the first page.
2. Add a small catalog client library that:
   - reads only the backend catalog contract;
   - builds explicit query parameters for `category`, `q`, `price_min`, `price_max`, `color`, `material`, `size_length`, `product_type`, `mounting_method`, `page`, and `limit`;
   - preserves selected filter state from the backend response;
   - avoids hardcoded product/category/filter source data.
3. Render:
   - product cards/list entries;
   - category navigation;
   - search input;
   - required filter controls;
   - selected filter summary;
   - empty/error state;
   - pagination controls.
4. Add a scoped storefront catalog test runner under allowed `apps/storefront/src/**`.
5. Run packet gates and store execution evidence under `.tasks/TASK-007/`.

## Intended Local Gates

- `node --check apps/storefront/src/test-runner.cjs`
- `node --check apps/storefront/src/catalog-ui.test.cjs`
- `npm --workspace apps/storefront run test -- catalog`
- `npm --workspace apps/storefront run typecheck`
- `node scripts/mb-lint.mjs`
- `node scripts/mb-doctor.mjs --strict`

## MB-SYNC Handoff

`/execute` does not close `TASK-007`. After `/verify TASK-007` passes and closure ownership is explicit, `/mb-sync` should reconcile task state, changelog, and queue readiness.
