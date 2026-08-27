---
description: FT-008 order lifecycle state machine and native Medusa projection rules.
status: active
owner: spec-improve
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/contracts/order-lifecycle-admin-api.md
  - .memory-bank/states/order-payment-inventory.md
---
# Order Lifecycle And Admin State

## Logical States

```text
pending_payment -> paid -> processing -> completed
pending_payment -> canceled
paid|processing|completed -> refunded       (native Admin refund path, when needed)
```

`expired` is not a peer logical state. FT-007 persists it as the timeout reason
on a canceled native order; the projection returns `canceled` with reason
`payment_timeout`.

## Native Projection

| Logical state | Native Medusa evidence | Required projection rule |
|---|---|---|
| `pending_payment` | order `status: pending`, unpaid system payment collection, `checkout_state: pending_payment` | Only an authenticated checkout creates it. |
| `paid` | Admin-marked-paid native payment collection/payment, order not canceled/completed, no fulfillment started | Only the native Admin `Mark as paid` action may enter it. |
| `processing` | paid native payment plus native fulfillment-created state | Native Admin fulfillment action and reservation consumption are required. |
| `completed` | native order `status: completed` and paid native payment | Native Admin completion workflow is the source of the operator transition. |
| `canceled` | native order `status: canceled` from an unpaid Admin cancel, or existing FT-007 expiry projection | Reservation is released exactly once; the order remains auditable in the database. |
| `refunded` | confirmed native Admin refund status and retained native order record | No automatic stock restock; use the native return/fulfillment path explicitly. |

## Guards

- `pending_payment -> paid` requires a current non-expired native pending order,
  an unpaid system payment collection belonging to that order, and the native
  Admin `Mark as paid` operation.
- No paid transition is accepted for native canceled, expired, or completed
  orders.
- `paid -> processing` requires a paid native payment and a native Admin
  fulfillment event; the reservation must still be available for the fulfillment
  workflow.
- `processing -> completed` requires the native Admin completion event and does
  not rewrite payment or reservation records.
- Cancellation of an unpaid pending order is performed only through the native
  Admin order-cancel action. A paid, processing, or completed order cannot be
  changed to `canceled` by FT-008; use the native Admin refund path when a
  refund is appropriate.
- `refunded` requires confirmed native Admin refund evidence; a Store request
  or client state cannot produce it.
- Repeated events that target the current state are no-ops. Contradictory,
  forged-source, unauthorized, or cross-order events fail closed and leave all
  native records unchanged.

## Reservation Lifecycle

```text
pending_payment -> reserved
paid            -> reserved (hold remains)
processing      -> consumed by native fulfillment
canceled        -> released by native Admin cancel / FT-007 expiry path
refunded        -> unchanged by FT-008; stock return is an explicit operator path
```

The Admin payment transition must never delete reservation items or decrement
stock directly. Native fulfillment owns the stock adjustment boundary.

## Verification Matrix

| Scenario | Required proof |
|---|---|
| Admin marks paid | `pending_payment -> paid`, native payment/admin projection, reservation unchanged |
| Fulfillment starts | `paid -> processing`, native fulfillment consumes reservation |
| Completion | `processing -> completed`, native order status completed |
| Admin cancellation/late event | unpaid order remains canceled in DB, active cart is not restored, late paid event is rejected |
| Refund | confirmed refund projects refunded without automatic restock |
| Duplicate event | no duplicate metadata mutation or downstream side effect |
| Admin visibility | required contact/product/delivery/payment/status/total fields visible in built-in Admin |
