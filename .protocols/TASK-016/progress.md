---
description: TASK-016 execution progress.
status: complete
---
# TASK-016 Progress

## Implemented

- Storefront catalog and product-detail fetchers now send the configured
  `x-publishable-api-key`.
- Product detail response types and the narrow cart-action handoff preserve the
  opaque Medusa Product Variant ID alongside SKU.
- Playwright now builds and starts compiled `medusa start`, runs the canonical
  workflow seed, starts Next.js, and drives both buyer-flow suites.
- The old `catalog-e2e-server.cjs` bypass and its dedicated runners were
  removed.
- E2E checks missing-key rejection, seeded-key success, catalog/filter/search
  behavior, product detail selection/unavailability/default SKU behavior, and
  browser handoff variant-ID equality.
- Cleanup is bounded and verifies both test ports are released.

## Execution Gates

- Storefront unit tests: PASS.
- Workspace typecheck: PASS.
- Windows-native `smoke:local`: PASS.
- Real Medusa Store E2E: PASS.
- Memory Bank lint and strict doctor: PASS.

## Browser Evidence

- `.tasks/TASK-016/playwright/real-medusa-trace.zip`
- `.tasks/TASK-016/playwright/catalog.png`
- `.tasks/TASK-016/playwright/product-detail.png`
- `.tasks/TASK-016/playwright/medusa-backend.log`
- `.tasks/TASK-016/playwright/real-runtime.log`
- `.tasks/TASK-016/playwright/real-runtime-progress.log`
