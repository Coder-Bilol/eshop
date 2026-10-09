---
description: Fresh read-only S-01 architecture review for FT-008.
status: complete
task_id: TASK-MB-REVIEW
stage_id: S-01
feature: FT-008
---
# S-01 Architect Review — FT-008

## Scope and method

Проверены AGENTS.md, Constitution, MBB, global SDD backbone/index, FT-008 hub и пять linked specs (feature design, runtime architecture, contract, data, state), system/order-lifecycle/pending-order architecture, order/payment/inventory state, boundary/data contracts, EP-003, IMPL-FT-008, FT-007 handoff, TASK-053..057 records/packets, FT-008 protocol plan/decision log и существующие implementation references. Ревью read-only; runtime implementation FT-008 ещё не выполнялась.

## Architecture decision

Архитектура FT-008 согласована и готова к выполнению TASK-054. C4 сохраняется: product → EP-003 → FT-008 → implementation tasks (MBB, lines 22–23); FT-008 не создаёт новый bounded context или параллельное хранилище. Native Medusa Order/Payment/Fulfillment/Reservation и PostgreSQL остаются durable source of truth; `checkout_state` — ограниченная логическая projection.

## Evidence of sound boundaries

- Constitution запрещает Medusa Core changes и требует API → Workflows → Modules (Constitution.md:29–32). FT-008 прямо закрепляет native Medusa v2.16 workflows/subscribers и отсутствие Core edit (IMPL-FT-008.md:54–69).
- Global source-of-truth rules делают Admin authoritative для payment/order status, а Storefront не может писать success/status (system-architecture.md:51–72; order-payment-inventory.md:18–24, 40–47). Feature-local contract сохраняет это: no Store route/replacement Admin API (order-lifecycle-admin-api.md:13–19, 84–98).
- FT-007 owns pending creation, 72-hour expiry/release; FT-008 owns post-Admin lifecycle projection; FT-009 is deferred and does not enter the current payment boundary (FT-008 feature.md:88–100; spec-backbone.md:152–161). This handoff matches FT-007’s resolved ownership (FT-007 feature.md:80–89, 107–119).
- Payment semantics are internally consistent: one unpaid `pp_system_default` collection, Admin `markAsPaid` is the only `paid` authority, no provider/webhook, and reservation remains until native fulfillment (order-payment-inventory.md:79–86, 108–116; FT-008 state.md:29–33, 38–52; runtime.md:59–69).
- Cancellation/refund semantics are explicit and native: cancel is allowed only where Medusa permits it; captured-payment refund and reservation cleanup belong to native cancellation; completed correction uses refund/return; refund does not auto-restock (FT-008 tech-spec.md:61–71; contract.md:74–82; decision-log.md:43–58, 85–89).
- Projection is fail-closed and re-reads native records, rejects cross-order/contradictory events, and does not fabricate Admin actor proof where the event boundary lacks it (contract.md:41–45, 69–82, 88–98). This is a sound authorization boundary: native Admin authorizes mutation; FT-008 verifies committed state.
- The five linked specs have `complete` design status and are registered as separate authoritative scopes (FT-008 feature.md:4–12; spec-index.md:52–56; IMPL-FT-008.md:6–16). Tasks 054–057 include the same linked specs in source/normative inputs (TASK-054.task.json:43–59; TASK-055.task.json:50–67; TASK-056.task.json:44–60; TASK-057.task.json:46–63), and all canonical packets are `ready` (TASK-054.packet.json:3–8; TASK-055.packet.json:3–8; TASK-056.packet.json:3–8; TASK-057.packet.json:3–8).
- TASK-053 is a completed FT-007 follow-up and explicitly excludes FT-008 behavior (TASK-053.task.json:100–110, 159–167; TASK-053 packet:9–13, 44–45), so the dependency into TASK-054 is bounded and safe.

## Findings

### P0

Нет.

### P1

Нет архитектурных P1. Не обнаружено нарушения Constitution, второго source of truth, пересечения ownership FT-007/FT-008/FT-009 или требования custom Admin/provider boundary.

### P2

1. **Stale global readiness label.** `.memory-bank/spec-backbone.md:13–16` сохраняет `Pre-PRD Spec Status: ready_for_prd`, тогда как тот же файл фиксирует `Global Backbone Status: complete` и `Downstream readiness: global backbone no longer blocks /prd-to-tasks` (lines 61–75). Это не меняет FT-008 design или task safety, но создаёт противоречивый routing signal для следующего агента.

2. **Feature/task lifecycle labels требуют явного чтения.** FT-008 feature остаётся `lifecycle: planned` (FT-008 feature.md:2–5), тогда как FT-008 decomposition protocol имеет `status: complete` и TASK-054 уже `ready` (FT-008 plan.md:2–6, 26–34; TASK-054.task.json:2–8). Это семантически объяснимо (планирование завершено, feature не реализована), но без пояснения может быть ошибочно принято за несогласованный status.

3. **Protocol state отсутствует для downstream tasks до старта.** `.protocols/TASK-054..057/` не содержит task protocol files, при этом records/packets корректно оставляют TASK-055..057 `planned` и задают последовательные dependencies (TASK-055.task.json:4–8; TASK-056.task.json:4–8; TASK-057.task.json:4–8). Это не blocker до выполнения; после promotion соответствующий protocol state должен быть создан по tier policy.

## Remediation list

1. При следующем `mb-sync` обновить `spec-backbone.md:13–16` до недвусмысленного post-PRD/backbone-complete wording, сохранив historical note отдельно.
2. Добавить в FT-008 feature hub или router одну строку, объясняющую `planned` как “implementation not complete”, а `spec_design_status: complete` как “design/decomposition complete”.
3. Перед запуском каждого promoted task создать tier-appropriate `.protocols/TASK-054..057/` state и прогнать `mb-doctor --strict`; не считать отсутствие protocol files дефектом текущего pre-execution состояния.
4. Во время TASK-055..057 подтвердить реальными local evidence именно native cancellation/refund/reservation semantics; design docs корректно требуют это, но architecture review не заменяет runtime verification (IMPL-FT-008.md:137–158; TASK-055.task.json:28–34; TASK-057.task.json:24–29).

## Conclusion

FT-008 имеет coherent C4 placement, единый source-of-truth, корректные native Medusa boundaries и согласованные manual-payment/cancellation handoffs. P2-документальный drift не блокирует выполнение, но должен быть устранён до batch/autonomous routing, чтобы readiness labels не вводили в заблуждение.

VERDICT: APPROVE
