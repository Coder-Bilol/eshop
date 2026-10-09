---
description: Feature FT-008 - order lifecycle and Medusa Admin visibility.
status: draft
lifecycle: planned
spec_design_status: complete
last_updated: 2026-10-04
spec_design_links:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/architecture/order-lifecycle-admin-runtime.md
  - .memory-bank/contracts/order-lifecycle-admin-api.md
  - .memory-bank/domains/order-lifecycle-admin-data.md
  - .memory-bank/states/order-lifecycle-admin.md
---
# FT-008 Order Lifecycle Admin Visibility

## Use Cases

- Authenticated customer submits contact and delivery data; the storefront only
  calculates and records the order price and the request for personal payment.
- The storefront does not initiate, redirect to, or confirm an online payment.
- The operator contacts the customer personally and uses the native Medusa Admin
  order detail to mark the native payment collection as paid or to cancel the
  order when native cancellation rules allow it.
- The operator uses Medusa Admin as the only MVP surface for order status
  changes and sees contacts, products, delivery data, payment status, order
  status, total amount, and payment method.

## Acceptance Criteria

- Covers REQ-022, REQ-028, REQ-029 under the current manual-payment profile.
- Order lifecycle supports `pending_payment -> paid -> processing -> completed`
  and native Admin cancellation to `canceled` when Medusa's cancellation
  preconditions allow it; `refunded` remains an Admin-only native refund
  projection for a manually recorded payment.
- `pending_payment -> paid` is produced only by the native Medusa Admin
  `Mark as paid` action over the order's unpaid payment collection.
- `pending_payment -> canceled` and an allowed post-payment cancellation are
  produced only by the native Medusa Admin cancel action or the existing FT-007
  expiry path. The native order remains in PostgreSQL as `canceled`; native
  cancellation handles captured-payment refund and reservation cleanup, and the
  canceled order is not restored to the customer's active cart.
- No storefront payment request, provider redirect, webhook, or client status
  mutation is part of this feature.
- Required order and payment data is visible in the native Medusa Admin detail.
- Lifecycle projection accepts only the allow-listed server-internal native
  events, re-reads the authoritative records with the canonical order-lifecycle
  lock, verifies
  same-order bindings, and makes no mutation for unknown, forged, contradictory,
  cross-order, late, or unauthorized input.
- FT-007 expiry and all supported native Admin lifecycle mutations acquire
  `order-lifecycle:${order_id}` before authoritative preconditions and native
  mutation; projector delivery is not used as the concurrency boundary.
- An FT-007-origin cancellation preserves `checkout_state: expired`, timeout
  reason, and pending/complete cleanup state. FT-008 does not overwrite that
  projection or repeat reservation release.

## Edge Cases & Failure Modes

- Native cancellation is attempted for a completed order or while active
  fulfillments still exist.
- A native event does not match the order/payment/fulfillment records it claims
  to project.
- A customer attempts to mark payment or change order status from the Store API.
- An unauthenticated, customer, or otherwise unauthorized actor attempts to use
  the native Admin operation.
- Duplicate, out-of-order, replayed, or concurrent native events race with
  cancellation, expiry, payment, fulfillment, or refund.
- The native Admin detail must show feature metadata without a custom Admin
  replacement.

## Test Strategy Pointers

- Unit/integration: native-state projection and lifecycle transition guards.
- Integration/e2e: native Admin `Mark as paid`, native cancel, fulfillment and
  completion actions, and required order data visibility.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/states/lifecycle-map.md](../states/lifecycle-map.md)
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)

## SDD Design Gate

- Global `/spec-design` gate is complete.
- Feature-level SDD design is complete and is authoritative through the linked
  runtime, contract, data, and state specs.
- Design focus is resolved: manual Admin payment authority, native Medusa Admin
  visibility, lifecycle ownership, source authorization, and reservation
  behavior after Admin payment confirmation.
- Order lifecycle and operator data work route through T2/T3 according to the
  tier policy; no online payment provider is required for FT-008.

## Normative Design Surface

- [.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md](../tech-specs/FT-008-order-lifecycle-admin-visibility.md): feature hub and ownership.
- [.memory-bank/architecture/order-lifecycle-admin-runtime.md](../architecture/order-lifecycle-admin-runtime.md): native Medusa runtime and event handoffs.
- [.memory-bank/contracts/order-lifecycle-admin-api.md](../contracts/order-lifecycle-admin-api.md): internal transition workflow contract; no custom Admin replacement.
- [.memory-bank/domains/order-lifecycle-admin-data.md](../domains/order-lifecycle-admin-data.md): native order/payment/fulfillment data and metadata projection.
- [.memory-bank/states/order-lifecycle-admin.md](../states/order-lifecycle-admin.md): lifecycle states, guards, and native projections.
- [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md): global lifecycle and safety guardrails.

## Ownership And Handoffs

- FT-007 remains the owner of pending-order creation, 72-hour expiry, and
  release of reservations for unpaid orders.
- FT-008 owns the lifecycle projection and guarded consistency checks after a
  native Admin operation, plus supported pre-native middleware that applies the
  shared lock and authoritative operation preconditions. It does not expose a
  Store lifecycle route or accept caller-supplied lifecycle state, source, or
  actor data.
- FT-009 is a deferred optional provider-payment profile. It is not a
  prerequisite for FT-008 and must not be called by the current implementation.
- Medusa Admin remains the operator surface. Native fulfillment, completion, and
  cancellation workflows provide operator actions; project middleware guards
  those native handlers and FT-008 subscribers/projectors keep logical metadata
  aligned with native notifications.
- FT-010 owns customer email side effects and consumes committed lifecycle state;
  FT-008 does not send email directly.

## Resolved Design Decisions

- `checkout_state` is the durable logical lifecycle projection. Its values are
  `pending_payment`, `paid`, `processing`, `completed`, `canceled`, and
  `refunded`. FT-007's `expired` value remains a timeout reason that normalizes
  to global `canceled` when that existing expiry path is used.
- Native Medusa `status` remains `pending` for pending/paid/processing, becomes
  `completed` for completed, and becomes `canceled` through native Admin cancel
  or the FT-007 expiry path. A native Admin cancellation of a paid order may
  also refund captured payment and clean up its reservation; FT-008 projects
  `checkout_state: canceled`. A standalone refund projects
  `checkout_state: refunded` only after persisted native refunds (or
  authoritative `raw_refunded_amount`) cover all persisted native captures (or
  `raw_captured_amount`) within native currency precision; partial refunds
  preserve the current logical state and no nonexistent status field is assumed.
- FT-007 writes `checkout_expiry_origin: "ft-007"` and pending cleanup before
  native timeout cancellation. FT-008 preserves FT-007's `expired` projection,
  reason, origin, and cleanup marker for `order.canceled`/refund notifications;
  retry discovery remains owned by FT-007 and uses origin plus cleanup state.
- FT-007 expiry and built-in Admin mark-as-paid, cancellation, fulfillment,
  completion, and refund operations use the canonical
  `order-lifecycle:${order_id}` Medusa lock before authoritative re-read,
  precondition, and native mutation. The Admin route wrapper holds the lock
  through its native handler; the async projector reacquires the same key and
  reconciles from current native state. Event delivery is not commit,
  serialization, or actor proof.
- A refund caused by native cancellation is not a standalone lifecycle refund:
  when the authoritative native order is `canceled`, the `payment_refunded`
  notification must leave `checkout_state: canceled` and may only update the
  native payment evidence. Only a confirmed cumulative full refund for a
  non-canceled order in `paid`, `processing`, or `completed` may project `refunded` when
  the cumulative full-refund predicate passes.
- The current payment profile is personal/offline payment: Medusa's native
  system payment provider (`pp_system_default`) backs one unpaid payment
  collection so the built-in Admin `Mark as paid` action can be used. No
  external provider call is made.
- Admin payment confirmation keeps the native reservation until the supported
  Medusa fulfillment workflow consumes it. Payment confirmation never deletes a
  hold or directly mutates inventory quantities.
- Refund does not automatically restock inventory. Stock return is an explicit
  native operator return/fulfillment action.
- Contacts, line items, delivery address/method, totals, payment method metadata,
  native payment status, native order status, and fulfillment status stay on the
  Medusa order/payment/fulfillment records. No custom order table or Admin app is
  introduced.
- The complete workflow-owned metadata set from the FT-007/FT-008 data contract
  is protected. It is displayed by native Admin but cannot be changed or
  deleted by the generic Admin metadata update path; unchanged values must be
  preserved. Only approved server-side checkout/expiry or lifecycle workflows
  may write protected keys.

## Verification Targets

- Unit/integration proof covers every allowed transition, forbidden transition,
  duplicate/no-op event, expiry normalization, payment/order disagreement, and
  reservation preservation until fulfillment.
- Real Medusa/PostgreSQL proof covers Admin mark-as-paid projection, native
  fulfillment consumption of reservations, native unpaid/paid cancellation
  semantics, and optional native refund projection with synthetic data only.
- Admin acceptance proves the v2.16 built-in order detail uses its native
  `metadata` field in `DEFAULT_FIELDS`, the `showMetadata`/`showJSON` sections,
  and `/orders/:id/metadata/edit`; it also proves the native
  `paymentCollection.markAsPaid(paymentCollectionId, { order_id })` action.
- Source-security acceptance proves that no Store request can invoke lifecycle
  mutation or provide payment state, order status, or target metadata. Native
  Admin authentication remains the authorization boundary for the native
  operation; FT-008 does not fabricate actor identity across the event bus.
- Metadata-security acceptance proves that a generic Admin metadata update
  cannot change or delete any protected workflow key, while explicitly
  operator-editable unrelated metadata remains editable and native `Mark as
  paid`/cancel/refund operations still project the correct state.
- Refund acceptance covers one partial refund, multiple cumulative partials,
  the final full refund, duplicates, out-of-order delivery, and
  cancellation-origin refund without prematurely entering `refunded`.
- Security negative-path acceptance proves deny-by-default event filtering,
  same-order payment binding, no mutation after rejected/late/terminal events,
  and pre-native serialization of competing lifecycle operations. It must show
  that a late mark-as-paid attempt after cancellation/expiry fails before
  payment capture, even when metadata projection is delayed.
- Expiry acceptance proves `order.canceled` cannot overwrite FT-007 origin,
  timeout reason, or cleanup state and cannot hide a partial cleanup retry.
- Feature completion requires the tier-policy gates and a feature-level semantic
  review after all indexed tasks are closed.

## Open Questions

No product or design question remains open. TASK-055 has a mandatory preflight:
prove that supported project middleware can hold the shared lock around each
installed built-in Admin native handler. If it cannot, stop before coding and
revisit the native Admin integration decision; modifying Medusa Core is not an
allowed fallback. The current MVP still defers live YooKassa credentials,
webhooks, return pages, and provider payment to FT-009.
