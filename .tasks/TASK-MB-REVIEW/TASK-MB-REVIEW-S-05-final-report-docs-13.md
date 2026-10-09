---
description: Current-context S-05 MBB compliance review report for FT-008.
status: complete
task: TASK-MB-REVIEW
stage: S-05
artifact: final-report
kind: docs
---
# TASK-MB-REVIEW S-05 — FT-008 MBB compliance

Роль GENERAL

## Scope and execution

Проверены Constitution/MBB, root/local routers, `spec-backbone`, `spec-index`,
FT-008 hub and linked specs, EP-003/FT-007 handoff, requirements/RTM,
IMPL-FT-008, tasks/packets/protocols and current lint/doctor output. Fresh
runner не завершился в локальный лимит; review выполнен read-only по canonical
MBB checklist. Durable docs, task records и statuses не менялись.

## Result

`REJECT`.

## Passed checks

- `node scripts/mb-lint.mjs` — PASS, 144 files.
- Reviewed Markdown files имеют frontmatter с `description`; routers для
  крупных directories и FT-008 spec registry присутствуют.
- `spec-index.md` остаётся registry, а global backbone status находится в
  `spec-backbone.md`. FT-008 feature declares `spec_design_status: complete`
  and all five linked SDD specs are registered.
- В самом FT-008 feature/runtime/contract/data/state surface нет прямой ссылки
  на operational `.tasks` evidence; task records и packets маршрутизируют
  execution context через `.memory-bank`/`.protocols`.

## Blocking finding

### F-01 — P1: durable Memory Bank still leaks direct `.tasks` evidence links

AGENTS/MBB разделяют durable `.memory-bank/` и operational `.tasks/`, а review
command требует отсутствия `.tasks` leakage в MBB surface. Текущий global scan
находит 32 Markdown-файла с `.tasks/`, включая 12 файлов с прямыми evidence
links. Примеры в reviewed handoff graph:

- `.memory-bank/features/FT-007-pending-order-inventory-reservation.md:103,119`;
- `.memory-bank/tasks/plans/IMPL-FT-006.md:236-245`;
- `.memory-bank/tasks/plans/IMPL-FT-007.md:139-140`;
- `.memory-bank/features/FT-006-checkout-delivery-methods.md:92-108`.

Часть процедурных упоминаний в command/workflow docs допустима для описания
операционного процесса, но direct Markdown links из durable feature/plan
документов делают `.tasks` частью долговечной навигации и ломают заявленную
границу. FT-008 использует FT-007 как relevant handoff, поэтому это не
полностью unrelated repository noise.

Нужно заменить direct evidence links на устойчивые task records/protocol
references или архивную навигацию и повторить S-05. `mb-lint` эту policy gap
не проверяет, поэтому его PASS не закрывает finding.

## Non-blocking drift

`.memory-bank/prd.md:197-199` сохраняет формулировку “to be finalized in
design” для уже решённого timeout mapping. Это следует исправить при MB sync,
но основной MBB reject вызван leakage выше.

VERDICT: REJECT
