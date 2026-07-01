---
description: Feature FT-001 - catalog browsing, filtering, and search.
status: draft
lifecycle: verified
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md
---
# FT-001 Catalog Browsing Filtering Search

## Use Cases

- Buyer browses home goods categories.
- Buyer searches products.
- Buyer filters by category, price, color, material, size/length, product type, and mounting method.

## Acceptance Criteria

- Covers REQ-001, REQ-002, REQ-003.
- Catalog lists products for home goods including curtain rods.
- Categories are visible and usable.
- Search and moderate filters narrow product listings.

## Edge Cases & Failure Modes

- No products match selected filters.
- Filters combine into an empty result.
- Product data has missing optional attributes.

## Test Strategy Pointers

- E2E: browse catalog and category pages.
- Integration/e2e: filter/search results.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/user-scenarios.md](../user-scenarios.md)

## Normative Inputs

- [.memory-bank/invariants.md](../invariants.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md).
- Feature tech spec: [.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md](../tech-specs/FT-001-catalog-browsing-filtering-search.md).
- Run `/prd-to-tasks FT-001` for implementation planning, task records, and packet generation.
- Use standalone `/spec-improve FT-001` only for repair/refresh if the linked feature tech spec becomes stale, incomplete, or contradictory.
- `/spec-improve` set `spec_design_status: complete` on 2026-06-19.

## Spec Design Notes

- Feature design depth: feature hub only.
- Catalog query/filter/search behavior is constrained by the feature tech spec and global API guidelines.
- No shared/global blocker was found; `/prd-to-tasks FT-001` may proceed after reading the linked specs.

## Implementation Status

- `TASK-009` is closed with manual T2 `/verify` evidence covering REQ-001, REQ-002, and REQ-003.
- The first feature-level `/red-verify --feature FT-001` returned `SEMANTIC_VERDICT: semantic-fail` on 2026-07-01 and identified a parallel direct-SQL catalog plus a test-only browser backend.
- `TASK-015` closed on 2026-07-01 after canonical Medusa Product/Category/Type/Option/Variant/Pricing/Inventory/Sales Channel migration and real-container integration verification.
- `TASK-016` closed on 2026-07-01 after publishable-key-scoped E2E through compiled Medusa Store runtime; the test-only backend was removed.
- Repeated feature-level `/red-verify --feature FT-001` returned `SEMANTIC_VERDICT: semantic-pass`.
- Feature lifecycle is `verified`; REQ-001, REQ-002, and REQ-003 have functional and semantic evidence.
