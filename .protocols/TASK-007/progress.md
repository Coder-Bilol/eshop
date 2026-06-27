# TASK-007 Progress

## Changes Made

- Replaced the placeholder storefront landing page in `apps/storefront/app/page.tsx` with a buyer-facing catalog screen.
- Added `apps/storefront/lib/catalog.ts` for backend catalog contract types, URL query helpers, backend fetch, money/value formatting, and selected-filter mapping.
- Updated `apps/storefront/app/globals.css` for responsive catalog layout, category navigation, filter controls, product cards, selected state, empty/error states, and pagination.
- Added `test` script to `apps/storefront/package.json`.
- Added scoped storefront test runner files:
  - `apps/storefront/src/test-runner.cjs`
  - `apps/storefront/src/catalog-ui.test.cjs`

## Contract Coverage

- Storefront fetches the backend Store catalog route through `NEXT_PUBLIC_MEDUSA_BACKEND_URL` / `MEDUSA_BACKEND_URL`.
- URL query helpers cover `category`, `q`, `price_min`, `price_max`, `color`, `material`, `size_length`, `product_type`, `mounting_method`, `page`, and `limit`.
- Category navigation uses backend-provided category metadata.
- Filter controls use backend-provided available values while the storefront owns labels/display order only.
- Product cards render backend response data: title, description, category, price, product type, attributes, optional-attribute gap state, and pagination totals.
- Selected category/search/filter state is rendered from the backend response.
- Empty result and backend query failure states are rendered without mutating backend/cart/order/payment/auth state.
- No seeded catalog product handles are embedded in storefront source.

## Scope Check

Scope compliance: yes.

Forbidden scope touched: no.

Backend catalog contract changed: no.

Product detail/add-to-cart behavior added: no.

Custom admin surface added: no.

Hardcoded catalog source data added to UI code: no.
