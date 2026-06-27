---
description: Operational decision log for FT-002 task decomposition.
status: active
---
# FT-002 Decision Log

## 2026-06-20
- Scope: product detail, variant/SKU selection validity, variant-aware product card summary, and selected variant handoff only.
- Design decision: reuse existing `.memory-bank/tech-specs/FT-002-product-detail-variant-selection.md`; no new SDD spec is needed.
- Sequencing decision: FT-002 core implementation starts after `TASK-007` so FT-011 and core FT-001 catalog surfaces exist first; FT-002 final e2e waits for FT-001 final e2e through `TASK-014` depending on `TASK-009`.
- Tier decision: backend product detail contract, variant data/availability, storefront/backend product detail behavior, and e2e verification are T2; isolated variant-selection helper coverage is T1.
- Cart boundary decision: because FT-003 durable cart persistence is not decomposed or implemented yet, FT-002 tasks use only a narrow cart-action handoff/stub for selection validation evidence and must not implement durable cart storage or merge.
- Persistence decision: `TASK-010` explicitly owns DB-backed variant/detail seed data and smoke evidence for FT-002.
