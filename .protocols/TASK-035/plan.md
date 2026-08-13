---
description: Execution plan for TASK-035 Wishlist Module persistence.
status: complete
---
# TASK-035 Plan

## Goal Interpretation

- Purpose: create the minimal durable wishlist storage boundary required by later
  workflow, API, and storefront tasks.
- Success outcome: one custom Medusa module persists one row per customer/product in
  PostgreSQL and can read/delete it across fresh Medusa exec processes.
- Anti-goals: no API/auth/workflow/UI, no Product/Customer/Core table changes, no
  cross-module foreign keys, cleanup jobs, events, or production data.
- Allowed write scope: task/packet-listed wishlist module, model, generated migration,
  smoke script, integration dispatcher, backend config/package, and changelog.
- Forbidden scope: Medusa Core/Product/Customer persistence, API/auth, storefront,
  cleanup jobs/events, and production data.
- Stop conditions: unsupported composite uniqueness/indexes, inability to run real
  PostgreSQL smoke, or need for direct core-table mutation.

## Boundary Notes

- Linked specs: FT-005 feature hub, Wishlist Data Specification, System Architecture.
- Responsibility boundary: this task owns only module registration, row model,
  migration, CRUD/restart/concurrency smoke, and execute evidence.
- Boundary drift risk: implementing projection, product validation, ownership HTTP
  guards, wishlist workflows, or UI would consume TASK-037+ scope.

## Steps

1. Define `WishlistItem` with opaque ID, customer/product IDs, composite uniqueness,
   and deterministic customer-list index.
2. Add `MedusaService` and module registration.
3. Generate and apply the Wishlist Module migration.
4. Add write/read/delete/concurrency phases over real PostgreSQL and register the
   integration suite.
5. Run packet gates, inspect migration scope, record evidence, and hand off to
   `/verify TASK-035`.

## Intended Local Gates

- `npm --workspace apps/backend run db:migrate:medusa`
- `npm --workspace apps/backend run test:integration -- wishlist-persistence`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## Ownership

- `/execute` owns implementation and local evidence only.
- `/verify`, task closure, dependent promotion, feature red verification, and
  `/mb-sync` remain for the next explicit owner.
