---
description: Execution progress for TASK-020 compensatable cart merge lifecycle.
status: complete
---
# TASK-020 Progress

## Current State

- Preflight: PASS
- Protocol initialized: yes
- Core-workflow remediation: complete
- Duplicate target variant-line remediation: complete
- Local gates: PASS
- Independent `/verify`: repeated PASS on 2026-07-07 after duplicate-line repair
- Per-task `/red-verify`: semantic-pass on 2026-07-07 after duplicate-line repair
- Manual closure: done on 2026-07-07 by GENERAL

## Scope Tracking

- Allowed implementation scope touched:
  - `apps/backend/package.json`
  - `apps/backend/src/workflows/merge-customer-cart.ts`
  - `apps/backend/src/scripts/smoke-cart-merge-lifecycle.ts`
  - `apps/backend/test/run-integration.cjs`
  - `.memory-bank/changelog.md`
- Forbidden scope touched: no
- Existing unrelated changes preserved: yes
- Remaining gates: none for TASK-020 task closure

## Completed Work

- Retained lexicographically sorted source/target locks and durable journal
  lifecycle.
- Replaced direct customer mutation with
  `transferCartCustomerWorkflow.runAsStep`.
- Replaced direct line update/create and source snapshot copying with
  `addToCartWorkflow.runAsStep`.
- Added a forced `refreshCartItemsWorkflow.runAsStep` so the final target uses
  current pricing, tax lines, promotions, and payment/cart refresh behavior.
- Retained direct Cart Module mutation only for source soft-delete/restore.
- Added an absolute postcondition over every planned target variant.
- Added real Medusa/PostgreSQL evidence using poisoned source pricing and a
  reference core-workflow cart with positive taxes and promotion discounts.
- Repaired duplicate target same-variant handling by validating aggregate target
  quantities and planned anchor-line presence instead of requiring exactly one
  target line.
- Added lifecycle regression where duplicate target same-variant lines are
  created through Medusa `addToCartWorkflow`, compensated, and then merged to
  the exact aggregate final quantity.

## Gate Results

| Gate | Result | Evidence |
|---|---|---|
| Cart merge lifecycle integration | PASS | `.tasks/TASK-020/execute-cart-merge-lifecycle.md` |
| Backend typecheck | PASS | `.tasks/TASK-020/execute-typecheck.md` |
| TASK-017/TASK-019 regression | PASS | `.tasks/TASK-020/execute-cart-merge-regression.md` |
| Memory Bank lint | PASS, 106 files | `.tasks/TASK-020/execute-mb-lint.md` |
| Scope/safety audit | PASS | `.tasks/TASK-020/execute-scope-audit.md` |
| Independent `/verify` | PASS | `.tasks/TASK-020/TASK-020-S-verify-final-report-code-03.md` |
| Per-task `/red-verify` | SEMANTIC_PASS | `.tasks/TASK-020/TASK-020-S-RED-VERIFY-final-report-docs-02.md` |
| Manual `/mb-sync` closure | DONE | `.tasks/TASK-020/TASK-020-S-mb-sync-final-report-docs-01.md` |

## Development Notes

- The first lifecycle run showed that workflow errors are wrapped by Medusa;
  the smoke now verifies durable journal/state outcomes instead of coupling to
  the wrapper shape.
- The next run exposed PostgreSQL JSONB key-order differences during immutable
  plan comparison. Canonical recursive key sorting fixed the comparison without
  weakening plan equality.
- Final coverage added a second variant to prove both new target-line creation
  and reverse deletion during compensation.

## Verification Handoff

- The previous bypass and source-snapshot implementation has been removed.
- Independent `/verify TASK-020` passed against the remediation on 2026-07-07.
- Evidence covers target quantities, totals, pricing, positive taxes, positive
  promotion discounts, journal ordering, compensation, retry, and stock conflict.
- Historical per-task `/red-verify TASK-020` failed semantically because the
  runtime rejected duplicate target variant lines even though linked
  SDD/TASK-019 planning aggregates target lines by `variant_id`.
- The duplicate target variant-line mismatch has been repaired, verified
  functionally by repeated `/verify`, and superseded by repeated per-task
  `/red-verify` with `SEMANTIC_VERDICT: semantic-pass`.
- T3 closure completed after explicit user instruction.
