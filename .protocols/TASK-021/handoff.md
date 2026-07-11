---
description: Implementation handoff for TASK-021 authenticated cart merge API.
status: complete
---
# TASK-021 Handoff

## Status

- `/execute TASK-021`: complete.
- Local execute gates: PASS.
- Task status: `done`.
- Independent `/verify`: PASS on 2026-07-08.
- Per-task `/red-verify`: semantic-pass on 2026-07-08.
- T3 closure: completed on 2026-07-09 by GENERAL.

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
- `.tasks/TASK-021/TASK-021-S-verify-final-report-code-01.md`
- `.tasks/TASK-021/TASK-021-S-RED-VERIFY-final-report-docs-01.md`
- `.tasks/TASK-021/TASK-021-S-mb-sync-final-report-docs-01.md`

## T3 Closure State

HUMAN_CHECKPOINT: done

ROLLBACK_RECOVERY_NOTE: present

- `/verify TASK-021`: PASS.
- Per-task `/red-verify TASK-021`: semantic-pass.
- Manual closure owner: `GENERAL`.
- Closed at: `2026-07-09`.

## MB-SYNC Notes

- `TASK-021.status` is `done`.
- No dependent task was promoted.
- TASK-022 readiness remains a separate scheduler/manual decision.
