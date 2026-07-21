# TASK-028 Functional Verification Report After Retry 1/2

VERDICT: PASS

## Findings

- No actionable functional findings.
- The corrected exchange uses VK ID `service_token` and excludes `client_secret`.
- The provider double rejects a mismatched callback `device_id` at token exchange,
  performs no user-info request, creates no identity, and returns a sanitized error.

## Evidence

- Packet R4 status/hash gate: pass; task SHA-256 is
  `d63c5d9ca193208eed1bcbea9be759f28a654913018657e9fad02eb91e65fcc6`.
- Required integration, backend typecheck, and Memory Bank lint gates: pass.
- Auth config regression smoke and Medusa 2.16 provider loader/interface check: pass.
- State opacity/TTL/single-use/concurrency, S256 PKCE, returned-state matching,
  stable VK `user_id`, required normalized email, missing/mismatched/cancel/upstream
  failures, sanitization, token non-persistence, and minimal `email` scope: pass by
  provider-double assertions and source/runtime audit.
- Official VK ID API confirms confidential code exchange requires `service_token`
  and callback `device_id`; credential-free endpoint reachability checks passed.
- No live credentials, valid provider code, provider account, or authorization flow
  was used.

## Artifact

- Detailed evidence: `.protocols/TASK-028/verification-code-02.md`.

## Scheduler Recommendation

- Functional closure gate is satisfied; use the separate `code-02` semantic verdict
  before scheduler-owned closure and dependent promotion.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
