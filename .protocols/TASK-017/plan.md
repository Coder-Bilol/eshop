---
description: Execution plan for TASK-017 cart merge journal persistence.
status: complete
---
# TASK-017 Plan

## Goal Interpretation

- Purpose: create the durable exactly-once and recovery boundary required before
  authenticated cart merge.
- Success outcome: a registered Medusa custom module persists one merge journal
  per source cart in PostgreSQL and can read it after fresh module resolution.
- Anti-goals: no merge API/workflow/UI, no parallel cart tables, no Medusa Core
  changes, and no destructive production migration.
- Allowed write scope:
  - `apps/backend/medusa-config.ts`
  - `apps/backend/package.json`
  - `apps/backend/src/modules/cart-merge/**`
  - `apps/backend/src/scripts/smoke-cart-merge-persistence.ts`
  - `apps/backend/test/run-integration.cjs`
  - `.memory-bank/changelog.md`
- Forbidden scope: Medusa Core/cart-table changes, storefront behavior,
  production data, and destructive cleanup.
- Stop conditions: unsupported unique source constraint, required core cart
  persistence changes, or inability to exercise PostgreSQL through the module.

## Boundary Notes

- Linked contracts/specs: FT-003 feature hub, cart runtime architecture, and cart
  merge data specification.
- Responsibility boundary: this task owns only journal model/service/module
  registration, migration, and persistence evidence.
- Boundary drift risk: implementing merge semantics or relationships to Medusa
  core tables would exceed scope.

## Steps

1. Define one `CartMerge` DML model with required fields and indexes.
2. Export a `MedusaService`-based module service and module definition.
3. Register the custom module in `medusa-config.ts`.
4. Generate a module migration with Medusa CLI.
5. Add a Medusa exec smoke that creates, re-resolves, reads, and checks the
   durable unique `source_cart_id` constraint.
6. Register the integration suite and run task gates.
7. Record evidence and hand off to `/verify TASK-017`.

## Intended Local Gates

- `npm --workspace apps/backend run db:migrate:medusa`
- `npm --workspace apps/backend run test:integration -- cart-merge-persistence`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff

`/execute` updates implementation documentation only. Final task state remains
for `/verify`; dependent promotion requires a separate authorized
status-transition pass after synchronization.
