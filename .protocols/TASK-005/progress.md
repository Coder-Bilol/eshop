# TASK-005 Progress

## Changes Made

- Added catalog schema support to `apps/backend/scripts/local-db.cjs`:
  - `eshop_local_catalog_categories`
  - `eshop_local_catalog_products`
  - `eshop_local_catalog_variants`
- Added deterministic local fixtures in `apps/backend/scripts/catalog-fixtures.cjs`.
- Updated `apps/backend/scripts/db-migrate.cjs` to create catalog tables and record `TASK-005-catalog-seed-v1`.
- Updated `apps/backend/scripts/db-seed.cjs` to seed categories, products, and variants idempotently.
- Added `apps/backend/scripts/smoke-catalog.cjs`.
- Added `smoke:catalog` script to `apps/backend/package.json`.
- Updated `README.md` with local catalog seed/smoke commands.

## Seed Dataset

Seeded local catalog coverage:
- 4 categories: home goods, window hardware, curtain rods, bathroom accessories.
- 5 products.
- 5 variants.
- 2 curtain rod products in the curtain rods category.
- Filter attributes for color, material, size length, product type, and mounting method.
- Prices across all variants.
- 1 product intentionally missing optional attributes, still visible in unfiltered listings.

## Scope Check

Scope compliance: yes.

Forbidden scope touched: no.

Medusa Core modified: no.

Production data imported: no.

External search service introduced: no.

Docker required for local catalog seed/smoke: no.
