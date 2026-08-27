---
description: FT-007 state machine for pending orders and inventory reservations.
status: active
owner: prd-to-tasks
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md
  - .memory-bank/domains/pending-order-inventory-data.md
  - .memory-bank/states/order-payment-inventory.md
---
# Pending Order And Inventory Lifecycle

## Logical Order States

```text
global product: pending_payment -> paid      (native Admin marks unpaid system collection as paid in the current profile)
global product: pending_payment -> canceled  (native Admin explicit cancel or existing expiry compatibility path)
FT-007 projection on expiry: checkout_state pending_payment -> expired
native Medusa on expiry: status pending -> canceled
```

The native Medusa order state is `pending` while the global product state and
FT-007 projection are `pending_payment`. On timeout, global/native state becomes
`canceled`; `checkout_state: expired` records only the logical expiry reason for
audit and retry guards. FT-007 never marks an order paid and never uses a return
page as payment authority.

## Reservation States

```text
available -> reserved -> finalized (native fulfillment after Admin payment confirmation)
                    \-> released  (cancel/expiry/payment failure owner)
```

In FT-007, creation reaches `reserved`, and expiry/cancel reaches `released`.
Finalization is a downstream handoff contract for FT-008 native fulfillment and
must not be faked by this feature. A future FT-009 provider profile may add its
own verified handoff without changing the current Admin authority implicitly.

## Guards

- Only an authenticated customer owning an active cart can enter
  `pending_payment`.
- Cart lines, current price, region, sales channel, delivery option, and stock
  are re-read server-side immediately before mutation.
- An order may enter `pending_payment` only after all required reservation inputs
  are available; partial success is compensated.
- Expiration may act only when native order status is `pending`, logical state is
  `pending_payment`, and `expires_at <= now`.
- A paid, canceled, expired, or otherwise non-pending order is never canceled by
  the expiry job.
- Repeated expiration and cleanup calls are safe no-ops for already terminal
  state/items.

## Recovery

- If reservation creation fails, workflow compensation removes reservations and
  cancels/compensates the pending order before returning failure.
- If cancellation succeeds but reservation deletion fails, the job reports a
  recoverable cleanup failure; a later run repeats deletion by line item.
- If idempotency metadata is found after a client timeout, the same order is
  returned rather than creating a duplicate.
- Any ambiguous payment/order state stops automatic mutation and requires the
  owning downstream workflow/operator path.

## Verification Matrix

| Transition | Required proof |
|---|---|
| cart -> pending_payment | authenticated actor, active cart, native order, current lines |
| pending_payment -> reserved | reservation items for every managed line, stock changed exactly once |
| duplicate request -> same order | same idempotency key and no second order/reservation set |
| stock failure -> no success | no partial order/reservation mutation remains |
| pending_payment -> canceled (`checkout_state: expired`) | 72-hour UTC guard, native cancel, released reservations |
| canceled/paid -> expiry no-op | state guard and unchanged order/reservation state |
