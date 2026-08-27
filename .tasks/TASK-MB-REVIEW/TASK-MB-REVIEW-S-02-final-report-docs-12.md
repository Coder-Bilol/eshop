---
description: Post-remediation S-02 scope and RTM review report for FT-008.
status: final
stage_id: S-02
reviewer: Scope/RTM
task_id: TASK-MB-REVIEW
---
# TASK-MB-REVIEW S-02 — FT-008 Scope / RTM

## Review boundary

Проведён read-only post-remediation review planned `FT-008 Order Lifecycle And
Admin Visibility`. Прочитаны обязательные governing docs, PRD/requirements,
Product Brief, `EP-003`, FT-008 feature hub и linked FT-008 SDD surface,
`IMPL-FT-008`, TASK-054..TASK-057 records и canonical packets, FT-008 protocol
context, а также границы FT-007, FT-009 и FT-010. Исторические отчёты в
`.tasks/TASK-MB-REVIEW/` не использовались как verdict текущего запуска.

Task statuses, packets, protocols, Memory Bank state и product scope не
изменялись. Записан только этот requested report.

## Verdict summary

Blocking scope/RTM findings не обнаружены. FT-008 после remediation имеет
согласованную трассировку `PRD -> REQ -> EP -> FT -> TASK`, корректное
разделение task ownership и explicit manual/offline Admin authority. Deferred
YooKassa requirements сохранены в active RTM и по-прежнему принадлежат FT-009.

## RTM verification

Требования соответствуют PRD:

- `REQ-022` — lifecycle `pending_payment -> paid -> processing ->
  completed/canceled/refunded` — в `requirements.md:39` mapped to
  `EP-003 -> FT-008`, lifecycle `planned` (`requirements.md:96`).
- `REQ-028` — Admin visibility required fields — в `requirements.md:45`
  mapped to `EP-003 -> FT-008`, lifecycle `planned` (`requirements.md:102`).
- `REQ-029` — Medusa Admin as operator surface — в `requirements.md:46`
  mapped to `EP-003 -> FT-008`, lifecycle `planned` (`requirements.md:103`).

`EP-003` явно включает `REQ-022`, `REQ-028` и `REQ-029` и оставляет epic
`planned`, пока FT-008 не завершён (`EP-003-checkout-order-inventory.md:33,
39-41`). FT-008 принимает ровно эти три requirements (`FT-008-order-lifecycle-
admin-visibility.md:28-42`).

Механическая проверка текущих документов дала 30 REQ definitions и 30 RTM
rows, уникальные и непрерывные `REQ-001..REQ-030`; все проверенные target rows
разрешаются в существующие EP/FT документы.

## Task-level coverage and TASK-054 check

Текущая acceptance coverage в `IMPL-FT-008.md:156-162`:

| Requirement | Task coverage |
|---|---|
| `REQ-022` | `TASK-054`, `TASK-055`, `TASK-057` |
| `REQ-028` | `TASK-056`, `TASK-057` |
| `REQ-029` | `TASK-056`, `TASK-057` |

Следовательно, TASK-054 не является REQ-028 task:

- `TASK-054.task.json:7` содержит только `"reqs": ["REQ-022"]`;
- его purpose — lifecycle vocabulary/projection/guards, а anti-goals исключают
  Admin UI и другие visibility slices;
- `TASK-056.task.json:7` содержит `REQ-028`, `REQ-029`;
- `TASK-057.task.json:7` содержит `REQ-022`, `REQ-028`, `REQ-029`;
- текущая строка `REQ-028` в implementation plan не содержит TASK-054.

Wave/dependency routing также согласован: TASK-054 `W1/T2/ready` зависит от
TASK-053; TASK-055 `W2/T3/planned` зависит от TASK-054; TASK-056
`W3/T3/planned` зависит от TASK-055; TASK-057 `W3/T3/planned` зависит от
TASK-056. Все четыре task records требуют packet и имеют matching canonical
packet hash; packet status у каждого — `ready`.

## Manual/offline authority and feature boundaries

Текущий payment profile явно ограничивает FT-008 personal/offline payment:
storefront рассчитывает цену и записывает payment request, а native Medusa
Admin единственный может mark native payment collection as paid или менять
order status (`requirements.md:49-57`, `FT-008-order-lifecycle-admin-visibility.md:18-24`).

FT-008 SDD surface последовательно фиксирует:

- один unpaid native system collection `pp_system_default`;
- `pending_payment -> paid` только через authenticated native Admin `Mark as
  paid`;
- unpaid Admin cancellation сохраняет native order как `canceled`, использует
  существующий FT-007 release path и не восстанавливает active cart;
- paid/processing/completed correction идёт через native Admin refund, а не
  post-payment cancel;
- отсутствуют Store lifecycle route, caller-supplied source/actor, provider
  redirect, webhook и custom Admin replacement.

Это одинаково отражено в feature hub, runtime, contract, data и state specs,
включая `order-lifecycle-admin-api.md` и `order-lifecycle-admin.md`.

Ownership boundaries не пересекаются:

- FT-007 сохраняет ownership pending-order creation, 72-hour expiry и release
  unpaid reservations (`FT-007-pending-order-inventory-reservation.md:80-87`).
  FT-008 сохраняет reservation после Admin payment до native fulfillment и не
  redesign-ит FT-007 expiry/release.
- FT-009 остаётся отдельным `deferred_optional` provider profile, не является
  dependency FT-008 и owns REQ-020 и REQ-023..REQ-026
  (`FT-009-yookassa-payment-webhook-return.md:5,9-15,26-29`).
- FT-010 owns REQ-027 email effects and consumes committed native Admin
  lifecycle result; email behavior не включён в FT-008
  (`FT-010-order-email-notifications.md:8-12,24`).

## YooKassa roadmap preservation

Deferred scope не удалён:

- PRD и Product Brief по-прежнему содержат исходный YooKassa journey,
  supported methods, webhook source-of-truth и Admin operation surface
  (`analysis/product-brief.md:18,42,54-60`; `prd.md` payment/integration
  sections).
- Active RTM сохраняет planned rows `REQ-020`, `REQ-023`, `REQ-024`, `REQ-025`
  и `REQ-026`, все через `EP-004 -> FT-009`
  (`requirements.md:94,97-100`).
- Requirements current payment profile и FT-009 boundary документируют
  откладывание provider calls, redirect и webhook именно из текущего FT-008
  slice; это scoped staging/roadmap decision, а не потеря requirements.

Product Brief имеет `Decision: proceed`, а PRD ссылается на него как на source
input. FT-008 scope traceable to the Admin/lifecycle portion of that brief;
provider-dependent portion remains traceable to FT-009. Unsupported new product
scope в проверенной цепочке не обнаружен.

## Governance and readiness observations

- Constitution is ratified and requires evidence-backed scope, KISS, native
  Medusa extension boundaries, no Core modification, and higher-tier treatment
  for lifecycle/payment/inventory work; FT-008 docs and task tiers comply.
- `node scripts/mb-lint.mjs` — PASS (`144 files`).
- `node scripts/mb-doctor.mjs --strict` in this environment returned
  `MB_LINT_FAILED ... spawnSync C:\\Program Files\\nodejs\\node.exe EPERM`, while
  direct `mb-lint` passed. This is an execution-environment/tooling gate
  observation, not an RTM or scope contradiction; strict doctor must be rerun in
  a permitted environment before implementation queue execution.

## Findings

No blocking or non-blocking S-02 scope/RTM finding remains. In particular, the
previous overclaim that TASK-054 covered REQ-028 is absent from the current
implementation plan and task record.

## VERDICT

VERDICT: APPROVE
