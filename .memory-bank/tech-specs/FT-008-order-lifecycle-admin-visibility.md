---
description: Feature-level SDD hub for FT-008 order lifecycle and Medusa Admin visibility.
status: active
owner: spec-improve
last_updated: 2026-10-04
source_of_truth:
  - .memory-bank/features/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/architecture/order-lifecycle-admin-runtime.md
  - .memory-bank/contracts/order-lifecycle-admin-api.md
  - .memory-bank/domains/order-lifecycle-admin-data.md
  - .memory-bank/states/order-lifecycle-admin.md
---
# FT-008 Order Lifecycle And Admin Visibility

## Scope

FT-008 turns the existing FT-007 pending order into a complete, durable logical
order lifecycle for the current personal/offline-payment MVP and keeps that
lifecycle visible through the native Medusa Admin order surface.

It owns the logical state projection, transition guards, the internal lifecycle
transition workflow, native Medusa Admin event projection, and operator
acceptance evidence. It does not own online provider calls, webhook
authentication, webhook replay storage, email delivery, or a custom Admin
application.

## Normative Design Surface

- [.memory-bank/architecture/order-lifecycle-admin-runtime.md](../architecture/order-lifecycle-admin-runtime.md)
- [.memory-bank/contracts/order-lifecycle-admin-api.md](../contracts/order-lifecycle-admin-api.md)
- [.memory-bank/domains/order-lifecycle-admin-data.md](../domains/order-lifecycle-admin-data.md)
- [.memory-bank/states/order-lifecycle-admin.md](../states/order-lifecycle-admin.md)
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md)
- [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md)

## Design Area Matrix

| Area | Status | Authoritative source |
|---|---|---|
| Architecture | complete | `architecture/order-lifecycle-admin-runtime.md` |
| Internal transition contract | complete | `contracts/order-lifecycle-admin-api.md` |
| Native order/payment/fulfillment data | complete | `domains/order-lifecycle-admin-data.md` |
| Lifecycle state machine | complete | `states/order-lifecycle-admin.md` |
| Storefront API | not_applicable | FT-008 adds no buyer-facing lifecycle mutation or custom order route. |
| Custom Admin UI | not_applicable | Medusa Admin remains the MVP operator surface. |
| External provider event authenticity | not_applicable | No external provider is used in the current MVP; FT-009 is a deferred optional profile. |
| Email side effects | not_applicable | FT-010 consumes committed state. |
| Persistence/migration | complete | Native Medusa order/payment/fulfillment records and existing metadata; no new table or migration. |
| Testing/operations | complete | Linked testing index, runtime smoke, and Admin/browser acceptance tasks. |

## Lifecycle Contract

The current product lifecycle is:

```text
pending_payment -> paid -> processing -> completed
pending_payment|paid|processing -> canceled (native Admin cancel, when allowed)
paid|processing|completed -> refunded        (native Admin refund path, when needed)
```

`pending_payment` is represented by the FT-007 native `pending` order plus
`checkout_state: pending_payment` and one native unpaid payment collection using
the Medusa system payment provider (`pp_system_default`). `paid` is written only
after the authenticated native Admin `Mark as paid` action. `processing` is
projected from a native Admin fulfillment-start action, `completed` from the
native Admin completion action, and `canceled` from the native Admin cancel
action when Medusa's native cancellation preconditions allow it, or from the
existing FT-007 expiry path. Native cancellation may refund captured payment
and clean up reservations as part of the supported workflow. A standalone
confirmed cumulative full native Admin refund may project `refunded`; partial
refunds preserve the current logical state. A completed order uses the native
refund/return path because native cancellation does not apply to it.
FT-007 expiry remains distinguishable through the durable
`checkout_expiry_origin: "ft-007"` marker and retains
`checkout_state: "expired"` as its timeout projection even though native/global
order state is `canceled`.

### Cancellation/refund precedence

Native cancellation and its captured-payment refund are one operator action.
The refund notification emitted by that action must not be interpreted as a
standalone lifecycle refund. The guarded projector applies this deterministic
precedence:

| Native evidence | Logical projection |
|---|---|
| `order.canceled` or authoritative `order.status: canceled` without FT-007 expiry origin | `checkout_state: canceled` |
| cancellation with `checkout_expiry_origin: "ft-007"` or a compatible existing FT-007 `expired` record | preserve FT-007 origin/reason/cleanup fields and `checkout_state: expired`; do not project operator cancellation |
| `payment_refunded` while the authoritative order is `canceled` without FT-007 expiry origin | no-op for logical state; preserve `canceled` |
| partial native refund while the order is not canceled | preserve the current logical state; retain native refund evidence |
| persisted native refunds (or authoritative `raw_refunded_amount`) cover all persisted native captures (or `raw_captured_amount`) within currency precision while the order is not canceled and logical state is `paid`, `processing`, or `completed` | `checkout_state: refunded` |
| refund notification with missing/contradictory payment-order binding, or a cancellation/refund race whose authoritative order state is not yet committed | reject/no-op; do not write lifecycle metadata |

The projector must re-read the order and payment-collection binding under the
canonical order-lifecycle lock for every notification. Event arrival order must
not allow cancellation-origin refund to overwrite `canceled` with `refunded`,
or an FT-007 cancellation notification to overwrite expiry cleanup state. The
full-refund predicate is derived from current native raw capture/refund totals
and currency precision, never from an event-supplied amount.

### Pre-native serialization

All competing operations for one order use the Medusa Locking module key
`order-lifecycle:${order_id}`. FT-007 expiry and supported wrappers around the
built-in Admin mark-as-paid, cancel, fulfillment, completion, and refund routes
acquire it before authoritative re-read and precondition checks, then hold it
through the native handler. The async projector acquires the same key again,
re-reads native state, and writes only the matching projection. A native event
is a notification, not proof that the source mutation committed or that it was
serialized.

Correctness does not depend on projector delivery timing: every native wrapper
fails closed from current native state before irreversible mutation, and every
projector reconciles from current native state after acquiring the same key.
No Medusa Core or `node_modules` edit is allowed. If the installed Admin route
boundary cannot hold the lock for the complete native handler, implementation
must stop and the native Admin integration decision must be redesigned before
TASK-055 continues.

## Admin Visibility Contract

The existing Medusa Admin order detail is the only operator surface. The native
order record must retain:

- contact data in the native email/shipping-address fields;
- products and quantities in native order line items;
- delivery address and selected method in the native shipping fields/method data;
- total amount in native order totals;
- payment method in the existing `checkout_payment_method` metadata and the
  native system payment collection/session;
- payment status from the native payment model;
- native order status plus logical `checkout_state` for the product lifecycle.

The supported v2.16 Admin mechanism is the existing Order Detail page: its
`DEFAULT_FIELDS` requests `metadata` and native payment/fulfillment relations,
`showMetadata` and `showJSON` render `checkout_state`, and the built-in
`/orders/:id/metadata/edit` route exposes the metadata section. The same page
uses `sdk.admin.paymentCollection.markAsPaid(paymentCollectionId, { order_id })`
for manual payment confirmation and `sdk.admin.order.cancel(orderId)` for native
order cancellation. No custom Admin replacement or direct database access is
part of the feature.

### Protected workflow metadata

The built-in Admin metadata editor may display workflow metadata, but the
generic Admin order-metadata update boundary must reject or preserve attempted
changes/deletions for the complete current protected set:
`checkout_state`, `pending_payment_expires_at`, `checkout_cart_id`,
`checkout_idempotency_key`, `checkout_request_fingerprint`,
`checkout_delivery_method`, `checkout_payment_method`,
`checkout_customer_comment`, `checkout_managed_line_count`,
`checkout_reservation_item_ids`, `checkout_reservation_line_ids`,
`checkout_expiry_origin`, `checkout_expiry_reason`, and
`checkout_expiry_cleanup`. The server-side boundary is authoritative; a
disabled or hidden UI field is not sufficient. Only approved server-side
checkout/expiry or lifecycle workflows may write protected keys; unrelated
operator metadata remains editable.

## Verification Targets

- Transition guards reject illegal or contradictory changes and make repeated
  already-applied Admin/native events safe no-ops.
- Concurrent Admin payment/cancellation/fulfillment/refund and FT-007 expiry
  acceptance proves the canonical lock is acquired before authoritative
  precondition checks and native mutation, not only inside the later projector.
- Admin mark-as-paid does not delete the reservation; native fulfillment consumes
  the reservation and performs the inventory adjustment.
- An Admin cancellation remains `canceled` in PostgreSQL, applies native
  refund/reservation-cleanup semantics where relevant, and never returns the
  order to the customer's active cart.
- Cancellation-origin refund evidence leaves the logical state `canceled`,
  while partial standalone refunds preserve the current state and only a final
  cumulative full refund on a non-canceled order projects `refunded`.
- FT-007-origin cancellation preserves `checkout_state: expired`, expiry reason,
  origin, and pending/complete cleanup state; partial cleanup remains discoverable
  and no second reservation release is attempted by FT-008.
- A canceled order cannot become paid/processing. Native cancellation failures
  for completed orders or orders with active fulfillments remain native errors;
  the FT-008 projector does not emulate or bypass that boundary.
- Admin acceptance observes the exact required order fields and logical metadata
  in the built-in UI and native order payload using synthetic contacts and data.
- Projection acceptance rejects unknown event kinds, contradictory or
  cross-order event data, and any Store-originated lifecycle mutation. It does
  not claim that the event bus carries Admin actor proof.
- Security acceptance also proves the native Admin unauthorized path is denied,
  authoritative records are re-read under the canonical lock, same-order payment
  binding is enforced, and duplicate, out-of-order, replayed, late, or
  concurrent events cannot create a second transition or mutate a terminal
  order. Native internal-event idempotency uses the guarded state transition;
  FT-008 does not add a separate replay ledger.
- Metadata acceptance proves that generic Admin metadata updates preserve or
  reject change/deletion of every protected workflow key, including unchanged
  submissions, while allowing explicitly operator-editable unrelated metadata.

## Explicit Non-Goals

- No YooKassa client, provider credentials, webhook endpoint, or replay ledger in
  the current MVP; those remain deferred FT-009 scope.
- No email provider, notification queue, custom event bus, or delivery provider.
- No custom order database, inventory ledger, Admin replacement, or Medusa Core edit.
- No automatic stock restoration on refund.
