# TASK-028 Retry 1/2 Execute-Local Gate Evidence

- Mode: scheduler `/execute` only
- Tier: T3
- Credentials/provider boundary: synthetic doubles and official public VK ID API
  documentation only; no live credentials or live VK request
- Bounded findings: `service_token` wire field and mismatched `device_id` rejection

## Commands

1. `npm --workspace apps/backend run test:integration -- auth-vkid`
   - Result: pass.
   - Sanitized output: `status=ok`, suite `auth-vkid`, provider `vkid`, state
     `single-use-ttl`, PKCE `S256`, exchange credential `service_token`, device ID
     `mismatch-rejected`, identity `stable-user-id-validated-email`, tokens
     `not-persisted-or-logged`, failures `sanitized`, credentials
     `synthetic-provider-double`.
2. `npm --workspace apps/backend run typecheck`
   - Result: pass with no diagnostics.
3. `node scripts/mb-lint.mjs`
   - Result: pass (`118 files`).
4. `git diff --check`
   - Result: pass; output contains only existing LF-to-CRLF warnings.

## Corrected Contract Assertions

- Confidential authorization-code exchange sends the configured credential as
  `service_token`; `client_secret` is absent.
- The synthetic token endpoint rejects an exchange with the wrong confidential
  field or a `device_id` that does not match the synthetic authorization code.
- The explicit mismatched-`device_id` case reaches token exchange, returns the
  sanitized `VK authentication failed` response, does not call user info, and
  creates no provider identity.
- Existing positive and negative assertions continue to cover state TTL/single use,
  S256 PKCE, stable VK `user_id`, required normalized email, sanitization, and
  provider-token non-persistence without expanding the `email` scope.

EXECUTE_LOCAL_VERDICT: PASS

This evidence is not `/verify`, `/red-verify`, lifecycle closure, or `/mb-sync`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
