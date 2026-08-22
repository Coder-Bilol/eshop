# TASK-MB-REVIEW S-01 Final Report

Task: `TASK-MB-REVIEW`  
Stage: `S-01`  
Role: Architect reviewer — C4, boundaries, ADR, routed SDD/support docs  
Mode: fresh-context final scheduler review  
Verdict: REJECT

## Scope And Evidence Checked

- Governing layer: `AGENTS.md`, Constitution, MBB, `spec-backbone.md`,
  `spec-index.md`, tier policy, and `/review` contract.
- C4/navigation: product L1, epic L2, feature L3, indexed task L4, main and
  folder routers.
- Architecture/spec surface: global system architecture, boundary/API rules,
  invariants, core domain, lifecycle/state specs, all registered feature design
  hubs through FT-007 plus FT-011, and routed architecture/contract/data/state
  support docs.
- ADR surface: `.memory-bank/adrs/` and the active ADR template/policy.
- Final scheduler state: `.memory-bank/tasks/index.json`, all indexed task
  records, FT-007 feature/plan, and final FT-007 reconciliation evidence.
- Read-only gates: `node scripts/mb-lint.mjs` passed for 138 files;
  `node scripts/mb-doctor.mjs --strict` passed with 0 errors and 0 warnings.

## Findings

### 1. BLOCKER — global architecture contradicts the Constitution-owned T2 Definition of Done

Evidence:

- Constitution Principle IV says task Definition of Done follows
  `.memory-bank/workflows/tier-policy.md`.
- `.memory-bank/architecture/system-architecture.md:179` says that high-tier
  tasks require `/verify` and that **T2/T3 require `/red-verify`**.
- `.memory-bank/workflows/tier-policy.md:29-32`, `:41-42`, and `:119-125`
  explicitly say a T2 task does not require per-task `/red-verify`; T2 semantic
  review is mandatory at feature completion, while per-task semantic review is
  mandatory for T3.

Impact: two active normative documents define different task-closure gates. This
is a Constitution contradiction and is blocking under the `/review` decision
rule even though the completed queue happened to carry sufficient evidence.

Required fix: change the architecture/testing wording to the exact tier-policy
split: T2 task = packet/spec gates plus `/verify PASS`; T2 feature = feature
`semantic-pass`; T3 task = per-task `semantic-pass` plus checkpoint/recovery.

### 2. HIGH — the authoritative global order state model conflicts with the implemented FT-007 logical state

Evidence:

- `.memory-bank/states/order-payment-inventory.md:27-42` defines the allowed MVP
  order states without `expired` and defines timeout as
  `pending_payment -> canceled`.
- `.memory-bank/domains/pending-order-inventory-data.md:29-30` calls
  `checkout_state` the product state and allows `expired`.
- `.memory-bank/states/pending-order-inventory-lifecycle.md:18` defines
  `pending_payment -> expired`; implementation writes that value in
  `apps/backend/src/workflows/checkout/expire-pending-order.ts:93` and `:123`
  while the native Medusa order is canceled.

Impact: the same logical product lifecycle has two active state vocabularies.
FT-008/FT-009 cannot safely consume this handoff without guessing whether
`expired` is an order state, a cancellation reason, or a feature-local projection.

Required fix: make one explicit authoritative mapping. Either add `expired` as a
documented logical substate/reason mapped to native `canceled`, or keep the global
logical state `canceled` and store expiry only as a reason. Update the global and
FT-007 state/data docs together; do not leave peer specs with incompatible enums.

### 3. HIGH — storage ownership is internally contradictory

Evidence:

- `.memory-bank/architecture/system-architecture.md:40` declares product media
  on a persistent server filesystem.
- The same file at `:137` says PostgreSQL is the **only durable data store**.
- `.memory-bank/spec-backbone.md:45` repeats the PostgreSQL-only claim, while
  system architecture requires persistent media mounting and backups.

Impact: backup, recovery, deployment, and no-data-loss boundaries can omit the
media store or treat it as non-authoritative despite the active architecture.
That conflicts with Constitution Principle VII (`no data loss`).

Required fix: distinguish the only durable structured/database store
(PostgreSQL) from the durable media/blob store (deployment-owned filesystem),
and route backup/recovery ownership for both consistently through backbone,
architecture, and deployment docs.

### 4. HIGH — the active backbone was not reconciled after FT-007 completion

Evidence:

- `.memory-bank/spec-backbone.md:30` still says Medusa status/reservation mechanics
  must be resolved during FT-007 design, and `:72` says no meaningful production
  code exists.
- `.memory-bank/architecture/system-architecture.md:193` still presents exact
  order-status/inventory extension points as pre-implementation work.
- In contrast, `.memory-bank/features/FT-007-pending-order-inventory-reservation.md:62-118`
  records completed design and verified implementation, and
  `.memory-bank/tasks/plans/IMPL-FT-007.md:131-140` records TASK-050..TASK-053
  closed plus final feature `semantic-pass`.

Impact: the global routing layer sends future FT-008/FT-009 work through already
resolved FT-007 questions and falsely describes repository maturity. This violates
Constitution Principles II and X requiring durable, synchronized project knowledge.

Required fix: reconcile the backbone/system-architecture risks and handoff after
the implemented wave. Preserve genuinely open FT-008/FT-009 finalization/Admin
questions, but mark FT-007 native status, reservation, expiry/release, and
idempotency ownership as resolved. Historical pre-code statements should be
marked historical or removed.

### 5. MEDIUM — active ADR policy and actual architecture-record strategy conflict

Evidence:

- `.memory-bank/adrs/` contains only `ADR-000-template.md`.
- That active file has `ADR Status: accepted` and states at line 19 that every
  significant architecture decision is recorded as an ADR.
- `spec-backbone.md:68` declares a single-file architecture strategy, while the
  project has already committed significant decisions for modular-monolith
  boundaries, Windows-local/remote-Docker topology, OAuth/session ownership,
  cart merge persistence, and native Medusa order/reservation/idempotency design
  without any real ADR.

Impact: decision precedence places ADRs above specs, but no accepted decision
records exist and the active ADR policy disagrees with the chosen documentation
strategy.

Required fix: owner must choose and record one policy. Either create accepted
ADRs for the material decisions (at minimum global topology/boundaries and the
FT-007 native-state/reservation/idempotency choice), or make the template
non-normative and explicitly state that authoritative SDD specs are the accepted
decision records for this KISS project.

### 6. MEDIUM — folder routers omit the final FT-006/FT-007 SDD surface

Evidence:

- `.memory-bank/architecture/index.md` omits `pending-order-runtime.md`.
- `.memory-bank/contracts/index.md` omits `pending-order-api.md`.
- `.memory-bank/domains/index.md` omits `pending-order-inventory-data.md`.
- `.memory-bank/states/index.md` omits `pending-order-inventory-lifecycle.md`.
- `.memory-bank/tech-specs/index.md` omits both FT-006 and FT-007 feature design
  hubs.
- The files are present and registered in `spec-index.md` and the main Memory
  Bank index, so this is router drift rather than a missing spec.

Impact: folder-local context routing does not expose the authoritative final
purchase-flow specs, contrary to the MBB router/navigation contract and the
review request's blocking router concern.

Required fix: add the missing entries to the existing folder routers and keep
their coverage aligned with `spec-index.md`.

## Checks That Passed

- C4 decomposition is present: product L1, EP-001..EP-005 L2,
  FT-001..FT-011 L3, and schema-backed L4 task records.
- The task index contains exactly TASK-001..TASK-053 with no ID gaps; all 53 are
  `done`. Distribution is coherent across FT-011 and FT-001..FT-007.
- FT-007 records TASK-050..TASK-053 as scheduler-closed and records final feature
  `SEMANTIC_VERDICT: semantic-pass`.
- No duplicate path or second competing feature design file was found in the
  pure `spec-index.md` registry.
- FT-008..FT-010 remain future feature scope; they are not incorrectly represented
  as completed by the terminal TASK-001..TASK-053 queue.
- Structural lint and strict doctor pass, but neither detects the semantic
  contradictions and incomplete routers listed above.

## Decision

The queue is terminal and the implemented feature boundary is well-evidenced,
but the final architecture gate cannot approve while active normative documents
conflict with the Constitution/tier policy, with each other, and with the
implemented FT-007 state. Re-run S-01 after the six bounded documentation fixes.

VERDICT: REJECT
