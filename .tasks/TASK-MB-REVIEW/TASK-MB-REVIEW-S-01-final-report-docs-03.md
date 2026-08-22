# TASK-MB-REVIEW S-01 Repeated Final Report

Task: `TASK-MB-REVIEW`  
Stage: `S-01`  
Role: delegated Architect reviewer — C4, boundaries, state/storage, ADR, routers, tier-policy alignment  
Mode: fresh-context review after bounded remediation  
Verdict: REJECT

## Scope And Evidence Checked

- Governing layer: `AGENTS.md`, Constitution, MBB, `spec-backbone.md`,
  `spec-index.md`, worker/review contracts, and the canonical tier policy.
- Historical evidence: S-01 `docs-02` rejection and
  `TASK-MB-REVIEW-S-REMEDIATION-final-report-docs-01.md`.
- Architecture surface: product/epic/feature/task C4 routing, system architecture,
  boundary map, FT-007 runtime/API/data/state/design docs, global state model,
  testing strategy, deployment/storage runbook, ADR policy, and folder routers.
- Implementation spot-check: FT-007 expiry workflow still writes
  `checkout_state: expired`, invokes native `cancelOrderWorkflow`, and releases
  reservations, matching the remediated global/native mapping.
- Read-only deterministic gates:
  - `node scripts/mb-lint.mjs`: PASS, 138 files.
  - `node scripts/mb-doctor.mjs --strict --json`: PASS, 0 errors, 0 warnings;
    53 indexed tasks, all 53 `done`.
  - `git diff --check`: PASS; only line-ending warnings.
  - Folder-router parity check: PASS for `architecture`, `contracts`, `domains`,
    `states`, and `tech-specs`.

## Recheck Of The Six Prior Findings

1. **RESOLVED — T2/T3 closure gates.**
   `system-architecture.md:184-188` and `testing/index.md:74-77` now match
   `tier-policy.md:119-138`: T2 task closure uses packet/spec gates plus
   `/verify PASS`, T2 feature completion requires feature-level
   `semantic-pass`, and T3 task closure adds per-task `semantic-pass`, checkpoint,
   and recovery evidence.

2. **RESOLVED — expiry state mapping.**
   `states/order-payment-inventory.md:47-54`,
   `states/pending-order-inventory-lifecycle.md:16-25`, and
   `domains/pending-order-inventory-data.md:29-32` consistently define global and
   native `canceled`, with `checkout_state: expired` only as the FT-007 timeout
   reason projection. The implementation spot-check agrees.

3. **RESOLVED — durable storage ownership.**
   `system-architecture.md:139-144` distinguishes PostgreSQL as the durable
   structured/database store and deployment-owned media as the durable blob
   store. `spec-backbone.md` carries the same split, while
   `DEPLOYMENT.md:266-293` and `:492-504` pair database dumps and media archives
   into one externally copied recovery set.

4. **RESOLVED — post-FT-007 backbone reconciliation.**
   `spec-backbone.md:30-33,78-80` and `system-architecture.md:202-205` record the
   verified pending-order/reservation/expiry/idempotency decisions and leave only
   FT-008/FT-009 payment-finalization and Admin/status projection questions open.

5. **RESOLVED — ADR strategy.**
   `adrs/ADR-000-template.md:11-26` is explicitly a non-normative template, and
   `spec-backbone.md:66-69` records authoritative SDD specs as the accepted KISS
   decision records, with ADRs reserved for cross-spec rationale or supersession.

6. **RESOLVED — folder-router coverage.**
   Current routers include FT-006 and FT-007 surfaces, including
   `pending-order-runtime.md`, `pending-order-api.md`,
   `pending-order-inventory-data.md`, `pending-order-inventory-lifecycle.md`, and
   both feature design hubs. The parity check found no unlisted markdown file in
   the five reviewed folders.

## Remaining Findings

### P1 / BLOCKER — global architecture permits an override forbidden by tier policy

Evidence:

- `architecture/system-architecture.md:175` says auth, payment, webhook, order
  lifecycle, inventory, deploy/runtime, destructive-data, and compliance work is
  T3 **unless a later task record justifies a lower tier**.
- `workflows/tier-policy.md:128-146` assigns auth, permissions/security,
  deploy/runtime/production, irreversible/data-loss, payments, compliance, and
  destructive operations to T3. It provides no task-record downgrade escape;
  task records route work under this policy rather than supersede it.
- Constitution Principle IV makes `tier-policy.md` the Definition-of-Done and
  routing authority; Principles V-VII make auth, payment, production, destructive
  data, and no-data-loss controls safety-critical.

Impact: a future sensitive task can cite the active global architecture to select
T2/T1 and thereby omit mandatory T3 per-task semantic review, human checkpoint,
or rollback/recovery evidence. This is a direct active normative contradiction,
so it is blocking under `/review` even though the current FT-007 tasks were in
fact routed as T3 and strict doctor passes.

Required fix: remove the task-record downgrade clause and use the exact policy
split. Auth/security/payment webhook, deploy/runtime/production,
irreversible/data-loss, destructive, and compliance implementation are T3.
Order lifecycle/inventory/API/state/data work is at least T2 and becomes T3 when
one of those critical dimensions applies. A task record may select the applicable
tier, but cannot waive a mandatory T3 assignment.

### P3 / LOW — retained pre-design hints use stale FT-007 wording

- `contracts/boundary-map.md:23` still asks for the exact Medusa stock
  reservation model "later".
- `states/lifecycle-map.md:22,45` still says exact status mapping and reservation
  implementation must be designed later.

These files are explicitly routed as initial `boundary_hints`/`lifecycle_hints`,
while the authoritative global and FT-007 specs now resolve the questions, so
this is not a competing state/storage contract and does not drive the verdict.
For cleaner future routing, mark those bullets historical or narrow them to the
still-open FT-008/FT-009 finalization/Admin projection decisions.

## Checks That Passed

- C4 levels remain present and navigable: product L1, EP-001..EP-005 L2,
  FT-001..FT-011 L3, and schema-backed TASK-001..TASK-053 L4.
- API -> Workflows -> Modules, no Medusa Core modification, provider isolation,
  webhook authority, and storefront/backend ownership boundaries remain
  consistent across the global and FT-007 architecture surface.
- No duplicate competing FT-007 architecture, API, data, state, or feature spec
  was found in the registry.
- Queue terminality and prior remediation claims are structurally supported by
  lint/doctor, but those tools do not detect the remaining semantic tier-policy
  contradiction.

## Decision

All six findings from S-01 `docs-02` are genuinely remediated. The repeated audit
nevertheless finds one new P1/blocking Constitution-to-architecture contradiction
in tier assignment. S-01 cannot approve until the lower-tier override is removed
or the governing tier policy is explicitly amended through its owner process.

VERDICT: REJECT
