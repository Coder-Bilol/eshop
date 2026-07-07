---
description: TASK-020 repeated red-verify final report after duplicate target-line remediation.
status: complete
---
# TASK-020 Red Verify Final Report 02

SEMANTIC_VERDICT: semantic-pass

## Finding

TASK-020 is semantically correct after the duplicate target variant-line repair.
The previous semantic-fail is superseded.

The lifecycle now matches TASK-019 and FT-003 SDD semantics:

- target before-state is validated by aggregate Product Variant ID quantity;
- planned anchor-line identity is still checked;
- duplicate target same-variant lines are accepted and merged to the exact
  aggregate final quantity;
- compensation restores the duplicate-line aggregate target state;
- target mutation remains in Medusa core workflows with forced refresh.

## Evidence

- `.protocols/TASK-020/red-verification.md`
- `.protocols/TASK-020/verification.md`
- `.tasks/TASK-020/TASK-020-S-verify-final-report-code-03.md`
- `.tasks/TASK-020/execute-cart-merge-lifecycle.md`
- `apps/backend/src/workflows/merge-customer-cart.ts`
- `apps/backend/src/scripts/smoke-cart-merge-lifecycle.ts`

Commands rerun during this red-verify:

- `npm --workspace apps/backend run test:integration -- cart-merge-lifecycle`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`
- `node scripts/mb-doctor.mjs --strict`

All passed.

## Remaining T3 Closure Gate

HUMAN_CHECKPOINT: pending

ROLLBACK_RECOVERY_NOTE: present

Do not mark TASK-020 `done` until the exact human checkpoint marker is recorded
under an explicit closure owner.
