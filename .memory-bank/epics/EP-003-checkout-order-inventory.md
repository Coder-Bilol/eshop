---
description: Epic EP-003 - checkout, order, and inventory lifecycle.
status: draft
lifecycle: planned
---
# EP-003 Checkout Order And Inventory

## Value

Convert authenticated carts into pending orders with delivery data, fixed delivery tariffs, inventory reservation, lifecycle visibility, and Medusa Admin operations.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/domains/core-domain.md](../domains/core-domain.md)
- [.memory-bank/states/lifecycle-map.md](../states/lifecycle-map.md)
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)

## Features

- [FT-006 Checkout Delivery Methods](../features/FT-006-checkout-delivery-methods.md)
- [FT-007 Pending Order Inventory Reservation](../features/FT-007-pending-order-inventory-reservation.md)
- [FT-008 Order Lifecycle Admin Visibility](../features/FT-008-order-lifecycle-admin-visibility.md)

## Success Metrics

- Checkout captures required contact and delivery data.
- Pending orders reserve inventory and expire after 72 hours if unpaid.
- Operator sees order/payment/delivery data in Medusa Admin.

## Acceptance Criteria

- Covers REQ-013 through REQ-019, REQ-021, REQ-022, REQ-028, and REQ-029.
- Delivery methods use fixed tariffs and no external carrier integration.
- Order lifecycle supports the PRD status model.

## Constraints / Invariants

- Order and inventory state changes must avoid data loss.
- Order lifecycle and stock reservation likely route to high-tier verification.
