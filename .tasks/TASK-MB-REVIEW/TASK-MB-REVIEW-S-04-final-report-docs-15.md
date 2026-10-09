---
description: FT-008 security review report.
status: complete
task_id: TASK-MB-REVIEW
stage_id: S-04
feature: FT-008
review_mode: read-only manual consolidation
---
# S-04 Security Review — FT-008

## Scope and method

Проверены Constitution principles V–VII/VIII, global security constraints,
FT-008 runtime/contract/data/state specs, FT-007 handoff, task plans/packets и
наличие заявленного implementation surface. FT-008 implementation files пока
отсутствуют (TASK-054 — первая implementation task). Fresh Codex reviewers
стартовали, но не завершились из-за model/timeout; ниже — воспроизводимая
read-only проверка тех же входов.

## Positive controls

- Storefront, customer and return-page authority explicitly cannot mark payment
  or mutate lifecycle; FT-009 provider/webhook is deferred.
- Design requires an allow-list of server-internal native events, authoritative
  re-read, same-order payment binding, atomic guard, no mutation on rejected
  events, synthetic/privacy-safe evidence, and native Admin auth/RBAC as the
  upstream operation boundary.
- Native mark-as-paid is required to preserve reservations; native fulfillment
  owns consumption; FT-008 forbids direct stock mutation, custom order store and
  provider secrets.

## Blocking findings

### P1 — Cancellation-origin refund can violate terminal-state integrity

The security/state contract says paid cancellation can cause native captured-
payment refund but the logical order must remain `canceled`; the same contract
maps a confirmed `payment_refunded` event to `refunded`. The internal event input
does not carry refund origin/correlation, and no explicit precedence rule says
that `order.status: canceled` dominates a cancellation-origin refund. A
subscriber implementation could therefore turn a canceled paid order into
`refunded`, allowing lifecycle metadata to disagree with the native cancellation
and late-event guards. This is a payment/order integrity issue, not merely a
missing test. Define and test the origin/precedence guard before TASK-055.

### P1 — Native metadata editor is an unguarded alternate lifecycle write path

The supported Admin surface includes `/orders/:id/metadata/edit` and renders
`checkout_state`, while the invariant says only the native mark-as-paid action
may produce `paid` and the projector should own lifecycle metadata. No
permission, protected-key, namespace, or reconciliation rule prevents an
authorized Admin metadata edit from writing `checkout_state: paid`,
`canceled`, or another terminal value without the corresponding native
operation. This defeats the stated authority boundary and can make security
negative-path claims false. The design must either protect/ignore lifecycle
keys on metadata edit or narrow the accepted Admin surface and prove it.

### P2 — Admin authorization assumption needs an executable matrix

Docs defer authorization to installed native Admin session/RBAC but do not name
the role/permission/store-scope fixture used by acceptance. TASK-055/TASK-057 do
require unauthorized-Admin denial evidence, so this is a testability gap rather
than a separate blocker if the metadata and refund authority issues are fixed.

## Required fixes before approval

1. Specify cancellation-origin refund correlation/precedence and terminal-state
   no-mutation behavior.
2. Specify the protected lifecycle metadata boundary for native Admin metadata
   editing and add a denial/reconciliation test.
3. Add a concrete native Admin role/permission matrix to the T3 acceptance
   fixture and retain sanitized before/after evidence.

## Disposition

The documents contain a strong intended security posture, but the alternate
metadata write path and cancellation/refund ambiguity leave payment/order
authority non-deterministic. Constitution principles on payment correctness,
security/privacy and evidence therefore prevent approval at the current design
state.

VERDICT: REJECT
