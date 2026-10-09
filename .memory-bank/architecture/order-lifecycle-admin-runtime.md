---
description: FT-008 runtime architecture for logical order lifecycle and native Medusa Admin projection.
status: active
owner: spec-improve
last_updated: 2026-10-04
source_of_truth:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/states/order-payment-inventory.md
  - .memory-bank/architecture/system-architecture.md
---
# Order Lifecycle And Admin Runtime

## Components And Ownership

- `order-lifecycle` pure helpers own the logical state union, native-state
  projection, transition matrix, and conflict guards.
- The lifecycle projector reads the native Medusa order/payment/fulfillment
  state and updates only FT-008-owned metadata. It is a projection boundary,
  not a replacement for native payment, cancellation, fulfillment, or refund
  workflows.
- Medusa subscribers/projectors consume server-internal notifications for
  payment collection marked paid, fulfillment-created, order-completed,
  order-canceled, and payment-refunded. Delivery of a notification does not by
  itself prove transaction commit, serialization, or actor identity. Native
  Admin authentication authorizes the originating operation; the subscriber
  does not treat event payload as a new authorization command.
- A project middleware/wrapper around each supported built-in Admin mutation
  route and the FT-007 expiry workflow use the same canonical
  `order-lifecycle:${order_id}` Medusa lock before native mutation. Medusa Core
  and `node_modules` remain unchanged.
- FT-009 is a deferred optional provider-payment profile and is not called by
  the current runtime.
- Medusa Admin reads the native order detail. It is not replaced or forked.

## Runtime Flow

```text
FT-007 pending order
  -> native order status pending + checkout_state pending_payment
  -> Admin route wrapper acquires order-lifecycle:${order_id}
  -> authoritative re-read + precondition
  -> native Admin "Mark as paid" on the unpaid payment collection
  -> release route lock after native handler completes
  -> projector reacquires same lock + re-reads native state: paid
  -> wrapped native fulfillment/completion actions follow the same pattern
```

Cancellation and refund are native operator paths with lifecycle projection:

```text
pending_payment|paid|processing + Admin cancel -> native cancel workflow -> canceled
confirmed native Admin refund -> native payment status -> refunded projection
```

Cancellation-origin payment refunds do not create a second logical transition:
once the authoritative native order is `canceled`, a `payment_refunded`
notification is a payment-evidence update/no-op for `checkout_state`. Only a
confirmed cumulative full refund for a non-canceled order in `paid`,
`processing`, or `completed` may project `refunded`. The guard re-reads all
bound native captures/refunds under the lock, compares raw totals with native
currency precision, and keeps the current logical state for every partial
refund. It must make this true regardless of notification arrival order and
must reject an uncommitted or contradictory native read.

Native Admin routes/workflows remain the mutation and authorization boundary.
Before the native handler starts, project middleware resolves the order ID,
acquires the shared lock, re-reads authoritative native records, verifies
same-order bindings and terminal/expiry preconditions, and fails closed on a
conflict. It keeps the lock through completion or failure of that handler.

The subscriber later receives a server-internal notification, acquires the same
lock, re-reads the order and related payment/fulfillment records, rejects
contradictory or cross-order data, and treats an already-applied target state as
an idempotent no-op. Correctness relies on the pre-native guard plus current
native state, not notification timing. The event bus does not carry the
originating HTTP actor context, so FT-008 does not fabricate actor identity or
claim event metadata is an actor proof. Any native audit fields available on the
source record remain the audit source; the lifecycle projection stores only
state and bounded event metadata.

## Security And Concurrency Boundary

- Subscribers use an explicit allow-list of native event names and do not expose
  a public Store or browser command path.
- Native Admin authentication/RBAC authorizes the native operation. Store,
  customer, unauthenticated, and unauthorized-Admin attempts are denied at the
  native boundary and are covered by negative acceptance tests.
- FT-007 expiry and built-in Admin mark-as-paid, cancel, fulfillment, completion,
  and refund wrappers acquire `order-lifecycle:${order_id}` before authoritative
  re-read, same-order/terminal checks, and native mutation. The route wrapper
  holds the lock for the full native handler; FT-007 holds it through its own
  cancellation and synchronous cleanup work.
- The projector re-reads the authoritative order and related records in one
  guarded operation under that same key, verifies same-order
  payment/fulfillment references, and performs no lifecycle write for unknown,
  forged, contradictory, or cross-order input.
- Competing native mutations are serialized before they begin; projection
  notifications reacquire the same key. Repeated events are state-based no-ops;
  late or terminal events cannot restore payment, processing, cart,
  reservation, or stock state even when projection is delayed. No separate
  native-event replay ledger is introduced.
- The complete current workflow-owned metadata set defined by the data/contract
  specs is protected from the generic native Admin metadata update path. The
  server-side boundary rejects or preserves changes/deletions while allowing
  explicitly operator-editable unrelated metadata; approved server-side
  checkout/expiry or lifecycle workflows remain the only writers, and UI-only
  disabling is not a security control.

## Reservation Behavior

FT-007 creates native reservation items linked to order lines. A successful
payment leaves those reservations in place so the stock hold survives until an
operator starts fulfillment. Medusa's supported fulfillment workflow consumes the
reservation, adjusts inventory, and deletes or updates the consumed reservation.

FT-008 must not delete reservations on Admin mark-as-paid, manually decrement
stock, or create a second reservation ledger. FT-007 remains responsible for
unpaid expiry. Before its native cancellation, FT-007 writes the durable
`checkout_expiry_origin: "ft-007"` marker and pending cleanup state. An
`order.canceled` projector that observes this marker preserves FT-007's
`checkout_state: expired`, reason, and cleanup state and never releases the
reservation itself. Native Admin cancellation owns its supported refund and
reservation-cleanup behavior for operator cancellation. Refund projection does
not automatically restock.

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

The metadata editor is a read/display surface for `checkout_state`, not a
lifecycle command. Its unchanged-value submissions may update unrelated
metadata, but attempts to change or remove the protected lifecycle key are
rejected or reconciled server-side.

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
- If supported project middleware cannot hold the shared lock around the full
  installed built-in Admin handler, TASK-055 stops before implementation changes
  and the Admin integration design is revisited.
