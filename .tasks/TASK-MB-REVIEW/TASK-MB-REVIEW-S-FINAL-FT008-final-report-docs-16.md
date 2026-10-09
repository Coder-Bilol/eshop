---
description: Aggregated fresh-context Memory Bank review report for FT-008.
status: complete
task_id: TASK-MB-REVIEW
feature: FT-008
artifact: final-report
kind: docs
review_mode: staged fresh-context consolidation
---
# TASK-MB-REVIEW — FT-008 итоговый отчёт

## Decision

FT-008 получает общий `REJECT`. Структура очереди, packets и deterministic
readiness gates проходят, а два P1 предыдущего run про cancellation-origin
refund precedence и прямое изменение `checkout_state` закрыты. Однако fresh
review выявил новые межспековые и security blockers. Не выполнять TASK-054 и не
запускать batch/autonomous chain до исправления fix-list и повторного scoped
review.

## Stage verdicts

| Stage | Reviewer | Verdict | Основной результат |
|---|---|---|---|
| S-01 | Architecture | REJECT | Несогласованный `card|sbp|sberpay` vs `personal_request` handoff и неусловные provider/webhook test targets в shared specs. |
| S-02 | Scope/RTM | APPROVE | REQ-022/028/029 → EP-003 → FT-008 → TASK-054..057 traceable; один LOW Product Brief drift. |
| S-03 | Plan/tasks | APPROVE | Queue, schema, dependencies, tiers и 4/4 packet hashes/scopes/gates проходят. |
| S-04 | Security | REJECT | Нет full-refund predicate; generic Admin metadata guard не защищает остальные workflow-control keys. |
| S-05 | MBB | REJECT | Durable Analysis/plan routing устарел и делает execution handoff неоднозначным. |
| S-06 | Code quality | N/A | FT-008 implementation ещё отсутствует; TASK-054 является первой implementation task. |

## Blocking findings

### P1 — Payment-method handoff не имеет единой семантики

Verified FT-006 и текущий FT-007 runtime принимают и сохраняют
`card|sbp|sberpay` (`tech-specs/FT-006...md:60`,
`contracts/checkout-delivery-api.md:43`,
`apps/backend/src/checkout/pending-order.ts:323-330`). FT-007/FT-008 data specs
и FT-008 UAT одновременно требуют уже существующий `personal_request`
(`domains/pending-order-inventory-data.md:18-38`,
`domains/order-lifecycle-admin-data.md:31-66`, `IMPL-FT-008.md:191-196`).
TASK-055 не задаёт mapping, compatibility/migration rule или явный acceptance
для изменения этого поля. В payment-sensitive flow это source-of-truth conflict.

### P1 — Shared verification targets не отделяют deferred FT-009

Global architecture/state/testing документы всё ещё перечисляют webhook
idempotency, simulated YooKassa webhook и return page как безусловные общие
targets (`architecture/system-architecture.md:192-198`,
`states/order-payment-inventory.md:159-164`, `testing/index.md:25-41`), тогда
как текущий PRD задаёт Admin-only FT-008 и переносит эти проверки в resumed
FT-009 (`prd.md:219-234`). TASK-054..057 используют shared docs как normative
inputs, поэтому Definition of Done требует явного conditional scoping.

### P1 — Partial refund может ошибочно завершить lifecycle

FT-008 переводит non-canceled `paid|processing|completed` в `refunded` по
«confirmed native refund», но не требует полного cumulative refund
(`contracts/order-lifecycle-admin-api.md:92-97`,
`states/order-lifecycle-admin.md:70-78`). Installed Medusa v2.16 допускает
refund с частичной суммой и публикует refund event. Без full-refund predicate
первый partial refund может ложно сделать logical order terminal `refunded`.

### P1 — Защищён не весь workflow-owned metadata namespace

Generic Admin metadata guard защищает только `checkout_state`, хотя expiry,
recovery и replay зависят также от `pending_payment_expires_at`,
`checkout_idempotency_key`, `checkout_request_fingerprint`, `checkout_cart_id`
и `checkout_expiry_origin|reason|cleanup`
(`contracts/order-lifecycle-admin-api.md:185-188`,
`domains/order-lifecycle-admin-data.md:53-57,91-97`,
`apps/backend/src/checkout/pending-order.ts:323-326,408-448`). Их изменение или
удаление через native Admin metadata API обходит guarded workflows.

### P2 — Durable routing/handoff устарел

- `.memory-bank/analysis/index.md:39` снова направляет уже декомпозированный
  FT-008 в `/prd-to-tasks` вместо current review/doctor → TASK-054 route.
- `.memory-bank/tasks/plans/IMPL-FT-008.md:228` блокирует handoff на
  неопределённых исторических “two P1 findings”, не называя durable issues и
  не используя fresh review gate.

Эти routing defects сами не меняют продуктовый contract, но позволяют fresh
worker перегенерировать task surface или неверно решить, что gate закрыт.

## Required fix list

1. Принять одну payment-selection модель. Либо сохранить проверенные
   `card|sbp|sberpay` как offline request labels и синхронизировать FT-007/008
   data/UAT, либо owner-approved изменить FT-006/007 runtime на
   `personal_request`. В обоих случаях определить compatibility для уже
   созданных orders и назначить изменение конкретному task/packet.
2. Пометить webhook/return-page targets в system architecture, shared lifecycle
   и testing index как conditional FT-009-only; current FT-008 E2E должен идти
   через native Admin confirmation.
3. Добавить authoritative cumulative full-refund predicate. Partial refund
   сохраняет текущий logical state; `refunded` допустим только после полного
   возврата. Покрыть single partial, cumulative partials, final full refund,
   duplicate/out-of-order и cancellation-origin cases.
4. Защитить server-side весь workflow-owned metadata key set, разрешая generic
   Admin editor/API менять только действительно operator-editable metadata.
   Расширить TASK-055/056/057 negative acceptance.
5. Исправить durable routing в `analysis/index.md` и заменить исторический
   счётчик findings в `IMPL-FT-008` на явный fresh review + strict doctor gate.
   При sync также добавить FT-008 design/plan navigation в root index либо
   последовательно маршрутизировать через area indexes.
6. Сохранить TASK-055 preflight: доказать, что supported middleware удерживает
   `order-lifecycle:${order_id}` через полный installed Admin handler. Если это
   невозможно без Medusa Core/custom mutation API, остановиться и пересмотреть
   D-003/D-009.
7. После remediation обновить affected task records/packets, повторить
   `mb-lint`, `mb-doctor --strict` и `/review FT-008`.

## Direct gate evidence

- `node scripts/mb-lint.mjs` — PASS, 144 files.
- `node scripts/mb-doctor.mjs --strict` — PASS, 0 errors, 0 warnings, 2 info.
- TASK-054..TASK-057: 4/4 canonical packets `ready`; raw task hashes,
  allowed-write scopes, required gates и tiers совпадают.
- Queue order структурно корректен: TASK-053 `done` → TASK-054 `ready` →
  TASK-055/056/057 `planned`.
- Structural readiness не отменяет blocking semantic/security review findings.

## Non-blocking cleanup

- `.memory-bank/analysis/product-brief.md:91` всё ещё называет YooKassa
  текущим payment constraint, хотя Brief/PRD в остальных местах используют
  manual/offline profile и deferred FT-009.
- Root `.memory-bank/index.md` неполно перечисляет активные FT-008 design/plan
  документы, хотя area routers и `spec-index.md` их находят.
- Feasibility полного built-in Admin handler wrapper пока является корректно
  оформленным TASK-055 stop condition, а не доказанным implementation fact.

VERDICT: REJECT
