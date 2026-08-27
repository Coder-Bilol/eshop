---
feature: FT-008
stage: decomposition
status: complete
---
# FT-008 Decision Log

## D-001 — Logical lifecycle over native Medusa status and online payment

- Decision: keep the product lifecycle in the existing order metadata
  `checkout_state` and retain native Medusa order status as a compatible Admin
  projection (`pending`, `completed`, or `canceled`). The current payment profile
  creates/keeps one unpaid native system payment collection and has no online
  provider or webhook.
- Reason: Medusa v2.16 `OrderStatus` has no `pending_payment`, `paid`, or
  `processing` state, and changing Medusa Core would violate KISS and the project
  boundary.
- Consequence: projection/transition helpers are authoritative for the logical
  product state; native payment and fulfillment records remain authoritative for
  their own domains.

## D-002 — Native fulfillment consumes an Admin-confirmed reservation

- Decision: Admin “Mark as paid” leaves FT-007 reservation items in place; supported
  Medusa fulfillment consumes the hold and adjusts inventory.
- Reason: installed Medusa v2.16 fulfillment workflows read reservation items and
  perform the inventory adjustment at fulfillment. Deleting a hold on payment
  would make paid stock available again before fulfillment.
- Consequence: FT-008 never directly decrements stock or deletes reservations on
  payment success; expiry/cancel remains FT-007/native cancel ownership.

## D-003 — Admin-bound transition workflow, no custom Admin route

- Decision: expose one guarded internal workflow for native Admin event
  subscribers/projectors; keep payment confirmation, cancellation, fulfillment,
  completion, and refund actions in the built-in Medusa Admin.
- Reason: the PRD explicitly excludes a custom Admin replacement and the native
  order/fulfillment workflows already provide the operator surface.
- Consequence: Admin acceptance verifies native fields plus logical metadata,
  while a future FT-009 profile may add provider authenticity and webhook
  idempotency without changing the current Admin authority.

## D-004 — Unpaid cancellation only

- Decision: Admin may cancel an unpaid order. The order remains in the database
  as `canceled`, disappears from the active customer cart, and cannot be revived
  by a late payment event. A paid/processing/completed order is corrected through
  the native Admin refund action, not a post-payment `canceled` state.
- Reason: payment confirmation and all order status changes are operator-owned in
  the current product scope; this avoids a contradictory global lifecycle.
- Consequence: refund is a separate terminal projection and does not imply stock
  restock.

## D-005 — Native Admin mechanism is explicit

- Decision: rely on the installed Medusa dashboard's native order detail fields
  and actions: `metadata` in `DEFAULT_FIELDS`, `showMetadata`/`showJSON`, the
  metadata editor route, `paymentCollection.markAsPaid(...)`, and
  `order.cancel(...)`.
- Reason: the reviewer requires a confirmed Admin mechanism and the project does
  not need a custom Admin surface.
- Consequence: implementation and acceptance must prove these exact boundaries
  against the installed dashboard/runtime version.

## D-006 — Refund projection without automatic restock

- Decision: a confirmed refund changes the lifecycle projection to `refunded` but
  does not automatically restore inventory.
- Reason: refund accounting and physical stock return are separate domain actions;
  the MVP has no explicit restock policy and must not invent one.
- Consequence: stock return, when applicable, is an explicit native operator
  return/fulfillment action and is outside the lifecycle projection workflow.

## Open Questions

None block decomposition. The current profile has no provider-specific payment
retry, webhook transport, or online payment. A future FT-009 profile may own
those concerns; FT-010 still owns email provider selection and notification
delivery.
