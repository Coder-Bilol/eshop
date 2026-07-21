# TASK-029 Plan

- Task record: `.memory-bank/tasks/TASK-029.task.json`
- Tier: T3
- Packet: `.memory-bank/packets/TASK-029.packet.json` R5; retry 2/2

## Goal Interpretation

- Purpose: convert a Medusa-validated Google/VK identity into one durable customer
  actor and one server-side session.
- Success outcome: callback completion is replay/collision safe, creates or reuses
  exactly one customer, saves the session before redirect, and emits only a fixed
  sanitized storefront redirect.
- Anti-goals: no storefront/cart/checkout changes, email auto-linking, custom
  identity store, Redis, browser token handoff, or direct core writes.
- Allowed write scope: the seven runtime/docs paths listed in the task plus required
  protocol and evidence artifacts.
- Forbidden scope: Medusa Core, direct core-table writes, storefront, cart merge,
  checkout/order/payment, and automatic email linking.
- Stop conditions: unsupported Medusa account workflow, unavoidable browser token,
  or ambiguous callback/account-collision behavior.

## Boundary Notes

- Linked contracts: auth runtime, auth/session security, and customer auth/session
  lifecycle specs.
- Responsibility: the custom route consumes provider callback data server-side;
  Medusa Auth validates identity, Customer Module owns lookup, the supported
  customer-account workflow owns create/link, and Medusa session middleware owns
  the cookie.
- Boundary drift risk: bypassing modules/workflows, retaining raw callback data, or
  treating matching email as identity proof.

## Steps

1. Hold one provider-identity ownership lock from the first identity read through
   customer resolve/create, post-create read, session save, and compensation.
2. Retain nested email serialization so concurrent different-provider collisions
   cannot bypass the no-email-link policy.
3. Acquire cleanup ownership immediately after successful create so post-create
   identity-read failure removes the new customer/link through the supported
   `removeCustomerAccountWorkflow`.
4. Add adversarial concurrent callback and post-create read-failure regressions
   while preserving existing-customer and all prior passing behavior.
5. Run focused and full regression gates, record evidence, and hand off without
   verification, sync, or lifecycle changes.

## Intended Local Gates

- `npm --workspace apps/backend run test:integration -- auth-completion`
- `npm --workspace apps/backend run test:integration -- auth-vkid`
- `npm --workspace apps/backend run test:integration`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`
- `git diff --check`

Scheduler owns `/verify`, `/red-verify`, lifecycle, dependent promotion, and
`/mb-sync`.
