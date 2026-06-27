# TASK-006 Progress

## Changes Made

- Added `apps/backend/src/catalog/query.ts`.
- Added `apps/backend/src/api/store/catalog/route.ts`.
- Added `apps/backend/test/run-integration.cjs`.
- Added `apps/backend/test/integration/catalog.test.cjs`.
- Added `test:integration` to `apps/backend/package.json`.

## Contract Coverage

The backend catalog query supports:
- category filtering by handle or identifier;
- case-insensitive text search across product title, description, handle, category name, and SKU;
- price range filtering against active variants;
- color, material, size length, and mounting method filtering against active variants;
- product type filtering against products;
- combined search and filters;
- bounded `page` / `limit` pagination.

Response includes:
- product card/list data;
- category navigation;
- selected filter state;
- available filter values;
- empty result state;
- pagination metadata.

## Scope Check

Scope compliance: yes.

Forbidden scope touched: no.

Medusa Core modified: no.

External search service introduced: no.

Cart/order/payment/auth behavior added: no.

Internal database identifiers exposed to the storefront response: no.
