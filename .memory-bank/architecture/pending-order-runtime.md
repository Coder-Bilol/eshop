---
description: FT-007 runtime architecture for pending orders and reservations.
status: active
owner: prd-to-tasks
last_updated: 2026-10-04
source_of_truth:
  - .memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md
  - .memory-bank/contracts/boundary-map.md
  - .memory-bank/architecture/system-architecture.md
---
# Pending Order Runtime

## Ownership

- Storefront submits an opaque cart reference, checkout fields, and an
  idempotency key. It never supplies authoritative line items, prices, tariff
  amounts, inventory IDs, or customer IDs.
- The backend derives the customer from the authenticated Medusa actor and
  validates that the referenced cart belongs to that actor and is active.
- The custom checkout workflow owns the order/reservation transaction boundary.
  It composes installed Medusa workflows rather than changing Medusa Core.
- PostgreSQL-backed Medusa order metadata and native inventory reservation items
  are the durable sources for this feature. No second pending-order or inventory
  store is introduced.
- FT-008 consumes the resulting order and its `personal_request` metadata for
  later lifecycle/Admin projection. Deferred FT-009 must define a separate
  provider-selection handoff when resumed.

## Creation Flow

1. `POST /store/checkout/order` authenticates the customer actor and parses the
   request with the standard Medusa parser.
2. The workflow acquires a lock over customer, cart, and idempotency key.
3. It loads the active cart with current lines, region, sales channel, variant
   inventory links, and authoritative prices. It rejects an empty, completed,
   foreign, or incompatible cart.
4. It re-runs FT-006 validation and Shipping Options resolution. The request
   cannot promote a client-provided snapshot or tariff to source-of-truth.
5. It calls `createOrderWorkflow` with native `status: "pending"`, canonical
   cart lines, shipping address/method, and logical pending-payment metadata.
6. It calls `reserveInventoryStep` for inventory-managed lines. The local MVP
   expects one usable location per inventory item; ambiguous allocation fails
   closed until a multi-location policy is explicitly designed.
7. On success it returns the order ID, logical `pending_payment` state,
   expiration timestamp, and `personal_request` ID for the current Admin-only
   flow. No provider call is made by FT-007.

## Compensation And Retry

- Core workflow compensation removes reservations created by a failed step.
- The order creation step must compensate or cancel the created pending order
  when reservation creation fails; a successful response is never emitted for a
  partial order.
- The idempotency key is normalized, locked, and persisted in order metadata.
  A repeated request with the same key and equivalent actor/cart returns the
  existing order; a mismatched body returns a stable conflict.
- A new idempotency key after a valid pending order exists is not a payment
  retry mechanism and must not create another order for the same checkout unless
  FT-009 explicitly owns that later behavior.

## Expiration Flow

- `src/jobs/expire-pending-orders.ts` runs hourly using the Medusa job loader.
- The job lists native pending orders, filters logical metadata in memory, and
  invokes an idempotent expiration workflow for records whose UTC expiry has
  passed.
- The workflow acquires the canonical `order-lifecycle:${order_id}` Medusa lock
  shared with FT-008 native Admin operations, then re-reads authoritative order
  and payment state. Expired/non-pending or contradictory state fails closed.
- Before `cancelOrderWorkflow`, FT-007 merges the durable
  `checkout_expiry_origin: "ft-007"`,
  `checkout_expiry_reason: "payment_timeout"`, and
  `checkout_expiry_cleanup: "pending"` fields without prematurely changing the
  current logical state. This marker lets an `order.canceled` projector preserve
  expiry ownership.
- After native cancellation succeeds, FT-007 writes
  `checkout_state: "expired"`, deletes reservation items by order line IDs, and
  finally marks `checkout_expiry_cleanup: "complete"` while still inside its
  guarded workflow.
- A retry after cancellation or partial reservation cleanup selects the order by
  `checkout_expiry_origin: "ft-007"` plus non-complete cleanup state, not only
  by `checkout_state`. It is a no-op for already-clean items and completes the
  remaining cleanup. Paid/non-pending orders are never canceled by this job.
- FT-008 may consume the same native cancellation notification, but it must not
  replace FT-007 expiry metadata or release the reservation again.

## Runtime Source Boundaries

```text
authenticated Store API
  -> create-pending-order workflow
     -> Medusa cart/order modules + createOrderWorkflow
     -> reserveInventoryStep / inventory module
     -> PostgreSQL order metadata + reservation items

hourly Medusa job
  -> expire-pending-order workflow
     -> shared order-lifecycle:${order_id} lock
     -> persist FT-007 expiry origin + cleanup pending
     -> cancelOrderWorkflow
     -> delete reservations by line item
     -> persist checkout_state expired + cleanup complete
```

## Not Applicable

- No custom scheduler service, queue, microservice, inventory ledger, payment
  provider, or Admin replacement.
- No direct browser database access and no trust in client-calculated totals.
