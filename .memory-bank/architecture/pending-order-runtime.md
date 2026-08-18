---
description: FT-007 runtime architecture for pending orders and reservations.
status: active
owner: prd-to-tasks
last_updated: 2026-08-16
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
- FT-009 consumes the resulting `order_id` and payment selection. FT-008 owns
  later lifecycle/admin projection.

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
   expiration timestamp, and selected payment ID for FT-009. No provider call is
   made by FT-007.

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
- The workflow rechecks state under the order lock, calls native
  `cancelOrderWorkflow`, then deletes reservation items by order line IDs.
- A retry after cancellation or partial reservation cleanup is a no-op for
  already-clean items and completes remaining cleanup. Paid/non-pending orders
  are never canceled by this job.

## Runtime Source Boundaries

```text
authenticated Store API
  -> create-pending-order workflow
     -> Medusa cart/order modules + createOrderWorkflow
     -> reserveInventoryStep / inventory module
     -> PostgreSQL order metadata + reservation items

hourly Medusa job
  -> expire-pending-order workflow
     -> cancelOrderWorkflow
     -> delete reservations by line item
```

## Not Applicable

- No custom scheduler service, queue, microservice, inventory ledger, payment
  provider, or Admin replacement.
- No direct browser database access and no trust in client-calculated totals.
