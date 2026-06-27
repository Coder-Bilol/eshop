---
description: TASK-011 incorrectly auto-selects the only sellable SKU of a multi-variant product.
status: archived
owner: verify
last_updated: 2026-06-27
source_of_truth:
  - .memory-bank/tasks/TASK-011.task.json
  - .memory-bank/tech-specs/FT-002-product-detail-variant-selection.md
  - apps/backend/src/catalog/product-detail.ts
  - .tasks/TASK-011/verify-multi-variant-one-sellable.txt
---
# TASK-011 Multi-Variant Default Selection

## Summary

`queryProductDetailWithClient` computes default selection from the count of
sellable variants. A product with multiple concrete variants but only one
currently sellable variant is therefore treated as a single/default-SKU product.

## Impact

The payload returns `requires_selection: false` and automatically sets
`default_variant_sku` and `selected_variant_sku`. This can bypass the explicit
variant-selection behavior required for multi-variant products.

## Normative Conflict

The FT-002 tech spec permits automatic selection for a product without variants
or with one default variant. It does not permit converting a multi-variant
product into a default-SKU product based only on current sellability.

## Evidence

- `.tasks/TASK-011/verify-multi-variant-one-sellable.txt`
- `.tasks/TASK-011/TASK-011-S-verify-final-report-code-01.md`

## Required Resolution

- Derive default selection from the concrete variant model, not the count of
  currently sellable variants.
- Add integration coverage for multiple variants with exactly one sellable SKU.
- Rerun `/verify TASK-011`.

## Resolution

Resolved on 2026-06-27.

- Default selection now requires exactly one concrete sellable variant.
- Products with multiple concrete variants retain `requires_selection: true`.
- PostgreSQL-backed regression coverage proves the previously failing case.
- Independent reverification passed.
- Evidence: `.tasks/TASK-011/TASK-011-S-verify-final-report-code-02.md`.
