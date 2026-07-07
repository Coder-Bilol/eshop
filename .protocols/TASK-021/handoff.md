---
description: Implementation handoff for TASK-021 authenticated cart merge API.
status: complete
---
# TASK-021 Handoff

## Status

- `/execute TASK-021`: complete.
- Local execute gates: PASS.
- Task status: `planned`.
- Independent `/verify`: not run by this handoff.
- Per-task `/red-verify`: not run by this handoff.
- T3 closure: not performed.

## Delivered

- Authenticated `POST /store/carts/:id/merge` Store API route.
- Customer actor is derived only from Medusa auth context.
- Source cart is derived only from route params.
- Request body must be empty; client-supplied `target_cart_id`,
  `customer_id`, or other authority fields are rejected.
- Completed journal replay is checked before source retrieval and validates
  journal ownership before target retrieval.
- Non-replay path uses TASK-019 planner and TASK-020 lifecycle workflow.
- Stable response envelopes cover transfer, merge, replay, auth, invalid
  request, not found, forbidden source, incompatible state, stock conflict,
  in-progress merge, and unexpected merge failure.
- Integration smoke covers route auth, empty body, transfer, merge, replay,
  foreign source denial, pending journal, and stock conflict.

## Changed Files

- `apps/backend/package.json`
- `apps/backend/src/api/middlewares.ts`
- `apps/backend/src/api/store/carts/[id]/merge/route.ts`
- `apps/backend/src/api/store/carts/[id]/merge/validators.ts`
- `apps/backend/src/scripts/smoke-cart-merge-api.ts`
- `apps/backend/test/run-integration.cjs`
- `.memory-bank/changelog.md`
- `.protocols/TASK-021/**`
- `.tasks/TASK-021/**`

## Evidence

- `.tasks/TASK-021/execute-cart-merge-api.md`
- `.tasks/TASK-021/execute-typecheck.md`
- `.tasks/TASK-021/execute-cart-merge-lifecycle-regression.md`
- `.tasks/TASK-021/execute-mb-lint.md`
- `.tasks/TASK-021/execute-scope-audit.md`
- `.tasks/TASK-021/rollback-recovery.md`
- `.tasks/TASK-021/TASK-021-S-execute-final-report-code-01.md`

## T3 Closure State

HUMAN_CHECKPOINT: pending

ROLLBACK_RECOVERY_NOTE: present

- `/verify TASK-021` is required next.
- Per-task `/red-verify TASK-021` is required before T3 closure.
- Explicit human checkpoint is required before setting task status to `done`.
- `/mb-sync` should be run only after successful verification/closure decision.

