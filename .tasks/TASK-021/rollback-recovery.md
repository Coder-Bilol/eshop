---
description: TASK-021 rollback and recovery note.
status: complete
---
# TASK-021 Rollback And Recovery

ROLLBACK_RECOVERY_NOTE: present

## Rollback Scope

TASK-021 adds an HTTP/API boundary and smoke coverage. It does not add schema
migrations, Medusa Core changes, OAuth provider configuration, storefront code,
or production data changes.

## Safe Rollback

To remove the new API boundary:

1. Remove `POST /store/carts/:id/merge` route files:
   - `apps/backend/src/api/store/carts/[id]/merge/route.ts`
   - `apps/backend/src/api/store/carts/[id]/merge/validators.ts`
2. Remove the route middleware entry from:
   - `apps/backend/src/api/middlewares.ts`
3. Remove the API smoke script and integration runner entries:
   - `apps/backend/src/scripts/smoke-cart-merge-api.ts`
   - `apps/backend/test/run-integration.cjs`
   - `apps/backend/package.json`

## Runtime Recovery Notes

- Completed merge replay is journal-first and read-only until the target cart is
  returned.
- Merge mutation and compensation remain owned by TASK-020 lifecycle workflow.
- Do not hard-delete carts or manually restore completed source carts as part
  of API rollback.
- If the route is disabled after a bad deploy, existing cart merge journals and
  carts should be left intact for TASK-020 recovery/idempotency semantics.

