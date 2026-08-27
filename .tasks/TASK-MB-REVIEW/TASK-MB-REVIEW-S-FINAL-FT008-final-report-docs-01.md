---
description: Aggregated fresh-context review of FT-008 Order Lifecycle And Admin Visibility.
status: complete
---
# TASK-MB-REVIEW — FT-008 итоговый отчёт

## Scope

Read-only review planned feature `FT-008 Order Lifecycle And Admin Visibility`:
feature hub, architecture/contract/data/state specs, FT-007 boundary, RTM,
implementation plan, TASK-054..TASK-057 records and packets, tier policy, and
MBB routing. FT-008 implementation code ещё не существует, поэтому S-06 Code
Quality не применялся.

Изменения product/spec/task статусов и implementation code не выполнялись.
Обновлены только operational review artifacts: `REQUEST.md` и stage/aggregate
reports в `.tasks/TASK-MB-REVIEW/`.

## Stage verdicts

| Stage | Reviewer | Verdict | Ключевой результат |
|---|---|---|---|
| S-01 | Architecture | REJECT | Противоречие lifecycle state и неподтверждённый native Admin metadata path. |
| S-02 | Scope/RTM | APPROVE | Traceability есть; найден малый drift в coverage table IMPL-FT-008. |
| S-03 | Plan/tasks | REJECT | Reviewer увидел EPERM и `TASK-057 ready_with_gaps`; прямой doctor позже прошёл. |
| S-04 | Security | REJECT | Не формализованы Admin authorization и binding доверенного event source. |
| S-05 | MBB compliance | REJECT | `.tasks` leakage в durable Memory Bank и packet gap hygiene. |
| S-06 | Code quality | N/A | FT-008 code surface отсутствует. |

Fresh reports:

- [S-01](TASK-MB-REVIEW-S-01-final-report-docs-07.md)
- [S-02](TASK-MB-REVIEW-S-02-final-report-docs-08.md)
- [S-03](TASK-MB-REVIEW-S-03-final-report-docs-08.md)
- [S-04](TASK-MB-REVIEW-S-04-final-report-docs-08.md)
- [S-05](TASK-MB-REVIEW-S-05-final-report-docs-08.md)

## Direct gate evidence

- `node scripts/mb-lint.mjs` — PASS, 144 files.
- `node scripts/mb-doctor.mjs --strict` — PASS, 0 errors, 0 warnings, 2 info.
- `TASK-054..057` присутствуют в `.memory-bank/tasks/index.json`; source task
  hashes совпадают с packet hashes.
- Dependency chain корректна: `TASK-053 -> TASK-054 -> TASK-055 -> TASK-056 ->
  TASK-057`; only `TASK-054` is currently `ready`.
- Direct gate rerun supersedes child-reviewer `node.exe EPERM` observations as
  current project status. Those observations remain environment execution
  hygiene, not a Memory Bank finding.

## Blocking findings

### P1 — FT-008 lifecycle conflicts with the global lifecycle contract

Evidence:

- FT-008 permits `paid|processing|completed -> canceled` in
  `.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md:56-58`
  and `.memory-bank/states/order-lifecycle-admin.md:16-19`.
- The global model in `.memory-bank/states/order-payment-inventory.md:36-45`
  defines post-payment paths to `refunded`, but not to `canceled`.
- FT-008 contract separately says captured payment cannot be canceled by a
  metadata-only update in `.memory-bank/contracts/order-lifecycle-admin-api.md:66-70`.

Impact: implementation cannot determine whether operator cancellation after
payment is a supported native transition, a refund-required path, or a
feature-local projection. This affects order state, payment/accounting meaning,
reservation behavior, and Admin visibility.

Required fix: choose one authoritative transition model. If post-payment
cancellation remains, extend the global state contract and specify the native
Medusa workflow, payment/refund semantics, reservation behavior, and audit
meaning. Otherwise remove those transitions from FT-008 and cover cancellation
through the confirmed refund/native operator path.

### P1 — caller authorization and event-source binding are declarative

Evidence:

- The internal workflow accepts `order_id`, `event`, and a string `source` in
  `.memory-bank/contracts/order-lifecycle-admin-api.md:15-39`.
- The contract assumes the caller is already authenticated, but does not define
  a technical caller-context binding or required permission for
  `source: medusa_admin`; see also `:83-90`.
- Runtime ownership is described in
  `.memory-bank/architecture/order-lifecycle-admin-runtime.md:22-24`.

Impact: a wrongly wired internal caller could request `payment_succeeded` or
`payment_refunded` by supplying a source string. This is an OWASP Broken Access
Control/trust-boundary risk, even though public Store mutation routes are
correctly excluded.

Required fix: bind source to an authenticated server-side caller context:

- `medusa_admin` — authenticated Admin session and required operator
  permission;
- `yookassa_webhook` — only FT-009 verified/authenticated handoff;
- `pending_order_expiry` — only FT-007 expiry workflow.

Define unauthorized/forged-source tests, cross-order protection, and the audit
actor/event requirements for operator cancellation/refund actions. Do not make
`order_id + source` alone a callable authority.

### P1 — native Admin visibility mechanism is not specified enough

Evidence:

- FT-008 requires arbitrary logical/payment metadata in built-in Admin in
  `.memory-bank/contracts/order-lifecycle-admin-api.md:76-81` and
  `.memory-bank/domains/order-lifecycle-admin-data.md:55-70`.
- The runtime forbids a custom Admin replacement/UI in
  `.memory-bank/architecture/order-lifecycle-admin-runtime.md:61-70` and the
  global architecture guardrail.

Impact: the plan assumes that `checkout_state` and
`checkout_payment_method` will be visible in native order detail, but does not
identify a supported native projection/read mechanism. This is a required
acceptance premise, not an implementation detail that can be guessed later.

Required fix: name the supported Medusa Admin/native order-detail mechanism and
prove it with a synthetic acceptance fixture. If native Admin cannot expose the
required fields, revise the requirement or explicitly approve the smallest
allowed Admin extension before task execution.

## Non-blocking but required cleanup

### P2 — RTM coverage table overclaims TASK-054 for REQ-028

`.memory-bank/tasks/plans/IMPL-FT-008.md:140-144` maps REQ-028 to TASK-054,
although TASK-054 is the T2 lifecycle model/guard task and has only
`reqs: ["REQ-022"]`. Admin visibility starts in TASK-056/TASK-057.

Fix the table during the next docs sync, preferably removing TASK-054 from
REQ-028 coverage. Keep REQ-028/029 `planned` until the relevant T3 tasks and
feature-level semantic review close.

### P2 — TASK-057 `ready_with_gaps` has no explicit gap explanation

`.memory-bank/packets/TASK-057.packet.json:7` has `status:
ready_with_gaps`, while the packet has no field explaining the bounded,
non-blocking gap. Tier policy allows `ready_with_gaps` only for bounded
non-blocking gaps, and the direct strict doctor currently accepts the packet.

Before T3 execution, repair/refresh the packet or add an explicit traceable
reason and owner for the gap. Do not silently treat an unexplained T3 packet as
fully ready.

### P2 — existing `.tasks` leakage violates the review's MBB boundary

There are 35 Memory Bank markdown files containing `.tasks/` references. Examples
include:

- `.memory-bank/epics/EP-003-checkout-order-inventory.md:45-51`;
- `.memory-bank/features/FT-005-authenticated-wishlist.md:62`;
- `.memory-bank/requirements.md:106-123`;
- `.memory-bank/changelog.md:291-306`;
- `.memory-bank/bugs/*` historical evidence references;
- command/workflow docs that describe operational evidence paths.

The FT-008 linked design docs themselves do not contain `.tasks/` references,
but the review command explicitly requires no `.tasks` leakage across
`.memory-bank/**`. Move historical evidence navigation to operational
artifacts or replace durable docs' links with stable task/protocol references
allowed by the MBB policy. Re-run MBB review after cleanup.

## Correctly scoped exclusions

- VPS root-password policy is an unrelated deployment blocker and is not counted
  as an FT-008 security finding.
- No FT-008 code-quality verdict is emitted because no FT-008 implementation
  files exist yet.
- FT-007 expiry/release ownership, FT-009 provider authenticity/idempotency
  ownership, and FT-010 email side-effect ownership are otherwise routed
  consistently; the issue is the missing enforceable caller/source contract at
  the FT-008 boundary.

## Decision

The FT-008 task queue is not approved for execution. Fix the three P1 design and
security blockers, document/repair TASK-057 packet readiness, correct the RTM
coverage drift, and clean the MBB `.tasks` leakage. Then repeat `/review FT-008`
and require every mandatory stage to return `APPROVE`.

VERDICT: REJECT
