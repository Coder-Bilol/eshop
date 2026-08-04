# TASK-032 Plan

- Tier: T3
- Task record: `.memory-bank/tasks/TASK-032.task.json`
- Packet context: `.memory-bank/packets/TASK-032.packet.json` R10, status `ready`

## Goal Interpretation

- Purpose: enforce the buyer-facing authentication and cart-readiness boundary at
  `/checkout` without implementing FT-006 or payment behavior.
- Success outcome: guests route through login with the constant safe `/checkout`
  return path; only a backend-confirmed customer with no guest source or a completed
  cart merge sees the bounded continuation.
- Anti-goals: no checkout fields, orders, inventory, payments, backend auth changes,
  external redirects, or client-authoritative identity/readiness persistence.
- Allowed write scope: `apps/storefront/app/checkout/page.tsx`,
  `apps/storefront/components/checkout-auth-gate.tsx`,
  `apps/storefront/src/checkout-auth-gate.test.cjs`,
  `apps/storefront/src/test-runner.cjs`, and `.memory-bank/changelog.md`, plus task
  protocol/evidence artifacts. After semantic escalation, the operator approved the
  bounded login page/component, auth-state, and focused auth test files recorded in
  the current task record and packet R8.
- Forbidden scope: backend authorization routes, checkout data fields, orders,
  inventory, payments, and external redirects.
- Stop conditions: truthful customer/cart readiness cannot be obtained through the
  existing providers, the handoff cannot stay separate from FT-006/payment, or the
  gate would need a browser-persisted readiness flag.

## Boundary Notes

- Linked contracts: auth/session security, customer auth/session lifecycle, API
  guidelines, and FT-004 feature design.
- Responsibility boundary: storefront controls visibility and navigation only;
  backend customer/session and cart responses remain truth, FT-003 owns merge, and
  later checkout/payment endpoints must independently authorize the actor.
- Boundary drift risk: treating initial client `guest`, a cart reference, or a local
  flag as identity/readiness proof; rendering continuation before merge resolution.

## Steps

1. Add the `/checkout` route and a client gate over existing Auth/Cart providers.
2. Resolve session, cart ownership/no-source, merge, blocked retry, and stale work
   with fail-closed state transitions.
3. Render only a bounded FT-006 handoff for `authenticated_ready`.
4. Add state-matrix, safe-return, retry, stale-result, and boundary tests.
5. Run packet commands and record evidence without closing the task.

## Local Gates

- `npm --workspace apps/storefront run test -- checkout-auth-gate`
- `npm --workspace apps/storefront run typecheck`
- `npm --workspace apps/storefront run build`
- `node scripts/mb-lint.mjs`

## Ownership

- GENERAL owns only this `/execute` implementation handoff.
- A later explicit owner must run `/verify TASK-032`, `/red-verify TASK-032`, record
  T3 closure markers, decide lifecycle state, and run `/mb-sync`.

## Semantic Remediation Plan

1. Remove `return_path` from checkout-to-login URL transport while keeping the
   constant normalized `/checkout` value in the versioned sessionStorage adapter.
2. Make an absent login-page return path remain absent through `AuthLogin` and
   `AuthStateController.startLogin`, preserving existing stored state.
3. Keep explicitly supplied login paths normalized and written as before.
4. Add focused regression coverage for both preserve-existing and explicit-path
   behavior, then rerun all TASK-032 and auth/storefront gates.
5. Record remediation evidence; repeated `/verify` and `/red-verify` remain separate
   owner actions.
