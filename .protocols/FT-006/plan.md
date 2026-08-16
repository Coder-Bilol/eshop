---
description: Planning protocol for FT-006 checkout and delivery-method design.
status: complete
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
  docs confirm checkout fields, manual delivery methods, fixed-tariff scope, and
  the backend/storefront boundary.
- BR-002 resolves the numeric initial local tariffs, stable delivery IDs/order,
  requiredness and conditional address rules, server-side normalization/limits,
  the unavailable-method error/recovery, payment IDs, and FT-007/FT-009 handoffs.
- Feature-local SDD is routed through the FT-006 hub, runtime architecture, API
  contract, data specification, and validation-state specification.

## Done Criteria

- Exact initial tariff table/source, stable delivery IDs/order, and unavailable
  behavior are authoritative.
- Contact-field and method-specific validation rules are authoritative, with
  exact numeric safe limits explicitly implementation-owned.
- FT-006 to FT-007 snapshot and FT-006 to FT-009 payment-ID semantics are explicit
  without importing downstream persistence/provider contracts.
- The feature hub design matrix has no blocked feature-relevant areas.
- Every generated T2/T3 task has linked SDD inputs, a canonical packet, and a
  matching source hash.

## Current Gate

The feature-level design gate is complete. Task generation is allowed. The exact
Medusa v2.16 Shipping Options adapter and exact numeric safe limits remain
bounded implementation assumptions; their task stop conditions require execution
to halt rather than inventing a parallel tariff source or an unsafe unbounded
input policy.

The generated task queue is handoff-only. This worker does not execute tasks,
verify implementation, run red-verification, perform UAT, or synchronize task
closure.

## Decomposition

| Wave | Task | Tier | Purpose |
|---|---|---|---|
| W1 | TASK-046 | T2 | Resolve Medusa Admin / Shipping Options delivery source, stable IDs/order, initial local tariffs, and backend option projection. |
| W2 | TASK-047 | T3 | Implement authenticated backend normalization, conditional validation, unavailable error, and FT-007/FT-009 handoff boundary. |
| W2 | TASK-048 | T2 | Implement storefront checkout fields, delivery/payment selection, tariff display, and validation/recovery state. |
| W3 | TASK-049 | T3 | Prove the complete authenticated FT-006 runtime through backend acceptance and browser E2E without order/payment-provider mutation. |

## Permitted Checks

- `node scripts/mb-lint.mjs`
- schema/index/task/packet consistency checks
- `node scripts/mb-doctor.mjs --strict` after the task queue and packets are
  written, because this is the feature/task-queue boundary and the command flow
  permits the strict readiness gate.

Do not run implementation, verification, red-verification, UAT, autonomous
execution, or `/mb-sync` from this worker session.
