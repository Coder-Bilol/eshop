---
description: Implementation plan for FT-001 catalog browsing, filtering, and search.
status: active
owner: prd-to-tasks
last_updated: 2026-07-01
source_of_truth:
  - .memory-bank/features/FT-001-catalog-browsing-filtering-search.md
  - .memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md
  - .memory-bank/requirements.md
---
# IMPL-FT-001 Catalog Browsing Filtering Search

## Goal

Implement catalog discovery for the storefront: home goods product listing, category browsing, search, moderate filters, empty/error/loading states, and verification against backend-owned catalog data.

## Source Artifacts

- [.memory-bank/features/FT-001-catalog-browsing-filtering-search.md](../../features/FT-001-catalog-browsing-filtering-search.md)
- [.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md](../../tech-specs/FT-001-catalog-browsing-filtering-search.md)
- [.memory-bank/requirements.md](../../requirements.md)
- [.memory-bank/epics/EP-001-catalog-product-discovery.md](../../epics/EP-001-catalog-product-discovery.md)
- [.memory-bank/architecture/system-architecture.md](../../architecture/system-architecture.md)
- [.memory-bank/contracts/api-guidelines.md](../../contracts/api-guidelines.md)
- [.memory-bank/domains/core-domain.md](../../domains/core-domain.md)
- [.memory-bank/testing/index.md](../../testing/index.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)

## Constitution Check

- Consistent with KISS: use Medusa/PostgreSQL-backed catalog behavior or a thin read-only facade, not a separate search service.
- Consistent with no Medusa Core modification: catalog extensions stay in supported backend/API boundaries.
- Consistent with evidence-before-done: T2 tasks require packets, `/verify`, and substantive evidence.
- Blockers: none for decomposition. Execution is sequenced after `TASK-004` from FT-011.

## Global Wave Classification

- W1: reserved for FT-011 foundation tasks.
- W2: core catalog data, backend contract, and storefront catalog UI after W1.
- W3: catalog edge-state polish and final FT-001 acceptance evidence after core FT-001 and FT-002 product-detail work are in place.
- W3 remediation: replace the semantically failed parallel catalog model and
  test-only backend harness after `TASK-014`.

## Waves

| Wave | Task | Purpose |
|---|---|---|
| W2 | TASK-005 | Add DB-backed catalog seed/fixtures and catalog persistence smoke. |
| W2 | TASK-006 | Implement backend catalog query/search/filter contract. |
| W2 | TASK-007 | Implement storefront catalog/category/search/filter UI. |
| W3 | TASK-008 | Add frontend catalog edge-state handling and local unit coverage. |
| W3 | TASK-009 | Add integration/e2e coverage for FT-001 acceptance criteria. |
| W3 | TASK-015 | Move catalog/product-detail data and queries to canonical Medusa modules. |
| W3 | TASK-016 | Use a publishable key and verify storefront flows through the real Medusa runtime. |

## Expected Touched Files

- `apps/backend/**`
- `apps/backend/scripts/**`
- `apps/backend/src/**`
- `apps/backend/test/**`
- `apps/storefront/src/**`
- `apps/storefront/app/**`
- `apps/storefront/components/**`
- `apps/storefront/lib/**`
- `apps/storefront/tests/**`
- `package.json`
- `README.md`
- `.memory-bank/changelog.md`

## Tests And Gates

- `npm --workspace apps/backend run db:seed`
- `npm --workspace apps/backend run test:integration -- catalog`
- `npm --workspace apps/storefront run test -- catalog`
- `npm --workspace apps/storefront run test:e2e -- catalog`
- `npm run smoke:local`
- `npm --workspace apps/backend run seed:medusa:catalog`
- `npm --workspace apps/backend run build`
- `node scripts/mb-lint.mjs`

Implementation may adjust exact command names to the scaffold created by FT-011, but verification must still prove the same catalog outcomes.

## UAT Steps

1. Complete FT-011 local foundation tasks through `TASK-004`.
2. Start the Windows-native local runtime.
3. Seed catalog data including curtain rods, categories, filterable attributes, and one product missing optional attributes.
4. Open the storefront catalog.
5. Verify product listing, category browse, search, filters, combined search+filters, empty result state, and safe rendering of missing optional attributes.

## Acceptance Coverage

| Acceptance item | Covered by |
|---|---|
| Covers REQ-001, REQ-002, REQ-003 | TASK-005, TASK-006, TASK-007, TASK-009 |
| Catalog lists home goods including curtain rods | TASK-005, TASK-007, TASK-009 |
| Categories are visible and usable | TASK-006, TASK-007, TASK-009 |
| Search and moderate filters narrow listings | TASK-006, TASK-007, TASK-009 |
| Empty result and missing optional attributes are safe | TASK-005, TASK-008, TASK-009 |
| Canonical Medusa catalog identity and persistence | TASK-015 |
| Real Medusa Store runtime and publishable-key browser evidence | TASK-016 |

## Handoff

- All indexed FT-001 tasks are `done`.
- TASK-015 and TASK-016 repaired the initial feature semantic failure.
- Feature-level `/red-verify --feature FT-001` returned
  `SEMANTIC_VERDICT: semantic-pass` on 2026-07-01.
- FT-001 and REQ-001..REQ-003 are synchronized as `verified`.
