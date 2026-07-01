---
description: Operational decision log for FT-001 task decomposition.
status: active
---
# FT-001 Decision Log

## 2026-06-20
- Scope: catalog browsing, category browsing, search, moderate filters, and catalog UX states only.
- Design decision: reuse existing `.memory-bank/tech-specs/FT-001-catalog-browsing-filtering-search.md`; no new SDD spec is needed.
- Sequencing decision: all FT-001 implementation tasks depend on `TASK-004` so the FT-011 executable local foundation is completed first.
- Tier decision: backend catalog data/query work, frontend/backend contract use, and e2e verification are T2; isolated frontend state handling is T1.
- Persistence decision: `TASK-005` explicitly owns DB-backed seeded catalog data and repository/API smoke evidence for FT-001.

## 2026-07-01
- Red-verification repair decision: the parallel `eshop_local_catalog_*`
  tables are not accepted as canonical catalog persistence.
- Canonical model decision: products, categories, types, options, variants,
  prices, inventory, sales-channel visibility, and publishable-key scope use
  Medusa modules and supported workflows.
- Sequencing decision: `TASK-015` migrates the backend data/query boundary after
  `TASK-014`; `TASK-016` then replaces test-harness browser evidence with the
  real Medusa runtime.
- Tier decision: both remediation tasks are T2 because they change persistence,
  API, cross-module identity, and integration verification.
