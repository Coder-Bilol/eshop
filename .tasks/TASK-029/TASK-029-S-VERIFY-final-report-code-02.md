# TASK-029 Functional Verification Report Code 02

- Role: Reviewer
- Mode: scheduler
- Result: REQUEST_CHANGES
- Packet: R4 (`ready`), source hash independently matched

## Findings

- HIGH: after the resolution lock is released, a successful concurrent callback can
  save a session for the new customer before the creator callback fails session save
  and deletes that same customer/link as compensation.
- MEDIUM: failure of the auth-identity read immediately after successful account
  creation occurs before the cleanup wrapper receives `created: true`, leaving the
  new customer/link after a pre-session failure.

## Evidence

- The isolated retry cases pass: new-account session failure removes the new
  customer/link/session through Medusa's supported workflow; existing-account
  session failure preserves its durable actor.
- The original dispatcher defect is fixed. Independent no-argument execution ran
  `auth-completion`, `auth-vkid`, and all seven legacy integration suites.
- Focused auth completion, VK regression, default full integration, backend
  typecheck, Memory Bank lint, packet hash, and diff checks passed.
- Replay, collision, session ordering, fixed redirect, rate-limit bounds/hash keys,
  sanitization, provider-token omission, allowed scope, and no-direct-write checks
  remain green.
- Adversarial probes reproduced a successful session referencing a deleted customer
  and a post-create failure with retained customer/link but no cleanup owner.

VERDICT: FAIL

Scheduler recommendation: do not close TASK-029 or promote dependents. Correct both
failure-atomicity boundaries, add regression assertions, and rerun both checks.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
