---
description: Feature FT-005 - authenticated wishlist.
status: draft
lifecycle: planned
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

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md).
- Run `/prd-to-tasks FT-005`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: ownership and scope; may be `not_required` for deep SDD if global auth/customer model covers it.
- Use standalone `/spec-improve FT-005` only for repair/refresh without creating or updating task records.
