# TASK-034 Plan

- Tier: T3
- Task record: `.memory-bank/tasks/TASK-034.task.json`
- Packet context: `.memory-bank/packets/TASK-034.packet.json` R3, status `ready`

## Goal Interpretation

- Purpose: prove buyer-visible Google/VK login-before-payment and cart continuity in
  a real browser over real local Medusa/PostgreSQL boundaries.
- Success outcome: both provider doubles establish a usable signed session, cart
  conflict/retry converges before checkout, replay/expiry/logout fail safely, and
  generated evidence contains no callback/session/PII identifiers.
- Anti-goals: no live provider, production data, backend behavior change, checkout
  fields, orders, inventory, or payments.
- Allowed write scope: task/packet-listed storefront harness, logout control, focused
  test, package, changelog, protocol, and evidence artifacts.
- Forbidden scope: backend auth/cart behavior and all task-record forbidden areas.
- Stop conditions: provider double bypasses production callback/session, real browser
  boundaries cannot be exercised, or privacy-safe artifacts cannot be generated.

## Boundary Notes

- Provider pages and token/user-info endpoints are local doubles; production backend
  start and completion routes, Auth/Customer modules, signed session middleware,
  Store current-customer route, FT-003 merge endpoint, and storefront controllers are
  exercised unchanged.
- The buyer-visible logout control calls the existing AuthStateController logout
  orchestration; it does not duplicate session or cart cleanup.
- Auth traces begin only after callback URL cleanup and readiness; backend output is
  suppressed for auth evidence rather than persisting raw request URLs.

## Steps

1. Diagnose callback response and browser-cookie state using coarse booleans/status.
2. Correct harness/runtime composition without editing backend behavior.
3. Prove Google and VK negative/success paths, merge conflict/retry, checkout, replay,
   expiry, and confirmed logout.
4. Scan generated artifacts without printing matched sensitive values.
5. Run packet gates and record implementation handoff for repeated `/verify`.

## Local Gates

- `npm --workspace apps/storefront run test:e2e -- auth`
- `npm --workspace apps/storefront run test`
- `npm run typecheck`
- `npm run build`
- `node scripts/mb-lint.mjs`

## Ownership

- GENERAL owns this bounded implementation retry and local evidence only.
- Repeated `/verify TASK-034`, `/red-verify TASK-034`, lifecycle closure, promotion,
  and `/mb-sync` remain with the later explicit owner.
