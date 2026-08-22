---
task_id: TASK-053
stage: implementation
tier: T3
status: complete
---
# TASK-053 Context

## Governing inputs

- `AGENTS.md`
- `.memory-bank/constitution.md`
- `.memory-bank/tasks/TASK-053.task.json`
- `.memory-bank/packets/TASK-053.packet.json`
- `.memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md`
- `.memory-bank/contracts/pending-order-api.md`
- `.memory-bank/states/pending-order-inventory-lifecycle.md`
- `.memory-bank/workflows/tier-policy.md`

## Root cause

`findMatchingIdempotencyOrder` filters through `isPendingOrderMetadata`. The
expiry workflow changes `checkout_state` to `expired`, so a bound key becomes
invisible and the existing terminal-state guard is bypassed. The bounded fix is
to locate the persisted key independent of logical state, then reuse the
existing ownership/fingerprint/status/expiry guard.

## Scope

Only the four task-record allowed paths may change. No new ledger, service,
public contract, expiry-owner change, provider behavior, or unrelated cleanup.
