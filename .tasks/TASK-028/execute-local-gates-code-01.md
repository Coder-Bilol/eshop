# TASK-028 Execute-Local Gate Evidence

- Mode: scheduler `/execute` only
- Tier: T3
- Credentials/provider boundary: synthetic doubles only; no live credentials or
  live VK request

## Commands

1. `npm --workspace apps/backend run test:integration -- auth-vkid`
   - Initial result: fail before execution because TypeScript required a plain
     `Record<string, unknown>` for provider state storage.
   - Correction: pass a shallow plain-record copy to Medusa `setState`.
   - Final result: pass.
   - Sanitized output: `status=ok`, suite `auth-vkid`, provider `vkid`, state
     `single-use-ttl`, PKCE `S256`, identity `stable-user-id-validated-email`, tokens
     `not-persisted-or-logged`, failures `sanitized`, credentials
     `synthetic-provider-double`.
2. `npm --workspace apps/backend run typecheck`
   - Initial result: same compile-only state-record error.
   - Final result: pass with no diagnostics.
3. `node scripts/mb-lint.mjs`
   - Result: pass (`118 files`).
4. `git diff --check`
   - Result: pass. Output contained only existing Windows LF-to-CRLF warnings.

## Contract Assertions

- Provider extends `AbstractAuthModuleProvider`, has identifier `vkid`, and is
  exported through `ModuleProvider(Modules.AUTH, ...)`.
- Start stores an opaque state with a ten-minute provider expiry and one verifier,
  sends only its SHA-256 base64url challenge, and fixes the configured backend
  callback.
- Callback consumes state before exchange and rejects sequential/concurrent replay,
  expiry, PKCE tampering, cancellation, missing `device_id`, malformed/upstream
  responses, returned-state mismatch, missing email, and token/profile user mismatch.
- Token exchange receives the original verifier and callback `device_id`; token and
  user-info responses must agree on stable `user_id`.
- Identity creation receives only stable entity ID, normalized email, and bounded
  optional names. Synthetic access/refresh/ID token markers are absent from stored
  state, identity persistence inputs, logger calls, and command output.
- All provider failures use `VK authentication failed`; raw upstream markers are
  absent from returned errors and final evidence output.

EXECUTE_LOCAL_VERDICT: PASS

This evidence is not `/verify`, `/red-verify`, lifecycle closure, or `/mb-sync`.
