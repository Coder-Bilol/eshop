---
description: Implementation plan for FT-005 authenticated product wishlist.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/features/FT-005-authenticated-wishlist.md
  - .memory-bank/tech-specs/FT-005-authenticated-wishlist.md
  - .memory-bank/requirements.md
---
# IMPL-FT-005 Authenticated Wishlist

## Goal

Implement PostgreSQL-backed product favorites for authenticated Medusa customers,
ownership-safe idempotent Store APIs, catalog/product favorite controls, and an
authenticated wishlist page without guest persistence or parallel identity/product
truth.

## Source Artifacts

- [.memory-bank/features/FT-005-authenticated-wishlist.md](../../features/FT-005-authenticated-wishlist.md)
- [.memory-bank/tech-specs/FT-005-authenticated-wishlist.md](../../tech-specs/FT-005-authenticated-wishlist.md)
- [.memory-bank/domains/wishlist-data.md](../../domains/wishlist-data.md)
- [.memory-bank/contracts/wishlist-api-security.md](../../contracts/wishlist-api-security.md)
- [.memory-bank/architecture/auth-runtime.md](../../architecture/auth-runtime.md)
- [.memory-bank/contracts/auth-session-security.md](../../contracts/auth-session-security.md)
- [.memory-bank/states/customer-auth-session.md](../../states/customer-auth-session.md)
- [.memory-bank/architecture/system-architecture.md](../../architecture/system-architecture.md)
- [.memory-bank/contracts/api-guidelines.md](../../contracts/api-guidelines.md)
- [.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md](../../tech-specs/FT-001-catalog-browsing-filtering-search.md)
- [.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md](../../tech-specs/FT-002-product-detail-variant-selection.md)
- [.memory-bank/requirements.md](../../requirements.md)
- [.memory-bank/epics/EP-002-customer-identity-cart-wishlist.md](../../epics/EP-002-customer-identity-cart-wishlist.md)
- [.memory-bank/testing/index.md](../../testing/index.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)

## Normative Inputs

- FT-005 feature and linked SDD specs listed above.
- [.memory-bank/constitution.md](../../constitution.md): KISS, security/privacy,
  no Medusa Core changes, no data loss, and evidence before done.
- [.memory-bank/invariants.md](../../invariants.md): API -> Workflows -> Modules and
  backend/PostgreSQL ownership.

## Constraints And Invariants

- Wishlist identity is Medusa Product ID, not variant/SKU.
- One custom Wishlist Module row per `(customer_id, product_id)` is durable truth.
- Customer owner always comes from authenticated actor context.
- Add/remove are idempotent and customer-isolated under retries/concurrency.
- Product data uses the exact minimal `WishlistProductProjection`, not copied
  CatalogProduct/ProductDetail payloads or wishlist snapshots.
- Visible means exists + `published` + current sales channel + active category.
  Out-of-stock remains visible/unavailable; all hidden cases return the same `404`
  on add and remain omitted on list, without cleanup jobs.
- Browser storage never persists wishlist state or guest favorite intent.
- Wishlist requires successful current-customer retrieval for a valid session and
  is independent of cart-merge/checkout readiness. `merge_blocked` does not block
  wishlist.
- Production storefront auth remains session-cookie only; synthetic bearer is
  limited to the existing local harness through standard Medusa middleware.

## Verification Targets

- Migration and real PostgreSQL persistence/uniqueness/restart smoke.
- Additive opaque product ID in catalog and product-detail contracts.
- Workflow/API actor ownership, exact list/add projection, visibility/error
  precedence, idempotency, concurrency, customer isolation, out-of-stock state,
  hidden product behavior, and sanitized failures.
- Browser add/view/remove from catalog/detail/wishlist, reload persistence, guest
  login routing, user isolation, session expiry/logout clearing, and no storage.

## Constitution Check

- KISS: one module/table, two small write workflows, three Store operations, one
  storefront state boundary, existing product/auth sources, and no cleanup worker.
- No Medusa Core modification: use custom module/migration, supported query,
  workflows, routes, middleware, and storefront components.
- Security/privacy: authenticated API/client/acceptance slices are T3; local
  persistence, projection, workflows, and UI-only slices are T2.
- Evidence before done: every T2/T3 task requires full protocol, packet, and
  `/verify`; T3 additionally requires per-task semantic/human/recovery evidence.
- Conflicts/blockers: none.

## Waves

| Wave | Task | Purpose |
|---|---|---|
| W1 | TASK-035 | Add Wishlist Module model, migration, uniqueness, and PostgreSQL smoke. |
| W1 | TASK-036 | Add opaque product ID to catalog/product-detail backend and storefront contracts. |
| W2 | TASK-037 | Implement idempotent wishlist add/remove workflows and visible-product list projection. |
| W2 | TASK-038 | Expose authenticated wishlist Store API and actor-derived ownership guards. |
| W2 | TASK-039 | Implement session-aware wishlist client and in-memory state orchestration. |
| W2 | TASK-040 | Add catalog/detail controls and authenticated wishlist page states. |
| W3 | TASK-041 | Add real Medusa/PostgreSQL backend ownership and persistence acceptance. |
| W3 | TASK-042 | Add real-browser authenticated wishlist and guest-isolation acceptance. |

TASK-035 and TASK-036 are independently ready because their dependencies are done.
They both update the shared Memory Bank changelog, so clean-session execution must
serialize that documentation write even when code scopes are independent.

## Expected Touched Files

- `apps/backend/medusa-config.ts`
- `apps/backend/src/modules/wishlist/**`
- `apps/backend/src/workflows/wishlist/**`
- `apps/backend/src/wishlist/**`
- `apps/backend/src/api/store/wishlist/**`
- `apps/backend/src/api/middlewares.ts`
- `apps/backend/src/catalog/**`
- `apps/backend/src/scripts/smoke-wishlist*.ts`
- `apps/backend/test/**`
- `apps/storefront/lib/catalog.ts`
- `apps/storefront/lib/product-detail.ts`
- `apps/storefront/lib/wishlist*.ts`
- `apps/storefront/components/wishlist*.tsx`
- `apps/storefront/app/wishlist/**`
- `apps/storefront/app/page.tsx`
- `apps/storefront/app/products/[handle]/page.tsx`
- `apps/storefront/src/wishlist*.test.cjs`
- `apps/storefront/e2e/**`
- `.memory-bank/changelog.md`

## Implementation Steps

1. Register the Wishlist Module, define the item model/composite unique index,
   generate migration, and prove real PostgreSQL read/write/delete/restart behavior.
2. Add opaque product `id` to existing catalog and product-detail projections and
   storefront types with regression coverage.
3. Implement add/remove workflows and list projection over actor/product IDs,
   canonical current product data, deterministic ordering, and hidden products.
4. Expose authenticated list/add/remove routes with validated inputs, actor-derived
   customer ID, idempotent responses, stable errors, and existing Store middleware.
5. Implement session-aware wishlist client/state that loads after successful
   current-customer retrieval regardless of cart-merge result, adopts backend truth,
   and clears on logout/session expiry.
6. Add guest login-routing and authenticated favorite controls to catalog/detail,
   plus loading/empty/error/products/remove states on `/wishlist`.
7. Verify real module migration, PostgreSQL persistence, concurrency, two-customer
   isolation, API auth, exact projection, unified hidden `404`, active-category and
   out-of-stock behavior, and restart.
8. Verify the complete browser flow without live OAuth or production data.

## Tests And Gates

- `npm --workspace apps/backend run test:integration -- wishlist-persistence`
- `npm --workspace apps/backend run test:integration -- wishlist-product-id`
- `npm --workspace apps/backend run test:integration -- wishlist-workflows`
- `npm --workspace apps/backend run test:integration -- wishlist-api`
- `npm --workspace apps/backend run test:integration -- wishlist-acceptance`
- `npm --workspace apps/storefront run test -- wishlist-client`
- `npm --workspace apps/storefront run test -- wishlist-state`
- `npm --workspace apps/storefront run test -- wishlist-ui`
- `npm --workspace apps/storefront run test:e2e -- wishlist`
- `npm run typecheck`
- `npm run build`
- `npm run smoke:local`
- `node scripts/mb-lint.mjs`

## UAT Steps

1. Start local PostgreSQL, Medusa, and storefront through the Windows-native path.
2. Log in with a synthetic/local customer session and favorite a catalog product.
3. Verify saved state appears on catalog, product detail, and `/wishlist` after
   reload, then remove it and verify all views update.
4. Repeat add/remove and rapid duplicate add; verify one durable row and no error.
5. Log in as a second customer and verify the first customer's favorites are absent
   and cannot be removed through product ID reuse.
6. Make saved products unpublished, channel-invisible, and inactive-category;
   verify each disappears with the same add `404` and reappears after restoration.
   Make it out of stock and verify it remains visible as unavailable.
7. Log out and verify wishlist state clears. As guest, click favorite and verify
   login routing without any wishlist data in browser storage.
8. Force `merge_blocked` with a still-valid customer session and verify wishlist
   remains usable while checkout stays blocked.

## Acceptance Coverage

| Acceptance item | Covered by |
|---|---|
| REQ-009 authenticated-only persistence | TASK-035, TASK-037, TASK-038, TASK-039, TASK-040, TASK-041, TASK-042 |
| Exact product-level identity/projection | TASK-036, TASK-037, TASK-038, TASK-040, TASK-041, TASK-042 |
| Customer ownership/isolation | TASK-038, TASK-041, TASK-042 |
| Idempotency/concurrency | TASK-035, TASK-037, TASK-038, TASK-041 |
| Visibility, unified hidden 404, out-of-stock | TASK-037, TASK-038, TASK-041, TASK-042 |
| Session capability independent of cart merge | TASK-039, TASK-040, TASK-042 |
| No guest/browser persistence | TASK-039, TASK-040, TASK-042 |

## Handoff

- Do not execute tasks from `/prd-to-tasks`.
- Run strict `/mb-doctor` once at the FT-005 feature/task-queue boundary.
- Start with ready TASK-035 or TASK-036, serializing shared changelog updates.
- After all FT-005 tasks pass, run `/red-verify --feature FT-005` before treating
  the T2/T3 feature as semantically complete.
