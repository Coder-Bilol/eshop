---
description: FT-008 durable data design for order lifecycle and Medusa Admin visibility.
status: active
owner: spec-improve
last_updated: 2026-10-04
source_of_truth:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/architecture/order-lifecycle-admin-runtime.md
  - .memory-bank/states/order-payment-inventory.md
---
# Order Lifecycle And Admin Data

## Durable Sources

The native Medusa records remain the only structured sources of truth:

- `Order`: customer, email, currency, native status, totals, shipping address,
  shipping methods, line items, and metadata.
- Payment collection/session/payment records: native system-payment status and
  the payment method/session projection used by the Admin mark-as-paid action.
- Fulfillment records: operator fulfillment progress and native inventory
  consumption boundary.
- Native reservation items: the FT-007 stock hold until cancellation/expiry or
  supported fulfillment consumption.

No order-lifecycle table, read-model database, custom Admin data store, or
inventory ledger is added.

## Metadata Projection

FT-007 already writes and owns these fields:

```json
{
  "checkout_state": "pending_payment",
  "pending_payment_expires_at": "2026-08-25T12:00:00.000Z",
  "checkout_expiry_origin": "ft-007",
  "checkout_expiry_reason": "payment_timeout",
  "checkout_expiry_cleanup": "pending",
  "checkout_delivery_method": "pickup",
  "checkout_payment_method": "personal_request",
  "checkout_customer_comment": "optional synthetic comment",
  "checkout_reservation_item_ids": ["resitem_synthetic"],
  "checkout_reservation_line_ids": ["ordli_synthetic"]
}
```

The three `checkout_expiry_*` fields are absent before expiry starts. FT-007
merges origin/reason/cleanup `pending` before native cancellation, changes
`checkout_state` to `expired` after successful cancellation, and changes cleanup
to `complete` only after reservation release. Existing compatible expiry records
without the new origin marker are recognized by `checkout_state: expired` plus
their FT-007 cleanup metadata.

FT-008 may update only the logical `checkout_state` and lifecycle audit fields
needed to explain a guarded transition. Existing cart, idempotency, expiry,
reservation, delivery, and payment-selection metadata must be preserved.
The complete workflow-owned set is protected metadata: `checkout_state`,
`pending_payment_expires_at`, `checkout_cart_id`, `checkout_idempotency_key`,
`checkout_request_fingerprint`, `checkout_delivery_method`,
`checkout_payment_method`, `checkout_customer_comment`,
`checkout_managed_line_count`, `checkout_reservation_item_ids`,
`checkout_reservation_line_ids`, `checkout_expiry_origin`,
`checkout_expiry_reason`, and `checkout_expiry_cleanup`. The generic Admin
metadata update path may not change or delete these keys, and unchanged
submissions must preserve them. Only approved server-side checkout/expiry or
lifecycle workflows may write them; unrelated operator metadata remains
editable.

The logical state values are `pending_payment`, `paid`, `processing`,
`completed`, `canceled`, and `refunded`. FT-007's `expired` value is retained
as a timeout reason and maps to logical `canceled`; it is not a new peer order
state. The current MVP uses `personal_request` as the customer-facing payment
choice and the native Medusa system provider (`pp_system_default`) only to
maintain the unpaid payment collection required by Admin's `Mark as paid`.
Existing orders with `card`, `sbp`, or `sberpay` keep that value as a legacy
offline-request label for audit compatibility. FT-008 displays but never
rewrites it or treats it as provider/payment proof; all new orders use
`personal_request`.

Provider credentials, webhook secrets, raw provider payloads, OAuth material,
and unnecessary customer PII are never copied into lifecycle metadata. No
external provider request is made by FT-008.

## Admin Field Projection

The Admin detail must obtain:

| Required operator field | Durable source |
|---|---|
| Contacts | `order.email`, native shipping address |
| Products | native order line items and variant/product projection |
| Delivery data | native shipping address and shipping method `data` |
| Total amount | native order totals |
| Payment method | `checkout_payment_method` plus native system payment session/collection |
| Payment status | native payment model/order detail projection |
| Order status | native order `status` plus logical `checkout_state` |

The exact UI layout remains Medusa-owned; acceptance verifies field presence and
meaning, not a custom layout.

## Data Safety

- Metadata updates merge with the existing object and never replace FT-007 keys.
- `order.canceled` and cancellation-origin refund projections preserve
  FT-007-owned expiry origin, reason, pending/complete cleanup, and
  `checkout_state: expired`; only FT-007 advances expiry cleanup.
- Metadata updates that attempt to change or remove any protected workflow key
  are rejected or reconciled to the current server-owned values; explicitly
  operator-editable unrelated metadata changes remain supported.
- A lifecycle projection is committed only after the current native
  order/payment/fulfillment state passes the projection guard under
  `order-lifecycle:${order_id}`. Native Admin routes/workflows own authorization
  and mutation, while project middleware acquires the same lock and enforces
  authoritative preconditions before that native mutation begins.
- An Admin cancellation leaves the native order auditable as `canceled`, removes
  it from the customer's active cart/order projection, and does not hard-delete
  it. If payment was captured, native Medusa performs its supported refund and
  reservation-cleanup behavior as part of cancellation.
- Repeated events do not create duplicate order, reservation, payment, or
  lifecycle records.
- Partial refund evidence leaves the current logical state unchanged. Refund
  state is recorded only after persisted native refund records (or the
  authoritative `raw_refunded_amount` aggregate) cover all persisted native
  capture records (or `raw_captured_amount`) within currency precision, without
  automatic stock restoration; no nonexistent capture/refund status field is
  assumed.
