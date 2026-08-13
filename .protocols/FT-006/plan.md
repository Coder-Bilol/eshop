---
description: Planning protocol for FT-006 checkout and delivery-method design.
status: blocked
---
# FT-006 Planning Protocol

## Goal

Complete feature-level SDD for authenticated checkout contact data, manual
delivery methods, fixed tariff calculation, and the validation/handoff boundary,
then create an implementation plan, schema-backed tasks, and required packets.

## Preflight Evidence

- Global SDD backbone status is `complete`.
- FT-004 owns authenticated checkout entry and only `authenticated_ready` may
  continue to checkout.
- The PRD, requirements, EP-003, architecture, API guidelines, state, and testing
  docs confirm the three semantic delivery methods and fixed tariffs.
- No authoritative source defines numeric tariff values, stable option IDs, full
  field validation rules, method-specific field applicability, or the exact
  downstream checkout snapshot contract.

## Done Criteria

- Exact tariff table, money representation, and calculation failure behavior are
  authoritative.
- Exact delivery option identifiers and availability behavior are authoritative.
- Contact-field and method-specific validation rules are authoritative.
- FT-006 to FT-007 order handoff and FT-006 to FT-009 payment-selection contract
  are explicit and verifiable.
- The feature hub design matrix has no blocked feature-relevant areas.
- Every generated T2 task has linked SDD inputs, a canonical packet, and a matching
  source hash.

## Current Gate

The done criteria are not met. Per `/prd-to-tasks`, stop before creating or
updating `.memory-bank/tasks/plans/IMPL-FT-006.md`, any FT-006 task record,
`.memory-bank/tasks/index.json`, or any FT-006 packet. Operator input is needed
for the tariff and validation decisions; cross-feature owners must fix the
downstream handoff contracts.

## Permitted Checks

- `node scripts/mb-lint.mjs`
- Read-only confirmation that no FT-006 task record or packet exists.

Do not run implementation, verification, red-verification, UAT, autonomous
execution, or strict task-queue doctor gates while this feature is blocked.
