---
description: Post-remediation S-05 MBB compliance review report for FT-008.
status: complete
task_id: TASK-MB-REVIEW
stage_id: S-05
feature: FT-008
mode: read-only
---
# TASK-MB-REVIEW S-05 — Post-remediation MBB Review FT-008

## Scope and method

Read-only review of the governing Constitution/MBB documents, root and local
routers, spec backbone/index, FT-008 hub and five linked SDD specs, FT-007 and
FT-009 handoffs, requirements/RTM, EP-003, FT-008 plan/protocols, TASK-054..057
records and canonical packets, relevant state/domain/architecture contracts, and
changelog. Task statuses, packets, protocols, and durable documents were not
changed; this report is the only requested write.

## Result

The FT-008 feature-local surface is internally coherent: the current profile is
personal/offline payment, one unpaid native system collection
(`pp_system_default`), native Medusa Admin `Mark as paid`/status actions as the
authority, and no online provider, redirect, or webhook. FT-009 is explicitly
deferred and is not an FT-008 dependency (`FT-008...md:30-42,88-118,146-149`;
`FT-009...md:11-15`; `requirements.md:49-60`).

Approval is blocked by unresolved contradictions in authoritative upstream
documents and one broken task-record fragment link.

## Blocking findings

### P1 — Global payment invariant and boundary map contradict the current profile

The active normative invariant still says that the ЮKassa webhook is the
authoritative payment source (`.memory-bank/invariants.md:16-17`). The active
authoritative boundary map repeats an unscoped ЮKassa payment row and says
“Webhook is source of truth” (`.memory-bank/contracts/boundary-map.md:22`).
These documents are explicitly authoritative inputs in
`.memory-bank/spec-backbone.md:21,24,46` and the invariant is registered in
`.memory-bank/spec-index.md:60-61`.

That conflicts with the current FT-008 contract and Constitution-sensitive
payment correctness boundary: native Admin is authoritative now; the verified
provider webhook belongs only to deferred FT-009. The conflict is actionable
for task execution and must be scoped or reconciled before FT-008 task execution
can be approved. No remediation was applied here.

### P1 — PRD retains unscoped current-sounding provider requirements

`.memory-bank/prd.md:96-99` correctly adds a current-profile qualifier, but the
same authoritative PRD later leaves FR-023..FR-026 provider/webhook/return
requirements unscoped (`:105-109`), repeats provider data ownership (`:144-147`),
provider integrations (`:180-190`), provider edge cases (`:197-201`), and
YooKassa/webhook acceptance (`:216-220`). The historical clarification also
still calls the ЮKassa webhook authoritative (`:244-247`).

The current requirements RTM correctly routes REQ-023..026 to future FT-009
(`.memory-bank/requirements.md:94-100`), but a reader following the PRD's
authoritative requirements/verification sections can still infer that FT-008
must implement them. This is a source-of-truth/documentation coverage defect,
not merely a roadmap label.

### P1 — Linked FT-007 data contract has stale metadata names

The active FT-007 data spec documents `delivery_method`, `payment_method`, and
`customer_comment` (`.memory-bank/domains/pending-order-inventory-data.md:16-25`),
while the active FT-008 data spec and current implementation use
`checkout_delivery_method`, `checkout_payment_method`, and
`checkout_customer_comment` (`.memory-bank/domains/order-lifecycle-admin-data.md:35-39,68`;
`apps/backend/src/checkout/pending-order.ts:326-330`). FT-008 task planning
includes the FT-007 data document among its normative inputs.

This leaves the Admin payment-method/metadata projection and its upstream
handoff with two competing field contracts. It must be reconciled before
TASK-054..057 implementation is safe.

### P2 — TASK-055 verification target points to a missing Markdown anchor

`.memory-bank/tasks/TASK-055.task.json:81-84` references
`.memory-bank/contracts/order-lifecycle-admin-api.md#guard-and-error-semantics`,
but the actual heading is `## Error And Guard Semantics` at line 70, whose slug
is `#error-and-guard-semantics`. The file exists, but the verification-target
fragment does not resolve. This is a broken traceability link in the current
task record.

## Passed checks

- `node scripts/mb-lint.mjs` passes for 144 files. An independent scan found no
  missing frontmatter, `description`, or `status` in `.memory-bank/**/*.md`.
- Markdown file links and anchors in the reviewed FT-008 graph resolve; the
  FT-008 feature, five SDD specs, `spec-index`, local routers, EP-003,
  requirements, plan, and protocol context are discoverable. The five FT-008
  SDD entries are registered at `spec-index.md:52-56`, and the feature declares
  `spec_design_status: complete`.
- EP-003 remains `planned`; RTM coverage is REQ-022 → FT-008 and REQ-028/029 →
  FT-008 (`requirements.md:96,102-103`). The plan maps those requirements to
  TASK-054..057 (`IMPL-FT-008.md:156-162`).
- TASK-054 is `ready` (W1/T2); TASK-055..057 are `planned` (W2/W3/T3) with the
  intended dependency chain. All four canonical packets are `ready`, their
  tiers match their records, and their source-task hashes match.
- FT-008 `plan.md` and `decision-log.md` consistently state the manual/Admin-only
  profile, reservation retention through native fulfillment, unpaid-only cancel,
  refund correction, and deferred FT-009.
- The FT-008 feature/spec/plan/requirements/EP-003/changelog navigation contains
  no direct Markdown links to `.tasks` operational artifacts; remaining
  `.tasks` mentions there are storage/procedure text. A global scan still finds
  direct evidence links in older unrelated FT-003/FT-005/FT-006/FT-007 feature
  and plan documents, so a project-wide absolute ban is not currently met.

## Environment note

`node scripts/mb-doctor.mjs --strict --json` reports one
`MB_LINT_FAILED` because its child `node` invocation fails with
`spawnSync C:\Program Files\nodejs\node.exe EPERM`. Direct `mb-lint` passes; the
doctor queue summary is 57 total, 53 done, 3 planned, 1 ready. This is a gate to
rerun before autonomous/batch execution and is separate from the normative
contradictions above.

VERDICT: REJECT
