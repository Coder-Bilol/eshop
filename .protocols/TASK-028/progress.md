# TASK-028 Progress

## 2026-07-18 Implementer Run

- Completed required T3 context, packet, linked-spec, dependency, scope, and dirty
  worktree preflight.
- Confirmed `TASK-027` is `done` and its Medusa config already resolves provider ID
  `vkid` to `./src/modules/auth-vkid` with backend-only options.
- Confirmed the installed Medusa provider interface and state-service behavior.
- Implemented provider ID `vkid` as an `AbstractAuthModuleProvider` registered with
  `ModuleProvider(Modules.AUTH, ...)`.
- Added opaque ten-minute state, S256 PKCE, fixed callback URL, required callback
  `code`/`state`/`device_id`, consumed-state overwrite before exchange, and an
  in-process claim guard for concurrent replay.
- Added server-side VK token and user-info POSTs, requiring matching returned state,
  matching stable token/profile `user_id`, and normalized provider-returned email.
- Persisted only stable entity ID and normalized email/optional names. Access,
  refresh, and ID tokens are not passed to state or identity persistence and no
  provider payload is logged.
- Added one sanitized callback failure and provider-double coverage for success,
  sequential/concurrent replay, expiry, PKCE tampering, missing `device_id`, cancel,
  network failure, missing email, user mismatch, returned-state mismatch, and token
  non-persistence.
- Preserved the existing integration runner by delegating non-`auth-vkid` suites
  from the allowed smoke script; no existing test suite file was changed.
- The first integration/typecheck run found one TypeScript state-record assignment
  error. It was corrected by passing a plain record, and both gates then passed.
- All final packet-sourced execute-local gates and `git diff --check` passed.
  Evidence: `.tasks/TASK-028/execute-local-gates-code-01.md`.
- Existing TASK-027, scheduler, packet, deployment, and unrelated dirty changes
  were preserved. No lifecycle or forbidden-scope file was changed.

## 2026-07-18 Retry 1/2

- Read packet R4, linked auth specs, official VK ID wire-contract evidence, and the
  independent functional/adversarial reviewer reports.
- Changed the confidential code exchange field from `client_secret` to VK ID
  `service_token` without changing the configured secret value or requested scope.
- Tightened the provider double so token exchange succeeds only with
  `service_token`, no `client_secret`, and the expected code-bound `device_id`.
- Added a mismatched-`device_id` callback case that reaches the synthetic token
  endpoint, receives an upstream rejection, returns only the sanitized provider
  error, and creates no identity.
- Preserved passing state TTL/single use, S256 PKCE, stable subject, validated
  normalized email, sanitization, token non-persistence, and `email` scope behavior.
- Packet commands all pass. Evidence:
  `.tasks/TASK-028/execute-local-gates-code-02.md`.
- No live credentials/provider calls, lifecycle changes, verify/red-verify,
  `/mb-sync`, scope expansion, or forbidden-scope edits were performed.
