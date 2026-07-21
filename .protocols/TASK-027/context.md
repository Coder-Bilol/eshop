# TASK-027 Context

- Role: Implementer
- Mode: scheduler
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-027.task.json`
- Packet context: `.memory-bank/packets/TASK-027.packet.json` R5 (derivative;
  scheduler/doctor readiness was accepted and not structurally revalidated)
- Dependency: `TASK-003` is `done`
- Task status observed: `in_progress`; lifecycle was not changed

## Sources Used

- `.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md`
- `.memory-bank/architecture/auth-runtime.md`
- `.memory-bank/contracts/auth-session-security.md`
- `.memory-bank/states/customer-auth-session.md`
- `.memory-bank/tasks/plans/IMPL-FT-004.md`
- `.memory-bank/constitution.md`
- `.memory-bank/invariants.md`
- `.memory-bank/architecture/system-architecture.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/testing/index.md`

## Historical Preflight Finding

The task requires the Medusa 2.16 built-in Google provider and an exact,
backend-environment callback URL. The security contract forbids browser callback
URL overrides. Installed Medusa 2.16 does not enforce that contract at the
configuration boundary:

- `node_modules/@medusajs/medusa/dist/api/auth/[actor_type]/[auth_provider]/route.js`
  forwards `req.body` to the provider.
- `node_modules/@medusajs/medusa/dist/api/auth/middlewares.js` applies no body
  validation to the provider start route.
- `node_modules/@medusajs/auth-google/dist/services/google.js` selects
  `body.callback_url` before configured `callbackUrl`.

This caused the first Implementer run to stop before runtime edits.

## Bounded Retry 1/2

- Operator decision: preserve the strict backend-controlled callback contract and
  extend TASK-027 to the existing `apps/backend/src/api/middlewares.ts` guard
  boundary.
- Authoritative task and packet R3 now include that middleware path and require GET
  plus POST callback override rejection.
- Human boundary checkpoint: the current operator instruction explicitly approves
  this resolved security/public-contract boundary. It does not authorize task
  closure.
- Exact expected runtime files: `apps/backend/medusa-config.ts`,
  `apps/backend/.env.example`, `apps/backend/package.json`,
  `apps/backend/src/api/middlewares.ts`, and
  `apps/backend/src/scripts/smoke-auth-config.ts`.
- Existing scheduler changes in the task record, packet, autonomous status, and
  changelog were preserved. No forbidden-scope overlap was found.

## Bounded Retry 2/2

- Scheduler intent is limited to the two independent T3 findings recorded by the
  functional and semantic Reviewer reports: secure cookies outside local HTTP
  development and fail-closed production signing secrets.
- The authoritative runtime policy is explicit: `Secure=false` is allowed only for
  local HTTP development, and production must not use local signing-secret
  fallbacks.
- Exact runtime files for this retry: `apps/backend/medusa-config.ts` and
  `apps/backend/src/scripts/smoke-auth-config.ts`.
- `DEPLOYMENT.md` and all other unrelated dirty files are excluded from this retry.
- Callback guard, provider allowlists, explicit CORS, bounded TTL, secret-safe
  provider failure, and admin `emailpass` behavior must remain unchanged.
