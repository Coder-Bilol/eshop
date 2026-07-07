---
description: Implementation plan for FT-003 guest cart persistence and authenticated merge.
status: active
owner: prd-to-tasks
last_updated: 2026-07-03
source_of_truth:
  - .memory-bank/features/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/requirements.md
---
# IMPL-FT-003 Guest Cart Persistence And Merge

## Goal

Implement PostgreSQL-backed Medusa guest carts, versioned reference-only browser
persistence, cart mutation UI, and an authenticated, ownership-safe,
exactly-once merge into a compatible customer cart. An existing-target merge
soft-deletes the consumed source only after target mutations succeed and restores
it during compensation.

## Source Artifacts

- [.memory-bank/features/FT-003-guest-cart-persistence-merge.md](../../features/FT-003-guest-cart-persistence-merge.md)
- [.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md](../../tech-specs/FT-003-guest-cart-persistence-merge.md)
- [.memory-bank/architecture/cart-runtime.md](../../architecture/cart-runtime.md)
- [.memory-bank/contracts/cart-api-data-contract.md](../../contracts/cart-api-data-contract.md)
- [.memory-bank/contracts/cart-access-security.md](../../contracts/cart-access-security.md)
- [.memory-bank/domains/cart-merge-data.md](../../domains/cart-merge-data.md)
- [.memory-bank/states/cart-ownership-merge.md](../../states/cart-ownership-merge.md)
- [.memory-bank/architecture/system-architecture.md](../../architecture/system-architecture.md)
- [.memory-bank/contracts/api-guidelines.md](../../contracts/api-guidelines.md)
- [.memory-bank/states/order-payment-inventory.md](../../states/order-payment-inventory.md)
- [.memory-bank/requirements.md](../../requirements.md)
- [.memory-bank/epics/EP-002-customer-identity-cart-wishlist.md](../../epics/EP-002-customer-identity-cart-wishlist.md)
- [.memory-bank/testing/index.md](../../testing/index.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)

## Normative Inputs

- FT-003 feature and linked SDD specs listed above.
- [.memory-bank/constitution.md](../../constitution.md): KISS, no Medusa Core
  modification, evidence before done, and no data loss.
- [.memory-bank/invariants.md](../../invariants.md): API -> Workflows -> Modules
  and preservation of cart/customer data.

## Constraints And Invariants

- Medusa Cart Module/PostgreSQL owns cart truth; browser storage holds only
  `{ version, cart_id }`.
- Existing Store cart CRUD routes are reused; only authenticated merge is custom.
- Merge identity is Medusa Product Variant ID and quantities are absolute.
- Existing-target success soft-deletes, never hard-deletes or clears, the source.
- Completed replay is journal-first; compensation restores the source before
  reverting target mutations.
- OAuth providers, checkout, orders, reservation, and payment remain out of scope.

## Verification Targets

- Real PostgreSQL journal persistence and Cart Module CRUD.
- Deterministic compatible-target selection and immutable merge planning.
- Ownership-safe merge, exact summing, replay, concurrency, soft-delete, Store
  not-found behavior, and restore compensation.
- Browser guest-cart persistence and atomic post-auth target-reference switch.

## Constitution Check

- KISS: reuse Medusa Cart Module and Store routes; add one merge endpoint and one
  small journal module, with no new service or queue.
- No Medusa Core modification: extension code uses supported API, workflow,
  module, migration, and query boundaries.
- Security/no data loss: authenticated merge tasks are T3; cart/data/API tasks
  are at least T2 and require DB-backed evidence.
- Evidence before done: T2 tasks require full protocol and `/verify`; T3 tasks
  additionally require per-task semantic verification, human checkpoint, and
  rollback/recovery evidence.
- Conflicts/blockers: none for decomposition.

## Waves

| Wave | Task | Purpose |
|---|---|---|
| W1 | TASK-017 | Add the Cart Merge Module, migration, journal constraints, and DB smoke. |
| W1 | TASK-018 | Add Store cart client and versioned browser reference adapter. |
| W2 | TASK-019 | Implement deterministic compatible-target selection and immutable merge planning. |
| W2 | TASK-020 | Implement compensatable target mutation, source soft-delete/restore, and journal lifecycle. |
| W2 | TASK-021 | Expose the authenticated merge API, ownership guards, replay, and concurrency response. |
| W2 | TASK-022 | Implement guest-cart state orchestration over the Store client. |
| W2 | TASK-023 | Connect product-detail handoff and cart UI states. |
| W2 | TASK-024 | Add the post-auth merge client and atomic active-reference switch. |
| W3 | TASK-025 | Add the real Medusa/PostgreSQL backend acceptance suite. |
| W3 | TASK-026 | Add real-browser guest persistence and authenticated-merge acceptance. |

TASK-017 and TASK-018 are independently ready because their existing
dependencies are done. They both update the shared Memory Bank changelog, so
clean-session execution must serialize that write even though code scopes differ.

## Expected Touched Files

- `apps/backend/medusa-config.ts`
- `apps/backend/package.json`
- `apps/backend/src/modules/cart-merge/**`
- `apps/backend/src/cart-merge/**`
- `apps/backend/src/workflows/**`
- `apps/backend/src/api/store/carts/**`
- `apps/backend/src/api/middlewares.ts`
- `apps/backend/src/scripts/**`
- `apps/backend/test/**`
- `apps/storefront/lib/cart*.ts`
- `apps/storefront/components/cart*.tsx`
- `apps/storefront/app/cart/**`
- `apps/storefront/components/product-detail-selector.tsx`
- `apps/storefront/src/**`
- `apps/storefront/e2e/**`
- `.memory-bank/changelog.md`

## Implementation Steps

1. Register a custom Cart Merge Module and generate its migration without
   altering core Medusa cart tables.
2. Prove journal persistence and uniqueness against local PostgreSQL.
3. Implement the storefront REST adapter and versioned `eshop.cart.v1`
   reference store.
4. Implement deterministic target selection and immutable merge-plan creation
   without mutating carts.
5. Implement the workflow lifecycle: sorted locks, absolute target mutations,
   reverse compensation, source `softDeleteCarts`, source `restoreCarts`, and
   journal completion ordering.
6. Expose the authenticated route with actor-derived ownership, journal-first
   replay, stable errors, and bounded concurrent-request behavior.
7. Implement guest-cart state orchestration over the Store client.
8. Connect the valid Product Variant ID handoff and cart UI states.
9. Expose a narrow post-auth merge handoff for FT-004 and switch the active cart
   reference only after backend success.
10. Verify server and browser acceptance separately with synthetic authenticated
    context, without live OAuth credentials or production data.

## Tests And Gates

- `npm --workspace apps/backend run db:migrate:medusa`
- `npm --workspace apps/backend run test:integration -- cart-merge-persistence`
- `npm --workspace apps/backend run test:integration -- cart-merge-plan`
- `npm --workspace apps/backend run test:integration -- cart-merge-lifecycle`
- `npm --workspace apps/backend run test:integration -- cart-merge-api`
- `npm --workspace apps/backend run test:integration -- cart-merge-acceptance`
- `npm --workspace apps/storefront run test -- cart-client`
- `npm --workspace apps/storefront run test -- cart-state`
- `npm --workspace apps/storefront run test -- cart-view`
- `npm --workspace apps/storefront run test -- cart-merge`
- `npm --workspace apps/storefront run test:e2e -- cart`
- `npm run typecheck`
- `npm run smoke:local`
- `node scripts/mb-lint.mjs`

Exact new suite registration is implemented by the corresponding task, but the
verification outcomes and real Medusa/PostgreSQL boundaries are fixed.

## UAT Steps

1. Start the Windows-native local PostgreSQL, Medusa, and storefront runtime.
2. Open a product with a valid selected Medusa variant and add it to cart.
3. Reload and open a new browser context with the same persisted reference;
   verify the backend cart is restored.
4. Change quantity and remove an item; verify totals/items come from Medusa.
5. Prepare an authenticated synthetic customer with an existing cart containing
   the same variant and invoke the post-auth merge handoff.
6. Verify the merged cart sums quantities, switches the active reference, and
   remains unchanged when the same merge request is repeated.
7. Verify the consumed source returns not found through ordinary Store CRUD,
   while authenticated replay still returns the recorded target.
8. Verify foreign-owned source, stock conflict, stale reference, concurrent
   request, and injected post-soft-delete failure restore do not leak data or
   lose either cart.

## Acceptance Coverage

| Acceptance item | Covered by |
|---|---|
| REQ-006 guest cart create/update | TASK-018, TASK-022, TASK-023, TASK-026 |
| REQ-007 persistence between browser sessions | TASK-018, TASK-022, TASK-023, TASK-026 |
| REQ-008 merge and same-variant summing | TASK-017, TASK-019, TASK-020, TASK-021, TASK-024, TASK-025, TASK-026 |
| DB-backed mutable storage path | TASK-017, TASK-020, TASK-025 |
| Consumed source soft-delete/replay/restore | TASK-020, TASK-021, TASK-025, TASK-026 |
| Ownership/security and no data loss | TASK-020, TASK-021, TASK-024, TASK-025, TASK-026 |

## Handoff

- Do not execute tasks from `/prd-to-tasks`.
- Run strict `/mb-doctor` once at the FT-003 feature/task-queue boundary.
- Start with ready TASK-017 or TASK-018; avoid parallel edits where their
  shared Memory Bank writes overlap.
- After all FT-003 tasks pass, run `/red-verify --feature FT-003` before treating
  the T2/T3 feature as semantically complete.
