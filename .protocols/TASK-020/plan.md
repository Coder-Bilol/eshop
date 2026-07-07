---
description: Execution plan for TASK-020 compensatable cart merge lifecycle.
status: complete
---
# TASK-020 Plan

## Goal Interpretation

- Purpose: implement the no-data-loss cart mutation lifecycle independently
  from HTTP/auth concerns.
- Success outcome: a planned merge either commits exact target quantities and
  consumes the source, or restores both carts to their pre-merge state.
- Anti-goals: no Store route, OAuth, checkout, order, reservation, payment,
  source hard-delete, or source line clearing.
- Allowed write scope:
  - `apps/backend/package.json`
  - `apps/backend/src/workflows/merge-customer-cart.ts`
  - `apps/backend/src/modules/cart-merge/**`
  - `apps/backend/src/scripts/smoke-cart-merge-lifecycle.ts`
  - `apps/backend/test/run-integration.cjs`
  - `.memory-bank/changelog.md`
- Forbidden scope: HTTP/auth route, Medusa Core/table changes, source hard
  deletion/clearing, and production data.
- Stop conditions: unsupported reversible source disposition, untracked partial
  target mutation, or journal completion before source soft-delete.

## Boundary Notes

- Linked specs: cart runtime architecture, merge data specification, ownership
  state specification, and FT-003 feature hub.
- Responsibility boundary: workflow/module mutation and recovery only; caller
  supplies the immutable TASK-019 plan.
- Boundary drift risk: accepting destination/customer HTTP input or adding auth
  would overlap TASK-021.

## Steps

1. Acquire source/target locks in lexicographic order.
2. Create or guarded-retry one pending journal for the immutable plan.
3. Revalidate carts and confirm final target inventory.
4. Compose Medusa core ownership-transfer or add-to-cart workflows under the
   existing parent locks; force a core cart refresh for pricing, tax, and
   promotions.
5. Validate and assert immutable target quantities by aggregate Product Variant
   ID so duplicate target lines are accepted according to TASK-019 and the SDD.
6. Soft-delete an existing-target source only after target mutation.
7. On failure, let orchestration restore source before compensating the nested
   target workflow.
8. Complete the journal only after lifecycle success and release locks.
9. Exercise transfer, poisoned source pricing, positive tax/promotion totals,
   injected failure/retry, success ordering, and stock conflict against real
   Medusa/PostgreSQL.

## Intended Local Gates

- `npm --workspace apps/backend run test:integration -- cart-merge-lifecycle`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## T3 Closure Gaps

- Human checkpoint: pending.
- Rollback/recovery note: `.tasks/TASK-020/rollback-recovery.md`.
- Independent `/verify` and per-task `/red-verify`: not owned by `/execute`.
- The 2026-07-07 duplicate target-line semantic fail is repaired in this
  execute pass, but repeated `/verify` and `/red-verify` remain external gates.

## MB-SYNC Handoff

`/execute` leaves task state unchanged. T3 closure requires explicit owner,
functional PASS, semantic-pass, human checkpoint, rollback/recovery evidence,
and only then `/mb-sync`.
