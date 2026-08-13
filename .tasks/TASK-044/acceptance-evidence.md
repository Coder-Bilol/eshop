---
description: Sanitized local evidence for TASK-044 browser wishlist fixture retention.
status: captured
---
# TASK-044 Acceptance Evidence

## Runtime

- Boundary: real local Medusa `exec`, Wishlist Store route handlers, acceptance-only
  Wishlist Module service setup, supported product workflows, canonical product query,
  and local PostgreSQL.
- Fixture policy: synthetic local provider-double browser customer, synthetic categories,
  products, wishlist rows, and zero-stock inventory only. No production data or live
  provider was used.

## Retention Handoff

- Existing `write`: `status=ok`, two synthetic backend customers, six synthetic products,
  and the existing durable visible favorite were created.
- New `browser-setup`: `status=ok`, synthetic browser customer actor accepted, four hidden
  durable rows retained, one restorable row retained after supported publication restore,
  and one visible zero-stock row retained.
- Setup list projection: `count=2`; hidden product IDs were omitted, the restored row was
  present with its original row identity, and the out-of-stock row was present with
  `product.is_available=false`.
- Setup output returned only coarse row counts and synthetic product IDs/handles. It did
  not return the browser customer ID, hidden wishlist row IDs, credentials, cookies, or
  session data.
- Existing unconditional `cleanup`: `status=ok`, `stateFound=true`,
  `cleanupComplete=true` after the retention smoke.

## Baseline Preservation

- `wishlist-acceptance` integration and backend smoke both passed the existing phased
  `write/read/cleanup` flow with all 11 TASK-041 assertion groups true.
- No production wishlist/auth/catalog, storefront, schema, bearer transport, or live
  provider behavior was changed.
