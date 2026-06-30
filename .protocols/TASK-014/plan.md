---
description: TASK-014 execution plan.
status: active
---
# TASK-014 Plan

## Goal
Add executable integration/e2e verification for FT-002 product detail and variant selection without changing product scope or final task status.

## Intended Changes
1. Extend the existing backend E2E HTTP harness under `apps/backend/test/**` so browser tests can read seeded product detail data through `/store/product-detail/:handle`.
2. Add a storefront Playwright E2E runner under `apps/storefront/e2e/**` for:
   - product card variant summary;
   - product detail option selection;
   - missing required options;
   - impossible combinations;
   - unavailable variant blocking;
   - valid selected variant handoff;
   - default/single SKU product path.
3. Route `npm --workspace apps/storefront run test:e2e -- product-detail` to the new product-detail E2E while preserving the existing catalog E2E default.
4. Run required local gates and store evidence under `.tasks/TASK-014/`.
5. Update protocol files and append a concise Memory Bank changelog entry if implementation evidence is produced.

## Local Gates
- `npm run smoke:local`
- `npm --workspace apps/backend run test:integration -- product-detail`
- `npm --workspace apps/storefront run test:e2e -- product-detail`
- `node scripts/mb-lint.mjs`

## Evidence Targets
- `.tasks/TASK-014/execute-smoke-local.txt`
- `.tasks/TASK-014/execute-backend-product-detail-integration.txt`
- `.tasks/TASK-014/execute-storefront-product-detail-e2e.txt`
- `.tasks/TASK-014/execute-mb-lint.txt`
- `.tasks/TASK-014/playwright/product-detail-trace.zip`
- `.tasks/TASK-014/playwright/product-detail-handoff.png`
- `.tasks/TASK-014/playwright/product-detail-default-sku.png`

## MB-SYNC Handoff
- `/execute` may update `.memory-bank/changelog.md` with implementation evidence.
- `/verify TASK-014` remains required before closure.
- T2 feature-level semantic verification for `FT-002` remains separate after all FT-002 tasks are verified.
