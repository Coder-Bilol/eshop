---
description: Feature-level SDD hub for FT-005 authenticated product wishlist.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/features/FT-005-authenticated-wishlist.md
  - .memory-bank/requirements.md
  - .memory-bank/domains/wishlist-data.md
  - .memory-bank/contracts/wishlist-api-security.md
---
# FT-005 Authenticated Wishlist

## Scope

FT-005 owns durable product-level favorites for authenticated customers, Store API
list/add/remove operations, wishlist state in the storefront, favorite controls on
catalog/product detail, and an authenticated wishlist page.

FT-005 does not own OAuth/session implementation, guest favorites, variant-level
favorites, folders/sharing, notifications, recommendations, product lifecycle, or
admin wishlist tooling.

## Normative Design Surface

- [.memory-bank/domains/wishlist-data.md](../domains/wishlist-data.md): record,
  uniqueness, persistence, availability projection, and migration rules.
- [.memory-bank/contracts/wishlist-api-security.md](../contracts/wishlist-api-security.md):
  HTTP operations, ownership, idempotency, errors, privacy, and access matrix.
- [.memory-bank/architecture/auth-runtime.md](../architecture/auth-runtime.md),
  [.memory-bank/contracts/auth-session-security.md](../contracts/auth-session-security.md),
  and [.memory-bank/states/customer-auth-session.md](../states/customer-auth-session.md):
  customer session/current-customer capability supplied by FT-004. Wishlist does
  not depend on cart-merge or checkout readiness.
- [.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md](FT-001-catalog-browsing-filtering-search.md)
  and [.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md](FT-002-product-detail-variant-selection.md):
  reused catalog product/category/price and availability semantics. Wishlist adds
  no separate catalog model.
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md)
  and [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md):
  global module, source-of-truth, API, and security rules.

## Design Area Matrix

| Area | Status | Authoritative source |
|---|---|---|
| Architecture Specification | complete | This hub; one custom module, workflows, Store routes, and storefront state/UI. |
| Component Contract | complete | This hub, `Storefront Contract`. |
| API Contract | complete | `contracts/wishlist-api-security.md` |
| Event Contract | not_applicable | Wishlist operations are synchronous; no event, subscriber, queue, or notification. |
| Data Contract | complete | `contracts/wishlist-api-security.md` |
| Data/Persistence Specification | complete | `domains/wishlist-data.md` |
| State Specification | complete | This hub, `Favorite Lifecycle`. |
| Security/Access Contract | complete | `contracts/wishlist-api-security.md` plus FT-004 auth specs. |
| Deployment/Operations | not_applicable | Existing Medusa/PostgreSQL runtime; only a normal custom-module migration is added. |

## Architecture

- Register one custom Wishlist Module using Medusa `Module` and `MedusaService`.
- The module owns wishlist records only. Product and customer truth remain in
  Medusa Product and Customer Modules.
- Store write routes call small add/remove workflows; routes derive customer actor
  from auth context and pass no client-selected owner.
- List orchestration reads the customer's wishlist records, queries canonical
  product data through supported Medusa query boundaries, applies the visibility
  rule below, and returns the exact minimal `WishlistProductProjection` from the
  API contract rather than copying `CatalogProduct` or `ProductDetail`.
- No direct storefront database/provider access, custom cache, event bus, or
  duplicate product/customer table is introduced.

## Favorite Lifecycle

- `absent`: no record exists for customer/product.
- `present`: record exists and product exists, is `published`, is visible in the
  current sales channel, and has an active category; list and UI show it even when
  all variants are out of stock, with `is_available: false`.
- `hidden`: record exists but product is missing, unpublished, channel-invisible,
  or has no active category; list/UI omit it without transferring ownership.
- Add `absent -> present` creates one record after product visibility validation.
- Repeated add in `present` is an idempotent no-op returning current state.
- Remove `present|hidden -> absent` deletes only the actor's matching record.
- Repeated remove in `absent` is an idempotent no-op.
- Product unpublish/channel removal/category deactivation moves `present -> hidden`
  without deleting the record. Restoring all visibility conditions moves
  `hidden -> present` on next read.

## Storefront Contract

- Wishlist capability is true when current-customer retrieval from the backend
  succeeds for the session. It is independent of cart-merge state: `merge_blocked`
  continues to block checkout but does not block wishlist reads or mutations.
- Logout/session expiry clears in-memory wishlist state.
- Browser storage never persists product IDs, favorite state, customer ID, or a
  queued guest favorite.
- Catalog cards and product detail use the opaque Medusa product ID returned by
  backend projections. Product ID is additive to existing catalog/detail contracts.
- Guest controls route to login with a safe current return path and do not queue or
  auto-create a favorite after login.
- Authenticated controls show deterministic idle/pending/saved/error states, disable
  duplicate mutations while pending, and adopt backend response truth.
- `/wishlist` is authenticated-only and supports loading, empty, products, error,
  remove, and session-expired states. Products link to their current handles.

## Anti-goals

- No guest/local-storage wishlist, variant/SKU favorites, quantities, folders,
  notes, ranking, sharing, notifications, recommendations, or admin UI.
- No automatic cleanup job for unpublished/missing products and no product lifecycle
  hooks. Hidden rows are bounded customer preference data and remain removable.
- No customer ID in request body/query, no cross-customer reads, and no ownership
  inferred from product/favorite IDs.
- No modification of Medusa Core, Product, or Customer tables.

## Verification Targets

- Migration and PostgreSQL smoke prove record persistence, unique
  `(customer_id, product_id)`, read/write/delete, and restart-safe retrieval.
- Workflow/API integration proves idempotent add/remove, exact list/add item shape,
  actor-derived ownership, customer isolation, visibility/error precedence,
  out-of-stock projection, and stable sanitized errors.
- Contract regression proves additive product `id` in catalog/detail responses.
- Browser E2E with synthetic authenticated sessions proves catalog/detail toggles,
  wishlist page, reload persistence, user isolation, guest login routing, no guest
  storage, `merge_blocked` independence, visibility behavior, and
  logout/session-expiry clearing. Synthetic product/wishlist values may appear in
  evidence; real PII, production data, credentials, tokens, and session IDs may not.
- T2/T3 closure follows [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md).

## Open Questions

None blocking implementation.
