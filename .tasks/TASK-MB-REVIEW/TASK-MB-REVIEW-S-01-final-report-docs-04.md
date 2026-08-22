# TASK-MB-REVIEW S-01 Second Repeated Final Report

Task: `TASK-MB-REVIEW`  
Stage: `S-01`  
Role: delegated Architect reviewer — C4, boundaries, tier routing, state/storage, backbone, ADR, routers  
Mode: fresh-context confirmation after second bounded remediation  
Verdict: REJECT

## Scope And Evidence Checked

- Governing layer: `AGENTS.md`, Constitution, MBB, `spec-backbone.md`,
  `spec-index.md`, worker/review contracts, and `workflows/tier-policy.md`.
- Prior evidence: S-01 `docs-02`, S-01 `docs-03`, and the bounded remediation
  report.
- Architecture surface: global system architecture, FT-011 local-runtime design,
  C4 routers, boundary/lifecycle hints, FT-007 runtime/API/data/state/design,
  global order/payment/inventory state, testing strategy, deployment/storage
  recovery guidance, ADR template, and folder routers.
- Final queue spot-check: all 53 indexed tasks are `done`; tier/title review was
  performed for the full queue and detailed records were inspected for
  TASK-001..TASK-004.
- Read-only deterministic checks:
  - `node scripts/mb-lint.mjs`: PASS, 138 files.
  - `node scripts/mb-doctor.mjs --strict --json`: PASS, 0 errors, 0 warnings;
    53 indexed tasks, all 53 `done`.
  - `git diff --check`: PASS; line-ending warnings only.
  - Folder-router parity: PASS for `architecture`, `contracts`, `domains`,
    `states`, and `tech-specs`.
  - Spec registry path uniqueness: PASS, 38 unique routed Markdown paths.

## Recheck Of Previous S-01 Findings

1. **RESOLVED — T2/T3 closure gates.** `system-architecture.md:189-193` and
   `testing/index.md:74-77` match `tier-policy.md`: T2 task closure uses
   packet/spec gates plus `/verify PASS`, T2 feature completion requires
   feature-level `semantic-pass`, and T3 adds per-task `semantic-pass`, checkpoint,
   and recovery evidence.
2. **RESOLVED — expiry mapping.** Global/native state is `canceled`, while
   FT-007 `checkout_state: expired` is consistently a timeout-reason projection
   in the global state, FT-007 data, and FT-007 lifecycle specs.
3. **RESOLVED — durable storage ownership.** PostgreSQL is the durable
   structured/database store, deployment-owned media is the durable blob store,
   and `DEPLOYMENT.md` requires a paired database-dump/media-archive recovery set.
4. **RESOLVED — post-FT-007 backbone.** The backbone and architecture record
   pending-order, reservation, expiry/release, and idempotency as resolved while
   retaining FT-008/FT-009 finalization/Admin projection questions.
5. **RESOLVED — ADR strategy.** `ADR-000-template.md` is explicitly
   non-normative; authoritative SDD specs are the KISS decision records.
6. **RESOLVED — routers.** The five reviewed folder routers expose the FT-006
   and FT-007 surfaces and have no unlisted Markdown files.
7. **RESOLVED — lower-tier override and stale hints.** `system-architecture.md:175-180`
   now says a task record cannot waive mandatory T3 routing. `boundary-map.md:20,23`
   and `lifecycle-map.md:22-23,46-47` distinguish resolved FT-007 choices from
   still-open FT-008/FT-009 work.

## Remaining Finding

### P1 / BLOCKER — FT-011 and the terminal queue still contradict the exact runtime tier assignment

Evidence:

- `workflows/tier-policy.md:128-146` assigns `deploy/runtime` work to T3, and
  Constitution Principle IV makes that policy authoritative for task routing and
  Definition of Done.
- The remediated `architecture/system-architecture.md:175-180` repeats that
  deploy/runtime implementation is mandatory T3 and explicitly forbids a task
  record from waiving that assignment.
- In direct conflict, `tech-specs/FT-011-windows-native-local-development.md:38`
  calls the policy a source for **T2 routing for cross-service local runtime and
  persistence tasks**, and `:54` explicitly assigns Windows-native runtime tasks
  to T2 while claiming alignment with tier policy.
- `TASK-003.task.json` is `tier: T2`, but its purpose, success outcome, touched
  files, and required gates explicitly implement the Windows-native local runtime
  and local startup/smoke path. It was closed with T2 evidence, without the
  per-task semantic review, human checkpoint, and rollback/recovery evidence
  required for T3. TASK-004 also adds runtime smoke scripts and must be classified
  consistently after the governing meaning of `runtime` is resolved.

Impact: the terminal queue contains at least one task whose declared tier and
closure evidence do not satisfy the currently authoritative assignment rule.
Strict doctor passes because it validates closure against the recorded `T2`; it
does not semantically infer the required tier from task purpose. Therefore the
autopilot terminal gate cannot rely on the current 53/53 `done` result.

Required remediation: make one owner-level, non-ambiguous policy choice and
synchronize all affected sources. Either (a) keep local runtime within mandatory
T3, correct the affected task tier/status, and provide T3 closure evidence, or
(b) explicitly narrow `runtime` in tier policy and system architecture so safe
local-development runtime/tooling is T2 while production/deployment/runtime-risk
work remains T3. Then update FT-011 wording and re-run strict doctor plus S-01.

## Decision

The second bounded remediation correctly fixes the `docs-03` architecture clause
and both retained hint files, and all earlier state/storage/backbone/ADR/router
findings remain resolved. Approval is still blocked by the active FT-011/task-tier
contradiction against Constitution-owned tier policy.

VERDICT: REJECT
