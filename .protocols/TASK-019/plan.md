---
description: Execution plan for TASK-019 deterministic cart merge planning.
status: complete
---
# TASK-019 Plan

## Goal Interpretation

- Purpose: separate deterministic merge decisions from later
  security-sensitive mutation orchestration.
- Success outcome: given a source cart and actor-derived customer ID, backend
  code selects one compatible actor-owned target or transfer mode and returns
  an immutable absolute-quantity plan without mutation.
- Anti-goals: no HTTP route, cart mutation, journal transition, storefront,
  checkout, order, inventory reservation, or payment behavior.
- Allowed write scope:
  - `apps/backend/package.json`
  - `apps/backend/src/cart-merge/plan.ts`
  - `apps/backend/src/scripts/smoke-cart-merge-plan.ts`
  - `apps/backend/test/run-integration.cjs`
  - `.memory-bank/changelog.md`
- Forbidden scope:
  - cart mutation or source soft-delete
  - HTTP/auth route implementation
  - storefront, checkout, order, inventory reservation, or payment behavior
- Stop conditions:
  - Medusa cart data cannot prove ownership/compatibility
  - plan identity would require SKU text
  - linked public contract contradicts implementation

## Boundary Notes

- Linked contracts: FT-003 cart API/data, data model, state, security, and
  runtime architecture specs.
- Responsibility boundary: TASK-019 reads Medusa Cart Module state and performs
  deterministic pure planning only.
- Boundary drift risk: adding mutation, journal persistence, HTTP/auth handling,
  stock decisions, or client-selected destination/customer behavior.

## Steps

1. Add a read-only Cart Module loader scoped by actor customer ID.
2. Add pure source/target validation and deterministic compatible-target
   selection (`updated_at DESC`, `id ASC`).
3. Aggregate source/target quantities by Medusa Product Variant ID into sorted
   immutable absolute quantities.
4. Add a real-container integration smoke plus pure negative/tie/aggregation
   assertions and read-before/read-after no-mutation proof.
5. Register the integration suite and run all task gates.
6. Record evidence and hand off to `/verify TASK-019`.

## Intended Local Gates

- `npm --workspace apps/backend run test:integration -- cart-merge-plan`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## MB-SYNC Handoff

`/execute` records implementation evidence only. It does not run `/verify`,
change task status, synchronize lifecycle state, or promote dependents.
