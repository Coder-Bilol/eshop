---
description: Feature FT-006 - checkout and delivery methods.
status: draft
lifecycle: planned
---
# FT-006 Checkout Delivery Methods

## Use Cases

- Authenticated buyer enters checkout contact data.
- Buyer selects pickup, city courier, or transport-company delivery.
- Buyer sees fixed tariff for selected delivery method.
- Buyer selects payment method.

## Acceptance Criteria

- Covers REQ-013 through REQ-017.
- Checkout collects name, email, required phone, city, address, comment, delivery method, and payment method.
- Delivery methods do not require external provider integration.
- Fixed tariffs are applied by delivery method.

## Edge Cases & Failure Modes

- Required phone missing.
- Delivery method unavailable.
- Fixed tariff cannot be calculated.

## Test Strategy Pointers

- Unit: fixed tariff calculation.
- E2E: checkout field validation and delivery selection.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md).
- Run `/prd-to-tasks FT-006`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: checkout data ownership, delivery method model, validation boundary.
- Use standalone `/spec-improve FT-006` only for repair/refresh without creating or updating task records.
