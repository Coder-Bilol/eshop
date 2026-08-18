---
description: Implementation plan for FT-007 pending order and inventory reservation.
status: active
feature: FT-007
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md
  - .memory-bank/architecture/pending-order-runtime.md
  - .memory-bank/contracts/pending-order-api.md
  - .memory-bank/domains/pending-order-inventory-data.md
  - .memory-bank/states/pending-order-inventory-lifecycle.md
---
# IMPL-FT-007 Pending Order And Inventory Reservation

## Goal

Implement the authenticated cart-to-pending-order boundary, reserve inventory
for the 72-hour pending-payment window, release holds on expiration/cancel, and
hand a truthful order ID/payment selection to FT-009 without invoking a payment
provider.

## Source Artifacts

- `.memory-bank/features/FT-007-pending-order-inventory-reservation.md`
- `.memory-bank/epics/EP-003-checkout-order-inventory.md`
- `.memory-bank/requirements.md`
- `.memory-bank/prd.md`
- `.memory-bank/constitution.md`

## Normative Inputs

- `.memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md`
- `.memory-bank/architecture/pending-order-runtime.md`
- `.memory-bank/contracts/pending-order-api.md`
- `.memory-bank/domains/pending-order-inventory-data.md`
- `.memory-bank/states/pending-order-inventory-lifecycle.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/contracts/boundary-map.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/states/order-payment-inventory.md`
- `.memory-bank/invariants.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/workflows/tier-policy.md`

## Boundaries And Invariants

- Customer identity is actor-derived; cart ownership is checked server-side.
- The backend revalidates checkout fields, current Shipping Options tariff, cart
  lines, prices, inventory links, region, and sales channel immediately before
  mutation.
- Native Medusa order `status: "pending"` plus logical metadata
  `checkout_state: "pending_payment"` is the only order state created here.
- Reservations are created with native `reserveInventoryStep` and are linked to
  order line IDs. No direct stocked/reserved quantity update is allowed.
- Duplicate requests with the same valid idempotency key return the same order;
  no second order or reservation set may be created.
- Any failed reservation path compensates the order/reservations before reporting
  success. Expiration/cancel is idempotent and does not touch paid orders.
- FT-009 owns provider calls/webhooks; FT-008 owns complete lifecycle/Admin
  projection; no custom Admin, provider, queue, or Medusa Core change.

## Waves And Tasks

### W1 — order and reservation foundation

`TASK-050` (`T3`, ready) adds the authenticated `POST /store/checkout/order`
boundary and custom workflow that creates one pending order, reserves all managed
lines, persists metadata, and reconciles retries.

### W2 — expiry and release

`TASK-051` (`T3`, planned; depends on TASK-050) adds the hourly Medusa job and
idempotent expiration/cancellation workflow with reservation release.

### W3 — storefront and acceptance

`TASK-052` (`T3`, planned; depends on TASK-050 and TASK-051) connects the existing
checkout continuation to order creation and adds real runtime evidence for order,
reservation, retry, conflict, expiry, cleanup, and provider isolation.

## Expected Touched Files

- `apps/backend/src/api/store/checkout/order/route.ts`
- `apps/backend/src/api/store/checkout/order/validators.ts`
- `apps/backend/src/workflows/checkout/create-pending-order.ts`
- `apps/backend/src/workflows/checkout/expire-pending-order.ts`
- `apps/backend/src/jobs/expire-pending-orders.ts`
- `apps/backend/src/checkout/pending-order.ts`
- `apps/backend/test/run-integration.cjs`
- `apps/backend/src/scripts/smoke-pending-order-acceptance.ts`
- `apps/storefront/components/checkout-form.tsx`
- `apps/storefront/lib/checkout.ts`
- `apps/storefront/src/pending-order.test.cjs`
- `.memory-bank/changelog.md`

## Testing And Quality Gates

- Unit: expiry arithmetic, state/idempotency guards, and reservation mapping.
- Backend integration: real Medusa/PostgreSQL authenticated order and reservation
  creation, compensation, duplicate reconciliation, cancellation, and release.
- Browser/runtime: one pending order from the real checkout flow, no silent
  duplicate, controlled expiry, released reservations, sanitized artifacts, and
  no provider request.
- Every T3 task requires full protocol, canonical ready packet, `/verify PASS`,
  per-task `/red-verify semantic-pass`, `HUMAN_CHECKPOINT: done`, and
  `ROLLBACK_RECOVERY_NOTE: present`.
- Feature completion additionally requires `/red-verify --feature FT-007` with
  `SEMANTIC_VERDICT: semantic-pass`.

## UAT

1. Authenticate a synthetic customer and open a cart with managed inventory.
2. Submit valid checkout data with a fresh idempotency key.
3. Confirm one native pending order, logical `pending_payment`, 72-hour expiry,
   and reservation items linked to every managed line.
4. Repeat the request with the same key and confirm the same order and unchanged
   order/reservation counts.
5. Attempt a stock-conflicting cart and confirm sanitized `409` with no partial
   mutation.
6. Run the controlled expiry path and confirm native cancellation, released
   reservations, idempotent rerun, and no payment-provider request.

## Handoff

Run `node scripts/mb-doctor.mjs --strict` at the feature/task-queue boundary.
Start with TASK-050 only; do not execute downstream tasks until dependencies are
closed by the scheduler/owner.
