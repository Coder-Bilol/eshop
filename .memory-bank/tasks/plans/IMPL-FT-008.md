---
description: Implementation plan for FT-008 order lifecycle and Medusa Admin visibility.
status: active
owner: prd-to-tasks
last_updated: 2026-08-27
feature: FT-008
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/architecture/order-lifecycle-admin-runtime.md
  - .memory-bank/contracts/order-lifecycle-admin-api.md
  - .memory-bank/domains/order-lifecycle-admin-data.md
  - .memory-bank/states/order-lifecycle-admin.md
source_of_truth:
  - .memory-bank/features/FT-008-order-lifecycle-admin-visibility.md
  - .memory-bank/requirements.md
---
# IMPL-FT-008 Order Lifecycle And Medusa Admin Visibility

## Goal

Implement a guarded logical order lifecycle on top of native Medusa order,
payment, fulfillment, and reservation records for the current manual-payment
profile: the storefront calculates the price and records a personal payment
request, while only the built-in Medusa Admin can mark an order paid or change
its status. Then prove the required order data is visible through that Admin
surface.

## Source Artifacts

- [.memory-bank/features/FT-008-order-lifecycle-admin-visibility.md](../../features/FT-008-order-lifecycle-admin-visibility.md)
- [.memory-bank/epics/EP-003-checkout-order-inventory.md](../../epics/EP-003-checkout-order-inventory.md)
- [.memory-bank/requirements.md](../../requirements.md)
- [.memory-bank/prd.md](../../prd.md)
- [.memory-bank/constitution.md](../../constitution.md)
- [.memory-bank/testing/index.md](../../testing/index.md)

## Normative Inputs

- [.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md](../../tech-specs/FT-008-order-lifecycle-admin-visibility.md)
- [.memory-bank/architecture/order-lifecycle-admin-runtime.md](../../architecture/order-lifecycle-admin-runtime.md)
- [.memory-bank/contracts/order-lifecycle-admin-api.md](../../contracts/order-lifecycle-admin-api.md)
- [.memory-bank/domains/order-lifecycle-admin-data.md](../../domains/order-lifecycle-admin-data.md)
- [.memory-bank/states/order-lifecycle-admin.md](../../states/order-lifecycle-admin.md)
- [.memory-bank/states/order-payment-inventory.md](../../states/order-payment-inventory.md)
- [.memory-bank/architecture/pending-order-runtime.md](../../architecture/pending-order-runtime.md)
- [.memory-bank/domains/pending-order-inventory-data.md](../../domains/pending-order-inventory-data.md)
- [.memory-bank/states/pending-order-inventory-lifecycle.md](../../states/pending-order-inventory-lifecycle.md)
- [.memory-bank/contracts/api-guidelines.md](../../contracts/api-guidelines.md)
- [.memory-bank/contracts/boundary-map.md](../../contracts/boundary-map.md)
- [.memory-bank/invariants.md](../../invariants.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)

## Constraints

- Use native Medusa v2.16 order/payment/fulfillment/reservation modules, supported
  workflows, and subscribers; do not modify Medusa Core.
- Keep `checkout_state` as a merged logical metadata projection and preserve all
  FT-007 cart, idempotency, expiry, delivery, payment-selection, and reservation
  metadata.
- Represent the current personal payment request with one unpaid native system
  payment collection (`pp_system_default`) so Admin can use its native “Mark as
  paid” action. No Store payment redirect, provider call, or webhook is part of
  FT-008; the YooKassa profile remains a deferred FT-009 follow-up.
- Native Medusa Admin is the operator surface. No custom Admin application or
  public Store lifecycle mutation endpoint is added.
- Admin “Mark as paid” keeps reservations in place; native fulfillment consumes
  the hold and adjusts stock. Refund does not auto-restock.
- Acceptance uses synthetic contacts, products, payment IDs, and local data; no
  production data, secrets, provider payloads, cookies, or tokens are evidence.

## Invariants

- Only a native Admin payment action can produce `pending_payment -> paid` in
  the current profile.
- An unpaid order can be canceled by Admin and remains in the database as
  `canceled`; it is removed from the active customer cart and is not restored by
  a late event. A paid/processing/completed order is not moved to `canceled`;
  Admin uses the native refund action for a post-payment correction.
- Expired/canceled/refunded orders cannot return to paid or processing.
- Repeated native Admin handoff events are safe no-ops and do not duplicate
  lifecycle metadata or downstream side effects.
- A successful payment never deletes a reservation or directly decrements stock.
- Required Admin fields remain available from native order/payment/fulfillment
  records and the logical metadata projection.

## Constitution Check

- KISS: one lifecycle helper, one guarded workflow, native event subscribers, and
  the existing Admin surface; no parallel order store, queue, or service.
- Boundaries: FT-008 owns lifecycle projection; FT-007 owns pending expiry/release;
  FT-009 remains a deferred provider authenticity/idempotency profile; FT-010
  owns email effects.
- Safety: state/payment/order/inventory work is T2/T3 and requires full protocol,
  packet, verification, semantic review, and recovery evidence where T3 applies.
- No Constitution conflict or unresolved design blocker remains.

## Waves And Tasks

| Wave | Task | Tier | Purpose |
|---|---|---|---|
| W1 | TASK-054 | T2 | Add the logical lifecycle model, native projection, and transition guards. |
| W2 | TASK-055 | T3 | Implement the Admin-bound workflow, native system payment handoff, and event projection. |
| W3 | TASK-056 | T3 | Verify native Admin order payload/visibility and operator lifecycle fixtures. |
| W3 | TASK-057 | T3 | Prove the complete lifecycle and built-in Admin flow through real local runtime/browser evidence. |

## Expected Touched Files

- `apps/backend/src/order-lifecycle/**`
- `apps/backend/src/workflows/order-lifecycle/**`
- `apps/backend/src/workflows/checkout/create-pending-order.ts`
- `apps/backend/src/subscribers/order-lifecycle.ts`
- `apps/backend/medusa-config.ts`
- `apps/backend/src/scripts/smoke-order-lifecycle*.ts`
- `apps/backend/src/scripts/smoke-order-admin-visibility.ts`
- `apps/backend/test/run-integration.cjs`
- `apps/backend/package.json`
- `apps/storefront/e2e/run-real-medusa-e2e.cjs`
- `apps/storefront/package.json`
- `.memory-bank/changelog.md`

## Tests And Quality Gates

- `npm --workspace apps/backend run test:integration -- order-lifecycle`
- `npm --workspace apps/backend run test:integration -- order-admin-visibility`
- `npm --workspace apps/backend run test:integration -- order-lifecycle-acceptance`
- `npm --workspace apps/storefront run test:e2e -- order-lifecycle-admin`
- `npm run typecheck`
- `npm run build`
- `node scripts/mb-lint.mjs`
- `node scripts/mb-doctor.mjs --strict`
- Feature-level `/red-verify --feature FT-008` after TASK-054..TASK-057 are done.

## UAT Steps

1. Start the existing Windows-native PostgreSQL, Medusa, and storefront runtime
   with synthetic/local configuration.
2. Use the completed FT-007 pending-order path to create one pending order with
   native line-linked reservations and required contact/delivery/payment metadata.
3. In the built-in Medusa Admin, mark the unpaid payment collection as paid and
   confirm `paid`, unchanged reservations, native payment status, and the
   Admin-readable `personal_request` payment method. Confirm that no Store or
   provider request is made.
4. Use the native Medusa fulfillment action and confirm `processing`, reservation
   consumption, and inventory adjustment through supported workflows.
5. Cancel an unpaid controlled fixture in Admin and confirm it remains in the
   database as `canceled`, disappears from the active customer cart, and does
   not return to `paid` on a late event. Complete/refund separate fixtures;
   confirm guards, terminal behavior, no automatic refund restock, and no
   contradictory state.
6. Open the built-in Medusa Admin order detail and verify contacts, products,
   delivery data, payment status, order status, total, and payment method.
7. Confirm all evidence is synthetic/privacy-safe and contains no live provider
   mutation, secrets, cookies, tokens, or production data.

## Acceptance Coverage

| Requirement | Coverage |
|---|---|
| REQ-022 | TASK-054, TASK-055, TASK-057 |
| REQ-028 | TASK-056, TASK-057 |
| REQ-029 | TASK-056, TASK-057 |

## Handoff

Run `node scripts/mb-doctor.mjs --strict` at the feature/task-queue boundary,
then execute TASK-054 first. Do not execute tasks from `/prd-to-tasks`; promote
downstream tasks only after their dependencies and packet/spec gates are closed.

After all tasks are implemented and individually verified, run
`/red-verify --feature FT-008` before treating the feature or EP-003 lifecycle
as complete.
