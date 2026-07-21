# TASK-030 Functional Verification Report Code 02

- Role: Reviewer
- Mode: scheduler
- Result: REQUEST_CHANGES
- Packet: R4 (`ready`), matching authoritative task hash

## Findings

- MEDIUM: transient `sessionStorage.getItem` failure does not tombstone the consume
  attempt; the independent probe returned `/` first and stale `/checkout` second.
- MEDIUM: failed DELETE while a restore is pending restores transient
  `customer_resolving`, suppresses the successful customer response, and loses the
  last confirmed authenticated state instead of preserving it for retry.

## Evidence

- Prior stale-response, duplicate-logout, cart-cleanup, destination-origin, and
  removal-failure findings are corrected by retry 1/2.
- Focused auth suites, all eight storefront suites, typecheck, production build,
  Memory Bank lint, strict doctor, diff check, packet hash, and no-token-storage
  checks passed.
- Independent fault probes reproduced both remaining defects. Full evidence is in
  `.protocols/TASK-030/verification-code-02.md`.

VERDICT: FAIL

Scheduler recommendation: do not close TASK-030 or promote dependents. Correct both
failure paths in bounded retry 2/2 and repeat `/verify` plus `/red-verify`. No code,
lifecycle, task status, dependency, or sync state was changed by Reviewer.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
