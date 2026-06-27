---
description: TASK-011 remediation implementation handoff after failed verification.
status: active
---
# TASK-011 Remediation Handoff

## Scope

- Task: `TASK-011`
- Tier: `T2`
- Mode: manual `/execute`
- Trigger: failed verification for multi-variant default selection.

## Changes

- `apps/backend/src/catalog/product-detail.ts`
  - Default/selected SKU is now assigned only when the product has exactly one
    concrete variant and that variant is sellable.
  - `requires_selection` is now based on multiple concrete variants, independent
    of how many are currently sellable.
- `apps/backend/test/integration/product-detail.test.cjs`
  - Added a PostgreSQL-backed regression fixture with two concrete variants,
    exactly one of which is sellable.
  - Proves explicit selection remains required and no SKU is auto-selected.

## Local Gates

- PASS: `npm --workspace apps/backend run test:integration -- product-detail`
- PASS: `npm --workspace apps/backend run test:integration -- catalog product-detail`
- PASS: `npm --workspace apps/backend run typecheck`
- PASS: `node scripts/mb-lint.mjs`
- PASS: standalone reproduction of the previously failing edge case.
- PASS: regression fixture cleanup leaves no test product or variants in PostgreSQL.

## Evidence

- `.tasks/TASK-011/execute-fix-backend-product-detail-integration.txt`
- `.tasks/TASK-011/execute-fix-backend-integration-regression.txt`
- `.tasks/TASK-011/execute-fix-backend-typecheck.txt`
- `.tasks/TASK-011/execute-fix-mb-lint.txt`
- `.tasks/TASK-011/execute-fix-multi-variant-one-sellable.txt`
- `.tasks/TASK-011/execute-fix-fixture-cleanup.txt`

## Scope Compliance

- Allowed product/test scope respected: yes.
- Forbidden scope touched: no.
- Medusa Core modified: no.
- Cart/order/payment/auth/inventory reservation behavior introduced: no.

## Handoff

`/execute` did not alter task status or replace the historical verification
verdict. Next owner: `/verify TASK-011`.
