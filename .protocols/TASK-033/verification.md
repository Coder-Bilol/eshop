# TASK-033 Independent Functional Verification

VERDICT: PASS

LATEST_RUN: code-03-after-interrupted-run-recovery

## Historical Finding

- HIGH: the required session-cookie and restart-logout acceptance is reported but not
  exercised. `smoke-auth-acceptance.ts` passes a custom in-memory
  `createSessionRecorder()` directly to `establishCustomerSession()`. Its fresh
  process checks only scan Auth/Customer JSON for session-like field names. No real
  HTTP callback, `Set-Cookie`, cookie jar, `/store/customers/me`, logout endpoint, or
  post-restart cookie rejection is executed. `auth-provider-double.cjs` nevertheless
  emits `cookie-save-destroy-and-restart-loss-covered`, creating false evidence for
  an explicit TASK-033 acceptance criterion and packet success check.

## Context Gates

- Manual `/verify TASK-033`; no lifecycle transition or closure ownership inferred.
- Indexed T3 task and required `PACKET-TASK-033-R2` were ready and hash-matched before
  verification evidence was added.
- TASK-029 dependency is done; linked FT-004 architecture, security, state, testing,
  and implementation-plan inputs are available and consistent.
- TASK-033 changes stay inside the acceptance harness/package/changelog scope. No
  production auth, storefront, live provider, production data, checkout, order, or
  payment change was attributed to this task.

## Acceptance Assessment

- Real persistence: PASS. Synthetic Google/VK Auth identities, Customer records, and
  account links survive a fresh Medusa process and are read through real modules and
  local PostgreSQL.
- First/repeat and atomic failures: PASS for the exercised real paths. Repeat login
  reuses the customer; collision and missing-email identities remain unlinked with
  no saved recorder session.
- Provider security: PASS at the local-double boundary for state replay/expiry, VK
  PKCE/device/state/user mismatch, sanitized errors, redirect, rate limit, and token
  non-persistence.
- Session cookie creation/destruction and restart logout: FAIL. Config values and an
  in-memory recorder are tested, but the runtime cookie/session HTTP boundary and a
  cookie presented after backend restart are not.
- Evidence privacy and cleanup: PASS. Output is coarse, no live credentials/data or
  forbidden identity/session values were recorded, and cleanup asserts no synthetic
  Auth/Customer fixtures remain.

## Commands

- `npm --workspace apps/backend run test:integration -- auth-acceptance` -> PASS;
  exposes the evidence gap above despite its green summary.
- `npm --workspace apps/backend run typecheck` -> PASS.
- `npm run smoke:local` -> PASS; this smoke does not start a backend HTTP process.
- `node scripts/mb-lint.mjs` -> PASS, 118 files.
- `node scripts/mb-doctor.mjs --strict` -> PASS, zero errors; unrelated TASK-040
  upstream warning only.
- `node --check` for both changed CommonJS runners -> PASS.
- `git diff --check` -> PASS with line-ending warnings only.
- Independent source/evidence probe -> confirmed session recorder use, no HTTP cookie
  probe, JSON field-name scan as restart evidence, and an overclaiming provider
  summary.

## Required Remediation

- Exercise the real local Medusa HTTP/session boundary with synthetic provider state:
  capture `Set-Cookie`, prove current-customer access, prove logout invalidates the
  cookie, and prove a cookie from the previous backend process is rejected after a
  fresh process while durable Auth/Customer links remain.
- Keep the test local and sanitized; do not add live credentials or production auth
  behavior. Remove or narrow summary claims that are not directly proven.
- Repeat `/verify TASK-033`. Run `/red-verify TASK-033` only after functional PASS.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present

## Repeated Verification After Recovery Remediation

- Required packet R2 was ready and hash-matched when verification began.
- Interrupted-run recovery: PASS. A bounded scan recovered the legacy run that
  triggered the concern, then recovered one simulated hard interruption after real
  PostgreSQL writes through the normal Medusa cleanup phase.
- Active-run safety: PASS. Owner markers are created before writes, live owner PIDs
  are skipped, and owner/state files are removed only after cleanup succeeds.
- Remnant check: PASS. No TASK-033 owner/state file remained in the system temp
  directory after recovery and the normal acceptance flow.
- Existing acceptance: PASS. Real Auth/Customer persistence, actual session HTTP,
  logout, restart rejection, durable-link survival, negative security paths, and
  evidence privacy remain green.
- Scope: PASS. The runtime edit is limited to the existing integration dispatcher;
  production auth behavior and all forbidden scope remain unchanged.

## Recovery Verification Commands

- `npm --workspace apps/backend run test:integration -- auth-acceptance` -> PASS;
  `previouslyRecovered: 1`, `simulatedRecovered: 1`, then normal acceptance PASS.
- `npm --workspace apps/backend run typecheck` -> PASS.
- `npm run smoke:local` -> PASS.
- `node scripts/mb-lint.mjs` -> PASS, 120 files.
- `node scripts/mb-doctor.mjs --strict` -> PASS, zero errors; unrelated TASK-040
  upstream warning only.
- CommonJS syntax, temp remnant, evidence privacy, and `git diff --check` -> PASS.

## Recovery T3 Handoff

- Functional verification remains PASS and now covers the prior semantic blocker.
- TASK-033 remains `ready` pending repeated per-task `/red-verify TASK-033`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present

## Repeated Verification After Remediation

- Required packet R2 was ready and hash-matched at verification start.
- Real persistence: PASS. Synthetic Google/VK Auth identities, Customer records, and
  links survive independent Medusa processes and remain readable after the HTTP
  server restart.
- Real session HTTP boundary: PASS. Actual `POST /auth/session` returns a flagged
  `connect.sid`; it authenticates `/store/customers/me`; real logout clears the
  session and the old cookie receives `401`.
- Restart loss: PASS. A newly created cookie works before a full compiled-backend
  stop/start and receives `401` afterward, while durable Auth/Customer linkage remains.
- Negative security paths: PASS for repeat login, duplicate/replay/expiry, collision,
  missing email, VK PKCE/device/state/user mismatch, CORS, redirect, rate limit, and
  token non-persistence through real and local-double boundaries as assigned.
- Cleanup/privacy: PASS. Temporary API key, Auth/Customer fixtures, backend process,
  port, and private temp state are removed; TASK-033 artifacts contain no cookie,
  bearer, API key, fixture ID/email, session ID, raw IP, provider token, or secret.
- Scope: PASS. No production auth behavior, storefront, live provider/credential,
  production data, checkout, order, or payment scope changed.

## Repeated Commands

- `npm --workspace apps/backend run test:integration -- auth-acceptance` -> PASS.
- `npm --workspace apps/backend run typecheck` -> PASS.
- `npm run smoke:local` -> PASS.
- `node scripts/mb-lint.mjs` -> PASS, 119 files.
- `node scripts/mb-doctor.mjs --strict` -> PASS, zero errors; unrelated TASK-040
  upstream warning only.
- CommonJS syntax checks, evidence privacy scan, and `git diff --check` -> PASS.

## T3 Handoff

- Functional verification is now PASS; TASK-033 remains `ready`.
- Per-task `/red-verify TASK-033` is required before closure eligibility.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
