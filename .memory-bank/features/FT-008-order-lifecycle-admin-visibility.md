---
description: Feature FT-008 - order lifecycle and Medusa Admin visibility.
status: draft
lifecycle: planned
---
# FT-008 Order Lifecycle Admin Visibility

## Use Cases

- System tracks order lifecycle states.
- Store operator views order contacts, products, delivery data, payment status, order status, total amount, and payment method in Medusa Admin.
- Operator uses Medusa Admin as MVP operations surface.

## Acceptance Criteria

- Covers REQ-022, REQ-028, REQ-029.
- Order lifecycle supports `pending_payment -> paid -> processing -> completed/canceled/refunded`.
- Required order and payment data is visible in Medusa Admin.

## Edge Cases & Failure Modes

- Invalid status transition is attempted.
- Payment state and order state disagree.
- Admin visibility requires mapping custom fields without custom admin replacement.

## Test Strategy Pointers

- Unit/integration: order status transition guards.
- Integration/e2e: admin visibility of required order data.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/states/lifecycle-map.md](../states/lifecycle-map.md)
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md).
- Run `/prd-to-tasks FT-008`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: Medusa status mapping, admin data visibility, lifecycle ownership.
- Order lifecycle work is high-risk and likely T3 under tier policy.
- Use standalone `/spec-improve FT-008` only for repair/refresh without creating or updating task records.
