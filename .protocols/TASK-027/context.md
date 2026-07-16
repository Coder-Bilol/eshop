# TASK-027 Context

- Role: Implementer
- Mode: scheduler
- Tier: T3
- Authoritative task: `.memory-bank/tasks/TASK-027.task.json`
- Packet context: `.memory-bank/packets/TASK-027.packet.json` (derivative; readiness was not validated)
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

## Preflight Finding

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

This is a security and public-contract contradiction covered by the task stop
condition. Resolving it requires a settled design change and write scope beyond
TASK-027, such as route middleware or a provider wrapper. No such decision is
authorized for this Implementer run.
