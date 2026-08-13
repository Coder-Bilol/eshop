---
description: Design decisions and blockers for FT-006 checkout delivery methods.
status: blocked
---
# FT-006 Decision Log

## 2026-08-12 - Feature design blocked before task decomposition

- Confirmed: the global SDD backbone is `complete`, and the existing FT-004
  authenticated checkout gate is the prerequisite for FT-006.
- Confirmed: authoritative product and architecture inputs define pickup, city
  courier, and transport-company delivery without external provider integration.
- Confirmed: authoritative inputs require fixed tariffs but provide no numeric
  tariff table, currency/precision rule, or tariff configuration source.
- Confirmed: authoritative inputs list checkout fields, but only required phone
  and optional comment have explicit requiredness; the remaining format,
  normalization, length, and method-specific rules are absent.
- Confirmed: exact API option IDs, tariff response shape, unavailable-method
  failure behavior, and FT-006 handoffs to FT-007/FT-009 are not authoritative.
- Decision: set FT-006 `spec_design_status: blocked` and create the feature hub
  with explicit blockers rather than inventing public contracts or tariff values.
- Consequence: do not create/update the implementation plan, task records,
  `tasks/index.json`, or packets until the blockers are resolved.

## Resolution Required

- Product/operator input: FT006-OQ-001 through FT006-OQ-005.
- Cross-feature contract decision: FT006-OQ-006 and FT006-OQ-007 with FT-007 and
  FT-009 owners.
