---
description: Fresh-context S-04 security review of the current FT-008 planning surface.
status: complete
task: TASK-MB-REVIEW
stage: S-04
feature: FT-008
artifact: final-report
kind: docs
---
# S-04 Security Review — FT-008

## Verdict

`REJECT`. Исторические P1 из report set `-15` про cancellation-origin refund
precedence и прямое изменение `checkout_state` закрыты в текущих specs/tasks,
но fresh review выявил два других blocking integrity gap на поддерживаемой
native Admin поверхности.

Review выполнен read-only как design/readiness gate до TASK-054. Отсутствие
FT-008 implementation само по себе не считалось finding: runtime enforcement и
negative evidence уже назначены TASK-055..TASK-057. Durable docs, task records,
packets и код не изменялись.

## Findings

### HIGH — частичный native refund ошибочно допускает terminal `refunded`

- Evidence: `.memory-bank/contracts/order-lifecycle-admin-api.md:92-97`,
  `.memory-bank/states/order-lifecycle-admin.md:36`,
  `.memory-bank/states/order-lifecycle-admin.md:70-78`,
  `.memory-bank/tasks/TASK-055.task.json:39-41`. Текущий contract требует лишь
  «confirmed native refund» для перехода non-canceled
  `paid|processing|completed -> refunded`, не требует полного возврата и не
  определяет cumulative-refund guard. Установленный native Admin API принимает
  optional refund amount (`node_modules/@medusajs/medusa/dist/api/admin/payments/validators.js:37-40`),
  а workflow разрешает любой amount, не превышающий оставшийся captured amount,
  и всё равно публикует `PaymentEvents.REFUNDED`
  (`node_modules/@medusajs/core-flows/dist/payment/workflows/refund-payment.js:20-33`,
  `72-74`, `99-105`, `145`).
- Impact: первый partial refund может завершить logical lifecycle как
  `refunded`, хотя часть captured payment остаётся невозвращённой. Это создаёт
  payment/order disagreement, делает последующие partial refunds terminal-state
  конфликтами и нарушает Constitution VII payment correctness.
- Fix: определить authoritative full-refund predicate по повторно прочитанным
  native captures/refunds (с native currency precision). Partial refund должен
  сохранять текущий logical order state и оставаться видимым только в native
  payment evidence; `checkout_state: refunded` разрешать лишь при полном
  cumulative refund. Добавить TASK-055/057 acceptance для одного partial,
  нескольких cumulative partial, финального full refund, duplicate/out-of-order
  delivery и cancellation-origin refund.

### HIGH — generic Admin metadata guard защищает только `checkout_state`, но оставляет изменяемыми другие workflow-control keys

- Evidence: `.memory-bank/contracts/order-lifecycle-admin-api.md:185-188`,
  `.memory-bank/domains/order-lifecycle-admin-data.md:53-57`,
  `.memory-bank/domains/order-lifecycle-admin-data.md:91-97`,
  `.memory-bank/tasks/TASK-055.task.json:43`, `98`. Эти места требуют защиты
  только `checkout_state` и называют остальные изменения «unrelated». Однако
  FT-007 принимает решения по `pending_payment_expires_at` и
  `checkout_expiry_cleanup` (`apps/backend/src/checkout/pending-order.ts:408-448`),
  а order replay связан с `checkout_idempotency_key`
  (`apps/backend/src/checkout/pending-order.ts:323-326`). Текущий FT-008 handoff
  дополнительно делает `checkout_expiry_origin` и cleanup state источником
  precedence/recovery (`.memory-bank/contracts/order-lifecycle-admin-api.md:79-83`,
  `.memory-bank/tasks/TASK-055.task.json:36`, `97`).
- Impact: Admin с обычным native order-update permission может через metadata
  editor/direct API удалить или подменить expiry origin/deadline/cleanup либо
  idempotency binding, не выполняя guarded lifecycle workflow. Это позволяет
  сфальсифицировать expiry precedence, скрыть/инициировать cleanup, изменить
  timeout или разрушить terminal replay binding; защита одного
  `checkout_state` не сохраняет reservation/payment integrity.
- Fix: на server-side generic order-metadata update boundary задать явный набор
  workflow-owned immutable keys (минимум `checkout_state`,
  `pending_payment_expires_at`, `checkout_idempotency_key`,
  `checkout_request_fingerprint`, `checkout_cart_id` и
  `checkout_expiry_origin|reason|cleanup`) и reject/preserve их изменение и
  удаление, сохраняя только действительно operator-editable metadata. Расширить
  TASK-055/056/057 negative tests на built-in editor и direct Admin API для
  каждого control key, включая unchanged submission и одновременное разрешённое
  изменение unrelated metadata.

## Revalidated controls without a new finding

- Native Admin auth/RBAC остаётся upstream authorization boundary; projector не
  фабрикует actor identity из event bus. Store/customer/unauthenticated и
  unauthorized-Admin deny paths назначены T3 acceptance.
- FT-008 не добавляет Store lifecycle route; order/payment/fulfillment bindings
  перечитываются server-side, event kind берётся из explicit internal allow-list,
  cross-order/unknown/forged input должен fail closed.
- Canonical `order-lifecycle:${order_id}` lock охватывает precondition и полный
  native handler, projector повторно берёт тот же lock. Невозможность такого
  wrapper является явным TASK-055 stop condition.
- Cancellation-origin refund precedence теперь детерминирована: native canceled
  order остаётся logical `canceled`, FT-007-origin cancellation сохраняет
  `expired` и cleanup ownership.
- Payment confirmation сохраняет reservation до native fulfillment; native
  cancellation владеет refund/cleanup, standalone refund не auto-restock.
- Evidence ограничена synthetic data и исключает secrets, cookies, tokens,
  provider payloads, production data и unnecessary PII.
- Текущий FT-007 runtime ещё использует старый expiry lock и не пишет новый
  durable origin до cancel (`apps/backend/src/checkout/pending-order.ts:159-161`,
  `apps/backend/src/workflows/checkout/expire-pending-order.ts:138-150`), но это
  не отдельный readiness finding: migration этого handoff явно входит в
  TASK-055, имеет stop conditions и race/recovery evidence requirements.

## Evidence checked

- Constitution, invariants, global order/payment/inventory state, system
  architecture, testing and tier policy.
- FT-008 feature hub, runtime/contract/data/state specs, IMPL-FT-008,
  TASK-054..057 records, all four packets, FT-008 protocol plan/decision log.
- FT-007 runtime/contract/data/state/feature specs, implementation plan, feature
  semantic handoff and current expiry/idempotency implementation.
- Installed Medusa v2.16 Admin order/payment routes, validators and refund
  workflow where needed to validate the claimed native boundary.

VERDICT: REJECT
