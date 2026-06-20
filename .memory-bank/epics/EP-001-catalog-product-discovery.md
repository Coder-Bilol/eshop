---
description: Epic EP-001 - catalog and product discovery.
status: draft
lifecycle: planned
---
# EP-001 Catalog And Product Discovery

## Value

Enable buyers to find home goods, inspect product details, and choose sellable variants/SKU before adding to cart.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/domains/core-domain.md](../domains/core-domain.md)
- [.memory-bank/user-scenarios.md](../user-scenarios.md)

## Features

- [FT-001 Catalog Browsing Filtering Search](../features/FT-001-catalog-browsing-filtering-search.md)
- [FT-002 Product Detail Variant Selection](../features/FT-002-product-detail-variant-selection.md)

## Success Metrics

- Buyer can browse listed home goods and categories.
- Buyer can use required filters/search.
- Buyer can select a valid variant/SKU and add it to cart.

## Acceptance Criteria

- Covers REQ-001 through REQ-005.
- Product discovery supports moderate MVP filters without external search engine commitment.
- Variant/SKU selection is explicit before add-to-cart for variant products.

## Constraints / Invariants

- Keep catalog scope moderate.
- Preserve KISS and avoid enterprise catalog/search complexity.
