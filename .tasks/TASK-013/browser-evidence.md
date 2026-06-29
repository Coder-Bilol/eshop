---
description: TASK-013 browser evidence for storefront product detail variant states.
status: active
---
# TASK-013 Browser Evidence

## Runtime

- Storefront: production Next.js build at `http://127.0.0.1:3001`
- Product data: temporary read-only facade at `http://127.0.0.1:9000`
- Facade source: existing
  `apps/backend/src/catalog/product-detail.ts::queryProductDetail`
- Data source: local PostgreSQL seeded catalog
- Product: `steel-telescopic-curtain-rod`

The standard `medusa develop` command could not start because the existing
backend installation lacks `ts-node` and `lodash/isPlainObject`. No backend
files or dependencies were changed in TASK-013. The evidence-only facade calls
the TASK-011 backend query directly and does not hardcode product data.

## Observed States

- Missing required options: add-to-cart disabled.
- Impossible combination (`Brass + Steel + 160-300 cm`): visibly rejected and
  add-to-cart disabled.
- Valid combination (`Black + Steel + 160-300 cm`): SKU
  `CR-STL-BLK-160-300`, selected price `2 490 RUB`, add-to-cart enabled.
- Cart-action handoff: selection reaches payload boundary with SKU and quantity
  one, then reports the expected unavailable-cart failure without persistence.
- Unavailable variant (`Brass + Aluminum + 300-500 cm`): SKU
  `CR-STL-BRS-300-500`, visibly unavailable, add-to-cart disabled.
- Default SKU: `basic-home-hook-set` selects `HG-HOOK-BASIC` without option
  input and enables add-to-cart.
- Unknown handle: renders the product-not-found state.
- Mobile viewport: `390x844`, no overlapping controls or text observed.

## Artifacts

- `.tasks/TASK-013/browser-blocked-desktop.png`
- `.tasks/TASK-013/browser-impossible-desktop.png`
- `.tasks/TASK-013/browser-valid-desktop.png`
- `.tasks/TASK-013/browser-unavailable-desktop.png`
- `.tasks/TASK-013/browser-handoff-failure-desktop.png`
- `.tasks/TASK-013/browser-handoff-failure-mobile.png`
- `.tasks/TASK-013/browser-default-sku-desktop.png`
- `.tasks/TASK-013/browser-not-found-desktop.png`
- `.tasks/TASK-013/browser-product-detail.trace`
- `.tasks/TASK-013/browser-invalid-states.trace`

The only production-browser console error was a missing `/favicon.ico`; no
product detail, selection, React, or network contract errors were observed.
