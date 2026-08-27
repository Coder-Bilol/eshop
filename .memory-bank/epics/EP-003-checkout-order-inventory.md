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

## Lifecycle Navigation

- Lifecycle remains `planned`: FT-006 and FT-007 are verified, including the
  authenticated cross-runtime pending-order, reservation, expiry/release, and
  terminal idempotency boundaries. FT-008 still owns complete order-lifecycle
  and Medusa Admin visibility, so the epic is not yet implemented/verified.
- Evidence navigation: [FT-006](../features/FT-006-checkout-delivery-methods.md),
  [IMPL-FT-006](../tasks/plans/IMPL-FT-006.md),
  [TASK-046 protocol verification](../../.protocols/TASK-046/verification.md),
  [TASK-047 protocol verification](../../.protocols/TASK-047/verification.md),
  [FT-006 protocol plan](../../.protocols/FT-006/plan.md),
  [TASK-051 record](../tasks/TASK-051.task.json),
  [TASK-051 verification](../../.protocols/TASK-051/verification.md),
  [TASK-053 record](../tasks/TASK-053.task.json), and
  [FT-007 protocol plan](../../.protocols/FT-007/plan.md).

## Constraints / Invariants

- Order and inventory state changes must avoid data loss.
- Order lifecycle and stock reservation likely route to high-tier verification.
