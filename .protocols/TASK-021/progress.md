---
description: Execution progress for TASK-021 authenticated cart merge API.
status: complete
---
# TASK-021 Progress

## Completed During `/execute`

- Added authenticated Store API route:
  `apps/backend/src/api/store/carts/[id]/merge/route.ts`.
- Added strict empty-body request validator:
  `apps/backend/src/api/store/carts/[id]/merge/validators.ts`.
- Added route middleware registration:
  `apps/backend/src/api/middlewares.ts`.
- Registered integration suite:
  - `apps/backend/package.json`
  - `apps/backend/test/run-integration.cjs`
- Added route-level integration smoke:
  `apps/backend/src/scripts/smoke-cart-merge-api.ts`.
- Recorded execute evidence under `.protocols/TASK-021/` and
  `.tasks/TASK-021/`.
- Updated `.memory-bank/changelog.md`.

## Important Implementation Decision

The merge route performs body validation inside the route instead of using
Medusa body validation middleware. This keeps the public error envelope under
the task implementation's control and guarantees a stable
`cart_merge_invalid_request` response for rejected client-supplied fields.

Auth remains in middleware through:

`authenticate("customer", ["session", "bearer"])`.

## Local Gate State

- Cart merge API integration: PASS.
- Backend typecheck: PASS.
- Memory Bank lint after evidence/changelog writes: PASS, 106 files.
- TASK-020 lifecycle regression: PASS.
- Scope audit: PASS.

## Not Performed By `/execute`

- `/verify TASK-021`: not run.
- `/red-verify TASK-021`: not run.
- T3 closure: not performed.
- `TASK-021.status`: not changed.
- `/mb-sync`: not run.
