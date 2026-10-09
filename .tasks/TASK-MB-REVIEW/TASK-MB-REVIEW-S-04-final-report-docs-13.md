---
description: Current-context S-04 security review report for FT-008.
status: complete
task: TASK-MB-REVIEW
stage: S-04
artifact: final-report
kind: docs
---
# TASK-MB-REVIEW S-04 — FT-008 Security

Роль GENERAL

## Scope and execution

Проверены Constitution, invariants, system/runtime architecture, FT-008
contract/state/data specs, FT-007 reservation boundary, task constraints и
installed Medusa v2.16 Admin/workflow boundaries. Fresh runner не завершился в
локальный лимит; security review выполнен read-only по canonical checklist.

## Verdict

`REJECT`.

## Passed security controls

- В FT-008 нет Store lifecycle mutation route; browser/client не должны
  передавать `source`, actor, payment state или target metadata.
- Current profile не вызывает external provider; provider credentials/webhook
  secrets и production data запрещены task scope.
- Native order/payment/fulfillment records остаются источниками истины,
  metadata merge должен сохранять FT-007 keys, а evidence должна быть
  synthetic/privacy-safe.
- Native Admin session/RBAC корректно выбран как intended authorization boundary
  для originating operation.

## Blocking findings

### F-01 — P1: authenticated Admin can perform an unsafe paid-order cancel

Установленный route
`node_modules/@medusajs/medusa/dist/api/admin/orders/[id]/cancel/route.js:6-15`
запускает native `cancelOrderWorkflow`. Core validation в
`node_modules/@medusajs/core-flows/dist/order/workflows/cancel-order.js:36-49`
не проверяет payment state; workflow refund captured payments, deletes
reservations и cancels order (`:52-55`, `:107-145`).

Это не только lifecycle mismatch. Для paid-but-unfulfilled order штатная Admin
операция может вызвать refund/release до того, как FT-008 subscriber увидит
event. В результате нарушаются payment correctness, inventory hold и
no-post-payment-cancel invariants. Post-event rejection не является
compensation, а по task scope нельзя молча добавлять custom Admin или менять
Medusa Core.

Нужна явная pre-operation authorization/guard boundary либо пересмотр
нормативной модели с соответствующей payment/inventory semantics и acceptance.

### F-02 — P1: asynchronous event is not proof of Admin authentication

FT-008 contract полагается на fixed private entrypoints и `caller:
"native_admin_event"`, но установленный `emitEventStep` сохраняет только
переданные `data`/`metadata` и не переносит request auth context:
`node_modules/@medusajs/core-flows/dist/common/steps/emit-event.d.ts:15-26` и
`emit-event.js:40-63`. Native cancel/complete/fulfillment events carry IDs,
not a durable Admin actor proof.

Следовательно, subscriber не может по одному event name/ID доказать, что
операцию выполнил именно authenticated Admin/RBAC actor, а не другой internal
caller или forged/replayed event. Нужна supported actor/operation binding,
audit lookup с fail-closed semantics и cross-order tests для всех event paths.

## Disposition

PII/secrets/public-route controls спроектированы правильно, но payment/order/
inventory boundary не закрыта enforceable authorization и безопасным cancel
behavior. До этого T3 implementation нельзя считать security-approved.

VERDICT: REJECT
