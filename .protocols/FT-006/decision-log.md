---
description: Design decisions and blockers for FT-006 checkout delivery methods.
status: active
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

## 2026-08-13 - BR-002 decisions resolve feature design blockers

- Source: [.memory-bank/analysis/brainstorming/BR-002.md](../../.memory-bank/analysis/brainstorming/BR-002.md).
- Decision: Medusa Admin / Shipping Options is the tariff source. Initial local
  values are `pickup: 0 RUB`, `city_courier: 500 RUB`, and
  `transport_company: 700 RUB`.
- Decision: stable delivery IDs are `pickup`, `city_courier`, and
  `transport_company`, in that order.
- Decision: `name`, `email`, `phone`, and `city` are required; `address` is
  required for courier and transport company but not pickup; `comment` is
  optional.
- Decision: backend normalizes input and applies safe length limits before
  validation. Exact numeric limits remain implementation-owned and are not
  promoted to a public client contract.
- Decision: unavailable delivery returns HTTP `422` with code
  `delivery_method_unavailable`; recovery is retry or choosing another method.
- Decision: payment IDs are `card`, `sbp`, and `sberpay`.
- Decision: FT-006 hands a validated checkout snapshot to FT-007 and the selected
  payment ID to FT-009; FT-006 creates no order and has no payment-provider
  integration.
- Decision: exact Medusa v2.16 Shipping Options extension point and exact safe
  limits are implementation assumptions with explicit stop conditions; downstream
  physical handoff transport remains owned by FT-007/FT-009.
- Consequence: feature design is complete and decomposition may create the plan,
  task records, index links, and required packets. This session still does not
  execute or verify implementation tasks.

## Resolution Required

- No blocker remains for FT-006 decomposition.
- Future implementation owner must confirm the installed Medusa v2.16 Shipping
  Options boundary and select bounded numeric safe limits without changing the
  accepted product semantics.
