# TASK-027 Execute-Local Verification

EXECUTE_LOCAL_VERDICT: PASS

## Preflight Checks

- Task index and ID: pass.
- Tier routing (`T3`) and full protocol selection: pass.
- Task lifecycle eligibility (`in_progress`): pass.
- Dependency `TASK-003`: pass (`done`).
- Linked SDD availability: pass.
- Allowed/forbidden scope review: pass.
- Resolved human boundary decision: pass; strict callback contract is enforced at
  the now-authorized application middleware boundary.
- Forbidden scope touched: no.

## Required Local Gates

- `npm --workspace apps/backend run smoke:auth-config`: pass. Sanitized output
  confirms actor/provider lists, exact callback config, GET/POST override guard,
  cookie/session policy, explicit CORS, production secure policy, and fail-closed
  missing enabled-provider secret behavior.
- `npm --workspace apps/backend run typecheck`: pass.
- `node scripts/mb-lint.mjs`: pass (`118 files`).
- `git diff --check`: pass; only line-ending warnings for existing Windows working
  copy policy were emitted.

Evidence: `.tasks/TASK-027/execute-local-gates-code-03.md`.

This is execute-local evidence only. `/verify` and `/red-verify` were not run, and
no task closure claim is made.

## Bounded Retry 2/2 Execute-Local Results

- PASS: local HTTP development retains `Secure=false`.
- PASS: staging and development with a non-local HTTPS storefront origin produce
  `Secure=true`; production remains `Secure=true`.
- PASS: production fails independently when `JWT_SECRET` or `COOKIE_SECRET` is
  absent, without selecting or printing the known local fallback literals.
- PASS: provider/actor lists, callbacks, GET/POST callback guard, CORS, TTL, cookie
  flags, and secret-safe enabled-provider failure assertions remain green.
- PASS: backend typecheck, Memory Bank lint (`118 files`), and `git diff --check`.
- The first pre-optimization smoke invocation reached the 120-second harness
  timeout without an assertion failure and passed with a 300-second timeout. The
  focused config cases were then consolidated into controlled in-process reloads;
  the final smoke passed within the standard 120-second gate window.

This retry does not replace or alter the independent Reviewer findings below.
Fresh `/verify` and `/red-verify` remain scheduler-owned handoff steps.

## Independent Reviewer Verification - 2026-07-18

Role: Reviewer. Mode: scheduler. Canonical packet inspected: R4 (`ready`), with
packet readiness and strict doctor accepted from the scheduler instruction.

VERDICT: FAIL

### Acceptance Results

- PASS: customer actor allowlist is `google,vkid`; admin user remains
  `emailpass`; enabled synthetic providers normalize to
  `emailpass,google,vkid`.
- PASS: Google/VK callbacks and credentials are backend environment values;
  missing enabled Google provider configuration fails closed without exposing a
  provided synthetic value.
- PASS: the application Google guard rejects `callback_url` for GET and POST.
  An actual Medusa 2.16 `MiddlewareFileLoader`/`RoutesLoader`/`RoutesSorter`
  inspection places `/auth/customer/google` middleware before the parameterized
  core middleware and GET/POST handlers.
- PASS: explicit CORS validation, `HttpOnly`, `SameSite=Lax`, path `/`, and the
  bounded one-day TTL are configured.
- FAIL: `apps/backend/medusa-config.ts:122` sets `Secure` only when
  `NODE_ENV === "production"`. A staging run and a development-mode non-local
  HTTPS-origin run both produce `secure:false`, contrary to
  `.memory-bank/contracts/auth-session-security.md:57-60` and
  `.memory-bank/architecture/auth-runtime.md:35-36`.
- FAIL: production with absent `JWT_SECRET` and `COOKIE_SECRET` uses the known
  `local-dev-*-change-me` fallbacks at `apps/backend/medusa-config.ts:111-113`.
  This defeats a secure signed-session baseline instead of failing closed.
- PASS: implementation runtime files stay inside packet R4 allowed scope; no
  forbidden product scope is present in the reviewed implementation diff.

### Commands And Evidence

- PASS: `npm --workspace apps/backend run smoke:auth-config`.
- PASS: `npm --workspace apps/backend run typecheck`.
- PASS: `node scripts/mb-lint.mjs` (`118 files`).
- PASS: `git diff --check` (line-ending warnings only).
- PASS: `npm --workspace apps/backend run build` (backend and frontend build).
- PASS: focused Medusa loader/sorter inspection; guard precedes both core auth
  middleware entries and GET/POST route handlers.
- FAIL evidence: staging config emitted
  `{"nodeEnv":"staging","secure":false,"sameSite":"lax"}`.
- FAIL evidence: HTTPS storefront config outside production emitted
  `{"storeCors":"https://shop.example.test","secure":false}`.
- FAIL evidence: production absent-secret check emitted
  `{"usesKnownJwtFallback":true,"usesKnownCookieFallback":true}`.
- PASS secret-safety evidence: isolated missing-provider-secret run emitted
  `{"failed":true,"namesMissingVariable":true,"leakedProvidedValue":false}`.

### Recommendation

Scheduler must not close TASK-027. Correct both session security failures, rerun
`/execute`, `/verify`, and required per-task `/red-verify`, then reassess closure.
No product code or authoritative lifecycle status was changed by this review.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
