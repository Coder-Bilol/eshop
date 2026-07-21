# TASK-027 Plan

## Goal Interpretation

- Purpose: establish the secure Medusa provider and session baseline for FT-004.
- Success outcome: Google/VK customer auth configuration and safe sessions without
  weakening Medusa Admin emailpass or exposing secrets.
- Anti-goals: no callback UI/exchange implementation, customer password login, live
  credentials, or provider implementation.
- Allowed runtime write scope: `apps/backend/medusa-config.ts`,
  `apps/backend/.env.example`, `apps/backend/package.json`,
  `apps/backend/src/api/middlewares.ts`,
  `apps/backend/src/scripts/smoke-auth-config.ts`, `.memory-bank/changelog.md`.
- Forbidden scope: Medusa Core, storefront auth UI, VK provider implementation,
  checkout/order/payment behavior, and live or production secrets.
- Resolved boundary decision: reject caller-controlled callback URL values in the
  existing application middleware before Medusa's built-in Google provider.

## Boundary Notes

- Linked contract: `.memory-bank/contracts/auth-session-security.md` callback and
  redirect rules.
- Responsibility boundary: TASK-027 owns provider/session configuration and the
  narrow Google auth-start request guard; callback completion and VK provider
  behavior remain later tasks.
- Boundary drift risk: no Medusa Core/provider wrapper changes, callback completion,
  storefront flow, or broader route policy may be introduced.

## Implementation Plan

1. Configure actor provider allowlists and provider declarations.
2. Add backend-only provider environment placeholders and startup validation.
3. Configure explicit CORS and signed HttpOnly session cookie policy.
4. Reject caller-provided Google `callback_url` values for both GET and POST at the
   application middleware boundary.
5. Add a sanitized configuration smoke command.
6. Run task-local smoke, backend typecheck, Memory Bank lint, and diff check.

## Handoff Ownership

The scheduler owns `/verify`, per-task `/red-verify`, lifecycle decisions, dependent
promotion, and `/mb-sync`. This `/execute` retry does not close TASK-027.

## Bounded Retry 2/2 Plan

1. Derive cookie `Secure` from the contract's local HTTP development exception,
   making staging and non-local/HTTPS configurations secure.
2. Require explicit `JWT_SECRET` and `COOKIE_SECRET` in production while preserving
   local-only development fallbacks.
3. Add focused smoke assertions for staging/non-local HTTPS cookies and each
   independently absent production signing secret.
4. Run only execute-local packet gates and hand off to independent verification.
