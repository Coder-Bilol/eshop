---
description: Scope and safety audit evidence for TASK-020.
status: complete
---
# TASK-020 Scope And Safety Audit

## Runtime Boundaries

- Sorted source/target locks use Medusa's Locking Module workflow steps.
- Inventory confirmation uses the Medusa core inventory-confirmation workflow.
- Ownership transfer uses `transferCartCustomerWorkflow.runAsStep`.
- Target mutations use `addToCartWorkflow.runAsStep`; current pricing, tax,
  promotion, and totals are finalized by
  `refreshCartItemsWorkflow.runAsStep`.
- Direct Cart Module mutations are limited to source `softDeleteCarts` and
  restore-first `restoreCarts`.
- Journal state uses the TASK-017 Cart Merge Module.
- No HTTP/auth route or client-selected destination/customer boundary exists.

## Destructive Operation Audit

- Runtime source disposition uses `softDeleteCarts`.
- Runtime recovery uses `restoreCarts` before any target reversal.
- Runtime workflow never calls `deleteCarts` or clears source lines.
- Target rollback is owned by Medusa's nested core workflow compensation.
- `deleteCarts` appears only in synthetic integration-fixture cleanup.

## Scope Result

- Allowed implementation scope: compliant.
- Forbidden scope touched: no.
- Medusa Core/table modification: no.
- Production data/credentials: no.
- Existing unrelated worktree changes overwritten: no.
- Forbidden target workflow mutation scan:
  `rg "updateCarts|updateLineItems|addLineItems|deleteLineItems|copyLineForTarget" apps/backend/src/workflows/merge-customer-cart.ts`
  returned no matches.
- Trailing-whitespace scan over the two touched source files returned no
  matches.
- Git CLI is not available in the current PATH or standard Windows install
  paths, so `git diff --check` could not be rerun in this execute pass.
- Authoritative task status after `/execute`: `planned`.
