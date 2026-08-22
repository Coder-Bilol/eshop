---
description: Feature FT-007 - pending order and inventory reservation.
status: draft
lifecycle: verified
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md
  - .memory-bank/architecture/pending-order-runtime.md
  - .memory-bank/contracts/pending-order-api.md
  - .memory-bank/domains/pending-order-inventory-data.md
  - .memory-bank/states/pending-order-inventory-lifecycle.md
---
# FT-007 Pending Order Inventory Reservation

## Use Cases

- System creates order before payment with `pending_payment`.
- System reserves inventory for pending order.
- Pending order remains eligible for FT-009 payment retry within the pending
  window; FT-007 itself does not call a payment provider.
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

## Feature Design Result

- Status: complete.
- Medusa v2.16 uses native order `status: "pending"`; the product-level
  `pending_payment` state is represented by durable order metadata
  `checkout_state: "pending_payment"` and an ISO UTC
  `pending_payment_expires_at` timestamp. Medusa Core is not modified.
- Native `reserveInventoryStep` owns the stock hold after the order is created;
  its workflow compensation removes reservations if order creation does not
  complete. Reservation items remain linked to order line items and carry the
  pending-order identity in metadata.
- Duplicate order requests are serialized by the existing workflow lock pattern
  and reconciled through a client idempotency key recorded in order metadata.
- Expiration uses a Medusa cron job plus an idempotent cancellation workflow. It
  cancels only still-pending logical orders, releases line-item reservations, and
  never treats the storefront or a future payment return as authoritative.
- Exact API, data, state, runtime, and verification decisions are routed through
  the linked SDD specs above.

## Design Boundaries

- FT-007 owns authenticated cart-to-order creation, pending-payment metadata,
  inventory reservation, timeout/cancel release, and the handoff of `order_id`
  plus payment-selection context to FT-009.
- FT-009 owns payment-provider calls and webhook-driven payment transitions.
- FT-008 owns the complete order lifecycle and Medusa Admin projection; FT-007
  exposes the minimum durable metadata and transition guards it needs.
- FT-007 does not introduce a custom admin panel, delivery provider, payment
  provider, fiscalization, or a second inventory database.

## Lifecycle Reconciliation

- `TASK-050` is scheduler-closed as `done` with functional `PASS`, semantic
  `semantic-pass`, and completed T3 checkpoint/recovery markers.
- `TASK-051` is scheduler-closed as `done` with functional `PASS`, semantic
  `semantic-pass`, exact T3 markers, and real expiry/release/retry evidence.
- TASK-050 and TASK-051 establish the server-authoritative order/reservation and
  expiry/release boundaries; TASK-052 closes the authenticated storefront and
  full cross-runtime acceptance slice.
- Evidence: [TASK-050 task record](../tasks/TASK-050.task.json),
  [verification](../../.protocols/TASK-050/verification.md),
  [semantic verification](../../.protocols/TASK-050/red-verification.md),
  [sync report](../../.tasks/TASK-050/TASK-050-S-MB-SYNC-final-report-docs-02.md),
  [TASK-051 task record](../tasks/TASK-051.task.json),
  [TASK-051 verification](../../.protocols/TASK-051/verification.md), and
  [TASK-051 semantic verification](../../.protocols/TASK-051/red-verification.md).
- `TASK-052` is scheduler-closed with full browser/runtime evidence, but the
  first feature-level semantic review observed that a same-key request after
  controlled expiry returned `201` instead of the normative stable conflict.
  `TASK-053` is scheduler-closed after preserving the terminal key binding and
  proving real backend/browser `409` with no replacement mutation.
- Final feature-level `/red-verify --feature FT-007` returned
  `SEMANTIC_VERDICT: semantic-pass`. FT-007 and REQ-018/REQ-019/REQ-021 are
  `verified`.
- Final evidence: [TASK-052 record](../tasks/TASK-052.task.json),
  [TASK-053 record](../tasks/TASK-053.task.json),
  [TASK-053 verification](../../.protocols/TASK-053/verification.md),
  [TASK-053 semantic verification](../../.protocols/TASK-053/red-verification.md),
  and [FT-007 final feature review](../../.tasks/FT-007/FT-007-S-RED-VERIFY-final-report-docs-02.md).
