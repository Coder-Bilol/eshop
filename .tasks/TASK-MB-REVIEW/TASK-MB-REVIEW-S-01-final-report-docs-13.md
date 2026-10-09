---
description: Current-context S-01 architecture review report for FT-008.
status: complete
task: TASK-MB-REVIEW
stage: S-01
artifact: final-report
kind: docs
---
# TASK-MB-REVIEW S-01 — FT-008 architecture review

Роль GENERAL

## Scope and execution

Проверены Constitution/MBB, `spec-backbone`, `spec-index`, C4/system
architecture, EP-003, FT-008 feature hub, все пять FT-008 SDD specs,
глобальные order/payment/inventory state rules, FT-007/FT-009 handoffs,
`IMPL-FT-008`, `.protocols/FT-008/`, TASK-054..057 и canonical packets.

Fresh Codex runner для этого stage был запущен, но не завершился за локальный
лимит 6 минут; итоговая проверка выполнена read-only в текущем контексте по
тому же canonical checklist. Implementation, task status, specs и protocols
не изменялись; записаны только review artifacts.

## Verdict summary

`REJECT`.

Иерархия C4 и feature-local SDD в целом согласованы, а прежние provider-profile
и metadata-path замечания в FT-008 surface исправлены. Но остаются два P1
противоречия, которые нельзя безопасно оставить до TASK-055.

## Passed checks

- C4/ownership chain прослеживается: system architecture → EP-003 → FT-008 →
  runtime/contract/data/state specs → implementation plan → tasks.
- FT-007 владеет pending-order creation, reservation, expiry/release; FT-008 —
  logical Admin lifecycle projection; FT-009 — deferred provider profile;
  FT-010 — notifications.
- Текущий payment profile однозначно описан как manual/offline: native Admin
  marks one unpaid `pp_system_default` collection as paid; Store/provider
  mutation is out of scope.
- Feature-local state machine удаляет post-payment `-> canceled`, а refund
  вынесен в native Admin path. Native metadata mechanism назван конкретно.
- Отдельный ADR не требуется: `spec-backbone` разрешает authoritative SDD и
  decision log как decision records; `.protocols/FT-008/decision-log.md`
  содержит решения D-001..D-006.

## Findings

### F-01 — P1: native Admin cancel bypasses the FT-008 unpaid-only guard

FT-008 state/contract требуют, чтобы cancellation применялся только к unpaid
pending order, а post-payment correction шла через refund:
`.memory-bank/states/order-lifecycle-admin.md:36-45` и
`.memory-bank/contracts/order-lifecycle-admin-api.md:70-83`.

Установленная Medusa v2.16 native boundary этому не соответствует:

- `node_modules/@medusajs/medusa/dist/api/admin/orders/[id]/cancel/route.js:6-15`
  напрямую запускает `cancelOrderWorkflow` с `req.params.id`;
- `node_modules/@medusajs/core-flows/dist/order/workflows/cancel-order.js:36-49`
  запрещает только уже cancelled/completed order и активные fulfillments, но
  не запрещает paid order;
- тот же workflow описывает refund captured payments и удаление reservations
  (`:52-55`, `:107-145`), после чего native order становится canceled;
- FT-008 subscriber, вызываемый после `order.canceled`, уже не может отменить
  эту native mutation.

Следствие: оплаченный, но ещё не fulfilled заказ может через штатный Admin
получить `native status: canceled`, refund и release reservation, хотя FT-008
прямо запрещает этот переход и требует сохранять hold до fulfillment. Guard
только внутри post-event logical workflow не является защитой boundary.

До execution нужно выбрать совместимое решение: доказать существующий
pre-operation unpaid-only guard, добавить поддержанный pre-operation boundary,
либо изменить нормативную lifecycle/reservation модель и её acceptance. Custom
Admin replacement и Medusa Core modification сейчас запрещены, поэтому
implementation не может безопасно угадывать решение.

### F-02 — P1: Admin actor provenance is not closed across the event bus

Contract/runtime говорят о fixed private entrypoints и native Admin
authentication: `.memory-bank/contracts/order-lifecycle-admin-api.md:39-49,93-100`
и `.memory-bank/architecture/order-lifecycle-admin-runtime.md:46-55`.
Однако установленный event boundary передаёт subscriber только event `data` и
optional `metadata`, а не исходный HTTP `req.auth_context`:
`node_modules/@medusajs/core-flows/dist/common/steps/emit-event.d.ts:15-26` и
`emit-event.js:40-63`.

В native workflows для cancel/complete/fulfillment payload содержит order или
fulfillment IDs, но не Admin actor proof; например
`cancel-order.js:107-112` и `complete-orders.js:34-42`. Native complete и
fulfillment Admin routes также запускают workflow без передачи actor context.

Поэтому `caller: "native_admin_event"` и private function сами по себе не
доказывают, что asynchronous event был порождён authenticated Admin/RBAC
операцией. Нужна поддержанная durable binding/operation-audit lookup или
другая server-side boundary, а также тесты forged/replayed/cross-order event.
Иначе subscriber может принять идентичный внутренний event без доказуемого
Admin authority.

## Disposition

RTM, packets и прямые gates не устраняют эти boundary defects. До их решения
TASK-055 нельзя считать безопасно реализуемым, потому что ошибка затронет
native order status, payment/refund accounting, reservations и audit authority.

VERDICT: REJECT
