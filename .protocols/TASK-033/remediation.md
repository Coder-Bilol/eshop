# TASK-033 Session HTTP Remediation

## Trigger

- Independent functional verification returned `VERDICT: FAIL`.
- PostgreSQL persistence/atomicity/cleanup remained valid, but session evidence used
  only an in-memory recorder and falsely claimed actual cookie/restart coverage.
- Bug: `.memory-bank/bugs/TASK-033-session-restart-acceptance-gap.md`.

## Real HTTP Boundary

1. The write process creates real PostgreSQL Auth/Customer links and a temporary
   publishable API key through supported modules/workflows.
2. The runner builds and starts compiled Medusa with isolated local port and
   synthetic local signing secrets; live providers remain disabled.
3. A short-lived synthetic customer bearer calls real `POST /auth/session`.
4. The test captures actual `connect.sid` Set-Cookie and asserts HttpOnly, SameSite
   Lax, path, and configured CORS.
5. The cookie authenticates real `GET /store/customers/me` for the fixture customer.
6. Real `DELETE /auth/session` succeeds, emits an empty cookie, and the original
   cookie is rejected with `401`.
7. A second valid cookie is created. The backend process is stopped, its port is
   confirmed released, and a new process starts with the same signing config.
8. The pre-restart cookie is rejected with `401`, proving ephemeral session loss.
9. A fresh Medusa exec process still reads the durable identity/customer link.
10. Cleanup revokes/deletes the temporary key, removes all fixtures, asserts zero
    remnants, and removes the private temp state file.
11. Before database writes, the dispatcher creates a private owner marker. A later
    run discovers bounded dead-owner or legacy state, replays idempotent cleanup with
    the recovered run ID, and removes owner/state files only after cleanup succeeds.
12. The command simulates termination after real writes and requires the next
    recovery pass to remove that run before normal acceptance proceeds.

## Privacy And Scope

- Cookie, bearer, publishable key, fixture IDs, and customer email never enter stdout,
  protocol, evidence, or server logs.
- Server output is consumed but not emitted; failures expose only stable harness
  messages/status assertions.
- No production route, middleware, provider, callback, session implementation,
  storefront, order, checkout, payment, migration, or live data was changed.

## Local Result

- `npm --workspace apps/backend run test:integration -- auth-acceptance`: PASS on the
  real HTTP/restart harness.
- `npm --workspace apps/backend run typecheck`: PASS.
- `npm run smoke:local`: PASS.
- `node scripts/mb-lint.mjs`: PASS, 119 files.
- `node scripts/mb-doctor.mjs --strict`: PASS with zero errors; unrelated TASK-040
  upstream warning only.
- CommonJS syntax checks and `git diff --check`: PASS, with line-ending warnings only.
- Evidence value scan: PASS; no cookie, bearer, publishable key, fixture ID/email, or
  isolated backend URL value is present in TASK-033 markdown artifacts.
- Historical independent FAIL is retained until a repeated `/verify` is run.
- `/red-verify` remains gated on repeated functional PASS.

## Interrupted-run Recovery Result

- The first recovery-enabled acceptance run removed the legacy state that triggered
  adversarial concern, then recovered one simulated interrupted PostgreSQL run.
- Owner markers prevent cleanup of active concurrent runs for a bounded two-hour run
  window; discovery accepts only TASK-033 filenames and stops when more than 20 runs
  require inspection.
- `auth-acceptance`, backend typecheck, and `smoke:local`: PASS; no TASK-033 temp
  owner/state file remained after the command.
- Repeated `/verify` and `/red-verify` subsequently passed before closure.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
