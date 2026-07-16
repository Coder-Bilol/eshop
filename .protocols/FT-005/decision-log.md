---
description: Design decisions for FT-005 authenticated wishlist.
status: active
---
# FT-005 Decision Log

## 2026-07-16 - Manual review capability and contract correction

- Decision: wishlist capability is successful backend current-customer retrieval,
  independent of cart-merge/checkout readiness.
- Consequence: `merge_blocked` still blocks checkout but permits wishlist without a
  new auth state.
- Decision: list/add share one exact minimal `WishlistProductProjection`; visibility
  requires existing `published` product, current sales channel, and active category.
- Consequence: out-of-stock remains visible/unavailable; missing, unpublished,
  channel-invisible, and inactive-category products share one non-disclosing `404`.
- Decision: production storefront auth remains session-cookie only and evidence may
  show synthetic wishlist content while excluding real sensitive values.
- Consequence: no new bearer mechanism or impossible evidence-redaction rule is
  introduced.

## 2026-07-16 - Product-level favorites

- Decision: wishlist identity is Medusa Product ID, not variant/SKU.
- Consequence: one saved product can later be opened and a current variant selected;
  variant quantities/options are not frozen in wishlist data.

## 2026-07-16 - One custom PostgreSQL module

- Decision: store one custom record per `(customer_id, product_id)` with a unique
  composite index.
- Consequence: Medusa Product/Customer remain authoritative and concurrent adds
  converge without a parallel product/customer table.

## 2026-07-16 - Actor-derived ownership

- Decision: all API operations derive customer ID from Medusa auth context and
  never accept owner input.
- Consequence: authenticated API slices are T3; product ID alone cannot read or
  remove another customer's state.

## 2026-07-16 - Hide catalog-invisible products without cleanup machinery

- Decision: missing, unpublished, channel-invisible, or inactive-category products
  are omitted while the favorite row remains; stock does not hide the product.
- Consequence: restoring visibility makes the record visible again, out-of-stock is
  shown as unavailable, no lifecycle subscriber/cleanup job is added, and a hidden
  product does not fail the complete list.

## 2026-07-16 - No guest favorite intent

- Decision: guests are routed to login but no pending favorite is persisted or
  automatically applied after login.
- Consequence: MVP satisfies authenticated-only persistence without creating a
  second browser state/merge lifecycle.
