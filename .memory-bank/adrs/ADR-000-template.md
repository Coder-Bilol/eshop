---
description: "ADR-000: Шаблон для архитектурных решений."
status: active
owner: architecture
last_updated: 2026-08-21
source_of_truth:
  - .memory-bank/adrs/ADR-000-template.md
---
# ADR-000: Template

## ADR Status
template (non-normative)

## Context
Используй этот файл как шаблон для новых ADR.
Копируй и заполняй: Status, Context, Decision, Consequences, Alternatives.

## Decision
Этот шаблон не является принятым архитектурным решением. В текущей KISS-стратегии
authoritative SDD specs являются принятыми decision records. Отдельный ADR нужен,
только когда решение пересекает несколько specs, меняет их precedence или требует
отдельной истории rationale/supersession.

## Consequences
Обычные feature/global решения остаются трассируемыми через SDD specs; созданный
и принятый ADR имеет precedence, заданный system architecture.
