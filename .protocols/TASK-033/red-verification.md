# TASK-033 Adversarial Semantic Verification

SEMANTIC_VERDICT: semantic-pass

LATEST_RUN: docs-02-after-interrupted-run-recovery

## Top Substance Risk

- MEDIUM: the normal HTTP acceptance run cleans its own state, but crash recovery is
  not self-healing. An independent post-run probe found a stale TASK-033 private
  state file from an earlier interrupted remediation run. The dispatcher always
  generates a new run ID, so the normal command neither reuses nor cleans the stale
  run. This contradicts the implementation/evidence claim that temp state and
  fixtures are removed unconditionally.

## Purpose Fit And False-success

- The core backend proof now fits the task: real PostgreSQL links, actual session
  cookie, authenticated current-customer access, real logout, stale-cookie rejection,
  full backend restart, and durable-link survival were reproduced.
- The prior false cookie/restart summary is corrected; `sessionHttp` is emitted only
  after the HTTP assertions pass.
- Cleanup creates a remaining false-success surface: a green current run proves only
  its own normal `finally` path, not recovery from a killed earlier process.

## Scope And Anti-goals

- No production auth behavior, storefront, live provider/credential, production
  data, checkout, order, or payment code was changed.
- Provider interactions and identities remain synthetic; evidence values are
  sanitized.
- Runtime/test edits remain inside the task acceptance scope.

## Cross-boundary And State Assessment

- Auth/Customer persistence: PASS across independent real Medusa/PostgreSQL
  processes.
- Session HTTP behavior: PASS for Set-Cookie, current customer, logout, and restart
  loss with durable identity preservation.
- Negative auth behavior: PASS at the assigned real/local-double boundaries.
- Cleanup/recovery: CONCERN. The temp state contains synthetic fixture IDs and a
  temporary publishable key needed to identify a run. If the parent process is
  terminated before `finally`, a later normal run cannot target that state or prove
  the associated database fixtures/API key were removed.

## Critical T3 Assessment

- No production secret, live token, customer PII, payment, migration, irreversible
  production write, or production data exposure was observed.
- The stale file is mode-restricted and contains local synthetic state, which limits
  severity, but its existence directly disproves unconditional cleanup.
- The current rollback/recovery note says to rerun cleanup with the same run ID; the
  dispatcher does not expose a normal same-run recovery path because it always
  creates a new ID.

## Weak-context Questions

- None needed to establish the concern. Whether hard-termination cleanup is accepted
  as an explicit residual risk is an operator decision, but T3 semantic-pass should
  not silently contradict the recorded cleanup guarantee.

## Hidden Assumption And Maintenance Cost

- Hidden assumption: JavaScript `finally` always runs. It does not run after process
  termination, host restart, or some tool timeouts.
- Stale run IDs can accumulate temp files and may leave synthetic API-key/Auth/
  Customer fixtures that future runs do not inspect because fixture names are keyed
  by a newly generated ID.

## How This Could Still Be Wrong

- TASK-034 browser acceptance may expose callback-to-cookie composition issues not
  covered by the synthetic bearer-to-session setup; that is an explicit downstream
  boundary and is not the blocker found here.
- The stale temp file may correspond to already-cleaned database fixtures, but the
  current harness cannot prove that after losing the original run context.

## Counterproposal / Escalation

- Add deterministic interrupted-run recovery inside the existing acceptance scope:
  either avoid durable temp state, or make the runner discover/recover bounded stale
  TASK-033 states and clean their API-key/Auth/Customer fixtures before a new run.
- Expose a sanitized same-run cleanup path and test a simulated interruption/recovery
  sequence. Do not print or persist state values in evidence.
- Repeat `/verify TASK-033` and `/red-verify TASK-033` after remediation, or obtain an
  explicit operator decision that narrows the cleanup guarantee and accepts this
  residual risk.

## Historical Failure / Blocker

- Status: resolved
- Where: `apps/backend/test/run-integration.cjs:84-116` and system temp state
- Expected: interrupted and successful runs leave no TASK-033 temp state or fixture
  cleanup ambiguity.
- Observed: one stale TASK-033 state file remained; new runs use unrelated run IDs.
- Likely category: code|verification
- Recommended next action: implement and test stale-run recovery or explicitly narrow
  the cleanup/recovery contract.
- Requires replan: no

## Historical Closure Recommendation

- Keep TASK-033 `ready`; functional PASS remains valid, but T3 closure is not
  eligible until repeated red verification returns semantic-pass.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present

## Repeated Adversarial Verification

### Top Substance Risk

- Resolved: a new run no longer depends on its own `finally` to reach prior fixture
  state. A mode-restricted marker exists before writes, and the next command derives
  a validated stale run ID from the filename and invokes real idempotent cleanup.

### Purpose Fit And False-success

- The command recovered the actual legacy run that exposed the gap, then created real
  Auth/Customer/API-key fixtures for a simulated interrupted run and recovered them
  through the same discovery path before normal acceptance.
- Recovery success is not inferred from file deletion alone: Medusa cleanup asserts
  zero API keys, customers, and identities before owner/state files are removed.
- Existing PostgreSQL persistence and real HTTP cookie/logout/restart evidence still
  pass after recovery is added.

### Scope, Boundaries, And State

- The runtime change remains inside `apps/backend/test/run-integration.cjs`; no
  production auth, storefront, provider, checkout, order, payment, migration, or
  persistent product contract changed.
- Discovery accepts only lowercase TASK-033 run IDs of bounded length, inspects at
  most 20 run groups, and never reads runtime state values for recovery.
- Live owner PIDs inside the two-hour acceptance window are skipped. Expired, dead,
  malformed, missing, and legacy owner states are recoverable, bounding PID reuse.
- Cleanup failure preserves the owner/state marker because file removal occurs only
  after the cleanup process succeeds; a later run can retry safely.

### Critical T3 Assessment

- No live credentials, provider calls, production data, irreversible writes, or
  sensitive evidence values were introduced.
- The only recovered records are deterministic local synthetic fixtures owned by the
  task run ID; cleanup uses supported Medusa modules/workflows.
- The exact human checkpoint and rollback/recovery markers remain present and the
  recovery note now matches an executable normal-command path.

### Hidden Assumptions And Residual Risk

- The simulated interruption changes the owner marker after real writes instead of
  forcibly killing the parent process. This is sufficient for the recovery boundary:
  discovery observes the same dead-owner plus persisted-fixture state.
- A concurrent acceptance lasting over two hours becomes recoverable by design. This
  is an explicit bounded local-test lease, not a production lock; normal runs complete
  far below that window.
- TASK-034 still owns browser callback-to-cookie composition and is not silently
  claimed by this backend task.

### How This Could Still Be Wrong

- Host failure during cleanup can leave a partially removed synthetic run, but its
  marker remains and the idempotent cleanup path retries it on the next command.
- More than 20 matching run groups fail closed for explicit operator cleanup rather
  than scanning an unbounded temp directory.

## Final Closure Recommendation

- Functional `VERDICT: PASS`, semantic substance, packet/spec gates, checkpoint, and
  rollback/recovery evidence satisfy T3 closure requirements.
- Manual standalone owner may mark TASK-033 `done` and run `/mb-sync`; do not promote
  TASK-034 or mark FT-004 verified inside sync.

SEMANTIC_VERDICT: semantic-pass

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
