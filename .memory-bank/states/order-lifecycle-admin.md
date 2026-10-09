---
description: FT-008 order lifecycle state machine and native Medusa projection rules.
status: active
owner: spec-improve
last_updated: 2026-10-04
source_of_truth:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/contracts/order-lifecycle-admin-api.md
  - .memory-bank/states/order-payment-inventory.md
---
# Order Lifecycle And Admin State

## Logical States

```text
pending_payment -> paid -> processing -> completed
pending_payment|paid|processing -> canceled (native Admin cancel, when allowed)
paid|processing|completed -> refunded       (native Admin refund path, when needed)
```

`expired` is not a peer logical state. FT-007 persists it as the timeout reason
on a canceled native order; the projection returns `canceled` with reason
`payment_timeout`. The durable `checkout_expiry_origin: "ft-007"` marker keeps
that FT-007 projection and partial-cleanup state distinct from an operator
cancellation.

## Native Projection

| Logical state | Native Medusa evidence | Required projection rule |
|---|---|---|
| `pending_payment` | order `status: pending`, unpaid system payment collection, `checkout_state: pending_payment` | Only an authenticated checkout creates it. |
| `paid` | Admin-marked-paid native payment collection/payment, order not canceled/completed, no fulfillment started | Only the native Admin `Mark as paid` action may enter it. |
| `processing` | paid native payment plus native fulfillment-created state | Native Admin fulfillment action and reservation consumption are required. |
| `completed` | native order `status: completed` and paid native payment | Native Admin completion workflow is the source of the operator transition. |
| `canceled` | native order `status: canceled` from Admin cancel without FT-007 expiry origin | Native operator cancellation owns refund/reservation cleanup; the order remains auditable in the database. |
| `refunded` | persisted native refunds (or authoritative `raw_refunded_amount`) cover all persisted native captures (or `raw_captured_amount`) for the bound payment collection within native currency precision; native order is not `canceled` | Partial refunds preserve the current logical state; no capture/refund status field or automatic stock restock is assumed. |

For FT-007 expiry, native status is `canceled` but FT-008 preserves
`checkout_state: expired`, `checkout_expiry_origin: "ft-007"`, the timeout
reason, and pending/complete cleanup marker. Global projection still normalizes
that record to `canceled` with `payment_timeout`.

## Guards

- FT-007 expiry and each supported native Admin lifecycle operation acquire
  `order-lifecycle:${order_id}` before authoritative re-read, operation-specific
  preconditions, and native mutation. The route wrapper holds the lock through
  the native handler; the async projector reacquires the same key before its
  re-read and projection.
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
- Native Admin cancellation may move a pending, paid, or processing order to
  `canceled` when Medusa's cancellation preconditions allow it. Captured-payment
  refund and reservation cleanup belong to the native cancellation workflow;
  FT-008 only projects the authoritative result. A completed order is not
  canceled by the native cancel workflow and uses the native Admin refund/return
  path.
- An `order.canceled` notification for `checkout_expiry_origin: "ft-007"` (or a
  compatible existing FT-007 expired record) preserves the expiry projection
  and cleanup marker. FT-008 neither writes operator `canceled` over it nor
  releases reservations.
- `refunded` requires persisted native refunds (or authoritative
  `raw_refunded_amount`) to cover all persisted native captures (or
  `raw_captured_amount`) for the bound payment collection within native currency
  precision; no capture/refund status field is assumed, and a Store request,
  event amount, or client state cannot produce it.
- A cancellation-origin `payment_refunded` event for an authoritative native
  `canceled` order is a no-op for logical state: `checkout_state` remains
  `canceled` while native payment evidence may be `refunded`.
- A standalone refund may project `refunded` only for a non-canceled order whose
  current logical state is `paid`, `processing`, or `completed` and whose
  authoritative cumulative full-refund predicate passes. A partial refund is a
  no-op for logical state. Missing or contradictory native payment/order binding
  fails closed; a refund
  notification observed during an uncommitted cancellation is a no-op until
  cancellation is committed.
- Repeated events that target the current state are no-ops. Contradictory or
  cross-order events fail closed and leave the native records unchanged; Store
  requests cannot invoke the native operator workflows or projector.
- The projector accepts only allow-listed server-internal native events, re-reads
  authoritative records under the canonical lock, and rejects unknown, forged,
  unauthorized, missing, or same-order-mismatched references without metadata
  mutation.
- Expiry, cancellation, payment, fulfillment, and refund native mutations are
  serialized before they begin; their async projectors reacquire the same lock.
  Late or terminal events reject or no-op and cannot restore payment,
  processing, cart, reservation, or stock state even when projection is delayed.
  Native-event idempotency is provided by the guarded transition and does not
  require a separate replay ledger.

## Reservation Lifecycle

```text
pending_payment -> reserved
paid            -> reserved (hold remains)
processing      -> consumed by native fulfillment
canceled        -> released/cleaned up by native Admin cancel / FT-007 expiry path
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
| Admin cancellation/late event | pending or paid order follows native cancel/refund/release semantics, remains canceled in DB, active cart is not restored, and late paid event is rejected |
| FT-007 expiry cancellation | expiry origin/reason and pending/complete cleanup survive `order.canceled`; FT-008 performs no release |
| Expiry vs Admin payment race | one canonical pre-native lock; loser re-reads terminal/paid state and fails before unsafe native mutation |
| Cancellation-origin refund | native order remains `canceled`; payment evidence may be refunded; logical state is not overwritten |
| Standalone refund | single partial and cumulative intermediate refunds preserve state; final cumulative full refund on non-canceled `paid/processing/completed` projects `refunded` without automatic restock |
| Duplicate event | no duplicate metadata mutation or downstream side effect |
| Admin visibility | required contact/product/delivery/payment/status/total fields visible in built-in Admin |
