---
description: Archived resolved TASK-020 blocker where cart merge mutations bypassed required Medusa core cart workflows.
status: archived
owner: verify
last_updated: 2026-07-07
source_of_truth:
  - .memory-bank/tasks/TASK-020.task.json
  - .memory-bank/architecture/cart-runtime.md
  - .memory-bank/domains/cart-merge-data.md
  - apps/backend/src/workflows/merge-customer-cart.ts
---
# TASK-020 Core Cart Workflow Bypass

## Summary

TASK-020 passes its quantity, ordering, soft-delete, retry, and compensation
integration checks, but applies ownership and target-line mutations directly
through Cart Module service methods.

The linked architecture requires the immutable plan to be applied through
Medusa core cart workflows, with direct Cart Module operations reserved for the
specified source soft-delete/restore boundary.

## Impact

Direct line creation copies the source cart's price/tax snapshot into the target
cart. Direct quantity and customer updates also bypass normal target-cart
refresh behavior.

The current evidence therefore does not establish correct totals,
customer-group pricing, tax, promotions, or core workflow hooks after merge.
Quantity correctness alone is insufficient for a customer-visible cart.

## Evidence

- `.memory-bank/architecture/cart-runtime.md` requires core cart workflows when
  applying the immutable plan.
- `.memory-bank/tasks/TASK-020.task.json` requires supported Medusa core
  workflows plus Cart Module soft-delete/restore.
- `apps/backend/src/workflows/merge-customer-cart.ts` calls `updateCarts`,
  `updateLineItems`, and `addLineItems` directly for ownership and target-line
  mutations.
- `copyLineForTarget` copies `unit_price`, tax, discountability, and product
  snapshot fields from the source line.
- The TASK-020 integration suite asserts quantities and lifecycle ordering but
  does not assert recalculated target pricing, totals, taxes, or promotions.

## Resolution

Resolved by the TASK-020 core-workflow remediation verified on 2026-07-07:

- Ownership transfer now uses `transferCartCustomerWorkflow.runAsStep`.
- Target line mutation now uses `addToCartWorkflow.runAsStep`.
- Target pricing/tax/promotion/cart state is force-refreshed through
  `refreshCartItemsWorkflow.runAsStep`.
- Direct Cart Module mutation is limited to source `softDeleteCarts` and
  restore-first `restoreCarts`.
- Integration evidence covers poisoned source pricing isolation, final target
  totals matching a reference Medusa workflow cart, positive taxes, promotion
  discounts, ordering, compensation, retry, and stock conflict.

Verification artifact:
`.tasks/TASK-020/TASK-020-S-verify-final-report-code-02.md`.

## Required Resolution

- Apply ownership and target line changes through the supported Medusa core cart
  workflows required by the SDD contract, while retaining direct
  `softDeleteCarts` and `restoreCarts` for source disposition/recovery.
- Preserve absolute target quantities and restore-first compensation semantics.
- Add executable evidence for target totals and relevant pricing/tax/promotion
  refresh behavior.
- Rerun `/verify TASK-020`, then the required per-task `/red-verify`.

The functional blocker is resolved. Do not close TASK-020 or promote TASK-021
until T3 per-task `/red-verify` and human-checkpoint closure gates are complete.
