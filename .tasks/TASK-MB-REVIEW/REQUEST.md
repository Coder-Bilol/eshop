# TASK-MB-REVIEW Request

## Scope

Scoped fresh-context review of the planned `FT-008 Order Lifecycle And Admin
Visibility` surface before execution of `TASK-054`. Review the FT-008 feature
hub, linked architecture/contract/data/state specs, REQ-022/REQ-028/REQ-029 RTM
coverage, `IMPL-FT-008`, TASK-054..TASK-057 JSON records, canonical packets,
protocol context, and relevant FT-007/FT-009 handoffs. Review surrounding
Memory Bank governance and queue rules only insofar as they affect FT-008
readiness, correctness, traceability, or safe execution.

Existing reports in this folder are historical and are not stage verdicts for
this run. This run uses the `-12` report set after the FT-008 remediation.

## Mode

- Fresh-context stages S-01 through S-05.
- FT-008 planning/readiness review; no implementation, remediation,
  synchronization, or task-status mutation is authorized during review.
- S-06 is omitted because FT-008 implementation code does not yet exist;
  TASK-054 is the first implementation task.

## Inputs

- `AGENTS.md`, `.memory-bank/constitution.md`, `.memory-bank/mbb/index.md`,
  `.memory-bank/index.md`, `.memory-bank/spec-backbone.md`, and
  `.memory-bank/spec-index.md`.
- FT-008 feature, architecture, API, data, and lifecycle-state specs, plus
  shared order/payment/inventory, boundary, invariant, testing, and tier docs.
- `.memory-bank/requirements.md`, EP-003, and
  `.memory-bank/tasks/plans/IMPL-FT-008.md`.
- TASK-054..TASK-057 records, packets, dependency/wave metadata, and
  `.protocols/FT-008/` context.
- Current `node scripts/mb-doctor.mjs --strict` and relevant lint/readiness
  evidence.

## Blocking concerns

- Constitution, architecture, security, privacy, lifecycle, or public-contract
  contradiction affecting FT-008.
- RTM drift for REQ-022/REQ-028/REQ-029 or broken FT-007 -> FT-008 -> FT-009
  ownership and handoff boundaries.
- Missing/conflicting SDD links, malformed or stale required packets, unsafe
  dependency/wave/status metadata, or a task queue that cannot be safely
  started at TASK-054.
- Missing guards for expiry/late payment, payment/order disagreement,
  reservation preservation/consumption, duplicate events, or native Admin
  field projection.
- Open P0/P1 issue, privacy/security gap, or unresolved task blocker that
  invalidates safe execution.

## Remediation focus

- Current FT-008 payment is personal/offline: the storefront calculates and
  records the price/request; native Admin is the only payment and status
  authority, using one unpaid native system collection (`pp_system_default`).
- Unpaid native Admin cancellation persists the order as `canceled`, removes it
  from the active customer cart, and rejects late payment. Paid/processing/
  completed orders use native Admin refund rather than post-payment cancel.
- Source/actor/order binding is server-side and fixed to authenticated native
  Admin events; no Store-supplied `source`/`caller` is trusted.
- The installed Medusa dashboard mechanism is explicit: order `metadata` is in
  `DEFAULT_FIELDS`, `showMetadata`/`showJSON` and metadata edit are available,
  and native `paymentCollection.markAsPaid(...)` / `order.cancel(...)` are the
  operator actions.
- RTM plan coverage is `TASK-054/055/057 -> REQ-022` and
  `TASK-056/057 -> REQ-028/REQ-029`; all FT-008 packets are `ready` with fresh
  hashes, including TASK-057.

## Expected result

Each stage writes a fresh report to:

- `.tasks/TASK-MB-REVIEW/TASK-MB-REVIEW-S-01-final-report-docs-12.md`
- `.tasks/TASK-MB-REVIEW/TASK-MB-REVIEW-S-02-final-report-docs-12.md`
- `.tasks/TASK-MB-REVIEW/TASK-MB-REVIEW-S-03-final-report-docs-12.md`
- `.tasks/TASK-MB-REVIEW/TASK-MB-REVIEW-S-04-final-report-docs-12.md`
- `.tasks/TASK-MB-REVIEW/TASK-MB-REVIEW-S-05-final-report-docs-12.md`

Each report must end with exact `VERDICT: APPROVE` or `VERDICT: REJECT`.
A single blocking `REJECT` requires a fix list and repeated review after
remediation. This run itself must not apply remediation.
