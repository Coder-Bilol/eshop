# TASK-050 Reviewer Red Verification

SEMANTIC_VERDICT: semantic-fail

Reviewer verdict: REQUEST_CHANGES

Findings:

1. HIGH — A different `Idempotency-Key` can create a second pending order for
   the same authenticated active cart. The lock key hashes the idempotency key
   (`apps/backend/src/checkout/pending-order.ts:155-159`), and the preparation
   lookup only matches that same key
   (`apps/backend/src/workflows/checkout/create-pending-order.ts:64-91`). FT-007
   explicitly requires a new key not to create another order for the same
   checkout. The current smoke covers only same-key replay.
2. BLOCKER — Required packet hash is stale: current task raw SHA-256 is
   `5f36264d3172095d136f4ebdc53080c257420a3c70989c871826e13e1a19a55b`, while
   the packet records `883038a07bdb80f96a0af86d097bf791285601e9b0f0f33e6ee89fbd9cf93ffc`.
3. BLOCKER — Both required build gates timed out without output (root: 180s;
   backend Medusa build: 120s). No build PASS evidence exists.
4. BLOCKER — Exact T3 markers are not present/credible. Handoff records
   `HUMAN_CHECKPOINT: pending_scheduler_owner` and
   `ROLLBACK_RECOVERY_NOTE: pending_scheduler_owner`.

Evidence checked: authoritative TASK-050/task packet/specs, full protocol
context, actual source/diff, implementer report, integration log, and fresh
read-only runs of typecheck, mb-lint, diff-check, and the pending-order
integration smoke. The integration smoke passed its narrow same-key scenario;
that does not clear finding 1.

T3 marker status:

- Required `HUMAN_CHECKPOINT: done`: ABSENT.
- Required `ROLLBACK_RECOVERY_NOTE: present`: ABSENT.

The reviewer did not change task status, source, packet, or scheduler state.
