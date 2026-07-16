# TASK-027 Preflight Security Conflict

## Required Contract

- `.memory-bank/contracts/auth-session-security.md:40-41` requires exact registered
  backend callback URLs and rejects or ignores browser runtime overrides.
- `.memory-bank/architecture/auth-runtime.md:19,28-34` requires the Medusa 2.16
  built-in Google provider with a backend-environment callback URL.
- `.memory-bank/tasks/TASK-027.task.json:69` requires stopping when Medusa 2.16
  provider configuration conflicts with linked specs.

## Installed Runtime Evidence

- `node_modules/@medusajs/medusa/dist/api/auth/[actor_type]/[auth_provider]/route.js:9-17`
  includes unvalidated `req.body` in provider authentication input.
- `node_modules/@medusajs/medusa/dist/api/auth/middlewares.js:84-91` applies only
  provider/actor association validation to the provider start route.
- `node_modules/@medusajs/auth-google/dist/services/google.js:63-68` stores
  `body.callback_url ?? this.config_.callbackUrl` and uses it in the provider
  redirect.
- `node_modules/@medusajs/auth-google/package.json:2-3` confirms package version
  `2.16.0`.

## Impact

An untrusted caller can supply a callback URL that takes precedence over the
backend configuration. Configuration-only changes in TASK-027 cannot satisfy the
exact callback URL security contract. Fixing route/provider behavior would exceed
the allowed write scope and requires an explicit security/public-contract design
decision.

No secret values were read, printed, or recorded.
