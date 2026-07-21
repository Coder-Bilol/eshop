# TASK-043 Plan

## Goal Interpretation

- Purpose: close the remaining malformed-query bypass at the storefront OAuth
  authorization destination boundary.
- Success outcome: exact approved Google/VK paths accept structurally valid OAuth
  queries while malformed, ambiguous, control-bearing, and dangerous decoded names fail closed.
- Anti-goals: no destination expansion, backend exchange change, auth state change,
  browser token persistence, or TASK-030 lifecycle mutation.
- Allowed write scope: `apps/storefront/lib/auth.ts`,
  `apps/storefront/src/auth-client.test.cjs`, optional changelog, and operational evidence.
- Forbidden scope: backend providers, cart semantics, checkout/order/payment,
  browser token storage, verify/red/sync/lifecycle.
- Stop conditions: parser ambiguity requiring a new public/security contract or
  any need to broaden approved destinations.

## Boundary Notes

- Linked contract: `.memory-bank/contracts/auth-session-security.md` callback and redirect rules.
- Responsibility: validate the backend-returned provider location before browser navigation.
- Drift risk: forgiving `URL`/`URLSearchParams` parsing erases malformed raw query structure.

## Steps

1. Bound raw queries to 4096 characters and 32 `name=value` segments before parsing.
2. Validate percent syntax after every one of at most three decode rounds.
3. Reject decoded parameter names outside the OAuth-safe unreserved grammar,
   including blank, whitespace, and delimiter names.
4. Preserve existing exact destination and provider-bound `redirect_uri` checks.
5. Add reproduced hostile cases, exact cap boundaries, and legitimate regressions.
6. Run focused/full tests, typecheck, build, lint, and diff checks.

## Handoff

- Scheduler owns `/verify`, `/red-verify`, lifecycle decisions, dependent routing,
  and `/mb-sync` after this implementation handoff.
