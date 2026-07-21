# TASK-031 Functional Verification Report Code 02

## Findings

- HIGH: Actual no-source completion fails. The root CartProvider starts `idle` with
  `restoreOnMount={false}` and returns `null + idle` when no reference exists, while
  the resolver accepts only the synthetic `null + empty` fixture. A successfully
  authenticated buyer without a guest cart is left `merge_blocked`.
- MEDIUM: Contradictory malformed handoffs still reach readiness, including `ready`
  with an error/pending restore and incomplete merge metadata.

VERDICT: FAIL

## Evidence

- Packet R9 is `ready` and its SHA-256 exactly matches the authoritative task.
- Focused and all nine storefront suites, typecheck, build, strict doctor, Memory
  Bank lint, and diff check passed.
- Independent production-composition probing reproduced the real `null + idle`
  no-source handoff and its rejection by `resolveCartReadiness()`.
- Independent hostile probing confirmed merge success, blocked
  backend-error/empty/unknown paths, blocked-state return non-consumption,
  auth-loss/retry/unmount invalidation, and exposed the remaining malformed accepts.
- Privacy, allowed scope, one-flight actions, sanitized errors, and exact T3 markers
  passed review.
- Full evidence: `.protocols/TASK-031/verification-code-02.md`.

## Closure Recommendation

- REQUEST_CHANGES. Do not close TASK-031 or promote dependents. Use retry 2/2 to
  align no-source with the real CartProvider handoff and fail closed on contradictory
  malformed forms, then rerun both T3 reviews.
- Reviewer changed no implementation, lifecycle, dependency, changelog, or sync
  state and did not run `/execute` or `/mb-sync`.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
