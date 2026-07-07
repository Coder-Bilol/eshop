---
description: Rollback and recovery note for TASK-020 cart merge lifecycle.
status: complete
---
# TASK-020 Rollback And Recovery

ROLLBACK_RECOVERY_NOTE: present

## Automatic Recovery

- Failure before source soft-delete invokes Medusa's nested core-workflow
  compensation for target mutations.
- Failure after source soft-delete compensates the outer source-disposition step
  first, then the nested target workflow, so the source is restored first.
- Existing target lines return to their recorded absolute before-quantity.
- Newly created target lines are deleted during compensation.
- The journal becomes `failed`; it never becomes `completed` after a compensated
  failure.

## Guarded Retry

- Retry is allowed only for the same source, target, customer, mode, and
  canonical immutable plan.
- A retry increments `attempt_count`.
- Every retry revalidates source and target against the immutable before-state
  under the same sorted locks; incomplete compensation therefore blocks any new
  mutation rather than incrementing quantities again.
- A pre-existing `cart_merge_compensation_failed` journal remains blocked and
  requires manual investigation.
- A completed journal is not re-entered by this workflow; replay belongs to
  TASK-021.

## Manual Recovery Boundary

If compensation cannot prove source restoration:

1. Stop retries and preserve the failed journal.
2. Inspect the source with deleted records included and inspect target line
   quantities against the immutable plan.
3. Restore the source before changing any target line.
4. Reverse target mutations from the plan in reverse order.
5. Record evidence and require a new human checkpoint before retry.

Do not hard-delete the source, clear its lines, or automatically restore a
successfully completed source. Completed-merge rollback requires a separately
approved T3 recovery task.

## Code Rollback

TASK-020 adds no schema migration. Reverting its workflow, smoke registration,
and package script removes the new runtime path without altering existing cart
or journal tables. Any already completed synthetic/local test journal is cleaned
by the integration suite.
