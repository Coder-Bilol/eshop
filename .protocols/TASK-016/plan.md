---
description: TASK-016 implementation plan.
status: active
---
# TASK-016 Plan

1. Make the seeded local publishable key available to storefront runtime and
   send it on Store API requests.
2. Replace Playwright startup of `catalog-e2e-server.cjs` with real Medusa
   backend startup after migration and canonical seed.
3. Run catalog and product-detail flows against the Next.js storefront and
   actual Medusa Store routes.
4. Capture runtime, HTTP, browser artifact, and process cleanup evidence.
5. Run `/verify TASK-016`, then repeat `/red-verify --feature FT-001`.
