---
description: Execution plan for TASK-036 opaque product IDs.
status: complete
---
# TASK-036 Plan

## Goal Interpretation

- Purpose: expose canonical Medusa Product ID as the durable identity needed by later
  wishlist mutations.
- Success outcome: catalog and product-detail responses and storefront types preserve
  one additive opaque product `id` without changing existing semantics.
- Anti-goals: no wishlist persistence/API/UI, no handle/variant/cart redesign, no
  database/query internals, and no Medusa Core changes.
- Allowed write scope: task/packet catalog/detail projections, smokes, storefront
  contracts/tests, approved integration dispatcher, and changelog.
- Forbidden scope: wishlist runtime behavior, filter/search redesign, variant/cart
  behavior, and Medusa Core.
- Stop conditions: canonical ID unavailable, additive field causes a breaking change,
  or client identity would need derivation from handle/SKU/title.

## Boundary Notes

- Product ID is mutation identity; handle remains navigation and variant ID remains
  SKU/cart identity.
- Backend canonical Product/query boundary owns the ID; storefront only preserves it.
- The integration suite composes existing real catalog/detail smokes and adds no new
  source of product truth.

## Steps

1. Add `id` to canonical catalog projection and backend smoke assertions.
2. Add `id` to product-detail projection and backend smoke assertions.
3. Add `id` to storefront `CatalogProduct` and `ProductDetail` contracts and fixtures.
4. Register a combined `wishlist-product-id` integration suite over both real smokes.
5. Run packet gates, record evidence, and hand off to `/verify TASK-036`.

## Intended Local Gates

- `npm --workspace apps/backend run test:integration -- wishlist-product-id`
- `npm --workspace apps/backend run smoke:catalog`
- `npm --workspace apps/backend run smoke:product-detail`
- `npm run typecheck`
- `node scripts/mb-lint.mjs`

## Ownership

- `/execute` owns implementation and local evidence only.
- `/verify`, closure, TASK-037 promotion, feature red verification, and `/mb-sync`
  remain for the next explicit owner.
