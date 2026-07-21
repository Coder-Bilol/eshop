# TASK-030 Functional Verification Report Code 06

## Findings

- HIGH: expired-session logout returns Medusa `401`, but the controller restores the
  old customer and performs no cart cleanup. Independent evidence ended in
  `session_established` with `cus_expired` and zero cleanup calls.
- MEDIUM: `https://accounts.google.com/o/oauth2/v2/auth?state=x#` is accepted and
  returned despite the exact no-fragment requirement; a bare `#` produces an empty
  WHATWG `URL.hash` and bypasses the current check.

VERDICT: FAIL

## Evidence

- Installed Google and current VK providers generate the exact approved real
  destinations and provider-bound callbacks; both pass the storefront validator.
- TASK-043 malformed/double-encoded query regressions and exact 4096-character/
  32-segment boundaries pass independently; 4097/33 reject.
- Credentials include, current-customer authority and `401 -> guest`, covered
  restore/logout races, cleanup-only cart retry, one-shot return-path storage faults,
  and no-token storage all otherwise pass.
- All eight storefront suites, workspace typecheck, both workspace builds, VK and
  auth-completion smoke tests, Memory Bank lint, strict doctor, and diff check pass.
- Full evidence: `.protocols/TASK-030/verification-code-06.md`.

## Closure Recommendation

- REQUEST_CHANGES. TASK-030 is not functionally closure-eligible; keep dependents
  unpromoted and repeat full verification after bounded remediation. Reviewer did
  not change implementation, execute/sync lifecycle, or task/dependency state.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
