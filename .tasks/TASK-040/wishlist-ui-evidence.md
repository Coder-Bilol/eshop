---
description: Behavioral UI evidence for TASK-040 wishlist controls and page.
status: complete_pending_scheduler_verification
---
# TASK-040 Wishlist UI Evidence

## Controls

- Catalog and product detail pass `product.id` to `WishlistToggle`; product
  `handle` remains navigation-only.
- The client control uses `session_established` plus a current customer as its
  capability signal. It does not read `CartProvider` or `merge_blocked` state, so a
  valid customer remains able to use wishlist while checkout merge is blocked.
- `idle`, `pending`, `saved`, and `error` are explicit `data-wishlist-state` values.
  Pending controls use `aria-busy`, `disabled`, and per-product pending state;
  duplicate mutation is therefore blocked by the existing state controller and UI.
- Guest click uses the existing `writeReturnPath` helper for the current pathname
  and query, then navigates to the fixed `/login` route. It does not call `add` or
  `remove` and does not store a product ID or favorite intent.
- Session expiry clears TASK-039 state; after a previously observed customer
  wishlist session, controls offer login recovery and the page renders an explicit
  session-expired state.

## Wishlist Page

- `/wishlist` is authenticated-only and consumes `WishlistProvider` state.
- Loading, guest, empty, products, error, remove, and session-expired branches are
  present. Retry uses the current customer ID only through the existing provider
  `load` method.
- Product cards render only `WishlistProduct` projection fields: title, current
  handle link, thumbnail, category name, price, and availability. Wishlist record
  metadata is not rendered or copied.
- Remove reuses the same product-level control and provider `remove(product.id)`;
  backend response truth remains authoritative through TASK-039 state.

## Verification Limits

- This is implementation evidence, not `/verify` or `/red-verify`.
- Real-browser OAuth/session acceptance remains a downstream feature task/gate.
