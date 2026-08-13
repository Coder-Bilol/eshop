---
description: TASK-038 local gate output summary.
status: complete
---
# TASK-038 Local Gates

## Integration

Command: `npm --workspace apps/backend run test:integration -- wishlist-api`

Result: PASS. The final dispatcher output reported:

```text
suite: wishlist-api
status: ok
sourceBoundary: medusa-route-workflow-module-postgresql
middlewareRegistered: true
guestDenied: true
exactProjection: true
duplicateAddIdempotent: true
customerIsolation: true
removeIdempotent: true
invalidRequestStable: true
hiddenProductNonDisclosure: true
productionBearerAdded: false
productionData: false
```

## Typecheck

Command: `npm --workspace apps/backend run typecheck`

Result: PASS (`tsc --noEmit`).

## Memory Bank Lint

Command: `node scripts/mb-lint.mjs`

Result: PASS (`122 files`).

## Dispatcher Syntax

Command: `node --check apps/backend/test/run-integration.cjs`

Result: PASS.
