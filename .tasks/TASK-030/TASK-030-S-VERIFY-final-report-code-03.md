# TASK-030 Functional Verification Report Code 03

VERDICT: FAIL

## Findings

- HIGH: `startProviderLogin()` rejects the configured VK provider's valid
  `https://id.vk.com/authorize` location because the storefront accepts only the
  Medusa backend origin. Medusa forwards provider `location` unchanged, so VK login
  cannot start through the TASK-030 client boundary.

## Evidence

- R5 packet is `ready` and its task SHA-256 matches the authoritative T3 task.
- Both final retry fixes pass independent probes: storage read failure cannot replay
  the return path, and failed logout during pending restore preserves the last
  confirmed customer while suppressing the stale response.
- Earlier concurrency, removal-fault, logout precedence/single-flight, cart cleanup
  retry, `401`, credentials, and token non-storage behaviors pass.
- Focused suites, all eight storefront suites, typecheck, production build, Memory
  Bank lint, strict doctor, and diff check pass.
- Backend VK smoke passes and asserts `https://id.vk.com`; the independent storefront
  probe rejects that same origin with `auth_invalid_response`.
- Full evidence: `.protocols/TASK-030/verification-code-03.md`.

## Recommendation

- `REQUEST_CHANGES`. Retry budget `2/2` is exhausted; scheduler should recommend
  `status: failed`, keep TASK-031/TASK-032/TASK-039 unpromoted, and not close
  TASK-030. No fix, lifecycle transition, sync, or dependent promotion was performed.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
