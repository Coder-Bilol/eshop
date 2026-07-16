---
description: Feature FT-005 - authenticated wishlist.
status: draft
lifecycle: planned
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-005-authenticated-wishlist.md
  - .memory-bank/domains/wishlist-data.md
  - .memory-bank/contracts/wishlist-api-security.md
---
# FT-005 Authenticated Wishlist

## Use Cases

- Authenticated customer saves products to wishlist/favorites.
- Authenticated customer views saved products.

## Acceptance Criteria

- Covers REQ-009.
- Wishlist/favorites are only available to authenticated users.
- Guest users cannot persist wishlist/favorites in MVP.

## Edge Cases & Failure Modes

- User tries to save favorite while unauthenticated.
- Product is removed or unpublished after being favorited.

## Test Strategy Pointers

- Unit/integration: wishlist ownership checks.
- E2E: authenticated wishlist add/view.

## Constraints And Invariants

- Wishlist stores product-level favorites, not variant/SKU selections.
- Medusa customer actor owns each favorite; customer ID is derived from
  authenticated request context and is never accepted from storefront input.
- PostgreSQL-backed custom Wishlist Module owns durable records with at most one
  row per `(customer_id, product_id)`.
- Guests have no local or backend wishlist persistence in MVP.
- Wishlist capability requires a valid customer session/current customer response;
  it does not depend on guest-cart merge success or checkout readiness.
- Missing, unpublished, current-sales-channel-invisible, or inactive-category
  products are hidden while their favorite records remain. Out-of-stock products
  remain visible with unavailable state.
- Add/remove operations are idempotent and never expose another customer's state.

## Verification Targets

- PostgreSQL integration proves create/list/delete, uniqueness, restart safety,
  customer isolation, exact product projection, and visibility behavior.
- API tests prove unauthenticated denial and actor-derived ownership.
- Browser E2E proves authenticated add/view/remove from catalog, product detail,
  and wishlist page, plus no guest persistence.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md).
- Run `/prd-to-tasks FT-005`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: ownership and scope; may be `not_required` for deep SDD if global auth/customer model covers it.
- Use standalone `/spec-improve FT-005` only for repair/refresh without creating or updating task records.

## Feature Design

- Status: complete.
- Feature hub: [.memory-bank/tech-specs/FT-005-authenticated-wishlist.md](../tech-specs/FT-005-authenticated-wishlist.md).
- Data model: [.memory-bank/domains/wishlist-data.md](../domains/wishlist-data.md).
- API/security contract: [.memory-bank/contracts/wishlist-api-security.md](../contracts/wishlist-api-security.md).
- Blocking design questions: none.
