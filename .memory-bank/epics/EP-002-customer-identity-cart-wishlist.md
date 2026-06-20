---
description: Epic EP-002 - customer identity, cart, and wishlist.
status: draft
lifecycle: planned
---
# EP-002 Customer Identity Cart And Wishlist

## Value

Let buyers build carts before login while preserving customer identity, cart continuity, and authenticated wishlist behavior.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/user-scenarios.md](../user-scenarios.md)
- [.memory-bank/invariants.md](../invariants.md)

## Features

- [FT-003 Guest Cart Persistence Merge](../features/FT-003-guest-cart-persistence-merge.md)
- [FT-004 OAuth Login Before Payment](../features/FT-004-oauth-login-before-payment.md)
- [FT-005 Authenticated Wishlist](../features/FT-005-authenticated-wishlist.md)

## Success Metrics

- Guest cart persists between sessions.
- Login through Google OAuth and VK ID is available before payment.
- Guest and user carts merge correctly.
- Wishlist is available only to authenticated users.

## Acceptance Criteria

- Covers REQ-006 through REQ-012.
- Cart merge sums identical variants/SKU.
- Payment cannot proceed before authentication.

## Constraints / Invariants

- Security/privacy is non-negotiable for identity and cart ownership.
- Auth-related tasks likely route to high-tier verification.
