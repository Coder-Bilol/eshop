# TASK-027 Plan

## Goal Interpretation

- Purpose: establish the secure Medusa provider and session baseline for FT-004.
- Success outcome: Google/VK customer auth configuration and safe sessions without
  weakening Medusa Admin emailpass or exposing secrets.
- Anti-goals: no callback UI/exchange implementation, customer password login, live
  credentials, or provider implementation.
- Allowed runtime write scope: `apps/backend/medusa-config.ts`,
  `apps/backend/.env.example`, `apps/backend/package.json`,
  `apps/backend/src/scripts/smoke-auth-config.ts`, `.memory-bank/changelog.md`.
- Forbidden scope: Medusa Core, storefront auth UI, VK provider implementation,
  checkout/order/payment behavior, and live or production secrets.
- Stop condition reached: Medusa 2.16 built-in Google provider configuration cannot
  enforce the linked exact callback URL contract by configuration alone.

## Boundary Notes

- Linked contract: `.memory-bank/contracts/auth-session-security.md` callback and
  redirect rules.
- Responsibility boundary: TASK-027 may configure providers/session policy only.
- Boundary drift risk: fixing callback override behavior requires auth route or
  provider behavior outside the task's allowed write scope.

## Intended Implementation Before Blocker

1. Configure actor provider allowlists and provider declarations.
2. Add backend-only provider environment placeholders and startup validation.
3. Configure explicit CORS and signed HttpOnly session cookie policy.
4. Add a sanitized configuration smoke command.
5. Run task-local smoke, backend typecheck, and Memory Bank lint.

Implementation did not start because preflight must stop before edits on a
security/public-contract contradiction.

## Handoff Ownership

The scheduler/spec owner must reconcile the Medusa built-in Google behavior with
the security contract and update task scope/specification as needed. `/mb-sync` is
not owned by this run.
