---
description: Feature FT-008 - order lifecycle and Medusa Admin visibility.
status: draft
lifecycle: planned
spec_design_status: complete
last_updated: 2026-08-27
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
  unpaid order.
- The operator uses Medusa Admin as the only MVP surface for order status
  changes and sees contacts, products, delivery data, payment status, order
  status, total amount, and payment method.

## Acceptance Criteria

- Covers REQ-022, REQ-028, REQ-029 under the current manual-payment profile.
- Order lifecycle supports `pending_payment -> paid -> processing -> completed`
  and `pending_payment -> canceled`; `refunded` remains an Admin-only native
  refund projection for a manually recorded payment.
- `pending_payment -> paid` is produced only by the native Medusa Admin
  `Mark as paid` action over the order's unpaid payment collection.
- `pending_payment -> canceled` is produced only by the native Medusa Admin
  cancel action. The native order remains in PostgreSQL as `canceled`, its
  reservations are released by the existing native/FT-007 cancellation path,
  and the canceled order is not restored to the customer's active cart.
- No storefront payment request, provider redirect, webhook, or client status
  mutation is part of this feature.
- Required order and payment data is visible in the native Medusa Admin detail.

## Edge Cases & Failure Modes

- Invalid status transition or a post-payment cancel is attempted.
- A caller forges an internal event source or supplies an order/payment pair
  that do not belong together.
- A customer attempts to mark payment or change order status from the Store API.
- The native Admin detail must show feature metadata without a custom Admin
  replacement.

## Test Strategy Pointers

- Unit/integration: Admin-bound order status transition guards and source
  binding.
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
- FT-008 owns the lifecycle projection and guarded transition workflow after a
  native Admin operation. It does not expose a Store lifecycle route or accept
  a caller-supplied source string.
- FT-009 is a deferred optional provider-payment profile. It is not a
  prerequisite for FT-008 and must not be called by the current implementation.
- Medusa Admin remains the operator surface. Native fulfillment, completion, and
  cancellation workflows provide operator actions; FT-008 subscribers/projectors
  keep logical metadata aligned with those native events.
- FT-010 owns customer email side effects and consumes committed lifecycle state;
  FT-008 does not send email directly.

## Resolved Design Decisions

- `checkout_state` is the durable logical lifecycle projection. Its values are
  `pending_payment`, `paid`, `processing`, `completed`, `canceled`, and
  `refunded`. FT-007's `expired` value remains a timeout reason that normalizes
  to global `canceled` when that existing expiry path is used.
- Native Medusa `status` remains `pending` for pending/paid/processing, becomes
  `completed` for completed, and becomes `canceled` only through the unpaid
  Admin cancel/FT-007 expiry path. A post-payment order is never changed to
  native `canceled` by FT-008; a confirmed native refund projects
  `checkout_state: refunded`.
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

## Verification Targets

- Unit/integration proof covers every allowed transition, forbidden transition,
  duplicate/no-op event, expiry normalization, payment/order disagreement, and
  reservation preservation until fulfillment.
- Real Medusa/PostgreSQL proof covers Admin mark-as-paid projection, native
  fulfillment consumption of reservations, unpaid cancellation guards, and
  optional native refund projection with synthetic data only.
- Admin acceptance proves the v2.16 built-in order detail uses its native
  `metadata` field in `DEFAULT_FIELDS`, the `showMetadata`/`showJSON` sections,
  and `/orders/:id/metadata/edit`; it also proves the native
  `paymentCollection.markAsPaid(paymentCollectionId, { order_id })` action.
- Source-security acceptance proves that only native Admin-authenticated
  operations can reach lifecycle transitions; no Store request can provide
  `source`, actor, payment state, or target metadata.
- Feature completion requires the tier-policy gates and a feature-level semantic
  review after all indexed tasks are closed.

## Open Questions

None blocking implementation. The current MVP intentionally defers live
YooKassa credentials, webhooks, return pages, and provider payment to FT-009.
The existing FT-007 expiry/release behavior is not redesigned here; any future
change to that behavior must be handled by a separate FT-007 improvement.
