---
description: Feature-level adversarial semantic verification for FT-001.
status: complete
---
# FT-001 Red Verification

SEMANTIC_VERDICT: semantic-pass

## Prior Failure Resolution

The 2026-07-01 `semantic-fail` findings were reproduced and resolved:

1. Backend build/runtime: resolved. Full Medusa backend/Admin build passes and
   E2E starts compiled `medusa start`.
2. Parallel catalog truth: resolved. Runtime catalog/product-detail code uses
   Medusa ProductCategory, ProductType, Product, ProductOption,
   ProductVariant, Pricing, Inventory, Sales Channel, Query, and workflows.
   No application catalog path references `eshop_local_catalog_*`.
3. Test-only browser backend: resolved. `catalog-e2e-server.cjs` was removed.
   Playwright reaches real Store middleware, which rejects a missing
   publishable key with HTTP 400 and accepts the seeded key with HTTP 200.
4. Sellable identity: resolved. Backend responses and the browser handoff use
   opaque Medusa Product Variant IDs; SKU remains operator-facing metadata.

## Top Substance Risks

No closure-blocking concern was found.

- Catalog filtering is performed in-process over records loaded through Medusa
  Query. This is acceptable for the explicitly moderate MVP catalog, but
  product-volume growth should move filtering/pagination deeper into supported
  Medusa/PostgreSQL query capabilities.
- The local seed creates missing canonical records and inventory levels but
  does not reconcile arbitrary edits to existing seeded products. This is
  acceptable for deterministic local bootstrap; fixture evolution may require
  an explicit update workflow or local reset procedure.
- Old custom catalog tables may remain physically in an already-used local
  database, but no migration, seed, query, smoke, test, or runtime route reads
  or creates them. They are not a source of truth.

## False Success / Purpose Fit

The feature now solves the declared buyer and system problem, not only the
local assertions:

- home-goods products and categories are canonical Medusa records;
- category, search, price, color, material, size/length, product type, mounting
  method, combined filters, empty results, and sparse attributes pass through
  the real Store runtime and Next.js browser flow;
- inventory-backed unavailable variants remain non-sellable;
- browser-visible product/variant behavior is derived from canonical backend
  data under publishable-key sales-channel scope.

The previous false-success path has been removed rather than hidden behind new
tests.

## Anti-goals And Scope

- No external search engine, production data, production credentials, Medusa
  Core modification, custom admin replacement, durable cart, checkout, order,
  payment, or auth behavior was introduced.
- TASK-015 and TASK-016 stayed within their final packet scopes.
- The publishable API key is intentionally storefront-public and carries only
  sales-channel scope; no secret credential is exposed.

## Hidden Assumptions

- Current catalog volume remains moderate, as required by the FT-001 spec.
- Cart/order features will revalidate variant and inventory state rather than
  treating product-detail availability as a reservation.
- Fixture updates to already-seeded records are an explicit local maintenance
  operation, not an implicit promise of this bootstrap command.

None of these assumptions changes the current verdict.

## Cross-boundary Impact

- FT-002 now reads the same canonical Product Variant/Pricing/Inventory model.
- FT-003 can consume Medusa Product Variant IDs without SKU-to-custom-table
  translation.
- Medusa Admin sees canonical product records without a synchronization layer.
- Storefront remains HTTP-only and does not access PostgreSQL directly.

## Architectural, State, And Operational Assessment

- Architecture: conforms to Medusa backend ownership and supported
  Query/workflow/module boundaries.
- State consistency: price and availability come from Medusa Pricing and
  Inventory scoped to the publishable key's sales channel.
- Operational behavior: seed reruns are idempotent for the current dataset;
  E2E startup and cleanup are bounded and verify ports are released.
- Maintenance cost: one canonical catalog model remains. The custom Store
  facade is small and keeps the moderate filter contract explicit.

## Weak-context Questions

No unanswered context question can reasonably change this verdict. Production
catalog scale, production deployment, and durable cart behavior remain future
feature concerns and were not used as proof here.

## How This Could Still Be Wrong

The verdict should be revisited if product volume makes in-process filtering
materially expensive, if local seed fixtures must become an update/sync
mechanism, or if a later cart implementation ignores Medusa variant IDs and
inventory revalidation. Those are observable future changes, not current
semantic failures.

## Counterproposal / Escalation

No remediation task is required for FT-001 closure. Record performance-driven
query optimization or seed reconciliation only when product volume or local
catalog editing creates a concrete need.

## Fresh Evidence

- TASK-015 `VERDICT: PASS`: canonical Medusa seed, Query integration,
  inventory/pricing, build, and legacy-boundary scan.
- TASK-016 `VERDICT: PASS`: compiled Medusa Store E2E, key boundary, browser
  variant-ID handoff, traces/screenshots, and process cleanup.
- `.tasks/TASK-016/playwright/real-medusa-trace.zip`
- `.tasks/TASK-016/playwright/catalog.png`
- `.tasks/TASK-016/playwright/product-detail.png`
- `node scripts/mb-doctor.mjs --strict`: PASS, 0 errors and 0 warnings.
