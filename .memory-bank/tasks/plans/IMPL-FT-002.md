---
description: Implementation plan for FT-002 product detail and variant selection.
status: active
owner: prd-to-tasks
last_updated: 2026-06-20
source_of_truth:
  - .memory-bank/features/FT-002-product-detail-variant-selection.md
  - .memory-bank/tech-specs/FT-002-product-detail-variant-selection.md
  - .memory-bank/requirements.md
---
# IMPL-FT-002 Product Detail Variant Selection

## Goal

Implement product detail discovery and variant/SKU selection: variant-aware product card/detail data, valid option combination selection, unavailable/out-of-stock blocking, single/default SKU behavior, and a narrow selected variant handoff to the cart action boundary.

## Source Artifacts

- [.memory-bank/features/FT-002-product-detail-variant-selection.md](../../features/FT-002-product-detail-variant-selection.md)
- [.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md](../../tech-specs/FT-002-product-detail-variant-selection.md)
- [.memory-bank/requirements.md](../../requirements.md)
- [.memory-bank/epics/EP-001-catalog-product-discovery.md](../../epics/EP-001-catalog-product-discovery.md)
- [.memory-bank/architecture/system-architecture.md](../../architecture/system-architecture.md)
- [.memory-bank/contracts/api-guidelines.md](../../contracts/api-guidelines.md)
- [.memory-bank/domains/core-domain.md](../../domains/core-domain.md)
- [.memory-bank/states/order-payment-inventory.md](../../states/order-payment-inventory.md)
- [.memory-bank/testing/index.md](../../testing/index.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)

## Constitution Check

- Consistent with KISS: use Medusa/PostgreSQL-backed product and variant data or a thin read-only facade, not a custom configurator framework.
- Consistent with no Medusa Core modification: product detail and variant behavior stay in supported backend/API and storefront boundaries.
- Consistent with evidence-before-done: T2 tasks require packets, `/verify`, and substantive evidence.
- Blockers: none for decomposition. Execution is sequenced after `TASK-007` so FT-011 foundation and core FT-001 catalog surfaces exist first, without waiting for FT-001 final e2e evidence.

## Global Wave Classification

- W1: reserved for FT-011 foundation tasks.
- W2: core product detail data, backend contract, selection helpers, and storefront product detail UI after W1 and core FT-001 catalog work.
- W3: FT-002 final integration/e2e evidence after key FT-001/FT-002 implementation tasks are complete.

## Waves

| Wave | Task | Purpose |
|---|---|---|
| W2 | TASK-010 | Add DB-backed product detail and variant seed/fixture data. |
| W2 | TASK-011 | Implement backend product detail payload and variant availability contract. |
| W2 | TASK-012 | Add local variant selection helper logic and unit coverage. |
| W2 | TASK-013 | Implement storefront product detail, variant UI, product card summary, and narrow cart-action handoff. |
| W3 | TASK-014 | Add integration/e2e coverage for FT-002 acceptance criteria. |

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
- `apps/storefront/e2e/**`
- `package.json`
- `README.md`
- `.memory-bank/changelog.md`

## Tests And Gates

- `npm --workspace apps/backend run db:seed`
- `npm --workspace apps/backend run smoke:product-detail`
- `npm --workspace apps/backend run test:integration -- product-detail`
- `npm --workspace apps/storefront run test -- product-detail`
- `npm --workspace apps/storefront run test:e2e -- product-detail`
- `npm run smoke:local`
- `node scripts/mb-lint.mjs`

Implementation may adjust exact command names to the scaffold created by FT-011, but verification must still prove the same variant selection outcomes.

## UAT Steps

1. Complete FT-011 local foundation and core FT-001 catalog tasks through `TASK-007`.
2. Start the Windows-native local runtime.
3. Seed product detail data with multi-option variants, unavailable/out-of-stock variants, and a single/default SKU product.
4. Open the storefront catalog and product detail page.
5. Verify product cards expose variant-aware summary data.
6. Verify product detail blocks add-to-cart until a valid sellable variant is selected.
7. Verify impossible combinations and unavailable variants cannot be submitted.
8. Verify a valid selected variant/SKU reaches the cart-action handoff.
9. Verify a product with no variants or a single/default sellable SKU has a valid add-to-cart path.

## Acceptance Coverage

| Acceptance item | Covered by |
|---|---|
| Covers REQ-004 and REQ-005 | TASK-010, TASK-011, TASK-013, TASK-014 |
| Product card/detail supports variants/SKU | TASK-010, TASK-011, TASK-013, TASK-014 |
| Add-to-cart requires valid sellable variant when variants exist | TASK-012, TASK-013, TASK-014 |
| Unavailable/out-of-stock variants are blocked | TASK-010, TASK-011, TASK-012, TASK-014 |
| Product with no variants/default SKU has a valid path | TASK-010, TASK-011, TASK-013, TASK-014 |

## Handoff

- Next gate before execution: run `/mb-doctor` for the feature/task-queue boundary.
- Do not start `/execute` from this command.
