---
task_id: TASK-050
stage: closure
tier: T3
status: done
---
# TASK-050 Red Verification

SEMANTIC_VERDICT: semantic-pass
Reviewer verdict: APPROVE

## Substance assessment

The final implementation solves the intended FT-007 boundary rather than only
the narrow same-key case. Customer/cart locking plus pending-cart reconciliation
prevents changed-key duplicate orders; the fingerprint guard rejects a changed
request without mutation. Server-owned cart, pricing, delivery, inventory, and
actor checks remain in the API -> workflow -> native Medusa boundary.

The successful fixture proves native `pending` plus logical
`pending_payment`, 72-hour expiry, and one line-linked reservation. The
post-order failure fixture reaches native `reserveInventoryStep` after native
order creation and verifies sanitized failure, unchanged counts, and failed-key
absence. No provider call, direct stock mutation, Medusa Core modification, or
out-of-scope FT-008/FT-009 behavior was found.

## Risks / limitations

- Registered HTTP middleware/parser/session runtime is not directly exercised;
  the smoke calls the handler with synthetic `auth_context`. This is an
  evidence limitation, not a demonstrated semantic break.
- Local Medusa uses its in-memory lock fallback and replay is sequential; the
  lock contract is present and the local behavior passes, but production lock
  provider concurrency is outside this bounded run.
- Exact T3 markers were scheduler-owned at review time and are now recorded in
  the closure handoff after scheduler evidence review.

## Scheduler closure

The final semantic review is `semantic-pass`. Scheduler reviewed the
compensation evidence, unconditional synthetic cleanup, packet readiness, and
strict doctor result; the task is eligible for lifecycle reconciliation.

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
