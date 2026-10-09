---
description: FT-008 architecture review report.
status: complete
task_id: TASK-MB-REVIEW
stage_id: S-01
feature: FT-008
review_mode: read-only manual consolidation
---
# S-01 Architect Review — FT-008

## Scope and method

Проверены Constitution, MBB, global `spec-backbone`/`spec-index`, C4-маршрут
product → EP-003 → FT-008 → tasks, FT-008 feature hub и linked
architecture/contract/data/state specs, global order/payment/inventory state,
FT-007/FT-009/FT-010 handoffs, implementation plan, tasks and packets. Две
fresh Codex-сессии запускались, но не завершились из-за неподдерживаемой
модели/таймаута; этот stage report составлен по тем же входам в read-only
режиме. Исходный код FT-008 отсутствует до TASK-054.

## Passed checks

- FT-008 сохраняет KISS-модульный монолит, не добавляет второй order store,
  custom Admin или изменение Medusa Core.
- PostgreSQL/native Medusa Order, Payment Collection/Session, Fulfillment и
  reservation остаются durable sources of truth; `checkout_state` описан как
  ограниченная metadata projection.
- FT-007 владеет pending-order creation/72-hour expiry/release, FT-008 —
  lifecycle projection после native Admin operation, FT-009 — deferred provider
  profile, FT-010 — email side effects. Handoffs согласованы.
- `spec_design_status: complete` и пять FT-008 links зарегистрированы в
  `spec-index.md`; T2/T3 records ссылаются на релевантные SDD specs.

## Blocking findings

### P1 — Refund, вызванный cancellation, неотличим от самостоятельного refund

Документы одновременно требуют:

- paid/processing Admin cancellation → native `canceled`, причём captured
  payment может быть refunded (`features/FT-008...md`, `tech-specs/FT-008...md`;
  `architecture/order-lifecycle-admin-runtime.md:45-56`);
- `payment_refunded` является allow-listed event и подтверждённый refund
  проектирует `checkout_state: refunded`
  (`contracts/order-lifecycle-admin-api.md:24-36,74-79`;
  `states/order-lifecycle-admin.md:30-34,48-53`).

Transition input содержит только `event: "payment_refunded"`, optional
`payment_collection_id` и optional `native_event_id`; в нём нет причины/origin
или correlation с cancellation. Не задано также явное правило приоритета по
native `order.status: canceled`. Поэтому корректная реализация generic
`payment_refunded` subscriber может перезаписать требуемый результат
`canceled` на `refunded` после paid cancellation. Это меняет публичный lifecycle
contract и делает state projection недетерминированной до реализации.

Требуется до TASK-055 зафиксировать один проверяемый guard: например,
специально определить cancellation-origin refund и сохранить `canceled`, либо
явно задать native-order-status precedence и запретить `refunded` для
cancel-origin events. То же правило должно попасть в state matrix и negative
tests.

### P1 — Editable native metadata surface конфликтует с authority invariant

FT-008 требует, чтобы только native Admin `Mark as paid` производил
`pending_payment -> paid`, но одновременно называет встроенный
`/orders/:id/metadata/edit` доступным механизмом и показывает в metadata
`checkout_state` (`tech-specs/FT-008...md:73-93`; `architecture/...:88-96`).
В design/task records нет правила, которое защищает FT-008-owned
`checkout_state`, запрещает его ручную запись или гарантирует reconciliation
при metadata edit. Значит, обычный Admin metadata edit может напрямую записать
`paid`/`canceled` без native payment/cancel transition и нарушить claim «only
native operation». Нужно определить protected field/namespace и native
permission behavior либо исключить editable field из supported acceptance, а
затем добавить negative-path proof.

## Non-blocking observations

- `spec-backbone.md` сохраняет историческую `Pre-PRD Spec Status:
  ready_for_prd` рядом с `Global Backbone Status: complete`; это routing drift.
- FT-008 feature `lifecycle: planned` при `spec_design_status: complete` не
  противоречит реализации, но требует пояснения, что design/decomposition
  complete не означает implementation complete.

## Disposition

Архитектурная раскладка и ownership в целом согласованы, но два P1 gap в
детерминированности lifecycle projection и Admin metadata authority требуют
исправления до безопасного выполнения lifecycle implementation.

VERDICT: REJECT
