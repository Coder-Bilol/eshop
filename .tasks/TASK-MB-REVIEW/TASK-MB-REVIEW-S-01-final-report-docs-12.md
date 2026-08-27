---
description: Post-remediation S-01 architecture review report for FT-008.
status: complete
task: TASK-MB-REVIEW
stage: S-01
artifact: final-report
kind: docs
---
# TASK-MB-REVIEW S-01 — FT-008 architecture review

Роль GENERAL

## Scope and mode

Выполнено read-only review post-remediation planning surface для FT-008:
`AGENTS.md`, Constitution, MBB/index, Memory Bank index, `spec-backbone.md`,
`spec-index.md`, EP-003/RTM, FT-008 feature hub и все пять linked SDD specs,
global system architecture, lifecycle и order/payment/inventory state, FT-007
runtime/state/feature handoffs, FT-009/FT-010 current boundaries,
`IMPL-FT-008`, `.protocols/FT-008/`, TASK-054..057 и canonical packets.

Дополнительно сверены установленный Medusa v2.16 native Admin/runtime bundle,
native payment/fulfillment/cancel/refund workflows и локальный PostgreSQL.
FT-008 implementation paths ещё не созданы, поэтому это approval/rejection
планирования, а не runtime closure. Task statuses, packets, specs, protocol
state и remediation не изменялись; записан только этот отчёт.

## Verdict summary

`REJECT`. Основные прежние два замечания действительно устранены в feature-local
surface: post-payment `-> canceled` удалён из логической state machine, а
поддержанный v2.16 Admin metadata/Mark-as-paid механизм назван конкретно.
Однако обнаружены blocking findings:

1. native Admin `Cancel` всё ещё позволяет отменить оплаченный, но ещё не
   fulfilled order; subscriber после события уже не может предотвратить native
   mutation;
2. глобальные MUST/boundary документы по-прежнему безусловно называют YooKassa
   webhook authoritative, что противоречит текущему manual/Admin-only profile;
3. contract заявляет actor/source binding для native Admin events, но план не
   определяет доказуемую передачу Admin actor context через asynchronous event
   boundary для fulfillment/completion/cancel;
4. canonical `TASK-055` packet stale, поэтому strict readiness gate не закрыт.

## C4 boundaries and ownership

Иерархия C4/SDD прослеживается: global system architecture → EP-003 → FT-008
feature → `IMPL-FT-008` → TASK-054..057. Основные ownership boundaries в
feature-local документах согласованы:

- FT-007 владеет pending-order creation, reservation, expiry и release unpaid
  orders;
- FT-008 владеет logical lifecycle projection и guarded Admin handoff;
- native Medusa Admin/modules владеют payment, order и fulfillment records;
- FT-009 — deferred optional YooKassa profile, FT-010 — committed-state email
  effects;
- custom Admin, Store lifecycle route, second ledger, direct stock mutation и
  Medusa Core modification запрещены.

Это согласуется с [FT-008 runtime](D:/projects/eshop/.memory-bank/architecture/order-lifecycle-admin-runtime.md:13)
и [FT-008 contract](D:/projects/eshop/.memory-bank/contracts/order-lifecycle-admin-api.md:13).
Но boundary surface нельзя считать закрытым из-за F-01 и F-02 ниже.

## Findings

### F-01 — P1: native Admin cancel bypasses the “unpaid only” lifecycle guard

Нормативный FT-008 state/contract корректно говорит, что cancel разрешён только
для unpaid pending order, а paid/processing/completed должны идти через native
refund: [state](D:/projects/eshop/.memory-bank/states/order-lifecycle-admin.md:36),
[contract](D:/projects/eshop/.memory-bank/contracts/order-lifecycle-admin-api.md:70),
[D-004](D:/projects/eshop/.protocols/FT-008/decision-log.md:43).

Фактическая installed native boundary этому не соответствует:

- `/admin/orders/:id/cancel` без дополнительного FT-008 guard вызывает
  `cancelOrderWorkflow` — [native route](<D:/projects/eshop/node_modules/@medusajs/medusa/dist/api/admin/orders/[id]/cancel/route.js:6>);
- core validation запрещает только completed order и order с active
  fulfillments; paid state сама по себе не запрещает cancel — [core workflow](D:/projects/eshop/node_modules/@medusajs/core-flows/dist/order/workflows/cancel-order.js:36);
- тот же workflow refunds captured payments, deletes reservations, emits
  `order.canceled` и cancels native order — [core workflow](D:/projects/eshop/node_modules/@medusajs/core-flows/dist/order/workflows/cancel-order.js:52);
- built-in Order Detail показывает Cancel action и отключает его только при
  `canceled_at`, без payment/logical-state guard — [compiled Admin bundle](D:/projects/eshop/apps/backend/.medusa/server/public/admin/assets/order-detail-B4624AIP-DztFU34j.js:2).

Следовательно, для оплаченного, но ещё не fulfilled заказа официальный Admin
оператор может получить native `status: canceled`, refund и release reservation.
FT-008 subscriber, срабатывающий после native event, может лишь обнаружить
конфликт; он не предотвращает уже совершённую mutation. Это нарушает требование
«no post-payment canceled transition» и одновременно ломает заявленную
reservation boundary. В текущем плане нет pre-operation state guard внутри
native Admin boundary, а custom Admin и Medusa Core changes запрещены Конституцией.
F-01 блокирует approval до отдельного совместимого решения.

### F-02 — P1: unscoped provider-authority contradiction

Текущий manual profile последовательно описан в [requirements](D:/projects/eshop/.memory-bank/requirements.md:49),
[global lifecycle state](D:/projects/eshop/.memory-bank/states/order-payment-inventory.md:20)
и [system architecture](D:/projects/eshop/.memory-bank/architecture/system-architecture.md:26):
только authenticated native Admin подтверждает payment; используется один
unpaid `pp_system_default`; YooKassa/webhook deferred to FT-009.

Но authoritative inputs, которые входят в FT-008 task packets, всё ещё содержат
противоположные безусловные правила:

- [global invariant](D:/projects/eshop/.memory-bank/invariants.md:12) требует
  считать YooKassa webhook authoritative;
- [boundary map](D:/projects/eshop/.memory-bank/contracts/boundary-map.md:17)
  описывает YooKassa payment creation/return/webhook как текущую payment
  boundary и называет webhook source of truth;
- [PRD clarification](D:/projects/eshop/.memory-bank/prd.md:238) оставляет
  YooKassa webhook authoritative без current-profile scope.

При этом `TASK-055` и `IMPL-FT-008` одновременно включают `invariants.md` в
normative inputs и запрещают YooKassa HTTP/webhook. `spec-backbone.md` фиксирует
deferred provider, но не задаёт явного supersession/precedence для этих MUST.
Это не только stale wording: агент, исполняющий T3 payment/lifecycle task,
получает несовместимые authoritative instructions. F-02 является
Constitution/MBB contradiction и блокирует безопасный task handoff.

### F-03 — P1: actor/source binding is not closed across native events

Feature contract правильно запрещает public `source`/`caller` и требует fixed
private entrypoints: [contract](D:/projects/eshop/.memory-bank/contracts/order-lifecycle-admin-api.md:19),
[runtime](D:/projects/eshop/.memory-bank/architecture/order-lifecycle-admin-runtime.md:46).
Native Admin routes действительно защищены Admin policies, а mark-as-paid
передаёт `req.auth_context.actor_id` как `captured_by` — [route](<D:/projects/eshop/node_modules/@medusajs/medusa/dist/api/admin/payment-collections/[id]/mark-as-paid/route.js:6>).

Но installed event mechanism передаёт subscriber только явно заданные `data` и
`metadata`, не исходный HTTP `auth_context` — [emit-event contract](D:/projects/eshop/node_modules/@medusajs/core-flows/dist/common/steps/emit-event.d.ts:5)
и [implementation](D:/projects/eshop/node_modules/@medusajs/core-flows/dist/common/steps/emit-event.js:40).
В частности:

- `order.canceled` содержит только order id — [cancel workflow](D:/projects/eshop/node_modules/@medusajs/core-flows/dist/order/workflows/cancel-order.js:107);
- `order.completed` содержит только order ids — [complete workflow](D:/projects/eshop/node_modules/@medusajs/core-flows/dist/order/workflows/complete-orders.js:34);
- `order.fulfillment_created` содержит order/fulfillment ids — [fulfillment workflow](D:/projects/eshop/node_modules/@medusajs/core-flows/dist/order/workflows/create-fulfillment.js:353);
- native fulfillment и complete routes не inject actor из `req.auth_context` —
  [fulfillment route](<D:/projects/eshop/node_modules/@medusajs/medusa/dist/api/admin/orders/[id]/fulfillments/route.js:6>)
  и [complete route](<D:/projects/eshop/node_modules/@medusajs/medusa/dist/api/admin/orders/[id]/complete/route.js:6>).

Поэтому “native event” ещё не является доказуемым “authenticated Admin event”
для asynchronous subscriber. План не указывает supported durable binding или
проверяемый actor/audit lookup для всех пяти events. Для payment/order/inventory
границы это unverifiable security contract, а не косметическая недостача.

## Decision/ADR coverage

Отсутствие отдельного FT-008 ADR само по себе не дефект: [spec-backbone policy](D:/projects/eshop/.memory-bank/spec-backbone.md:65)
и [ADR template](D:/projects/eshop/.memory-bank/adrs/ADR-000-template.md:18)
разрешают authoritative SDD specs как decision records, оставляя ADR для
cross-spec precedence/supersession. `D-001`..`D-006` в
`.protocols/FT-008/decision-log.md` покрывают lifecycle, reservation, Admin
mechanism, cancellation и refund. Форма coverage — PASS; однако D-004 не
разрешает фактический native cancel behavior из F-01, а provider supersession из
F-02 нигде не оформлен.

## Native payment and reservation checks

Совместимость positive-path подтверждена: installed `@medusajs/payment` is
v2.16.0, provider loader registers system provider as `pp_system_default`, native
`markPaymentCollectionAsPaid` defaults to that provider, а local DB показывает
`pp_system_default` enabled. Current DB содержит zero payment collections,
что ожидаемо до реализации TASK-055 и не является runtime proof.

Reservation design также корректен для intended path: payment оставляет native
reservation, а supported fulfillment reads reservations, adjusts inventory и
deletes/updates consumed items — [FT-008 reservation boundary](D:/projects/eshop/.memory-bank/architecture/order-lifecycle-admin-runtime.md:57)
и [installed fulfillment workflow](D:/projects/eshop/node_modules/@medusajs/core-flows/dist/order/workflows/create-fulfillment.js:310).
Именно поэтому native paid-cancel из F-01 является blocking contradiction, а не
допустимым альтернативным terminal path.

## Queue and gate evidence

- RTM в `IMPL-FT-008` исправлен: REQ-022 → TASK-054/055/057, REQ-028 и
  REQ-029 → TASK-056/057.
- Статусная цепочка остаётся `TASK-053 done → TASK-054 ready → TASK-055..057
  planned`; premature promotion не обнаружено.
- Все четыре packets имеют `status: ready`, но `TASK-055.packet.json` stale:
  packet содержит `sha256:3b4872…`, текущий task record — `sha256:126a19…`.
  `node scripts/mb-doctor.mjs --strict --json` сообщил `TASK_PACKET_STALE`.
- `node scripts/mb-lint.mjs` — PASS, 144 files. Strict doctor завершился FAIL:
  кроме stale packet, его nested lint subprocess получил environment
  `spawnSync C:\Program Files\nodejs\node.exe EPERM`. Это отдельное readiness
  limitation; никакой packet refresh или remediation в review не выполнялся.

## Disposition

До следующего architecture/task-queue gate необходимо устранить F-01–F-03 и
обновить stale TASK-055 packet с повторной проверкой strict doctor. Текущие
документы не дают безопасного основания запускать полный FT-008 chain или
считать “no post-payment canceled transition” доказанным. Review завершён без
изменения task statuses и без применения remediation.

VERDICT: REJECT
