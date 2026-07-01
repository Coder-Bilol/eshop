---
description: TASK-015 execution context.
status: active
---
# TASK-015 Context

- Tier: `T2`
- Mode: manual `/execute`
- Task: `.memory-bank/tasks/TASK-015.task.json`
- Packet: `.memory-bank/packets/TASK-015.packet.json` (`ready`)
- Dependency: `TASK-014` is `done`
- Feature: `FT-001`, with FT-002 compatibility required

## Goal Interpretation

- Purpose: replace parallel direct-SQL catalog truth with canonical Medusa
  commerce records and query boundaries.
- Success outcome: catalog and product-detail responses preserve buyer behavior
  while using Medusa category/product/variant/price/inventory identity.
- Anti-goals: no storefront redesign, cart persistence, checkout, external
  search service, production data, or Medusa Core modification.
- Allowed write scope: backend source/scripts/tests/package metadata, README,
  and linked Memory Bank docs.
- Forbidden scope: Medusa Core, cart/order/payment/auth behavior, production
  migrations or data.
- Stop conditions: canonical records cannot preserve the current contracts, a
  breaking storefront contract is required, or Medusa variant identity cannot
  be proven.

## Normative Context

- `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`
- `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/domains/core-domain.md`
- `.memory-bank/testing/index.md`

## Boundary Notes

- Medusa modules own categories, products, types, options, variants, prices,
  inventory, sales-channel visibility, and publishable-key scope.
- Custom routes remain thin Store API read facades.
- Storefront response compatibility is preserved, with Medusa variant ID added
  as the sellable identity.
