# TASK-MB-REVIEW S-01 — Architect Review (FT-008)

## Verdict

REJECT. Текущая FT-008 поверхность согласована по основной lifecycle authority
(native Admin, FT-007 expiry ownership, cancellation/refund precedence,
reservation handoff), но содержит два blocking межспековых конфликта. Они
затрагивают payment correctness и не позволяют безопасно начать очередь с
TASK-054 до архитектурной синхронизации.

## Findings

### F-01 — HIGH (blocking): FT-007 -> FT-008 передаёт несовместимую семантику payment method

**Evidence**

- `.memory-bank/features/FT-006-checkout-delivery-methods.md:32-34` определяет
  только `card|sbp|sberpay` и передаёт выбранный ID в deferred FT-009.
- `.memory-bank/domains/checkout-delivery-data.md:27` повторяет тот же закрытый
  набор provider-oriented IDs.
- `.memory-bank/contracts/pending-order-api.md:31` использует `payment_method:
  "card"` на FT-007 boundary.
- `apps/backend/src/checkout/validation.ts:6-18` принимает только
  `card|sbp|sberpay`, а `apps/backend/src/checkout/pending-order.ts:323-330`
  сохраняет выбранное значение без преобразования в
  `checkout_payment_method`.
- При этом `.memory-bank/domains/pending-order-inventory-data.md:18-38`
  утверждает, что FT-007 уже сохраняет `personal_request`, а
  `.memory-bank/domains/order-lifecycle-admin-data.md:31-55` принимает
  `personal_request` как существующий FT-007-owned field, который FT-008 обязан
  сохранять.
- TASK-055 требует создать unpaid `pp_system_default` collection
  (`.memory-bank/tasks/TASK-055.task.json:34-44`), но не задаёт преобразование,
  миграцию или compatibility rule для уже существующего provider-oriented
  `checkout_payment_method`; одновременно его constraints требуют сохранять
  FT-007 payment-selection metadata
  (`.memory-bank/tasks/TASK-055.task.json:90-99`).

**Impact**

Исполнение текущего плана оставит Admin projection с `card|sbp|sberpay`, хотя
current MVP и FT-008 объявляют единственный personal/offline request. Это
смешивает deferred FT-009 provider intent с текущей Admin-only authority,
делает required Admin field «payment method» семантически ложным и создаёт
source-of-truth conflict в payment-sensitive области. Конфликт блокирует по
Constitution I, VI и VII (`.memory-bank/constitution.md:21-23,41-47`).

**Fix**

Принять и синхронизировать одну явную handoff-модель до execution:

1. Для текущего PRD-профиля заменить checkout/payment-selection contract на
   `personal_request` (рекомендуемое направление по действующему PRD), обновить
   FT-006/FT-007 contracts, backend/storefront validation и acceptance evidence;
   либо явно определить отдельное, owner-approved отображение legacy
   `card|sbp|sberpay` в personal request без выдачи их за provider payment.
2. Задать migration/backward-compatibility rule для уже созданных FT-007 orders.
3. Добавить изменение и проверку `checkout_payment_method` в конкретный task и
   packet с достаточным allowed write scope; затем повторить review.

### F-02 — HIGH (blocking): глобальные normative test specs всё ещё требуют deferred webhook/return flow

**Evidence**

- `.memory-bank/architecture/system-architecture.md:196-198` задаёт integration
  webhook idempotency и E2E через `simulated webhook` как общую MVP strategy.
- `.memory-bank/states/order-payment-inventory.md:159-164` по-прежнему требует
  webhook-idempotency и return-page E2E в authoritative shared lifecycle spec.
- `.memory-bank/testing/index.md:25-41` определяет ЮKassa webhook mapping,
  simulated webhook и return-page behavior как общие integration/E2E targets,
  без ограничения FT-009.
- Более новый PRD прямо задаёт для текущего flow native Admin confirmation и
  относит simulated webhook к будущему FT-009
  (`.memory-bank/prd.md:227-234`), а shared state одновременно говорит, что
  FT-009 не входит в текущую FT-008 boundary
  (`.memory-bank/states/order-payment-inventory.md:166-176`).

**Impact**

TASK-054..057 получают противоречивые normative inputs: task-local FT-008
acceptance требует Admin-only flow, а глобальные architecture/state/testing
источники требуют отсутствующий deferred provider flow. Исполнитель не может
однозначно определить Definition of Done без расширения scope в FT-009 либо
игнорирования нормативного документа. Для payment-sensitive T3 work это
нарушает spec-driven/evidence requirements и запрет недокументированных
предположений (`.memory-bank/constitution.md:21-23,37-51`).

**Fix**

Ограничить webhook/return-page targets явным условием «только при resumed
FT-009 provider profile» во всех трёх shared docs. Для current MVP закрепить
integration/E2E путь `pending order -> native Admin mark-as-paid -> lifecycle
projection -> Admin visibility`, сохранив provider tests как будущий FT-009
раздел. После синхронизации перепроверить TASK-054..057 normative inputs и
gates.

### F-03 — MEDIUM (architecture risk, non-blocking independently): основной pre-native wrapper ещё не подтверждён установленным extension point

**Evidence**

- Feature одновременно ставит `spec_design_status: complete`
  (`.memory-bank/features/FT-008-order-lifecycle-admin-visibility.md:1-12`) и
  заявляет, что открытых design questions нет, но требует в TASK-055 доказать
  возможность удерживать shared lock через полный built-in Admin handler; при
  неуспехе нужно пересмотреть архитектурное решение
  (`.memory-bank/features/FT-008-order-lifecycle-admin-visibility.md:198-204`).
- D-009 также оставляет конкретный wrapper условным и требует остановки, если
  installed route boundary не поддерживает его
  (`.protocols/FT-008/decision-log.md:105-122`).

**Impact**

Это корректно оформленный stop condition, поэтому само по себе не является
Constitution violation. Однако механизм является единственной заявленной
pre-mutation serialization boundary для late-payment/expiry safety. Его
неподтверждённость может остановить W2 после завершения W1 и потребовать смены
границы D-003/D-009.

**Fix**

До promotion TASK-055 сохранить воспроизводимое evidence по точным installed
Admin routes и lifecycle каждой lock/release ветки (`success`, `error`, aborted
response). Если полный wrapper не поддерживается без Core/custom mutation API,
пометить feature design blocked и пересмотреть D-003/D-009; не ослаблять guard
до post-event projection.

## Evidence Checked

- Governing: `AGENTS.md`, Constitution, MBB, worker/review contracts,
  `spec-backbone`, `spec-index`, root index и scoped `REQUEST.md`.
- Architecture/C4: system architecture, boundary map, invariants, lifecycle map,
  shared order/payment/inventory state, testing strategy и ADR inventory.
- FT-008: feature hub, tech spec, runtime, contract, data, state, plan,
  TASK-054..057 routing/constraints, packets/protocol decision context.
- Handoffs: FT-007 feature/runtime/API/data/state and implemented checkout
  boundary; deferred FT-009 feature boundary.
- Current working tree was treated as the review target. No Memory Bank or code
  remediation was applied.

## Architecture Conclusions Without Findings

- C4 layering and bounded-context ownership are otherwise coherent: Storefront
  has no authoritative mutation; native Medusa/PostgreSQL own commercial state;
  FT-007 owns pending creation/expiry/release; FT-008 owns guarded projection;
  FT-009 is deferred; FT-010 owns notifications.
- Native Admin authority, cancellation-origin refund precedence, FT-007 expiry
  marker preservation, reservation-through-payment, fulfillment consumption,
  no automatic refund restock, and protected `checkout_state` are consistently
  represented across the FT-008 local spec set.
- No separate ADR is mandatory under the current backbone strategy; linked SDD
  specs plus D-003/D-009 carry the decision record. F-03 still requires concrete
  feasibility evidence before W2 promotion.

VERDICT: REJECT
