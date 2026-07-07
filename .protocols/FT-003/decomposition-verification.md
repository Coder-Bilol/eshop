---
description: Functional and readiness verification of the FT-003 task decomposition.
status: superseded
---
# FT-003 Decomposition Verification

> Superseded on 2026-07-03 by `/spec-improve FT-003` and the repaired
> `/prd-to-tasks FT-003` queue. The original FAIL remains historical evidence.

VERDICT: FAIL

## Scope

This is a decomposition/readiness verification, not `/verify TASK-<ID>` of
implemented behavior. No TASK lifecycle status was changed.

## Structural Evidence

- `node scripts/mb-lint.mjs`: PASS, 103 files.
- `node scripts/mb-doctor.mjs --strict --json`: PASS, 0 errors, 0 warnings.
- TASK-017 through TASK-022 are indexed, schema-valid, and linked to FT-003.
- All six required packets have `status: ready`.
- All six packet `source_task_hash` values match their task files.
- Dependency readiness is valid: TASK-017 depends on done TASK-016; TASK-018
  depends on done TASK-013 and TASK-016.
- REQ coverage is explicit:
  - REQ-006: TASK-018, TASK-020, TASK-022;
  - REQ-007: TASK-018, TASK-020, TASK-022;
  - REQ-008: TASK-017, TASK-019, TASK-021, TASK-022.
- No blocking `TBD`, `TODO`, `NEEDS CLARIFICATION`, or `???` marker exists in
  the FT-003 decomposition surface.

## Blocking Finding

The successful existing-target merge path does not define an executable
post-merge disposition for the source Medusa cart.

The state spec calls the source `merged_consumed`, while also saying that this
is only a workflow/journal semantic. The merge journal makes the custom merge
endpoint replay-safe, but no contract or task requires standard Store cart
retrieve/add/update/remove calls using the old source ID to be rejected,
redirected, invalidated, or otherwise made safe.

Therefore the decomposition cannot prove that an old tab/reference will not
continue using a second active cart after its quantities were merged. This is a
no-data-loss and exactly-once gap, not a minor implementation detail.

Durable record:
`.memory-bank/bugs/FT-003-source-cart-consumption-undefined.md`.

## Additional Quality Findings

1. TASK-019 combines authenticated route/schema work, ownership and target
   selection, multi-cart locking, merge-plan construction, core mutations,
   compensation, journal idempotency, concurrency, and integration evidence.
   This is materially larger than the normal 1-2 hour atomic slice required by
   `/prd-to-tasks`.
2. TASK-022 combines backend persistence/security/concurrency verification,
   storefront tests, real-browser E2E, runtime smoke, and final acceptance
   evidence. It is a broad verification wave rather than one atomic task.
3. The existing FT-003 red-verification report still says that no SDD, task,
   plan, or packet artifacts exist. It is historical evidence but is not marked
   superseded, so a fresh reader can mistake it for current readiness state.

## Required Repair

1. Resolve source-cart disposition in the linked state/API/data specs.
2. Add explicit post-success source-cart behavior and evidence to the affected
   task records.
3. Split TASK-019 and preferably TASK-022 into smaller executable slices, or
   record a concrete bounded justification for retaining their current size.
4. Refresh every changed packet hash.
5. Mark the earlier readiness-only red-verification report as superseded without
   deleting its historical evidence.
6. Rerun `mb-lint`, strict `mb-doctor`, and this decomposition verification.
