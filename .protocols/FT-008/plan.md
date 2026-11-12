---
feature: FT-008
stage: decomposition
status: complete
---
# FT-008 Decomposition Plan

## Current Simplification — 2026-11-12

The operator removed lifecycle locking and accepted competing-operation races.
Shared-lock/full-handler requirements below are historical and superseded by
the updated FT-008 feature/spec/task records. Keep native state/auth/metadata
checks; no native handler wrapper or tracing override is needed.

## Operator Override — 2026-11-11

Continue scoped development with delegated workers without VPS access and without
starting local servers or a database. The operator explicitly waived real-server
requirements for this pass. See the offline continuation section in
`.memory-bank/tasks/plans/IMPL-FT-008.md` for allowed checks and evidence limits.
Preparing dependent acceptance assets is permitted; dependency promotion and
runtime verification are not implied. The top-level GENERAL agent owns manual
coordination and integration; workers own only their assigned file scopes.

## Goal

Define and implement the complete logical order lifecycle over native Medusa
records for the current personal/offline payment profile, where only the
built-in Admin can confirm payment or change order status, and prove operator
visibility through that Admin surface.

## Design Inputs

- `.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md`
- `.memory-bank/architecture/order-lifecycle-admin-runtime.md`
- `.memory-bank/contracts/order-lifecycle-admin-api.md`
- `.memory-bank/domains/order-lifecycle-admin-data.md`
- `.memory-bank/states/order-lifecycle-admin.md`
- `.memory-bank/states/order-payment-inventory.md`
- `.memory-bank/architecture/pending-order-runtime.md`
- `.memory-bank/workflows/tier-policy.md`

## Waves

### W1 — state and projection foundation

- TASK-054 (`T2`, ready): add lifecycle states, native projection, and guards.

### W2 — guarded runtime boundary

- TASK-055 (`T3`, planned): add the Admin-bound lifecycle workflow, the native
  system payment handoff, and event projection for payment, fulfillment,
  completion, cancellation, and refund.

### W3 — Admin and end-to-end acceptance

- TASK-056 (`T3`, planned): prove native Admin order data and operator lifecycle
  projections with synthetic backend fixtures.
- TASK-057 (`T3`, planned): prove the complete compiled Medusa/PostgreSQL and
  built-in Admin/browser flow, including reservation and privacy assertions.

## Constitution Check

- KISS: native Medusa order/payment/fulfillment/reservation records, one guarded
  workflow, and the existing Admin UI are sufficient; no parallel store or Admin
  application is introduced.
- Safety: lifecycle/payment/inventory transitions are T2/T3, idempotent, guarded,
  and evidence-driven.
- Boundaries: FT-007 owns the existing unpaid expiry/release path, FT-008 owns
  the manual Admin lifecycle projection, FT-009 remains a deferred provider
  authenticity/idempotency profile, and FT-010 owns notifications.
- No conflict with the Constitution or global backbone remains.

## Quality Gates

- `node scripts/mb-lint.mjs`
- `node scripts/mb-doctor.mjs --strict`
- Per-task typecheck/build/integration/browser gates from task records.
- Full T3 protocol, `/verify PASS`, per-task semantic pass, checkpoint, and
  rollback/recovery evidence for TASK-055..TASK-057.
- Feature-level `/red-verify --feature FT-008` after all tasks close.

## Handoff

Run strict `/mb-doctor` at the feature/task-queue boundary, then execute only
TASK-054 first. Downstream tasks remain planned until their dependencies are done.
