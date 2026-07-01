---
description: TASK-015 execution progress.
status: complete
---
# TASK-015 Progress

## Implemented

- Added idempotent `seed:medusa:catalog` using supported Medusa workflows.
- Seeded ProductCategory hierarchy, ProductType records, Product/Option/Variant
  records, RUB prices, inventory items/levels, stock location, sales-channel
  links, and publishable API key.
- Replaced direct PostgreSQL catalog/product-detail clients with Medusa Query
  graph readers resolved from request scope.
- Added sales-channel-aware inventory availability through
  `getVariantAvailability`.
- Updated Store routes to consume `MedusaStoreRequest` publishable-key context.
- Exposed stable Medusa Product Variant IDs while preserving SKU fields.
- Retired runtime creation, seeding, smoke checks, and tests for parallel
  `eshop_local_catalog_*` tables.
- Moved catalog and product-detail integration checks into real `medusa exec`
  container scripts.

## Execution Gates

- Backend typecheck: PASS.
- Canonical seed: PASS; repeated run reported `products_created: 0` and
  `inventory_levels_created: 0`.
- Catalog integration: PASS against `medusa-query-graph`.
- Product-detail integration: PASS against Medusa pricing and inventory.
- Full Medusa backend/Admin build: PASS.

## Scope

No cart persistence, checkout, order, payment, auth, production data, external
search service, or Medusa Core changes were introduced.
