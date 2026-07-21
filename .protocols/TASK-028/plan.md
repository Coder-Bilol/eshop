# TASK-028 Plan

## Goal Interpretation

- Purpose: add VK ID as one Medusa Auth Module Provider without a parallel auth
  system.
- Success outcome: start and callback produce a validated Medusa provider identity
  keyed by stable VK `user_id`, with state, S256 PKCE, `device_id`, required email,
  and no provider-token retention.
- Anti-goals: no customer/session completion, account linking, storefront,
  checkout/payment behavior, live credentials, or token persistence.
- Allowed runtime write scope: `apps/backend/src/modules/auth-vkid/index.ts`,
  `service.ts`, `types.ts`, `apps/backend/src/scripts/smoke-auth-vkid.ts`,
  `apps/backend/package.json`, and `.memory-bank/changelog.md`.
- Forbidden scope: Medusa Core, Google provider internals, customer auto-linking,
  storefront, checkout/order/payment, and live provider credentials.
- Stop conditions: VK exchange cannot enforce state/S256 PKCE, stable `user_id` or
  validated email cannot be obtained, or tokens would need persistence/exposure.

## Boundary Notes

- Linked contracts: `.memory-bank/contracts/auth-session-security.md` and
  `.memory-bank/architecture/auth-runtime.md`.
- Responsibility boundary: this provider owns VK authorization start, callback
  validation/exchange, minimum identity mapping, and sanitized provider failures.
  TASK-029 owns customer/session completion and collision policy.
- Boundary drift risk: provider metadata must not become a token store, and this
  slice must not create customers, sessions, routes, UI, or account-link behavior.

## Implementation Plan

1. Define the minimal VK options/state/response types and register provider ID
   `vkid` through `ModuleProvider(Modules.AUTH, ...)`.
2. Implement opaque short-lived state, S256 PKCE, fixed callback, single-use claim,
   required callback fields, server-side exchange, stable subject matching, email
   normalization, and sanitized failures.
3. Add a provider-double contract script covering success, replay, expiry, PKCE,
   `device_id`, cancellation, malformed/upstream failures, token non-persistence,
   and sanitized output without live credentials.
4. Register exact integration dispatch and run packet-sourced local gates plus a
   diff check.

## Handoff Ownership

The scheduler owns independent `/verify`, per-task `/red-verify`, lifecycle
decisions, dependent promotion, and `/mb-sync`. This `/execute` does not close
TASK-028.

## Retry 1/2 Bounded Fix

1. Send the configured confidential credential as VK ID `service_token`, never as
   OAuth `client_secret`.
2. Make the synthetic VK token endpoint reject the wrong confidential field and a
   `device_id` that does not match the authorization-code tuple.
3. Add a negative callback assertion proving mismatched `device_id` fails with the
   sanitized error and creates no identity.
4. Re-run only execute-local gates and hand off to scheduler-owned verification;
   do not change lifecycle, scopes, credentials, or Memory Bank state.
