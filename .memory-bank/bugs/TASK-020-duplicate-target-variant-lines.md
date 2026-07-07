---
description: Archived resolved TASK-020 semantic blocker for duplicate target variant-line aggregation.
status: archived
owner: red-verify
last_updated: 2026-07-07
source_of_truth:
  - .memory-bank/tasks/TASK-020.task.json
  - .memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/domains/cart-merge-data.md
  - apps/backend/src/cart-merge/plan.ts
  - apps/backend/src/workflows/merge-customer-cart.ts
---
# TASK-020 Duplicate Target Variant Lines

## Summary

This was a historical TASK-020 semantic blocker. TASK-020 passed the lifecycle
integration suite at the time, but failed an adversarial same-variant
target-line case required by the linked SDD and by TASK-019 planning semantics.

The FT-003 SDD requires quantities from all source and target lines for the same
Medusa Product Variant ID to be summed. TASK-019 implements that by aggregating
target lines by `variant_id`. TASK-020 then rejects the same valid target state
when the current target cart contains more than one line for the planned
variant.

## Evidence

- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md` says
  quantities from all source and target lines for the same variant are summed.
- `.memory-bank/domains/cart-merge-data.md` says merge plans aggregate source
  and target lines by `variant_id`.
- `apps/backend/src/cart-merge/plan.ts` aggregates `target.items` by
  `variant_id` and records the aggregated `target_quantity_before`.
- `apps/backend/src/workflows/merge-customer-cart.ts` rejects runtime target
  state when `targetLines.length > 1`.
- The existing TASK-020 lifecycle smoke covers source duplicate/new target line
  behavior, but does not cover duplicate target lines for the same variant.

## Impact

A cart state that the planner and specs treat as mergeable can fail at lifecycle
execution with `cart_merge_invalid_plan`. That means REQ-008 same-variant
summing is not implemented for all target-line states described by the current
contract.

This is not a closure-marker issue. It is a semantic mismatch between TASK-019,
TASK-020, and the linked FT-003 SDD.

## Original Required Resolution

- Choose one contract and make the implementation consistent:
  - preferred: make TASK-020 lifecycle apply/normalize the aggregate target
    quantity through supported Medusa core workflows for duplicate target
    variant lines; or
  - if Medusa guarantees duplicate target variant lines cannot exist through all
    supported Store paths, document that invariant in the linked SDD and prove it
    with executable evidence.
- Add integration evidence for duplicate target lines or for the documented
  impossibility invariant.
- Rerun `/verify TASK-020` and per-task `/red-verify TASK-020`.

Do not close TASK-020 or promote TASK-021 while this bug is active.

This bug is no longer active as of the repeated 2026-07-07 per-task
`/red-verify TASK-020` semantic-pass.

## Execute Remediation

The follow-up `/execute TASK-020` pass changed the lifecycle validation to
accept aggregate target quantities for duplicate same-variant target lines and
added lifecycle evidence using duplicate target lines created through Medusa
`addToCartWorkflow`.

Repeated `/verify TASK-020` passed on 2026-07-07 with lifecycle evidence
including `targetDuplicateVariantLinesMerged: true`.

Repeated per-task `/red-verify TASK-020` returned
`SEMANTIC_VERDICT: semantic-pass` on 2026-07-07. This bug is resolved and
archived.
