---
description: Feature FT-007 - pending order and inventory reservation.
status: draft
lifecycle: planned
---
# FT-007 Pending Order Inventory Reservation

## Use Cases

- System creates order before payment with `pending_payment`.
- System reserves inventory for pending order.
- Buyer can retry payment within pending window.
- Pending order expires/cancels after 72 hours.

## Acceptance Criteria

- Covers REQ-018, REQ-019, REQ-021.
- Pending order is created before payment.
- Inventory is reserved during pending-payment state.
- Unpaid pending order expires or cancels after 72 hours.

## Edge Cases & Failure Modes

- Inventory is unavailable when creating pending order.
- Timeout occurs while payment result is delayed.
- Reservation must release without data loss.

## Test Strategy Pointers

- Unit: timeout calculations and transition guards.
- Integration: order creation, reservation, release/expiration.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/states/lifecycle-map.md](../states/lifecycle-map.md)
- [.memory-bank/domains/core-domain.md](../domains/core-domain.md)

## Normative Inputs

- [.memory-bank/invariants.md](../invariants.md)
- [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md).
- Run `/prd-to-tasks FT-007`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: order/inventory lifecycle, timeout owner, reservation consistency.
- Order state and stock reservation work is high-risk and likely T3 under tier policy.
- Use standalone `/spec-improve FT-007` only for repair/refresh without creating or updating task records.
