---
description: FT-008 durable data design for order lifecycle and Medusa Admin visibility.
status: active
owner: spec-improve
last_updated: 2026-08-27
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
  "checkout_delivery_method": "pickup",
  "checkout_payment_method": "personal_request",
  "checkout_customer_comment": "optional synthetic comment"
}
```

FT-008 may update only the logical `checkout_state` and lifecycle audit fields
needed to explain a guarded transition. Existing cart, idempotency, expiry,
reservation, delivery, and payment-selection metadata must be preserved.

The logical state values are `pending_payment`, `paid`, `processing`,
`completed`, `canceled`, and `refunded`. FT-007's `expired` value is retained
as a timeout reason and maps to logical `canceled`; it is not a new peer order
state. The current MVP uses `personal_request` as the customer-facing payment
choice and the native Medusa system provider (`pp_system_default`) only to
maintain the unpaid payment collection required by Admin's `Mark as paid`.

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
- A transition is committed only after the current native order/payment/
  fulfillment state passes the guard and the initiating native Admin operation
  is bound to the fixed internal entrypoint.
- An unpaid Admin cancellation leaves the native order auditable as `canceled`
  and removes it from the customer's active cart/order projection; it does not
  hard-delete the order.
- Repeated events do not create duplicate order, reservation, payment, or
  lifecycle records.
- Refund state is recorded without automatic stock restoration.
