---
description: Fresh read-only security review of FT-008.
status: complete
task: TASK-MB-REVIEW
stage: S-04
feature: FT-008
---
# Security review: FT-008

## Scope and evidence

Проверены Constitution, invariants, system architecture, tier policy, FT-007
pending-order runtime/contract/data/state документы, все пять FT-008
feature/runtime/contract/data/state документов, IMPL-FT-008, текущий
`apps/backend/medusa-config.ts`, Store checkout/pending-order routes/workflow и
наличие заявленных FT-008 source-файлов. Рабочее дерево уже содержало чужие
незакоммиченные изменения; файлы не изменялись.

Проверяемые ссылки: `.memory-bank/constitution.md` (principles V--VII),
`.memory-bank/invariants.md` (payment authority, idempotency, data safety),
`.memory-bank/architecture/order-lifecycle-admin-runtime.md` (строки 21--25,
49--56), `.memory-bank/contracts/order-lifecycle-admin-api.md` (40--43,
70--98), `.memory-bank/states/order-lifecycle-admin.md` (38--56),
`.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md`
(61--71, 99--112), `.memory-bank/requirements.md` (current MVP Payment Profile),
`apps/backend/medusa-config.ts` (33--60, 75--88, 153--160),
`apps/backend/src/api/store/checkout/order/route.ts` (24--58) и
`apps/backend/src/workflows/checkout/create-pending-order.ts` (57--58,
108--133, 263, 428--450).

## Findings (prioritized)

### P1 — заявленные FT-008 security guards не подтверждены реализацией

`rg --files apps/backend/src | rg 'order-lifecycle|subscribers|admin|payment'`
не находит ни `order-lifecycle` модулей, ни guarded workflow, ни
`subscribers/order-lifecycle.ts`; в репозитории присутствуют только FT-007
checkout/expiry source-файлы. Поэтому нельзя подтвердить кодом ни allow-list
native event names, ни re-read authoritative records, ни same-order
payment-collection check, ни fail-closed unknown/contradictory event behavior,
ни no-op/replay semantics. Это блокирует security approval высокорисковой
payment/order/inventory фичи согласно Constitution V и VII и IMPL-FT-008
T2/T3 gates.

### P1 — Admin RBAC описан как внешняя предпосылка, но не определён и не доказан

Документы утверждают, что native Medusa Admin authentication/RBAC разрешает
операцию до публикации event (runtime 21--25; contract 92--100), но не
фиксируют требуемую роль/permission matrix, deny-by-default boundary,
проверку tenant/store scope или acceptance доказательство для unauthorized
Admin actor. В коде FT-008, который мог бы закрепить boundary, нет. Нельзя
принять любое событие как доказательство Admin authority: subscriber должен
оставаться недоступным Store/customer input и проверять native committed
state; это следует явно проверить в TASK-055/057 на реальном runtime.

### P1 — internal event trust и replay identity недостаточно операционализированы

Контракт признаёт, что event bus не несёт `req.auth_context` и event payload не
является actor proof (contract 40--43, 92--100). Это допустимо только при
строгом server-internal boundary. Однако `native_event_id` указан optional, а
отдельного durable processed-event/replay ledger для native events не
предусмотрено. State no-op снижает риск duplicate transition, но не доказывает
безопасность повторной/задержанной доставки, повторных downstream side effects
или событий с тем же target state и другой ссылкой. Нужны code-level
allow-list, source-boundary tests, stable event identity (или доказанный
transactional/idempotent native operation), order/payment/fulfillment
reconciliation и adversarial tests: forged Store call, unknown event,
cross-order payment id, replay after cancel/expiry, out-of-order payment after
cancel, duplicate fulfillment/refund.

### P1 — late payment/cancel/refund safety остаётся только декларацией

State spec требует, чтобы expired/canceled/refunded не возвращались в paid или
processing, а late event был rejected без восстановления cart/reservation.
Но implementation отсутствует, поэтому нет доказательства атомарного
read-and-guard против race между expiry/native cancel и payment projection.
Особенно опасны paid cancellation с native refund/reservation cleanup и
fulfillment handoff: ошибка в projector может оставить paid state при
освобождённом hold либо повторно потребить reservation. До APPROVE нужны
real Medusa/PostgreSQL tests из IMPL-FT-008 с concurrent/late event cases и
проверкой сохранения audit record.

### P2 — Store isolation в design выглядит корректно, но требует runtime gate

Положительно: FT-008 не добавляет Store lifecycle mutation route; текущий
Store route извлекает customer только из `req.auth_context.actor_id` и передаёт
в workflow серверный `customer_id` (route 24--48), а docs запрещают caller-
supplied status/payment/totals. Это соответствует invariant customer identity
и Store isolation. Но пока нет FT-008 endpoint/subscriber source и negative
integration test, утверждение нельзя считать доказанным: проверка должна
включать customer попытку mark-paid/status mutation, forged order/payment
reference и cross-order reference.

### P2 — secrets/PII/evidence controls в основном адекватны

`medusa-config.ts` требует JWT/COOKIE secrets в production и принимает
development fallback только вне production (33--60); provider secrets
required only when provider enabled (101--127). FT-008 docs запрещают
provider payloads, secrets, cookies, tokens, production data и лишнюю PII в
metadata/evidence. Pending-order response возвращает только order/status/
expiry/payment id (route 52--58), а raw internal errors sanitised. Это good
baseline. Осталось подтвердить в acceptance, что Admin evidence synthetic,
логи не содержат customer email/phone, session/token, payment details и что
Admin metadata editor не позволяет записать секреты/неограниченную PII в
projection.

## Required fixes before approval

1. Реализовать и показать code evidence FT-008 projector/workflow/subscriber;
   закрепить native Admin-only mutation boundary и deny-by-default event input.
2. Зафиксировать Admin RBAC/role/store-scope assumptions и negative tests.
3. Добавить replay/source/order-binding guards и доказательство безопасной
   обработки forged, cross-order, duplicate, out-of-order и late events.
4. Провести race-aware real Medusa/PostgreSQL acceptance для cancel/expiry,
   mark-paid, fulfillment, refund и reservation invariants; проверить safe
   evidence/PII policy.

Имеющиеся design-документы не противоречат Constitution; reject вызван
не противоречием, а отсутствием проверяемой реализации для критичных
security/payment invariants.

VERDICT: REJECT
