---
description: Archived resolved FT-003 verification blocker where the backend merge acceptance fixture was not reproducible after canonical local seed.
status: archived
owner: GENERAL
last_updated: 2026-07-13
source_of_truth:
  - .memory-bank/features/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/tasks/TASK-025.task.json
  - .memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/runbooks/local-development.md
  - apps/backend/src/scripts/smoke-cart-merge-acceptance.ts
  - apps/backend/src/catalog/canonical.ts
---
# FT-003 Backend Acceptance Fixture Reproducibility

## Summary

The source-runtime fixture divergence is resolved. The canonical seed now
idempotently links already-existing canonical products to the selected default
sales channel, matching the channel used by source `medusa exec` smoke and
acceptance scripts.

## Impact

The compiled real-browser FT-003 flow remains separate from independent backend
evidence of ownership denial, journal replay, exact summing, and compensation.
The repaired source-runtime chain now supplies that backend evidence.

## Evidence

- `npm --workspace apps/backend run seed:medusa:catalog`: PASS.
- `npm --workspace apps/backend run test:integration -- cart-merge-acceptance`:
  FAIL twice with `TASK-025 requires a sellable canonical Medusa variant.`
- `npm --workspace apps/backend run smoke:product-detail`: FAIL with
  `ProductDetailNotFoundError` for the canonical product.
- `npm --workspace apps/storefront run test:e2e -- cart`: PASS through compiled
  Medusa/PostgreSQL, including actual provider handoff and stale-context replay.
- Resolution chain on 2026-07-13: `seed:medusa:catalog` -> `smoke:product-detail`
  -> `test:integration -- cart-merge-acceptance`: PASS.

## Likely Boundary

Cause confirmed: `ensureProducts` created missing products with the selected
channel but did not add existing canonical products to a newly selected default
sales channel. Source product-detail and acceptance scripts query that channel,
so they could not find the otherwise seeded products.

## Required Resolution

- Done: canonical seed reconciles existing canonical product links to the
  selected default sales channel.
- Done: seed, product-detail smoke, and cart-merge acceptance passed in that
  order without manual database repair.
- Done: the repeated `/red-verify --feature FT-003` returned
  `SEMANTIC_VERDICT: semantic-pass`.

## Scope Boundaries

- Do not weaken the backend acceptance suite by replacing its real
  Medusa/PostgreSQL route/workflow/module boundary with mocks.
- Do not use production data, live OAuth providers, or modify Medusa Core.
- Feature closure is supported by the recorded repeated semantic pass and the
  explicit closure owner decision.
