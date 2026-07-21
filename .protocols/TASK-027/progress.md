# TASK-027 Progress

## 2026-07-16 Implementer Run

- Completed required T3 context and dependency preflight.
- Confirmed scheduler-only dirty change in the task record is the transition from
  `ready` to `in_progress`; it was preserved.
- Confirmed target runtime files have no unrelated dirty overlap.
- Confirmed installed Medusa/Auth Google packages are version `2.16.0`.
- Confirmed built-in Google provider accepts request `body.callback_url` ahead of
  configured `callbackUrl`, while the provider route has no body validation.
- Stopped before runtime edits under the task's semantic/security stop condition.
- Required execute-local gates were not run because there is no safe scoped
  implementation to test.

Evidence: `.tasks/TASK-027/preflight-security-conflict.md`.

## 2026-07-18 Implementer Bounded Retry 1/2

- Accepted the operator's resolved boundary decision and packet R3 context without
  structural packet/hash revalidation after scheduler lifecycle transition.
- Configured Medusa Auth providers with retained admin `emailpass`, customer
  `google/vkid` allowlist, backend-only environment callbacks, explicit enable
  switches, and sanitized fail-closed required environment checks.
- Added explicit HTTP(S) CORS validation and a one-day session/cookie TTL with
  `HttpOnly`, `SameSite=Lax`, path `/`, local HTTP `Secure=false`, and production
  HTTPS `Secure=true` policy.
- Added a narrow `/auth/customer/google` middleware guard that rejects
  `callback_url` from body or query for both GET and POST before the built-in
  provider executes.
- Added sanitized smoke assertions for provider/actor configuration, callback URLs,
  CORS, session policy, GET/POST guard behavior, production secure cookies, and
  missing enabled-provider secrets.
- Preserved existing scheduler-owned task, packet, autonomous status, and changelog
  changes. No task lifecycle status was changed.
- All final execute-local gates passed. Evidence:
  `.tasks/TASK-027/execute-local-gates-code-02.md`.

## 2026-07-18 Implementer Bounded Retry 2/2

- Read packet R5, both independent Reviewer reports, the full protocol, current
  implementation diff, and linked auth/session specs before editing.
- Confirmed the contract permits `Secure=false` only for local HTTP development.
  Updated cookie policy so staging and development with a non-local/HTTPS
  storefront origin receive `Secure=true`.
- Kept known development signing-secret fallbacks for non-production local startup,
  but production now fails closed when either `JWT_SECRET` or `COOKIE_SECRET` is
  empty or absent.
- Added focused smoke assertions for staging, development HTTPS, production secure
  cookies, and each independently missing production signing secret without
  printing values or fallback literals.
- Preserved callback guard, customer/admin provider allowlists, explicit CORS,
  one-day TTL, provider failure sanitization, and admin `emailpass` behavior.
- Did not modify `DEPLOYMENT.md`, lifecycle status, packet/task records, or any
  forbidden scope.
- All final execute-local gates passed. Evidence:
  `.tasks/TASK-027/execute-local-gates-code-03.md`.
