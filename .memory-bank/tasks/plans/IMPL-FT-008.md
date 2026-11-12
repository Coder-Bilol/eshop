---
description: Implementation plan for FT-008 order lifecycle and Medusa Admin visibility.
status: active
owner: prd-to-tasks
last_updated: 2026-11-12
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

## Current Task Closure — 2026-11-12

TASK-055 is `done` under explicit manual ownership, functional offline PASS and
independent per-task semantic-pass. The operator waived real-server execution
and accepted lock-free race risk. Evidence routes through
[TASK-055](../TASK-055.task.json). TASK-056 is also done under GENERAL's
explicit manual closure ownership after offline functional PASS and independent
semantic-pass; see [TASK-056](../TASK-056.task.json). TASK-057 remains planned.
TASK-056 uses the existing offline waiver: installed Admin source contracts and
controlled-record checks, with native runtime/browser checks explicitly deferred.
These closures do
not verify rendered Admin visibility or complete FT-008/REQ-022.

## Offline Continuation — 2026-11-11

- Operator instruction: continue development without VPS access or the ability
  to start a local server; real-server requirements may be ignored for this
  development pass. Delegated implementation and review are explicitly authorized.
- This instruction supersedes server-availability stop conditions for continuing
  scoped implementation and preparing dependent acceptance assets. It does not
  change native Admin authority, payment, inventory, access, or lifecycle behavior.
- Run service-free checks: deterministic tests with controlled collaborators,
  installed native-handler contract inspection, typecheck, build, and Memory Bank
  lint. Do not start HTTP servers, PostgreSQL, Docker, or contact the VPS.
- Record unavailable runtime/browser checks as deferred, never as successful
  executions. Existing runtime FAIL evidence remains historical until superseded
  by a clearly scoped verification report; do not claim full runtime readiness.
- TASK-055 implementation fixes and offline acceptance preparation for
  TASK-056/TASK-057 may proceed without promoting or closing dependent task records.
- The historical VPS security review rejection remains a deployment concern and
  does not block this explicitly authorized offline development pass.

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
- Native operations check authoritative state and same-order bindings before
  mutation; projectors re-read native evidence before metadata updates.
  No shared lifecycle lock or atomic read/mutation guarantee is provided; see
  [FT-008 accepted concurrency risk](../../features/FT-008-order-lifecycle-admin-visibility.md).
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
  the hold and adjusts stock. Native Admin cancellation may refund captured
  payment and clean up reservations according to Medusa's supported workflow;
  standalone refund does not auto-restock.
- A cancellation-origin payment refund leaves the logical order `canceled`.
  Partial standalone refunds preserve the current logical state; only when
  persisted native refunds (or authoritative `raw_refunded_amount`) cover all
  persisted native captures (or `raw_captured_amount`) within native currency
  precision may a non-canceled `paid`, `processing`, or `completed` order
  project `refunded`; no nonexistent capture/refund status is assumed.
- FT-007 writes `checkout_expiry_origin: "ft-007"` and pending cleanup before
  native timeout cancellation. Its `checkout_state: expired`, timeout reason,
  and cleanup state survive native cancellation/refund notifications; FT-008
  neither overwrites them nor releases those reservations.
- The complete workflow-owned metadata key set from the data/contract specs is
  protected. The generic Admin metadata update boundary may preserve or reject
  changes/deletions to those keys, while explicitly operator-editable unrelated
  metadata remains editable; only approved guarded FT-007/FT-008 workflows
  write protected keys.
- Acceptance uses synthetic contacts, products, payment IDs, and local data; no
  production data, secrets, provider payloads, cookies, or tokens are evidence.

## Invariants

- Only a native Admin payment action can produce `pending_payment -> paid` in
  the current profile.
- Native operations check authoritative state and same-order bindings before
  mutation; projectors re-read native evidence before metadata updates.
  No shared lifecycle lock or atomic read/mutation guarantee is provided; see
  [FT-008 accepted concurrency risk](../../features/FT-008-order-lifecycle-admin-visibility.md).
- Native Admin cancellation may move a pending, paid, or processing order to
  `canceled` when native preconditions allow it; captured-payment refund and
  reservation cleanup belong to the native workflow. The order remains in the
  database, is removed from the active customer cart, and is not restored by a
  late event. Completed-order correction uses native refund/return.
- Expired/canceled/refunded orders cannot return to paid or processing.
- A cancellation-origin or partial refund cannot overwrite the logical state
  with `refunded`, and generic Admin metadata editing cannot mutate or delete
  any workflow-owned protected key.
- Repeated native Admin handoff events are safe no-ops and do not duplicate
  lifecycle metadata or downstream side effects.
- FT-007 partial cleanup remains discoverable by expiry origin plus cleanup
  state even after native `order.canceled` delivery.
- A successful payment never deletes a reservation or directly decrements stock.
- Required Admin fields remain available from native order/payment/fulfillment
  records and the logical metadata projection.

## Constitution Check

- Native operations check authoritative state and same-order bindings before
  mutation; projectors re-read native evidence before metadata updates.
  No shared lifecycle lock or atomic read/mutation guarantee is provided; see
  [FT-008 accepted concurrency risk](../../features/FT-008-order-lifecycle-admin-visibility.md).
- Boundaries: FT-008 owns lifecycle projection; FT-007 owns pending expiry/release;
  FT-009 remains a deferred provider authenticity/idempotency profile; FT-010
  owns email effects.
- Safety: state/payment/order/inventory work is T2/T3 and requires full protocol,
  packet, verification, semantic review, and recovery evidence where T3 applies.
- The operator removed lifecycle serialization requirements. Native Admin
  authentication, current-state guards and protected metadata remain required;
  no full-handler wrapper or Medusa Core change is needed.

## Waves And Tasks

| Wave | Task | Tier | Purpose |
|---|---|---|---|
| W1 | TASK-054 | T2 | Add the logical lifecycle model, expiry-origin precedence, native projection, and transition guards. |
| W2 | TASK-055 | T3 | Implement native-state preconditions, native system payment handoff, FT-007 expiry preservation, and guarded projection. |
| W3 | TASK-056 | T3 | Verify native Admin order payload/visibility and operator lifecycle fixtures. |
| W3 | TASK-057 | T3 | Prove the complete lifecycle and built-in Admin flow through real local runtime/browser evidence. |

## Expected Touched Files

- `apps/backend/src/order-lifecycle/**`
- `apps/backend/src/workflows/order-lifecycle/**`
- `apps/backend/src/workflows/checkout/create-pending-order.ts`
- `apps/backend/src/workflows/checkout/expire-pending-order.ts`
- `apps/backend/src/checkout/pending-order.ts`
- `apps/backend/src/jobs/expire-pending-orders.ts`
- `apps/backend/src/subscribers/order-lifecycle.ts`
- `apps/backend/src/api/middlewares.ts`
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

Native operations check authoritative state and same-order bindings before
  mutation; projectors re-read native evidence before metadata updates.
  No shared lifecycle lock or atomic read/mutation guarantee is provided; see
  [FT-008 accepted concurrency risk](../../features/FT-008-order-lifecycle-admin-visibility.md).

Sequential acceptance checks current native payment/terminal state and partial
expiry cleanup recovery. Concurrent race-safety proof is outside the accepted
scope; see the FT-008 feature decision.

## UAT Steps

Native operations check authoritative state and same-order bindings before
  mutation; projectors re-read native evidence before metadata updates.
  No shared lifecycle lock or atomic read/mutation guarantee is provided; see
  [FT-008 accepted concurrency risk](../../features/FT-008-order-lifecycle-admin-visibility.md).

## Acceptance Coverage

| Requirement | Coverage |
|---|---|
| REQ-022 | TASK-054, TASK-055, TASK-057 |
| REQ-028 | TASK-056, TASK-057 |
| REQ-029 | TASK-056, TASK-057 |

## Handoff

Before executing TASK-054, require a fresh scoped `/review FT-008` with no
blocking `REJECT` and `node scripts/mb-doctor.mjs --strict` PASS at the
feature/task-queue boundary. Do not rerun `/prd-to-tasks`; promote downstream
tasks only after their dependencies and packet/spec gates are closed.

After all tasks are implemented and individually verified, run
`/red-verify --feature FT-008` before treating the feature or EP-003 lifecycle
as complete.
