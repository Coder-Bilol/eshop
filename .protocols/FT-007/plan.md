---
feature: FT-007
stage: decomposition
status: complete
---
# FT-007 Decomposition Plan

## Goal

Create one authenticated pending-payment order from the current customer cart,
reserve inventory durably for 72 hours, and release that reservation exactly once
when the order expires or is canceled.

## Design Inputs

- `.memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md`
- `.memory-bank/architecture/pending-order-runtime.md`
- `.memory-bank/contracts/pending-order-api.md`
- `.memory-bank/domains/pending-order-inventory-data.md`
- `.memory-bank/states/pending-order-inventory-lifecycle.md`
- `.memory-bank/states/order-payment-inventory.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/workflows/tier-policy.md`

## Waves

### W1 — authenticated order/reservation foundation

- TASK-050 (`T3`, ready): create pending order and reserve inventory atomically
  from the authenticated cart with idempotency and compensation.

### W2 — expiry and release

- TASK-051 (`T3`, planned): add the hourly expiry job and idempotent cancellation /
  reservation-release workflow.

### W3 — storefront handoff and runtime acceptance

- TASK-052 (`T3`, planned): connect the checkout continuation to pending-order
  creation and prove duplicate retry, stock conflict, expiry, cleanup, and no
  payment-provider traffic through the real local runtime.

## Constitution Check

- KISS: uses native Medusa order, inventory, reservation, lock, and cron extension
  points; no custom order/inventory database, service, queue, or Admin replacement.
- Boundaries: Store API -> workflow -> Medusa modules/core workflows; no Medusa
  Core modification; payment provider remains FT-009.
- Safety: order/inventory mutations are T3, authenticated, idempotent, compensating,
  and require full verify/red-verify plus recovery evidence.
- No conflict with the Constitution or global backbone was found.

## Quality Gates

- `node scripts/mb-lint.mjs`
- `node scripts/mb-doctor.mjs --strict`
- Per-task typecheck/build/unit/integration/runtime gates as listed in task records.
- Feature-level `/red-verify --feature FT-007` after TASK-050..TASK-052 are done.

## Handoff

Run `/mb-doctor --strict` at the feature/task-queue boundary, then execute only
TASK-050 first. Do not start TASK-051 or TASK-052 before their dependencies are
closed.
