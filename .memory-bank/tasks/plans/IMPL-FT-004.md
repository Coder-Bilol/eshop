---
description: Implementation plan for FT-004 Google and VK ID login before payment.
status: active
owner: prd-to-tasks
last_updated: 2026-07-16
source_of_truth:
  - .memory-bank/features/FT-004-oauth-login-before-payment.md
  - .memory-bank/tech-specs/FT-004-oauth-login-before-payment.md
  - .memory-bank/requirements.md
---
# IMPL-FT-004 OAuth Login Before Payment

## Goal

Implement Google and VK ID customer login over Medusa v2.16 Auth/Customer Modules,
establish a signed `HttpOnly` customer session, invoke the FT-003 cart merge after
login, and block checkout/payment continuation until authentication and cart
ownership are ready.

## Source Artifacts

- [.memory-bank/features/FT-004-oauth-login-before-payment.md](../../features/FT-004-oauth-login-before-payment.md)
- [.memory-bank/tech-specs/FT-004-oauth-login-before-payment.md](../../tech-specs/FT-004-oauth-login-before-payment.md)
- [.memory-bank/architecture/auth-runtime.md](../../architecture/auth-runtime.md)
- [.memory-bank/contracts/auth-session-security.md](../../contracts/auth-session-security.md)
- [.memory-bank/states/customer-auth-session.md](../../states/customer-auth-session.md)
- [.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md](../../tech-specs/FT-003-guest-cart-persistence-merge.md)
- [.memory-bank/contracts/cart-access-security.md](../../contracts/cart-access-security.md)
- [.memory-bank/architecture/system-architecture.md](../../architecture/system-architecture.md)
- [.memory-bank/contracts/api-guidelines.md](../../contracts/api-guidelines.md)
- [.memory-bank/requirements.md](../../requirements.md)
- [.memory-bank/epics/EP-002-customer-identity-cart-wishlist.md](../../epics/EP-002-customer-identity-cart-wishlist.md)
- [.memory-bank/testing/index.md](../../testing/index.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)

## Normative Inputs

- FT-004 feature and linked SDD specs listed above.
- [.memory-bank/constitution.md](../../constitution.md): security/privacy,
  evidence-before-done, KISS, and no Medusa Core modification.
- [.memory-bank/invariants.md](../../invariants.md): supported Medusa extension
  boundaries, isolated integrations, and high-tier auth routing.

## Constraints And Invariants

- Medusa Auth/Customer PostgreSQL records own identity/customer truth.
- Use built-in Google provider and one custom `vkid` Auth Module Provider.
- Storefront uses Medusa session cookie; no JWT or provider-token browser storage.
- Require state for both providers and S256 PKCE plus `device_id` for VK ID.
- Provider callback has a fixed backend route and fixed storefront completion
  redirect; browser callback overrides and open redirects are forbidden.
- Matching email never auto-links provider identities.
- Post-auth checkout waits for FT-003 merge success or no guest source.
- Preserve Medusa Admin `emailpass`; do not add customer password login.

## Verification Targets

- Provider config and VK provider contract behavior with doubles.
- Durable PostgreSQL Auth/Customer identity linkage and same-email collision safety.
- Signed session creation/destruction, callback replay/expiry/PKCE, rate limiting,
  sanitized errors/logs, CORS, cookie flags, and token non-persistence.
- Browser flow for both providers, callback cleanup, cart merge/retry, checkout gate,
  safe return path, cancellation, and logout cleanup.

## Constitution Check

- KISS: reuse Medusa Auth/Customer/session and the existing cart merge; add only one
  VK provider and bounded completion/rate-limit behavior.
- No Medusa Core modification: all work uses config, module provider, API route,
  middleware, workflow, and storefront boundaries.
- Security/privacy: every implementation slice is T3, provider secrets remain
  backend-only, and email collision fails closed.
- Evidence before done: each task requires full protocol, packet, `/verify`,
  per-task `/red-verify`, human checkpoint, and rollback/recovery marker.
- Conflicts/blockers: none. Live provider credentials remain a human UAT input.

## Waves

| Wave | Task | Purpose |
|---|---|---|
| W1 | TASK-027 | Configure Medusa customer providers, session/cookie policy, env placeholders, and config smoke. |
| W1 | TASK-028 | Implement the custom VK ID Auth Module Provider and provider contract tests. |
| W2 | TASK-029 | Implement backend callback completion, account/session resolution, redirect safety, and auth rate limiting. |
| W2 | TASK-030 | Implement storefront session customer client and deterministic auth state/logout orchestration. |
| W2 | TASK-031 | Implement login/completion UI and invoke the FT-003 post-auth merge handoff. |
| W2 | TASK-032 | Implement the checkout authentication/merge gate and safe return-path continuation. |
| W3 | TASK-033 | Add real Medusa/PostgreSQL backend auth acceptance with provider doubles. |
| W3 | TASK-034 | Add real-browser Google/VK login, cart handoff, checkout gate, failure, and logout acceptance. |

Only TASK-027 is initially ready. Later tasks become ready after indexed dependencies
are done. All tasks are T3 because they change authentication, sessions, customer
identity, privacy, or an authorization-sensitive checkout boundary.

## Expected Touched Files

- `apps/backend/medusa-config.ts`
- `apps/backend/.env.example`
- `apps/backend/package.json`
- `apps/backend/src/modules/auth-vkid/**`
- `apps/backend/src/auth/**`
- `apps/backend/src/api/auth/**`
- `apps/backend/src/api/middlewares.ts`
- `apps/backend/src/scripts/smoke-auth*.ts`
- `apps/backend/test/**`
- `apps/storefront/lib/auth*.ts`
- `apps/storefront/components/auth*.tsx`
- `apps/storefront/app/login/**`
- `apps/storefront/app/auth/complete/**`
- `apps/storefront/app/checkout/**`
- `apps/storefront/src/auth*.test.cjs`
- `apps/storefront/e2e/**`
- `.memory-bank/changelog.md`

## Implementation Steps

1. Register Google, VK ID, and retained admin emailpass providers; restrict actor
   methods and configure session/cookie/auth CORS/env behavior.
2. Implement VK ID Authorization Code provider with server-side state, S256 PKCE,
   `device_id`, token exchange, user-info mapping, and no token persistence.
3. Add backend completion routes that resolve/create one customer, reject email
   collision, establish session, sanitize failures, apply bounded auth rate limits,
   and redirect only to the configured storefront completion path.
4. Implement storefront session-aware customer retrieval, auth lifecycle, safe
   return-path storage, and confirmed logout cleanup.
5. Build Google/VK login and completion UI; invoke the existing
   `mergeAfterAuthentication()` handoff and expose retry without discarding source.
6. Gate `/checkout` so only `authenticated_ready` reaches continuation content;
   guests return through login and merge-blocked users remain blocked.
7. Verify provider/account/session behavior against real Medusa/PostgreSQL using
   local provider doubles and synthetic identities.
8. Verify both provider browser flows, URL cleanup, merge, gate, errors, replay,
   cancellation, safe redirect, and logout with Playwright.

## Tests And Gates

- `npm --workspace apps/backend run smoke:auth-config`
- `npm --workspace apps/backend run test:integration -- auth-vkid`
- `npm --workspace apps/backend run test:integration -- auth-completion`
- `npm --workspace apps/backend run test:integration -- auth-acceptance`
- `npm --workspace apps/storefront run test -- auth-client`
- `npm --workspace apps/storefront run test -- auth-state`
- `npm --workspace apps/storefront run test -- auth-ui`
- `npm --workspace apps/storefront run test -- checkout-auth-gate`
- `npm --workspace apps/storefront run test:e2e -- auth`
- `npm run typecheck`
- `npm run build`
- `npm run smoke:local`
- `node scripts/mb-lint.mjs`

Exact script registration is owned by the corresponding task. No gate may print
tokens, secrets, raw provider payloads, session IDs, customer PII, or production
data.

## UAT Steps

1. Configure local/staging Google and VK applications with exact backend callback
   URLs and non-production credentials.
2. Start local PostgreSQL, Medusa, and storefront through the Windows-native path.
3. Add an item as guest, open checkout, choose Google, complete login, and verify
   the session, cart merge, cleaned completion URL, and checkout continuation.
4. Repeat in a clean browser with VK ID and verify the same outcome.
5. Cancel each provider flow and verify the guest cart and login retry remain.
6. Force a merge conflict and verify login remains valid but checkout is blocked
   until merge retry succeeds.
7. Try an unsafe return path and verify fallback to `/` without external redirect.
8. Log out and verify current-customer retrieval returns `401`, local cart reference
   is cleared, and durable customer/cart records still exist.
9. Confirm no secret/token/session/customer email appears in URL, browser storage,
   logs, screenshots, or evidence.

## Acceptance Coverage

| Acceptance item | Covered by |
|---|---|
| REQ-010 Google OAuth | TASK-027, TASK-029, TASK-030, TASK-031, TASK-033, TASK-034 |
| REQ-011 VK ID | TASK-027, TASK-028, TASK-029, TASK-030, TASK-031, TASK-033, TASK-034 |
| REQ-012 login before payment | TASK-030, TASK-031, TASK-032, TASK-034 |
| Durable identity/customer storage | TASK-029, TASK-033 |
| Session/callback/privacy security | TASK-027, TASK-028, TASK-029, TASK-033, TASK-034 |
| Post-auth guest cart merge | TASK-031, TASK-034 |
| Logout/shared-browser safety | TASK-030, TASK-034 |

## Handoff

- Do not execute tasks from `/prd-to-tasks`.
- Run strict `/mb-doctor` once at the FT-004 feature/task-queue boundary.
- Start with ready TASK-027.
- Every T3 task requires its own `/verify`, `/red-verify`, human checkpoint, and
  rollback/recovery evidence before closure.
