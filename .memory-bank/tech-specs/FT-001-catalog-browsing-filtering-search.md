---
description: Feature tech spec for FT-001 catalog browsing, filtering, and search.
status: active
owner: spec-improve
last_updated: 2026-06-19
source_of_truth:
  - .memory-bank/features/FT-001-catalog-browsing-filtering-search.md
  - .memory-bank/requirements.md
  - .memory-bank/architecture/system-architecture.md
  - .memory-bank/contracts/api-guidelines.md
---
# FT-001 Catalog Browsing Filtering Search

## Scope

FT-001 covers buyer-facing catalog discovery:

- list home goods products, including curtain rods and related categories;
- browse by product category;
- search products;
- filter by category, price, color, material, size/length, product type, and mounting method;
- show stable empty/error/loading states for catalog discovery.

FT-001 does not own product detail variant selection, add-to-cart behavior, cart persistence, checkout, auth, payment, admin operations, or search infrastructure beyond the MVP catalog query surface.

## Normative Inputs

- [.memory-bank/features/FT-001-catalog-browsing-filtering-search.md](../features/FT-001-catalog-browsing-filtering-search.md): feature scope and acceptance criteria.
- [.memory-bank/requirements.md](../requirements.md): REQ-001, REQ-002, REQ-003 and RTM tests.
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md): catalog bounded context and no external search service by default.
- [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md): storefront/backend HTTP API and query parameter guardrails.
- [.memory-bank/domains/core-domain.md](../domains/core-domain.md): Product, Category, and Product Variant/SKU vocabulary.
- [.memory-bank/testing/index.md](../testing/index.md): integration/e2e expectations.

## Design Decisions

| Area | Decision | Rationale |
|---|---|---|
| Catalog source of truth | Medusa backend/PostgreSQL owns products, categories, variants/SKU, prices, and filterable product attributes. | Aligns with global backend source-of-truth and avoids duplicated storefront data. |
| Storefront data access | Storefront reads catalog data through Medusa Store APIs or a thin read-only catalog facade when native APIs cannot expose required MVP filters cleanly. | Keeps KISS while allowing REQ-003 without Medusa Core modifications. |
| Search engine | Do not add a separate search service for MVP. Use Medusa/PostgreSQL-backed search/filtering or supported Medusa mechanisms. | PRD calls for moderate search/filters, not advanced search infrastructure. |
| Filter ownership | Filter definitions are backend/catalog-owned; storefront may control display labels/order but not invent available values. | Prevents stale hardcoded filters and keeps product data authoritative. |
| Feature tier hints | Backend catalog query/facet work is at least T2; UI-only rendering may be T1; e2e coverage follows generated task scope. | Catalog API/filter semantics affect frontend/backend contract and data behavior. |

## Catalog Query Contract

The concrete URL may be a native Medusa Store API route or a thin custom read-only catalog route chosen during implementation. The logical contract for FT-001 must support these inputs:

| Input | Required behavior |
|---|---|
| `category` | Filter products by selected category identifier or handle. |
| `q` | Search current catalog text. |
| `price_min` / `price_max` | Filter products by sellable variant price range. |
| `color` | Filter by color attribute/option. |
| `material` | Filter by material attribute/option. |
| `size_length` | Filter by size or length attribute/option. |
| `product_type` | Filter by product type. |
| `mounting_method` | Filter by mounting method attribute. |
| `page` / `limit` | Support bounded pagination or equivalent cursor/page behavior. |

The response must provide enough data for the storefront to render:

- product cards/list entries;
- category navigation;
- selected filter state;
- available filter values or enough metadata to render the configured MVP filter controls;
- empty result state;
- pagination state.

Do not expose internal database identifiers or implementation-only provider fields when stable public identifiers/handles are available.

## Filter Semantics

- Multiple selected filters narrow the result set.
- A product matches a variant-derived filter when at least one active/sellable variant has the selected value.
- A product matches a price range when at least one active/sellable variant price falls inside the range.
- Products missing an optional filter attribute remain visible in unfiltered catalog results.
- Products missing an optional filter attribute do not match a filter that requires that attribute.
- Empty filter combinations must return an empty result state, not an error.
- Category browsing must remain usable without search text.
- Search text and filters may be combined.

## Search Semantics

MVP search is intentionally moderate:

- Search must cover product names/titles and can include descriptions, handles, SKU-like values, or category names when implementation support is simple.
- Search should be case-insensitive for the current catalog language where the selected backend mechanism supports it.
- Typo tolerance, synonym dictionaries, semantic search, transliteration, recommendations, ranking tuning, and external indexing are out of scope for FT-001.
- Search failures should degrade to a safe error state and must not corrupt catalog data or cart/order state.

## Storefront UX States

The storefront must support:

- initial catalog loading;
- category selected;
- filters selected;
- search text entered;
- no products match;
- optional product attributes missing;
- backend/catalog query failure;
- pagination or load-more state when the result set exceeds the page limit.

Visible UI layout and visual design are not specified here. Implementation tasks should follow the eventual app design system and keep catalog browsing directly usable as the first screen for this feature.

## Cross-feature Boundaries

- FT-002 owns product detail variant selection and add-to-cart validation.
- FT-003 owns cart persistence and merge behavior.
- FT-004 owns login before payment.
- FT-007 and later features own inventory reservation; FT-001 may display availability only if safely provided by the catalog backend.
- FT-011 foundation must create the executable app/backend baseline before FT-001 implementation begins unless a later explicit decision narrows scope.

## Verification Targets

Generated `/prd-to-tasks FT-001` records should include evidence for:

- catalog page lists home goods products including curtain rods;
- category browse narrows visible products;
- each required MVP filter is represented and narrows results against seeded/test catalog data;
- search narrows results;
- search combined with filters narrows results;
- empty result state is shown for no matches;
- missing optional product attributes do not break catalog rendering;
- Memory Bank lint passes after task updates.

Recommended test levels:

- integration tests for backend catalog query/filter behavior when custom backend logic is added;
- e2e tests for category browse, search, filters, combined filters, and empty result state;
- unit tests only for isolated frontend query-state helpers or pure filter normalization logic.

## Anti-goals

- Do not introduce an external search engine for MVP.
- Do not modify Medusa Core.
- Do not hardcode product catalog data in the storefront as the source of truth.
- Do not implement product detail variant selection or cart behavior in FT-001.
- Do not add analytics, recommendations, personalization, or merchandising rules.

## Open Questions

None blocking for task decomposition. Exact Medusa-native route versus thin read-only facade is an implementation choice constrained by this spec and the foundation baseline.
