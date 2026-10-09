---
description: FT-008 internal contract for guarded order lifecycle transitions and Admin projection.
status: active
owner: spec-improve
last_updated: 2026-10-04
source_of_truth:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/states/order-lifecycle-admin.md
  - .memory-bank/contracts/api-guidelines.md
---
# Order Lifecycle And Admin Contract

## Boundary

FT-008 exposes no Store route and no replacement Admin API. Its executable
boundary consists of supported project middleware around the built-in native
Admin mutation routes plus a server-internal projection subscribed to native
Medusa notifications. Native Medusa Admin routes/workflows remain the operation
and authorization boundary for payment, cancellation, fulfillment, completion,
and refund. Notification delivery is not treated as proof of commit,
serialization, or actor identity.

## Pre-native Operation Guard

FT-007 expiry and the built-in Admin mark-as-paid, cancel, fulfillment,
completion, and refund paths use the canonical Medusa Locking module key
`order-lifecycle:${order_id}`.

For an Admin operation, supported project middleware must:

1. derive the order ID from the native route parameters/body and authoritative
   payment/fulfillment binding, never from an untrusted lifecycle field;
2. acquire the canonical lock before the native handler begins;
3. re-read the order and related native records, enforce same-order, expiry,
   terminal-state, and operation-specific preconditions, and fail closed without
   native mutation on conflict;
4. keep the lock until the native handler completes or fails.

The async projector acquires the same key again before its authoritative re-read
and metadata write. A delayed projector cannot make an unsafe native mutation
valid: every later native operation repeats the authoritative precondition under
the shared lock. The implementation may use only supported project extension
points; inability to hold the lock around the complete installed Admin handler
is a TASK-055 stop condition, not permission to patch Medusa Core.

## Transition Input

The workflow input is bounded and server-owned. There is no public JSON input
with a mutable `source` field:

```ts
{
  order_id: string,
  event:
    | "payment_marked_paid"
    | "fulfillment_started"
    | "order_completed"
    | "order_canceled"
    | "payment_refunded",
  payment_collection_id?: string,
  native_event_id?: string
}
```

The event kind is selected by the server subscriber from the native event name;
it is not accepted from Store input or treated as actor proof. Native Admin
authentication/RBAC authorizes the originating operation. The projector re-reads
the native record and verifies that a payment collection, if present, belongs to
the same order; no caller can supply customer data, totals, payment status,
fulfillment status, inventory quantity, or a target metadata object.

## Cancellation/refund precedence

The native `order.canceled` and `payment_refunded` notifications do not by
themselves distinguish operator cancellation from FT-007 expiry or prove
transaction ordering. Therefore the projector must use the authoritative native
order state and durable expiry marker under the canonical lock:

- If `checkout_expiry_origin: "ft-007"` is present, or an existing compatible
  record already has `checkout_state: "expired"` with FT-007 cleanup metadata,
  `order.canceled` and cancellation-origin refund notifications preserve
  `checkout_state: "expired"`, expiry reason, origin, and cleanup state. FT-008
  does not release reservations for this path.
- If the native order is `canceled` without FT-007 expiry origin,
  `order.canceled` projects `checkout_state: "canceled"`.

- If the native order is `canceled` without FT-007 expiry origin,
  `payment_refunded` is a safe no-op for
  `checkout_state`; the logical state remains `canceled` even when native
  payment evidence is `refunded`.
- If the native order is not canceled and the logical state is `paid`,
  `processing`, or `completed`, only a confirmed cumulative full refund may
  project `refunded`. Under the lock, the projector sums persisted native
  capture and refund records for every payment bound to the order's payment
  collection, or uses their authoritative `raw_captured_amount` and
  `raw_refunded_amount` aggregates, with native currency precision. The
  predicate passes only when captured total is positive and no captured amount
  remains refundable within the currency epsilon; it does not depend on a
  capture/refund status field that the installed Medusa DTOs do not expose.
- A partial refund, including an intermediate refund in a cumulative series, is
  a no-op for `checkout_state`; the existing logical state remains unchanged
  while native payment/refund evidence remains visible. Every duplicate or
  out-of-order notification re-evaluates the cumulative predicate from current
  native records rather than trusting the event amount.
- Missing or contradictory payment-order binding rejects or no-ops the
  projection; when a cancellation/refund race is detected before cancellation
  is committed, it must also no-op rather than write a guessed lifecycle state.
  A normal standalone refund is allowed only for a confirmed cumulative full
  refund on a non-canceled order.

This rule is independent of event arrival order and prevents the refund
emitted by native cancellation from overwriting the cancellation projection.

## Transition Result

The internal result contains:

```ts
{
  order_id: string,
  previous_state: OrderLifecycleState,
  state: OrderLifecycleState,
  changed: boolean,
  native_order_status: string,
  payment_status: string,
  fulfillment_status: string
}
```

`changed: false` is the expected result for a repeated already-applied native
event. Raw provider payloads and customer contact data are never returned in
errors or acceptance evidence.

## Error And Guard Semantics

- Missing or inaccessible order: sanitized internal not-found failure.
- Event does not match the native payment/fulfillment/order state:
  `order_lifecycle_conflict`; no mutation occurs.
- A transition from `expired`, `canceled`, or `refunded` to `paid` or
  `processing`: rejected with no mutation.
- An `order.canceled` or `payment_refunded` notification carrying authoritative
  FT-007 expiry origin preserves the expiry projection and cleanup marker; it
  cannot write `checkout_state: canceled` or perform reservation cleanup.
- A native Admin cancellation may project `canceled` for a pending, paid, or
  processing order when native cancellation preconditions allow it. Native
  Medusa owns captured-payment refund and reservation cleanup performed by that
  operation; FT-008 does not duplicate it.
- A completed order is not canceled by the native cancel workflow; its correction
  uses the native Admin refund/return path and may project `refunded`.
- A `payment_refunded` event for a native `canceled` order never changes the
  logical state to `refunded`.
- A partial refund on a non-canceled order preserves its current logical state;
  only the authoritative cumulative full-refund predicate may project
  `refunded`.
- A repeated event targeting the current state is a safe no-op.
- A contradictory event or cross-order payment collection reference is rejected
  with no projection mutation. Store requests cannot invoke this boundary.

This is an internal workflow contract, so the shared Store JSON error envelope
is not exposed directly. Any future public route must define its own sanitized
HTTP envelope under the global API guidelines and is outside FT-008.

## Authorization And Audit Binding

- No Store or browser request can invoke the lifecycle projector or native
  operator workflows.
- Native Medusa Admin session/RBAC authorizes the originating operation. The
  event bus is server-internal and its payload is a notification, not a public
  command or an actor credential.
- The subscriber accepts only known native event names, re-reads authoritative
  native records, and fails closed on unknown events or mismatched identifiers.
- Because the installed event boundary does not carry `req.auth_context`, FT-008
  does not fabricate an Admin user ID or claim that event metadata proves actor
  identity. Native audit fields are retained where Medusa supplies them.

## Security Negative-Path Contract

- The subscriber maps only an explicit allow-list of native Medusa event names to
  transition kinds. Unknown event names, caller-supplied event kinds, forged
  sources, missing identifiers, and mismatched identifiers fail closed before a
  lifecycle write.
- Native Admin authentication/RBAC remains the authorization boundary. Store,
  browser, unauthenticated, customer, and unauthorized-Admin requests cannot
  invoke the native operator workflow or call the projector directly; runtime
  acceptance must prove the denied path using synthetic credentials.
- Before writing lifecycle metadata, the transition workflow re-reads the
  authoritative order and related payment/fulfillment records under the
  canonical order-lifecycle lock, verifies that every supplied reference
  belongs to the same order, and writes nothing on a conflict.
- Competing native operations acquire that same lock before their precondition
  and mutation; event projectors reacquire it before projection. A late or
  terminal transition is rejected or becomes a no-op, and cannot restore
  payment, processing, cart, reservation, or stock state even when notification
  delivery is delayed.
- Repeated delivery of an already-applied native event returns `changed: false`
  and emits no second lifecycle mutation or downstream side effect. FT-008 uses
  this guarded state transition for native-event idempotency and does not add a
  separate replay ledger.

## Protected Workflow Metadata

- The server-owned workflow metadata set is protected from generic Admin order
  metadata updates: `checkout_state`, `pending_payment_expires_at`,
  `checkout_cart_id`, `checkout_idempotency_key`,
  `checkout_request_fingerprint`, `checkout_delivery_method`,
  `checkout_payment_method`, `checkout_customer_comment`,
  `checkout_managed_line_count`, `checkout_reservation_item_ids`,
  `checkout_reservation_line_ids`, `checkout_expiry_origin`,
  `checkout_expiry_reason`, and `checkout_expiry_cleanup`. The update boundary
  must reject changes/deletion of these keys or preserve their current values
  while applying explicitly operator-editable unrelated metadata. Only approved
  server-side checkout/expiry or lifecycle workflows may write protected keys;
  UI-only protection is not sufficient.

## Admin Read Contract

The built-in Admin order detail must be able to read the following native and
feature-owned fields without a custom UI: contact, line items, delivery address
and method, total, payment method, payment status, native order status, logical
`checkout_state`, and fulfillment status. In the installed Medusa v2.16 Admin,
the Order Detail page requests `metadata` in `DEFAULT_FIELDS`, renders it via
`showMetadata`/`showJSON`, exposes `/orders/:id/metadata/edit`, and invokes
`paymentCollection.markAsPaid(paymentCollectionId, { order_id })` for the
manual payment action. `checkout_state` is readable there but is not a generic
Admin metadata-edit command; protected-key enforcement applies to both the
built-in editor and direct Admin API requests.

## Handoff Rules

- FT-007 writes `checkout_expiry_origin: "ft-007"` and pending cleanup state
  before its guarded native cancellation. FT-008 preserves that projection and
  must not re-release those reservations; FT-007 retry discovery uses origin
  plus cleanup state until cleanup is complete.
- FT-009 is deferred and must define a separate future provider-payment contract
  before it can participate in this lifecycle.
- FT-010 may subscribe to committed Admin lifecycle results for notification work
  but does not change lifecycle state.
