# TASK-030 Verify Final Report Docs 01

VERDICT: FAIL

## Findings

- HIGH: a current-customer request started during pending logout can complete after
  successful session DELETE and restore `session_established` with the stale
  customer.
- HIGH: concurrent logout calls can end in `logging_out` with the old customer even
  after one DELETE succeeds and cleanup runs.
- MEDIUM: arbitrary HTTP(S) provider destinations are accepted; strict return-path
  consume fails when removal throws; post-DELETE cart cleanup failure can retain the
  prior browser cart reference while auth becomes guest.

## Evidence Checked

- R3 packet hash/readiness, indexed T3 task, linked auth/session/cart contracts and
  state specs, implementation/protocol evidence, runtime source, focused tests, and
  scope diff.
- Focused auth tests, all storefront regressions, typecheck, production build,
  Memory Bank lint, strict doctor, and diff check passed.
- Independent concurrency, destination, consumption, open-redirect, and cleanup
  probes reproduced the failures recorded in
  `.protocols/TASK-030/verification.md`.

## Recommendation

- Do not close TASK-030 or promote dependents. Correct operation precedence,
  idempotent logout, destination policy, strict consume, and cart cleanup failure
  handling; add regressions and repeat both verification stages.
- No code, lifecycle, task status, sync, or dependency state was changed.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
