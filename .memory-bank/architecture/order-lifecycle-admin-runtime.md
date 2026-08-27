---
description: FT-008 runtime architecture for logical order lifecycle and native Medusa Admin projection.
status: active
owner: spec-improve
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/states/order-payment-inventory.md
  - .memory-bank/architecture/system-architecture.md
---
# Order Lifecycle And Admin Runtime

## Components And Ownership

- `order-lifecycle` pure helpers own the logical state union, native-state
  projection, transition matrix, and conflict guards.
- The lifecycle workflow reads the native Medusa order/payment/fulfillment state,
  validates the requested transition, and updates only FT-008-owned metadata.
- Medusa subscribers/projectors consume native events caused by authenticated
  Admin actions: payment collection marked paid, fulfillment-created,
  order-completed, order-canceled, and payment-refunded. They call the guarded
  workflow and never bypass it.
- FT-009 is a deferred optional provider-payment profile and is not called by
  the current runtime.
- Medusa Admin reads the native order detail. It is not replaced or forked.

## Runtime Flow

```text
FT-007 pending order
  -> native order status pending + checkout_state pending_payment
  -> native Admin "Mark as paid" on the unpaid payment collection
  -> guarded lifecycle workflow: paid
  -> native Admin fulfillment action
  -> native fulfillment event + reservation consumption: processing
  -> native Admin completion action: completed
```

Cancellation and refund are terminal guarded paths:

```text
pending_payment + Admin cancel -> native cancel workflow -> canceled
confirmed native Admin refund -> native payment status -> refunded projection
```

The workflow does not accept a caller-supplied `source`, actor, payment state, or
target metadata. Separate internal entrypoints bind the source to the native
Admin event that invoked them; the native Admin session/RBAC is the authorization
boundary. Each entrypoint re-reads the order and related payment/fulfillment
records under the existing order lock before mutation, rejects cross-order
references, rejects a paid transition for a canceled/expired order, rejects a
fulfillment transition without a successful payment state, and treats an
already-applied target state as an idempotent no-op. Native Admin activity/event
evidence is retained as the audit actor/event record; lifecycle metadata stores
only the bounded actor type and event kind.

## Reservation Behavior

FT-007 creates native reservation items linked to order lines. A successful
payment leaves those reservations in place so the stock hold survives until an
operator starts fulfillment. Medusa's supported fulfillment workflow consumes the
reservation, adjusts inventory, and deletes or updates the consumed reservation.

FT-008 must not delete reservations on Admin mark-as-paid, manually decrement
stock, or create a second reservation ledger. FT-007 remains responsible for
release on unpaid expiry/cancellation. Refund projection does not automatically
restock.

## Admin Projection

The Admin detail gets its required data from the native order, payment collection,
payment session, shipping method, shipping address, order line, fulfillment, and
metadata records. In Medusa v2.16 the Order Detail `DEFAULT_FIELDS` includes
`metadata` and native payment/fulfillment relations; `showMetadata` and
`showJSON` expose `checkout_state`, and `/orders/:id/metadata/edit` is the
built-in metadata editor. The detail's native payment collection action is
`sdk.admin.paymentCollection.markAsPaid(paymentCollectionId, { order_id })`.
The projection preserves both native status fields and logical
`checkout_state` so an operator can reconcile them when a transition is in
progress or an event is repeated.

No storefront endpoint is added for operator lifecycle changes. Buyer-facing
return pages, if later implemented by FT-009, can only read backend state.

## Deployment And Operations

- No new service, queue, scheduler, database table, or migration is introduced.
- Local verification uses the existing Windows-native Medusa/PostgreSQL runtime.
- Acceptance fixtures use synthetic contacts, the native system payment provider,
  and products; secrets, provider payloads, cookies, and production data are
  excluded.
- A transition or Admin visibility mismatch is a stop condition for execution,
  not a reason to add a custom Admin or bypass the native workflow.
