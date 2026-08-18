---
description: FT-007 feature design for pending order creation and inventory reservation.
status: active
owner: prd-to-tasks
last_updated: 2026-08-16
source_of_truth:
  - .memory-bank/features/FT-007-pending-order-inventory-reservation.md
  - .memory-bank/architecture/pending-order-runtime.md
  - .memory-bank/contracts/pending-order-api.md
  - .memory-bank/domains/pending-order-inventory-data.md
  - .memory-bank/states/pending-order-inventory-lifecycle.md
---
# FT-007 Pending Order And Inventory Reservation

## Purpose

Turn the authenticated cart and validated checkout input into one durable
pending-payment order with a stock reservation that can be released safely after
the 72-hour payment window.

## Normative Decisions

- Use the installed Medusa v2.16 core workflows and modules; do not modify
  Medusa Core.
- Create the order with native Medusa `status: "pending"`. Store the product
  state as `metadata.checkout_state: "pending_payment"` because
  `pending_payment` is not a native Medusa `OrderStatus`.
- Store `metadata.pending_payment_expires_at` as an ISO UTC timestamp and keep
  the original checkout/payment selection in non-secret metadata needed by
  downstream FT-008/FT-009 work.
- Use `createOrderWorkflow` and `reserveInventoryStep` inside a custom workflow.
  Reservation compensation must remove created reservation items if the order
  workflow fails after reservation.
- Use the authenticated actor plus a server-validated cart ownership check. A
  client cart ID is only a lookup reference; the client cannot supply order
  items, prices, tariffs, inventory IDs, or customer identity as authority.
- Serialize retries with the existing workflow lock pattern. The idempotency key
  is persisted in order metadata and a repeated successful request returns the
  same order instead of creating a second order.
- Use a Medusa cron job and an idempotent cancellation workflow to expire orders.
  Cancellation occurs before reservation deletion so a partial cleanup can be
  retried without leaving an active order without its hold.

## Acceptance Coverage

- REQ-018: one authenticated cart becomes one native pending order before any
  payment-provider call.
- REQ-019: every inventory-managed line has a durable reservation tied to its
  order line and the selected stock location.
- REQ-021: an unpaid logical `pending_payment` order expires after 72 hours,
  transitions to canceled, and releases each reservation exactly once.
- Retry within the pending window is allowed for FT-009 without creating a new
  order; retry after expiration is rejected with a stable conflict.
- Stock conflict and any compensation failure are observable, sanitized, and
  cannot silently produce a partial successful order.

## Linked Design

- [Pending-order runtime](../architecture/pending-order-runtime.md)
- [Pending-order API](../contracts/pending-order-api.md)
- [Pending-order data](../domains/pending-order-inventory-data.md)
- [Pending-order state](../states/pending-order-inventory-lifecycle.md)
- [System architecture](../architecture/system-architecture.md)
- [Order/payment/inventory state](../states/order-payment-inventory.md)

## Verification Targets

- Unit: expiry calculation, state guards, idempotency-key normalization, and
  reservation-to-line mapping.
- Integration: real Medusa/PostgreSQL order creation, reservation creation,
  stock conflict compensation, duplicate request reconciliation, cancellation,
  and reservation release.
- Runtime/E2E: authenticated checkout creates one pending order, retry returns
  the same order, and a controlled expired fixture is canceled with released
  reservations without payment-provider traffic.
- T3 closure requires full protocol, `/verify PASS`, per-task semantic review,
  human checkpoint, rollback/recovery note, and feature-level semantic review.

## Explicit Non-Goals

- No YooKassa API call, webhook, payment confirmation, or payment retry UI is
  implemented here; those belong to FT-009.
- No complete order lifecycle or custom Admin replacement is implemented here;
  those belong to FT-008.
- No custom inventory database, external delivery provider, fiscalization, or
  Medusa Core modification is introduced.
