---
description: Duplicate target variant-line remediation handoff for TASK-020.
status: complete
---
# TASK-020 Execute Remediation Report 03

## Result

`/execute TASK-020` repaired the semantic mismatch reported by per-task
`/red-verify`: TASK-020 runtime no longer rejects a target cart only because it
contains multiple active lines for the planned Product Variant ID.

This is implementation/evidence only. It does not run or replace
`/verify TASK-020` or `/red-verify TASK-020`, and it does not close the T3 task.

## Delivered

- `merge-customer-cart.ts` validates target state by aggregate
  `variant_id` quantity and planned anchor-line presence instead of enforcing a
  single target line.
- The target merge still uses Medusa core `addToCartWorkflow` plus forced
  `refreshCartItemsWorkflow`; direct Cart Module mutation remains limited to
  source `softDeleteCarts`/`restoreCarts`.
- `smoke-cart-merge-lifecycle.ts` now creates duplicate target same-variant
  lines through Medusa `addToCartWorkflow` using distinct line metadata.
- Lifecycle evidence proves duplicate target lines compensate back to the
  pre-merge aggregate and then merge to the exact final aggregate quantity.
- Pricing/tax/promotion evidence still compares the merged target to a
  reference cart built through standard Medusa workflows with the same duplicate
  target-line shape.

## Gates

- Backend typecheck: PASS.
- Cart merge lifecycle integration: PASS, including
  `targetDuplicateVariantLinesMerged: true`.
- TASK-017/TASK-019 regression: PASS.
- Memory Bank lint: PASS, 106 files.
- Scope/safety audit: PASS for forbidden mutation scan and touched-file
  trailing-whitespace scan. `git diff --check` could not run because Git is not
  available in this environment.

## Scope

- Scope compliance: yes.
- Forbidden scope touched: no.
- HTTP/auth route added: no.
- Source hard-delete or source line clearing added: no.
- Medusa Core/table modification added: no.
- Production data used: no.

## T3 Handoff

HUMAN_CHECKPOINT: pending

ROLLBACK_RECOVERY_NOTE: present

- Task status remains `planned`.
- Previous `/red-verify` remains `semantic-fail` until rerun.
- Next owner should run `/verify TASK-020`, then per-task
  `/red-verify TASK-020`.
