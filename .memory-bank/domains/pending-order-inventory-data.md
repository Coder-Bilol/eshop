---
description: FT-007 durable pending-order and inventory reservation data design.
status: active
owner: prd-to-tasks
last_updated: 2026-10-04
source_of_truth:
  - .memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md
  - .memory-bank/states/order-payment-inventory.md
  - .memory-bank/architecture/system-architecture.md
---
# Pending Order And Inventory Data

## Order Metadata

The native Medusa order is the durable commercial record. FT-007 writes only
feature-scoped metadata; native order fields and line items remain Medusa-owned.

```json
{
  "checkout_state": "pending_payment",
  "pending_payment_expires_at": "2026-08-19T12:00:00.000Z",
  "checkout_cart_id": "cart_synthetic",
  "checkout_idempotency_key": "opaque-bounded-key",
  "checkout_request_fingerprint": "sha256-hex",
  "checkout_delivery_method": "pickup",
  "checkout_payment_method": "personal_request",
  "checkout_customer_comment": "optional text",
  "checkout_managed_line_count": 1,
  "checkout_reservation_item_ids": ["resitem_synthetic"],
  "checkout_reservation_line_ids": ["ordli_synthetic"]
}
```

- `checkout_state` is the FT-007 logical projection. Its values are
  `pending_payment`, `canceled`, and `expired`; `expired` is the timeout reason
  mapped to the global product/native Medusa `canceled` state, not a peer native
  order status.
- `pending_payment_expires_at` is UTC and computed server-side as creation time
  plus exactly 72 hours.
- `checkout_idempotency_key` is never logged or returned.
- `checkout_reservation_item_ids` and `checkout_reservation_line_ids` are
  server-written linkage used to preserve and reconcile the native FT-007 stock
  holds. They are durable workflow metadata, not browser input.
- New orders always persist `checkout_payment_method: "personal_request"`.
  Existing orders with `card`, `sbp`, or `sberpay` retain the original value as
  a legacy offline-request label; it is never treated as provider/payment proof
  and is not rewritten during FT-008 projection.
- Contact and delivery data use native order shipping address/shipping method
  fields where possible; comment, stable feature IDs, and the personal payment
  method remain in metadata. FT-008 defines the Admin projection for them.

When expiry starts, FT-007 merges these durable fields before native
cancellation while leaving the current `checkout_state` unchanged until cancel
succeeds:

```json
{
  "checkout_expiry_origin": "ft-007",
  "checkout_expiry_reason": "payment_timeout",
  "checkout_expiry_cleanup": "pending"
}
```

After native cancellation, FT-007 sets `checkout_state: "expired"`; after all
reservation items are released it sets `checkout_expiry_cleanup: "complete"`.
The origin remains durable so FT-008 can distinguish timeout cancellation from
an operator cancellation. Existing expired records without the origin marker
remain compatible when `checkout_state: "expired"` and the FT-007 cleanup fields
already identify them.

## Reservation Items

Native Inventory reservation items are the stock-hold source of truth:

- `line_item_id` links the hold to one native order line.
- `inventory_item_id`, `location_id`, and `quantity` come from current backend
  inventory links, never from the browser.
- `created_by` identifies the FT-007 pending-order workflow.
- `metadata.order_id`, `metadata.expires_at`, and `metadata.state` provide
  sanitized traceability for cleanup and evidence.
- Deletion releases the reservation; deletion is idempotent for already-removed
  items and must not be replaced by a manual quantity decrement.

## Persistence Decision

No custom pending-order or inventory table is introduced. Native Medusa order,
line-item, and reservation-item persistence already provides durable records,
workflow compensation, and Admin-compatible data. The idempotency key and expiry
metadata are durable enough for the MVP because duplicate requests are serialized
by the workflow lock and the expiration job reconciles native pending orders.

If a future scale or query requirement makes metadata scans unsafe, that is a
separate design change requiring a unique durable ledger and migration; it is not
silently added to FT-007.

## Data Safety

- Order creation and reservation are one workflow boundary with compensation.
- Reservation quantity is never trusted from a browser snapshot.
- Expiration/cancellation is guarded by current state and the shared
  `order-lifecycle:${order_id}` lock used by competing FT-008 native operations.
- Expiry retry selection uses `checkout_expiry_origin: "ft-007"` and a
  non-complete cleanup state; it does not depend on a later projector preserving
  one exact `checkout_state` value.
- No hard delete of the order is used for a normal expiry; the native/global
  order remains auditable as `canceled`, with `checkout_state: expired` recording
  the timeout reason while the stock hold is released.
