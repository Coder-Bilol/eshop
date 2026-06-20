---
description: Feature tech spec for FT-002 product detail and variant selection.
status: active
owner: spec-improve
last_updated: 2026-06-19
source_of_truth:
  - .memory-bank/features/FT-002-product-detail-variant-selection.md
  - .memory-bank/requirements.md
  - .memory-bank/architecture/system-architecture.md
  - .memory-bank/contracts/api-guidelines.md
  - .memory-bank/states/order-payment-inventory.md
---
# FT-002 Product Detail Variant Selection

## Scope

FT-002 covers buyer-facing product detail behavior and variant/SKU selection:

- product cards and product detail views expose variant/SKU dimensions by color, size, length, material, or related attributes;
- product detail page lets the buyer select a valid sellable variant/SKU before add-to-cart when variants exist;
- add-to-cart action is blocked until selection is valid;
- out-of-stock or unavailable variants are not treated as valid sellable selections;
- products without variants still have a clear add-to-cart path for the single/default sellable SKU.

FT-002 does not own catalog search/filter mechanics, cart persistence, cart merge, checkout, auth, payment, order creation, or inventory reservation. Durable cart behavior belongs to FT-003; FT-002 owns only the selected variant/SKU handoff into the cart action.

## Normative Inputs

- [.memory-bank/features/FT-002-product-detail-variant-selection.md](../features/FT-002-product-detail-variant-selection.md): feature scope and acceptance criteria.
- [.memory-bank/requirements.md](../requirements.md): REQ-004, REQ-005 and RTM tests.
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md): catalog bounded context, backend source of truth, and no Medusa Core modification.
- [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md): storefront/backend API and error/status rules.
- [.memory-bank/domains/core-domain.md](../domains/core-domain.md): Product, Category, and Product Variant/SKU vocabulary.
- [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md): inventory and cart ownership boundaries.
- [.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md](FT-001-catalog-browsing-filtering-search.md): catalog/product card boundary.
- [.memory-bank/testing/index.md](../testing/index.md): variant selection unit/integration and e2e expectations.

## Design Decisions

| Area | Decision | Rationale |
|---|---|---|
| Variant source of truth | Medusa backend/PostgreSQL owns products, options, variants/SKU, prices, and availability signals. | Prevents storefront-only variant truth and aligns with global source-of-truth rules. |
| Product card scope | Product cards show variant-aware summary data such as available colors/sizes/materials when provided, but final variant selection happens on product detail. | Satisfies REQ-004 without turning catalog cards into full product configurators. |
| Product detail scope | Product detail owns option selection UI, valid-combination detection, disabled/unavailable states, and selected variant handoff. | REQ-005 requires valid SKU selection before add-to-cart. |
| Availability boundary | Product detail availability is a pre-check from backend catalog/cart data; final stock consistency is rechecked by cart/order/inventory flows. | Avoids stale UI state becoming authoritative for stock. |
| Product without variants | A product with one/default sellable SKU can be added without extra option selection, but still uses the same selected SKU handoff internally. | Keeps UX simple while preserving SKU-level handoff consistency. |
| Feature tier hints | UI-only selection helpers may be T1; backend product-detail contract, variant availability, or add-to-cart handoff changes are at least T2. | Variant contract and availability semantics cross frontend/backend boundaries. |

## Product Detail Data Contract

The concrete route may use native Medusa Store APIs or a thin read-only product detail facade chosen during implementation. The logical product detail payload must provide enough data for:

- product identity and stable public handle/ID;
- title/name and display media;
- base category/type context when available;
- option dimensions and values, including color, size, length, material, and related attributes used by the product;
- concrete variants/SKU and their option value combinations;
- price data needed to show the selected variant price or price range;
- availability/sellability signal for each variant when available from the backend;
- selected/default variant behavior for single-SKU products.

Do not expose internal database identifiers or implementation-only fields when stable public identifiers are available.

## Variant Selection Semantics

- If a product has variants, add-to-cart is disabled until all required option dimensions needed to identify one sellable variant are selected.
- A selected combination is valid only when it maps to exactly one backend-known variant/SKU.
- Impossible combinations are disabled or rejected with a visible validation state.
- A variant is sellable only when it is active/published, has required price data, and is not reported unavailable/out of stock by the backend data available to this feature.
- Required option missing is a validation state, not a backend failure.
- Product with no variants or one default variant can use that default sellable SKU automatically.
- Product card variant summary must not imply that add-to-cart can bypass detail-page selection when variants exist.

## Add-to-cart Handoff

FT-002 handoff to cart action must include:

- product identifier or handle sufficient for tracing;
- selected variant/SKU identifier;
- quantity, defaulting to one unless a later feature explicitly adds quantity controls;
- current validation state showing that the selected variant was valid at submit time.

FT-002 does not define durable cart storage, guest cart persistence, cart merge, or cart ownership. Those are FT-003 responsibilities. If FT-002 tasks are implemented before FT-003 cart persistence exists, they must either depend on the relevant cart task or use a narrow cart-action stub/demo path explicitly limited to selection validation evidence.

## Availability And Inventory Boundary

- Product detail can block add-to-cart for variants already known to be unavailable.
- Product detail must tolerate stale availability: cart/order flows must revalidate quantity and stock before durable cart/order success.
- Inventory reservation belongs to pending order flow in FT-007, not FT-002.
- Do not create reservation, release, or order state changes inside FT-002.

## Storefront UX States

The storefront must support:

- product detail loading;
- product not found/unpublished;
- product has no variants/default SKU;
- required variant option not selected;
- impossible option combination;
- selected variant unavailable/out of stock;
- selected variant valid and add-to-cart enabled;
- add-to-cart handoff failure from backend/cart boundary.

Visible layout and visual styling are not specified here. Implementation tasks should use the app design system once the executable baseline exists.

## Cross-feature Boundaries

- FT-001 owns catalog browsing, search, filters, and product card listing behavior.
- FT-003 owns guest cart persistence, cart updates, and cart merge semantics.
- FT-004 owns login-before-payment, not product selection.
- FT-007 owns stock reservation and timeout around pending-payment orders.
- FT-011 foundation must create the executable app/backend baseline before FT-002 implementation begins unless a later explicit decision narrows scope.

## Verification Targets

Generated `/prd-to-tasks FT-002` records should include evidence for:

- product card/detail exposes variant-aware attributes for color, size, length, material, or applicable related dimensions;
- product detail prevents add-to-cart while required variant options are missing;
- invalid/impossible variant combinations cannot be submitted as valid selections;
- valid selected variant/SKU can be handed to the cart action;
- out-of-stock/unavailable selected variant is blocked when backend data marks it unavailable;
- product without variants or with a single default sellable SKU has a valid add-to-cart path;
- Memory Bank lint passes after task updates.

Recommended test levels:

- unit tests for pure variant selection and valid-combination helpers;
- integration tests for product detail payload and selected variant/cart-action handoff when backend/API logic is added;
- e2e tests for selecting a variant and adding it to cart through the buyer flow.

## Anti-goals

- Do not implement catalog filtering/search in FT-002.
- Do not implement durable cart persistence, login cart merge, checkout, order, payment, or inventory reservation.
- Do not modify Medusa Core.
- Do not hardcode product variant data in the storefront as the source of truth.
- Do not introduce a custom product configurator framework beyond the MVP option/variant selection needs.

## Open Questions

None blocking for task decomposition. Exact Medusa-native route versus thin read-only product detail facade is an implementation choice constrained by this spec, the API guidelines, and the foundation baseline.
