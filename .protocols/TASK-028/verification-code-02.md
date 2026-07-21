# TASK-028 Independent Verification After Retry 1/2

VERDICT: PASS

## Findings

- No actionable functional findings.
- The retry removes the prior false success: the confidential code exchange sends
  `service_token`, never `client_secret`, and the provider double accepts only that
  wire shape.
- The mismatched-`device_id` case reaches the synthetic token endpoint, is rejected
  there, performs no user-info request, creates no identity, and returns only the
  stable sanitized failure.

## Context Gates

- Indexed task exists, remains `in_progress`, and is `T3` in scheduler mode.
- Full protocol files and linked FT-004 architecture, security, state, feature, and
  implementation-plan specs are present and were read.
- Packet `PACKET-TASK-028-R4` is `ready`. Its `source_task_hash` exactly matches the
  current task record:
  `sha256:d63c5d9ca193208eed1bcbea9be759f28a654913018657e9fad02eb91e65fcc6`.
- Prior functional and semantic FAIL reports and the latest implementation
  `code-02` report, gate evidence, source, and worktree diff were inspected.
- No code, task lifecycle, dependent promotion, Memory Bank, or `/mb-sync` change
  was made by this reviewer.

## Functional Evidence

- VK wire contract: pass. The official VK ID API documentation requires
  `service_token` as a POST parameter for confidential authorization-code exchange.
  `service.ts` sends `service_token` in an
  `application/x-www-form-urlencoded` POST together with `grant_type`, `code`,
  `code_verifier`, `redirect_uri`, `client_id`, callback `device_id`, and `state`.
  `client_secret` is absent. Public unauthenticated reachability checks also
  confirmed that the configured `.com` authorization, token, and user-info paths
  are active VK endpoints; no credentials or valid authorization code were used.
- `device_id` binding: pass. The double only accepts the expected synthetic
  code/`device_id` tuple. The explicit mismatched callback causes exactly one token
  request, no user-info request, no identity creation, and a sanitized failure.
- State and replay: pass for the specified single-process MVP. State is 32 random
  bytes encoded as 43 base64url characters, stores no identity/cart/return data,
  expires after ten minutes, is overwritten as consumed before exchange, rejects
  expired/sequential replay, and uses the singleton Medusa provider's in-process
  claim guard for concurrent replay.
- PKCE: pass. Every start creates a fresh 43-character verifier, sends only its S256
  challenge, validates the stored verifier/challenge before exchange, and sends the
  original verifier to the token endpoint.
- Identity and email: pass. Token and user-info `user_id` values must both be valid,
  stable, numeric, and equal. The provider retrieves by that entity ID before
  create. User-info email is required, trimmed, lowercased, length-bounded, and
  access-token-authorized; optional names are trimmed and bounded.
- Failure behavior: pass. Cancellation, malformed/missing fields, network/upstream
  rejection, expiry/replay, PKCE tampering, returned-state mismatch, missing email,
  and subject mismatch fail closed with only `VK authentication failed`.
- Token non-persistence and sanitization: pass by contract test and data-flow audit.
  Access/refresh/ID tokens remain callback-local; none enters provider state,
  identity metadata, logger calls, command output, or persisted synthetic records.
- Medusa compatibility: pass. The module registers `Modules.AUTH`, service ID
  `vkid`, and a class extending `AbstractAuthModuleProvider`; Medusa 2.16
  `loadModuleProvider` imports and validates it. The real Auth provider loader uses
  singleton lifetime, matching the in-process replay guard design.
- Scope: pass. Start requests only minimal `email` scope. No customer/session/UI,
  account-linking, storefront, checkout/payment, live credential, Medusa Core, or
  provider-token storage behavior was added. Retry changes are confined to the
  authorized provider and provider-double surfaces plus protocol/evidence files.

## Commands And Results

- `npm --workspace apps/backend run test:integration -- auth-vkid` -> exit 0;
  `service_token`, mismatched `device_id`, state/PKCE/replay/expiry, identity/email,
  sanitization, and token non-persistence assertions passed.
- `npm --workspace apps/backend run typecheck` -> exit 0, no diagnostics.
- `node scripts/mb-lint.mjs` -> exit 0, `118 files`.
- `npm --workspace apps/backend run smoke:auth-config` -> exit 0; actor/provider
  configuration, callback guard, cookie/session/CORS, and secret failure behavior
  passed.
- Synthetic Medusa 2.16 `loadModuleProvider` import/interface check -> exit 0;
  provider `vkid` loaded with `authenticate` and `validateCallback`.
- `git diff --check` -> exit 0 with line-ending warnings only.
- PowerShell SHA-256 comparison -> packet R4 hash exactly matches the current task.
- Official VK ID API/auth-flow docs and unauthenticated endpoint checks ->
  confidential exchange requires `service_token`; no live credentials, valid code,
  provider account, or authorization flow was used.

## Residual Limits

- A successful live VK exchange remains human UAT because credentials and a valid
  authorization code are intentionally unavailable. This does not block the
  mandatory provider-double verification.
- Multi-instance atomic replay protection is outside the specified single-process
  MVP. The current Medusa Auth loader registers this provider as a singleton.
- Durable Auth/Customer/PostgreSQL acceptance belongs to later FT-004 tasks and was
  not claimed by this provider-slice verdict.

## Scheduler Recommendation

- Functional gate is satisfied. Continue to the independent per-task semantic
  verdict; lifecycle, dependent promotion, and `/mb-sync` remain scheduler-owned.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
