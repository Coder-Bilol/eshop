---
description: FT-008 internal contract for guarded order lifecycle transitions and Admin projection.
status: active
owner: spec-improve
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/states/order-lifecycle-admin.md
  - .memory-bank/contracts/api-guidelines.md
---
# Order Lifecycle And Admin Contract

## Boundary

FT-008 exposes no Store route and no replacement Admin API. Its executable
boundary is an internal Medusa workflow reached only from subscribers to native
Medusa events caused by authenticated Admin actions.

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
  native_event_id?: string,
  caller: "native_admin_event"
}
```

The `caller` value is created by private server-side entrypoints, not accepted
from the Store API or from arbitrary workflow callers. The entrypoint is bound
to the native Admin operation: `paymentCollection.markAsPaid` for
`payment_marked_paid`, native Admin order cancel for `order_canceled`, and the
native Admin fulfillment/completion/refund operations for the remaining events.
Native Admin authentication/RBAC is therefore the authorization boundary. The
workflow re-reads the native record and verifies that a payment collection, if
present, belongs to the same order; the caller cannot supply customer data,
totals, payment status, fulfillment status, inventory quantity, or a target
metadata object.

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
- An unpaid pending order may be canceled by the native Admin order-cancel
  operation; its native order remains in the database and its reservation is
  released by the existing native/FT-007 cancellation path.
- A paid, processing, or completed order cannot be changed to `canceled` by
  FT-008. A native Admin refund is the only post-payment terminal projection.
- A repeated event targeting the current state is a safe no-op.
- A forged caller/source, missing native Admin event context, or cross-order
  payment collection reference is rejected with no mutation.

This is an internal workflow contract, so the shared Store JSON error envelope
is not exposed directly. Any future public route must define its own sanitized
HTTP envelope under the global API guidelines and is outside FT-008.

## Authorization And Audit Binding

- No Store or browser request can invoke a lifecycle transition.
- Native Medusa Admin session/RBAC authorizes the originating operation; FT-008
  does not trust a string supplied as `source` or `caller`.
- The subscriber maps only known native Admin operation events to fixed private
  entrypoints. Direct calls with an unknown event, forged caller, or mismatched
  order/payment identifiers fail closed.
- The native Admin activity/event record is the actor audit source. Lifecycle
  metadata may retain `checkout_lifecycle_actor_type: "admin"`, the bounded
  event kind, and the native event/operation ID when Medusa supplies one; no
  fabricated user ID or provider payload is stored.

## Admin Read Contract

The built-in Admin order detail must be able to read the following native and
feature-owned fields without a custom UI: contact, line items, delivery address
and method, total, payment method, payment status, native order status, logical
`checkout_state`, and fulfillment status. In the installed Medusa v2.16 Admin,
the Order Detail page requests `metadata` in `DEFAULT_FIELDS`, renders it via
`showMetadata`/`showJSON`, exposes `/orders/:id/metadata/edit`, and invokes
`paymentCollection.markAsPaid(paymentCollectionId, { order_id })` for the
manual payment action.

## Handoff Rules

- FT-007 sends `pending_order_expiry` only through its existing guarded cancel and
  reservation-release workflow; FT-008 must not re-release those reservations.
- FT-009 is deferred and must define a separate future provider-payment contract
  before it can participate in this lifecycle.
- FT-010 may subscribe to committed Admin lifecycle results for notification work
  but does not change lifecycle state.
