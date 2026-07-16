---
description: FT-005 wishlist record, persistence, uniqueness, and product visibility specification.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/tech-specs/FT-005-authenticated-wishlist.md
  - .memory-bank/domains/core-domain.md
  - .memory-bank/architecture/system-architecture.md
---
# Wishlist Data Specification

## Ownership

- PostgreSQL-backed custom Wishlist Module owns favorite records.
- Medusa Customer Module owns customer existence and authenticated actor identity.
- Medusa Product Module owns product existence, publication, handle, media, price,
  variants, sales-channel visibility, and lifecycle.
- The storefront owns no durable wishlist data.

## Record

`WishlistItem` contains:

| Field | Rule |
|---|---|
| `id` | Module-generated opaque ID with a wishlist-specific prefix. |
| `customer_id` | Required opaque Medusa customer ID derived from auth context. |
| `product_id` | Required opaque Medusa product ID validated through Product/query boundary. |
| `created_at` / `updated_at` | Standard Medusa model timestamps. |

The custom module stores identifiers but does not create cross-module database
foreign keys or duplicate customer/product fields.

## Constraints And Indexes

- Unique composite index on `(customer_id, product_id)` is the durable idempotency
  guard and prevents duplicate favorites under concurrent adds.
- Customer-list index starts with `customer_id` and supports newest-first ordering
  by `created_at DESC`, then `id ASC` for deterministic ties.
- Mutation lookups always include both actor-derived `customer_id` and `product_id`.
  A record ID alone is never an ownership boundary.

## Write Semantics

- Add validates that the product exists, is `published`, is visible in the
  request's publishable-key sales channel, and has an active category before
  creating or returning a record. Stock availability is not a visibility guard.
- Add uses lookup/create plus unique-conflict recovery so concurrent/repeated adds
  converge on one record and one saved state.
- Remove deletes only the actor's customer/product record. Missing record returns
  idempotent not-removed state rather than an existence leak.
- No bulk mutation, transfer, customer merge, hard customer deletion cleanup, or
  product lifecycle subscriber is part of FT-005.

## Read Projection

- List first reads records for authenticated customer only.
- Product data is resolved through supported Medusa query/Product boundaries in
  the current sales channel; direct Product table joins are forbidden.
- Return only records whose products exist, are `published`, are visible in the
  current sales channel, and have an active category.
- Missing/deleted, unpublished, channel-invisible, or inactive-category products
  are omitted. Their records are not returned as tombstones and are not silently
  reassigned/deleted.
- Out-of-stock products remain visible. Their projection uses
  `is_available: false`; stock does not turn an otherwise visible product into a
  hidden record.
- Response count describes visible returned items, not hidden record count.
- Product projection is exactly `WishlistProductProjection` from
  [.memory-bank/contracts/wishlist-api-security.md](../contracts/wishlist-api-security.md):
  opaque ID, current handle/title, nullable thumbnail, active category, nullable
  lowest valid current price, and boolean availability. Values come from current
  FT-001/FT-002 catalog truth, never a wishlist snapshot.

## Migration And Recovery

- Generate a Wishlist Module migration for the model and indexes; do not edit a
  generated migration after it has been applied to a shared environment.
- Local rollback before shared use may remove the new module table only after
  confirming no required wishlist data exists. Later rollback should disable routes
  and preserve the table until data/export decision is explicit.
- Migration and smoke evidence use synthetic local customer/product IDs and never
  production data.

## Verification Targets

- Real PostgreSQL create/read/delete and process-restart read.
- Duplicate and concurrent add produce one row.
- Customer A cannot list/remove Customer B record.
- Unpublish/channel removal/category deactivation hides without deleting; restoring
  all visibility conditions shows the same record.
- Out-of-stock remains visible with `is_available: false`.
- Missing product is omitted without failing the whole list.
