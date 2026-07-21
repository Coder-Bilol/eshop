# TASK-029 Independent Functional Verification

VERDICT: FAIL

## Findings

- HIGH: first-login session persistence failure does not satisfy the required
  pre-session cleanup. `completeCustomerAuth` creates and links the customer before
  `establishCustomerSession` runs. If `session.save` fails,
  `establishCustomerSession` clears and destroys only the session; the durable
  customer and `app_metadata.customer_id` link remain. The independent probe
  observed one retained customer and the retained link after
  `auth_session_failed`. This conflicts with
  `.memory-bank/states/customer-auth-session.md` verification target requiring no
  customer/session/link after a pre-session failure. The existing smoke assertion
  checks only `auth_context` deletion and session destruction, so its PASS does not
  prove the claimed customer/link cleanup.
- MEDIUM: the changed package dispatcher makes the unqualified backend integration
  command a false-success no-op. `smoke-auth-completion.ts` returns immediately when
  no suite is requested, whereas the replaced `test/run-integration.cjs` command
  selected all legacy suites by default. Independent execution of
  `npm --workspace apps/backend run test:integration` exited 0 without running or
  reporting any suite. This is a regression outside the named TASK-029 gate and can
  hide failures in normal CI/developer use.

## Context Gates

- The indexed task exists, remains `in_progress`, and has `tier: T3`; scheduler mode
  owns lifecycle changes.
- Packet `PACKET-TASK-029-R3` is `ready`. Its `source_task_hash` exactly matches the
  raw current task file:
  `sha256:fc6055df9dd3e52c4aaf53dff9d1ae9662e9a7cd373c8c64c76574e5f0334a47`.
- Linked FT-004 feature, architecture, security, state, implementation-plan, and
  tier-policy inputs were checked. Protocol context/plan still say R2, but this is
  non-blocking documentation drift because the canonical R3 packet is valid.
- No code, task record, lifecycle, dependent promotion, bug record, Memory Bank
  sync, or unrelated worktree content was changed by verification.

## Functional Evidence

- Supported Medusa boundary: PASS by installed Medusa 2.16 source/type inspection.
  `createCustomerAccountWorkflow` accepts `authIdentityId` plus `customerData`,
  creates the customer, and links it through `setAuthAppMetadataStep`; production
  code resolves Auth/Customer Modules and invokes that workflow without direct core
  table writes.
- Exactly-one resolution: PASS for task-local synthetic behavior. First callback
  creates one customer; repeat and concurrent same-identity completion reuse that
  actor. The email-keyed single-process lock is bounded and chained correctly.
- Replay and collision: PASS in the independent route probe. Reusing a claimed
  state did not re-run provider validation or save another session. A same-email
  cross-provider identity produced `auth_account_link_required` with no customer
  link or session.
- Server-side session: PASS in the independent route probe. The session was
  regenerated and saved before the redirect; the redirect contained no JWT,
  callback code, state, or provider token.
- Redirect and sanitization: PASS. Completion always used the first validated
  configured storefront origin plus `/auth/complete`, with only allowlisted
  provider and coarse status. Unexpected errors map to `auth_failed`; raw provider
  data is not logged or copied to session/customer input.
- Rate limiting and replay storage: PASS for the stated single-process MVP. Keys are
  HMAC-SHA256 digests under a process-random salt, maps and raw key size are bounded,
  expired entries are pruned, and capacity exhaustion fails closed.
- Partial failure: FAIL for newly created account plus session-store failure.
  Session state is removed, but durable customer/link cleanup is absent.
- Scope: production runtime files attributable to TASK-029 stay inside the indexed
  allowed write scope; no storefront/cart/checkout, Medusa Core, direct table write,
  or automatic email-linking change was found.
- PostgreSQL boundary: not credited here and not treated as a TASK-029 defect by
  itself. The local suite uses synthetic Auth/Customer/workflow/session doubles.
  Real Medusa/PostgreSQL persistence and restart acceptance is explicitly owned by
  TASK-033. Existing evidence correctly discloses this limitation, so synthetic
  output must not be cited as real PostgreSQL proof.

## Commands And Checks

- `npm --workspace apps/backend run test:integration -- auth-completion` -> PASS.
- `npm --workspace apps/backend run typecheck` -> PASS.
- `node scripts/mb-lint.mjs` -> PASS, 118 files.
- `npm --workspace apps/backend run test:integration -- auth-vkid` -> PASS.
- Independent route probe -> PASS for fixed redirect, server session, no browser
  token, replay rejection, and collision no-link/no-session.
- Independent first-login/session-failure probe -> FAIL contract cleanup: session
  destroyed, but one customer and its auth link remained.
- `npm --workspace apps/backend run test:integration` -> exit 0 with zero suites,
  confirming the dispatcher regression.
- `git diff --check` -> PASS with existing line-ending warnings only.
- Raw SHA-256 comparison -> packet/task hash match.

## Recommendation

- Scheduler should not close TASK-029 or promote dependents and should recommend
  `status: failed`.
- Resolve the first-login/session-failure contract safely. If retaining a complete,
  retryable account is the intended architecture, an owner must first reconcile the
  conflicting state verification target and task/evidence claim; otherwise add
  supported compensation and a first-login failure assertion without direct core
  writes or destructive guessing.
- Restore non-empty behavior for the unqualified integration command and verify both
  named auth suites and legacy suite dispatch. Then repeat `/verify TASK-029` and
  `/red-verify TASK-029`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
