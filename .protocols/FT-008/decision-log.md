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

## D-004 — Native Admin cancellation semantics

- Decision: native Admin cancellation is authoritative for pending, paid, or
  processing orders when Medusa's native cancellation preconditions allow it.
  The order remains in the database as `canceled`, disappears from the active
  customer cart, and cannot be revived by a late payment event. Native Medusa
  owns captured-payment refund and reservation cleanup performed by cancellation.
  Completed-order correction uses the native Admin refund/return path because
  native cancellation does not apply to completed orders.
- Reason: the operator explicitly accepts native Admin refund/cancel behavior;
  FT-008 must project the installed Medusa runtime rather than impose an
  unpaid-only rule that native Admin does not enforce.
- Consequence: `checkout_state: canceled` may coexist with native refunded
  payment evidence after paid-order cancellation. Standalone refund projects
  `refunded` and does not imply automatic stock restock.

## D-007 — Native event is a projection notification, not actor proof

- Decision: native Admin session/RBAC remains the authorization boundary for the
  operation. FT-008 subscribers accept only known server-internal native events,
  re-read authoritative native records, and project state; they do not fabricate
  actor identity from an event that lacks `req.auth_context`.
- Reason: Medusa v2.16 event data does not carry the originating HTTP auth
  context, and event delivery alone is not proof that competing native mutations
  were serialized or that every related write is already visible. Adding a
  second actor-binding store would overcomplicate the current MVP and duplicate
  native audit ownership.
- Consequence: security verification proves that Store/browser requests cannot
  invoke native operator workflows or the projector, and that contradictory or
  cross-order event data fails closed. The event is never used as a substitute
  for the pre-mutation lock defined by D-009. Actor-level audit is retained only
  where native Medusa provides it.

## D-008 — Preserve FT-007 expiry origin and cleanup projection

- Decision: FT-007 remains the sole owner of pending-order expiry and its
  reservation cleanup. Before invoking native cancellation for expiry, the
  guarded FT-007 path records a durable `checkout_expiry_origin: "ft-007"`
  marker. Its existing `checkout_state: "expired"`,
  `checkout_expiry_reason: "payment_timeout"`, and
  `checkout_expiry_cleanup: "pending"|"complete"` projection is preserved.
  FT-008 maps a native `order.canceled` event to `checkout_state: "canceled"`
  only when the authoritative order does not carry the FT-007 expiry marker;
  expiry-origin cancellation preserves the FT-007 projection and cleanup state.
- Reason: native Admin cancellation and FT-007 expiry emit the same native
  cancellation evidence. Inferring the origin from `order.canceled` or from an
  elapsed timestamp can overwrite retry metadata and make partial reservation
  cleanup undiscoverable.
- Consequence: expiry retry selection uses the durable origin and cleanup marker,
  does not depend on event arrival order, and never asks FT-008 to release the
  reservation a second time. Native/global order state remains `canceled`, while
  `expired` is retained as the FT-007 timeout reason and compatibility
  projection rather than a new peer global lifecycle state.

## D-009 — Serialize native lifecycle mutations before they start

- Decision: every competing mutation for one order uses one canonical
  `order-lifecycle:${order_id}` lock from the Medusa Locking module. FT-007
  expiry, native Admin mark-as-paid, cancellation, fulfillment, completion, and
  refund paths acquire this lock before their authoritative re-read,
  precondition check, and native mutation. A supported project route wrapper
  holds it until the built-in Admin handler completes or fails; FT-007 holds it
  through its native cancellation and synchronous cleanup work. The asynchronous
  FT-008 projector reacquires the same lock for its re-read and metadata write.
  Correctness does not depend on projector delivery timing because every native
  mutation repeats authoritative preconditions under the shared lock.
- Reason: a guard that runs only after a native event cannot prevent a payment
  capture, cancellation, refund, reservation release, or fulfillment that has
  already happened. The previous FT-007-only
  `ft-007:pending-order-expiry:${order_id}` lock does not serialize native Admin
  operations.
- Consequence: the operation that acquires the lock first defines the valid
  order. A mark-as-paid attempt that runs after cancellation/expiry re-reads the
  terminal state and fails before capture; a cancellation that runs after a
  successful payment follows Medusa's supported cancel/refund semantics. The
  built-in Admin remains the operator surface: project middleware or another
  supported extension wrapper must enforce the lock around its full native
  handler; Medusa Core and `node_modules` are not modified. If the installed
  route boundary cannot do this, implementation stops and D-003 must be
  revisited before coding continues.

## D-005 — Native Admin mechanism is explicit

- Decision: rely on the installed Medusa dashboard's native order detail fields
  and actions: `metadata` in `DEFAULT_FIELDS`, `showMetadata`/`showJSON`, the
  metadata editor route, `paymentCollection.markAsPaid(...)`, and
  `order.cancel(...)`.
- Reason: the reviewer requires a confirmed Admin mechanism and the project does
  not need a custom Admin surface.
- Consequence: implementation and acceptance must prove these exact boundaries
  against the installed dashboard/runtime version. The metadata editor is a
  display/edit surface for unrelated operator metadata; server-side enforcement
  must preserve or reject changes/deletions across the complete protected
  workflow-owned key set, while approved checkout/expiry or lifecycle workflows
  remain the only writers.

## D-006 — Refund projection without automatic restock

- Decision: only a confirmed cumulative full refund changes the lifecycle
  projection to `refunded`; partial refunds preserve the current logical state.
  Refund projection does not automatically restore inventory.
- Reason: refund accounting and physical stock return are separate domain actions;
  the MVP has no explicit restock policy and must not invent one.
- Consequence: stock return, when applicable, is an explicit native operator
  return/fulfillment action and is outside the lifecycle projection workflow.

## D-010 — Current payment selection is personal_request

- Decision: every new FT-006/FT-007 checkout uses `personal_request`. Existing
  orders with `card`, `sbp`, or `sberpay` retain that value as a legacy offline
  request label for audit compatibility; FT-008 does not rewrite it or treat it
  as provider/payment proof.
- Reason: the current PRD is Admin-only and defers provider selection to FT-009;
  reusing provider rail IDs in the current handoff creates false semantics.
- Consequence: backend/storefront validation exposes only `personal_request`.
  FT-009 must define a separate provider-selection contract when resumed.

## D-011 — Only cumulative full refund is terminal

- Decision: `checkout_state: refunded` is allowed only when persisted native
  refund records (or authoritative `raw_refunded_amount`) cover every persisted
  native capture record (or `raw_captured_amount`) for the bound payment
  collection within native currency precision. This uses the installed Medusa
  model and assumes no capture/refund status field. Partial refunds preserve the
  current logical state, and every event re-evaluates current native totals.
- Reason: Medusa can emit `PaymentEvents.REFUNDED` for a partial amount; the event
  name alone does not prove that the captured payment was fully returned.
- Consequence: TASK-054/055/057 cover single partial, cumulative partials, final
  full refund, duplicate/out-of-order, and cancellation-origin cases.

## D-012 — Protect the complete workflow metadata set

- Decision: the generic Admin metadata editor/API cannot change or delete any
  workflow-owned checkout/expiry/idempotency/handoff key enumerated by the data
  and API contracts. Unchanged protected values are preserved; explicitly
  unrelated operator metadata remains editable. The protected set includes the
  FT-007 reservation linkage keys `checkout_reservation_item_ids` and
  `checkout_reservation_line_ids`.
- Reason: protecting only `checkout_state` leaves expiry, replay, cart binding,
  payment selection, and recovery controls mutable outside guarded workflows.
- Consequence: TASK-055/056/057 test the built-in editor and direct Admin API
  against every protected key.

## D-013 — Provider verification is conditional FT-009 scope

- Decision: the current FT-008 verification path is pending order -> native
  Admin confirmation -> visible lifecycle result. Webhook idempotency,
  simulated provider events, and return-page behavior become required only when
  FT-009 is resumed.
- Reason: unconditional provider targets in shared specs contradict the current
  Admin-only PRD and make FT-008 Definition of Done ambiguous.
- Consequence: shared architecture/state/testing routes now label those targets
  as FT-009-only.

## Open Questions

No product decision remains open for the current manual-payment profile. D-008
through D-013 are synchronized into the FT-006/FT-007/FT-008 normative specs and
the implementation handoff. TASK-055 must prove during preflight that the installed
Admin route boundary can hold the shared lock across the full native handler;
failure is a stop condition and requires revisiting D-003. A future FT-009
profile may own provider-specific payment retry, webhook transport, and online
payment; FT-010 still owns email provider selection and notification delivery.
