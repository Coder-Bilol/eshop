---
description: Fresh S-05 MBB compliance review for FT-008.
status: final
task_id: TASK-MB-REVIEW
stage_id: S-05
target: FT-008
review_mode: read-only
---
# S-05 MBB compliance review — FT-008

## Scope and evidence

Проверены `AGENTS.md`, `.memory-bank/constitution.md`, `.memory-bank/mbb/index.md`,
root/local routers, `spec-backbone.md`, `spec-index.md`, PRD/requirements и
product brief, FT-008 feature/spec/runtime/contract/data/state documents,
`IMPL-FT-008`, `TASK-054..057` records and packets, FT-007/FT-009 handoffs,
FT-008 protocols и текущие MBB validators. Работа read-only; единственная запись
этого запуска — настоящий отчёт.

Положительные проверки:

- `node scripts/mb-lint.mjs` завершился `mb-lint passed (144 files)`.
- Проверенные Memory Bank Markdown-документы имеют `description` frontmatter;
  FT-008 документы также содержат согласованные `status`, `owner` и даты.
- FT-008 зарегистрирован в `spec-index.md`, связан с feature hub и routed
  architecture/contract/data/state specs; `spec-backbone.md` помечает global
  backbone как `complete`.
- `features/index.md`, `architecture/index.md`, `contracts/index.md`,
  `domains/index.md`, `states/index.md`, `tasks/plans/index.md` и root index
  содержат FT-008 маршруты. `IMPL-FT-008` и `.protocols/FT-008/*` согласованы
  по W1–W3 и границам FT-007/FT-008/FT-009/FT-010.
- `TASK-054..057` содержат tier/status/wave/dependencies, normative inputs,
  source artifacts, docs и verify; T2/T3 tasks имеют связанные SDD specs и
  canonical ready packets.
- Product brief присутствует и имеет `decision: proceed`; analysis index явно
  трассирует PRD/decomposition и не вводит bypass к task decomposition.

## Findings

### P1 — durable Memory Bank содержит ссылки на operational `.tasks/*`

В `.memory-bank` найдено 79 совпадений с `.tasks/` или `.tasks\\`, включая:

- `.memory-bank/bugs/FT-011-storefront-dev-startup-turbopack.md`;
- `.memory-bank/bugs/TASK-002-local-postgres-unavailable.md`;
- `.memory-bank/bugs/TASK-010-package-scope-gap.md`;
- `.memory-bank/prd.md` (инструкция хранить evidence в `.tasks`);
- `.memory-bank/architecture/system-architecture.md` (описание `.tasks` как
  agent-only execution artifacts).

Это не просто упоминание границы в policy-документе: bug/knowledge docs
содержат прямые ссылки на конкретные `.tasks/TASK-*` evidence files. MBB и
`AGENTS.md` определяют `.memory-bank` как durable project knowledge, а `.tasks`
как operational artifacts, не являющиеся Memory Bank. Следовательно,
durable-навигация зависит от disposable execution output и нарушает
durable-vs-operational boundary. Для FT-008 это особенно актуально, поскольку
его task/packet design требует evidence, но durable conclusions должны быть
перенесены в Memory Bank без ссылок на operational paths.

Исправление: оставить в Memory Bank только устойчивые conclusions/summary с
датой и command/result при необходимости; конкретные `.tasks/*` paths удалить
из durable docs либо заменить на устойчивые ссылки на task record/protocol/
Memory Bank handoff. Упоминания `.tasks` в governing policy, объясняющие саму
границу, можно сохранить, но не следует превращать их в evidence navigation.

### P2 — strict doctor не является воспроизводимо подтверждённым в этом запуске

`node scripts/mb-doctor.mjs --strict` завершился `mb-doctor FAIL (1 errors)` с
`MB_LINT_FAILED ... spawnSync ... node.exe EPERM`. Это похоже на ограничение
окружения/процесса, а не на диагностированную MBB-ошибку: прямой
`node scripts/mb-lint.mjs` прошёл. Поэтому это не самостоятельный content defect,
но перед batch execution нужен успешный strict-doctor в разрешённой среде и
сохранённый reproducible result.

## Verdict rationale

Frontmatter, routers, FT-008 SDD registry/backbone routing, task packets и
product-brief traceability в целом согласованы. Однако P1 затрагивает
обязательную долговечность и границу Memory Bank, а также создаёт stale/brittle
links на operational artifacts. До удаления/замены таких ссылок MBB compliance
не может быть одобрен. P2 требует отдельного environment re-run, но сам по
себе не определяет verdict.

VERDICT: REJECT
