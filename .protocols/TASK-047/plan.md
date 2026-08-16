---
description: Execution plan for TASK-047 authenticated checkout validation handoff.
status: in_progress
---
# TASK-047 Plan

## Scope

- Tier: T3.
- Authoritative task record: `.memory-bank/tasks/TASK-047.task.json`.
- Packet: `.memory-bank/packets/TASK-047.packet.json`.
- Allowed runtime files are exactly those listed in `runtime_context.allowed_write_scope`.
- Forbidden scope includes Medusa Core, auth provider/session behavior, FT-007 order/inventory persistence, FT-009 payment-provider integration, external delivery providers, and production data/secrets.

## Intended Implementation

1. Confirm the standard Medusa customer actor boundary for the checkout route.
2. Normalize string fields before bounded server-side safe limits.
3. Validate required fields, conditional address, stable delivery IDs, and stable payment IDs.
4. Resolve the selected option through TASK-046 Admin/Shipping Options output and fail closed when unavailable or tariff resolution fails.
5. Return only the transient validated snapshot and selected payment ID; perform no downstream mutation or provider call.
6. Add synthetic integration/safety evidence and run assigned local gates.

## Bounded Remediation Plan

1. Adapt only the native unauthenticated response emitted by the existing standard
   customer middleware to the shared checkout error envelope with stable
   `checkout_auth_required`; preserve the middleware actor boundary.
2. Exercise POST `/store/checkout` through a real local HTTP route, body parser,
   configured middleware, synthetic session context, and the existing handler for
   both guest and authenticated requests.
3. Keep cleanup unconditional, record sanitized deletion failures, and fail after
   all run-owned fixture deletion attempts complete.
4. Rerun relevant integration suites and implementation gates; record remediation
   evidence without owning verification, semantic review, task status, or markers.

## Scope Refresh And Implementation Decision

The owner approved the only required boundary expansion: adding
`apps/backend/src/api/middlewares.ts` to TASK-047. This permits the standard
customer matcher without introducing an auth mechanism. The prior preflight stop
is resolved; no other scope was widened.

The implementation uses bounded server-side limits (`name: 120`, `email: 254`,
`phone: 32`, `city: 120`, `address: 240`, `comment: 500`) after Unicode and
whitespace normalization. These are internal safety bounds and are not returned
as client configuration.

## Local Gates Planned

- `npm --workspace apps/backend run test:integration -- checkout-delivery`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`
- `node --check apps/backend/test/run-integration.cjs`
- static scope/privacy review of touched runtime paths

## Handoff Ownership

- `/verify`, `/red-verify`, `/mb-sync`, task status, and closure remain scheduler-owned and were not run or changed.
- Scheduler/verification owner must run `/verify` and `/red-verify` as required by
  T3 policy; this implementer does not own closure, status, or synchronization.
