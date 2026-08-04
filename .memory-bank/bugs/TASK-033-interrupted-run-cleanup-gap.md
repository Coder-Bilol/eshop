---
description: Active TASK-033 interrupted-run temp-state and fixture recovery gap.
status: archived
owner: general
last_updated: 2026-08-02
source_of_truth:
  - .memory-bank/tasks/TASK-033.task.json
  - .protocols/TASK-033/red-verification.md
---
# TASK-033 Interrupted Run Cleanup Gap

## Summary

Resolved: TASK-033 now creates a private owner marker before database writes,
discovers a bounded set of prior run files, skips markers owned by a live process,
and performs idempotent Medusa cleanup for interrupted runs before new acceptance
work starts.

## Impact

- Hard termination no longer makes a run unreachable solely because the next run
  receives a different ID.
- Concurrent active runs are protected by PID ownership markers for the bounded
  two-hour acceptance window; older markers become recoverable despite PID reuse.
- Discovery is restricted to at most 20 bounded TASK-033 run IDs and never reads or
  emits runtime state values.

## Evidence

- `.protocols/TASK-033/red-verification.md`
- `.tasks/TASK-033/TASK-033-S-RED-VERIFY-final-report-docs-01.md`

## Resolution Criteria

- Bounded discovery and recovery for stale TASK-033 run state is implemented.
- Simulated interruption followed by a normal recovery run passes.
- State values remain outside logs/evidence and scope remains synthetic-only.
- Repeated `/verify TASK-033` and `/red-verify TASK-033` pass.

## Resolution

- `apps/backend/test/run-integration.cjs` creates a mode-restricted owner marker
  before the write phase and removes owner/state files only after successful cleanup.
- A missing, malformed, or dead-owner marker is recoverable; a live owner is skipped.
- Legacy state files without owner markers remain recoverable by their validated
  filename, including the state that triggered this bug.
- The real acceptance command recovered one legacy run, simulated interruption after
  real PostgreSQL writes, recovered that run in a new cleanup invocation, and left no
  TASK-033 owner/state files.
- Repeated functional and semantic verification passed before T3 closure.
