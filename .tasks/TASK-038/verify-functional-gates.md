---
description: TASK-038 independent verification evidence.
status: complete
---
# TASK-038 Functional Verification Evidence

## Commands

- `node scripts/mb-doctor.mjs --strict`
  - FAIL: `TASK_PACKET_STALE`; the canonical packet source hash does not match the
    current task record.
- `npm --workspace apps/backend run test:integration -- wishlist-api`
  - PASS. Runtime output:
    - `middlewareRegistered: true`
    - `guestDenied: true`
    - `exactProjection: true`
    - `duplicateAddIdempotent: true`
    - `customerIsolation: true`
    - `removeIdempotent: true`
    - `invalidRequestStable: true`
    - `hiddenProductNonDisclosure: true`
    - `productionBearerAdded: false`
    - `productionData: false`
- `npm --workspace apps/backend run test:integration -- wishlist-workflows`
  - PASS on retry with a 300-second timeout. Runtime output:
    - `createdDuplicateAndConcurrent: true`
    - `exactProjection: true`
    - `hiddenProductsOmitted: true`
    - `outOfStockVisibleUnavailable: true`
    - `productionData: false`
  - An initial 120-second run timed out before producing a result; it was not used
    as passing evidence.
- `npm --workspace apps/backend run typecheck`
  - PASS (`tsc --noEmit`).
- `node scripts/mb-lint.mjs`
  - PASS (122 files).
- `node --check apps/backend/test/run-integration.cjs`
  - PASS.
- `git diff --check -- apps/backend/src/api/middlewares.ts apps/backend/test/run-integration.cjs apps/backend/package.json .memory-bank/changelog.md`
  - PASS with LF/CRLF normalization warnings only.

## Source and evidence review

- The three wishlist route families are registered with standard Medusa customer
  middleware and handlers derive ownership from `req.auth_context.actor_id`.
- The direct API smoke exercises two synthetic customers and checks exact response
  keys, guest denial, stable invalid input, duplicate add, repeated remove, and
  missing-product non-disclosure.
- The workflow smoke covers hidden projection omission and out-of-stock visibility,
  but it does not call the Store API boundary for those cases.
- `productionBearerAdded: false` is emitted as a constant by the smoke script. It is
  not a runtime assertion. Source inspection found no new bearer config, storage, or
  storefront bearer behavior, but the route middleware explicitly lists both
  `session` and `bearer`, matching the existing cart merge middleware.
- The implementation report and protocol contain pending, not completed, T3 marker
  evidence.

## Scope

- Reviewed implementation paths stay within the task scope except
  `apps/backend/test/run-integration.cjs`; the protocol records this as an approved
  bounded dispatcher expansion needed to run the required suite.
- No source, task status, packet, or scheduler lifecycle file was changed by the
  reviewer.
