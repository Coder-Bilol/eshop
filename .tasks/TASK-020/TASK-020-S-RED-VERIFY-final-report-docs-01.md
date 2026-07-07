---
description: TASK-020 red-verify final report.
status: complete
---
# TASK-020 Red Verify Final Report

SEMANTIC_VERDICT: semantic-fail

## Finding

TASK-020 is not T3 closure-eligible. The latest `/verify` PASS is valid for the
covered happy/failure paths, but adversarial semantic verification found a
cross-task contract mismatch:

- FT-003 SDD says quantities from all source and target lines for the same
  variant are summed.
- TASK-019 planning aggregates target lines by `variant_id`.
- TASK-020 runtime rejects a target cart when more than one target line exists
  for the planned variant.

This means a plan shape accepted by the planning/spec contract can fail at the
lifecycle boundary instead of committing exact summed quantities or compensating.

## Evidence

- `.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md`
- `.memory-bank/domains/cart-merge-data.md`
- `apps/backend/src/cart-merge/plan.ts`
- `apps/backend/src/workflows/merge-customer-cart.ts`
- `.protocols/TASK-020/red-verification.md`
- `.memory-bank/bugs/TASK-020-duplicate-target-variant-lines.md`

## Recommendation

Do not close TASK-020 and do not promote TASK-021. Repair duplicate target
variant-line handling or prove/document that such state is impossible through
supported Medusa paths, then rerun `/verify TASK-020` and per-task
`/red-verify TASK-020`.
