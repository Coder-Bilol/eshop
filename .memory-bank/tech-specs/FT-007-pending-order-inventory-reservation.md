---
description: FT-007 feature design for pending order creation and inventory reservation.
status: active
owner: prd-to-tasks
last_updated: 2026-10-04
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
  the current `personal_request` selection in non-secret metadata for FT-008.
  FT-009 must define a separate provider-selection contract when resumed.
- Use `createOrderWorkflow` and `reserveInventoryStep` inside a custom workflow.
  Reservation compensation must remove created reservation items if the order
  workflow fails after reservation.
- Use the authenticated actor plus a server-validated cart ownership check. A
  client cart ID is only a lookup reference; the client cannot supply order
  items, prices, tariffs, inventory IDs, or customer identity as authority.
- Serialize order-creation retries with the existing customer/cart workflow lock.
  The idempotency key is persisted in order metadata and a repeated successful
  request returns the same order instead of creating a second order.
- Serialize expiry against native Admin payment, cancellation, fulfillment,
  completion, and refund operations with the canonical
  `order-lifecycle:${order_id}` Medusa lock. The expiry workflow acquires it
  before its authoritative re-read and keeps it through native cancellation and
  its synchronous FT-007 cleanup work.
- Use a Medusa cron job and an idempotent cancellation workflow to expire orders.
  Before native cancellation, persist
  `checkout_expiry_origin: "ft-007"`,
  `checkout_expiry_reason: "payment_timeout"`, and
  `checkout_expiry_cleanup: "pending"` while retaining the current
  `checkout_state`. After cancellation succeeds, persist
  `checkout_state: "expired"`, release reservations, and set cleanup to
  `complete`. Cancellation still occurs before reservation deletion so a
  partial cleanup can be retried without leaving an active order without its
  hold.
- A native `order.canceled` notification is not allowed to overwrite an
  FT-007-origin expiry projection. Retry discovery uses the durable expiry
  origin plus cleanup state, including the interval after native cancellation
  but before `checkout_state: "expired"` is persisted.

## Acceptance Coverage

- REQ-018: one authenticated cart becomes one native pending order before any
  payment-provider call.
- REQ-019: every inventory-managed line has a durable reservation tied to its
  order line and the selected stock location.
- REQ-021: an unpaid logical `pending_payment` order expires after 72 hours,
  transitions to canceled, and releases each reservation exactly once.
- A repeated equivalent pending-order request within the window returns the
  same order; retry after expiration is rejected with a stable conflict. Future
  provider-payment retry remains FT-009 scope.
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
  expiry-origin preservation, partial-cleanup retry, and reservation release.
- Runtime/E2E: authenticated checkout creates one pending order, retry returns
  the same order, and a controlled expired fixture is canceled with released
  reservations without payment-provider traffic.
- T3 closure requires full protocol, `/verify PASS`, per-task semantic review,
  human checkpoint, rollback/recovery note, and feature-level semantic review.

## Explicit Non-Goals

- No YooKassa API call, webhook, provider-payment retry UI, or provider-specific
  selection is implemented here; those belong to FT-009. Native Admin payment
  confirmation belongs to FT-008.
- No complete order lifecycle or custom Admin replacement is implemented here;
  those belong to FT-008.
- No custom inventory database, external delivery provider, fiscalization, or
  Medusa Core modification is introduced.
