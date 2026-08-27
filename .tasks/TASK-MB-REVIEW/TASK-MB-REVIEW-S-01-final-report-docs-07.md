Роль GENERAL

FT-008-only read-only архитектурное ревью завершено. Файлы и статусы не изменялись.

Найдено 2 blocking findings:

1. Конфликт lifecycle transitions.

- FT-008 разрешает `paid|processing|completed -> canceled`: [FT-008 spec](D:/projects/eshop/.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md:56-58), [FT-008 state](D:/projects/eshop/.memory-bank/states/order-lifecycle-admin.md:16-19).
- Глобальная нормативная state-модель разрешает cancellation только из `pending_payment`; для `paid|processing|completed` определён только переход в `refunded`: [global state](D:/projects/eshop/.memory-bank/states/order-payment-inventory.md:36-45).
- Contract FT-008 дополнительно запрещает отмену captured payment metadata-only: [contract](D:/projects/eshop/.memory-bank/contracts/order-lifecycle-admin-api.md:66-70).

Scoped fix: выбрать и зафиксировать единую модель: либо убрать post-payment `-> canceled` из FT-008, либо расширить глобальный state contract и явно определить native Medusa/operator workflow, reservation и accounting semantics.

2. Native Medusa Admin visibility недостаточно обоснована.

- FT-008 требует отображения `checkout_state` и `checkout_payment_method` в built-in Admin без custom UI: [FT-008 contract](D:/projects/eshop/.memory-bank/contracts/order-lifecycle-admin-api.md:76-81), [data spec](D:/projects/eshop/.memory-bank/domains/order-lifecycle-admin-data.md:55-70).
- Одновременно архитектура запрещает custom Admin replacement/UI: [system architecture](D:/projects/eshop/.memory-bank/architecture/system-architecture.md:43-46), [FT-008 runtime](D:/projects/eshop/.memory-bank/architecture/order-lifecycle-admin-runtime.md:61-70).
- Не указано, каким поддержанным native Medusa Admin механизмом arbitrary order metadata будет гарантированно доступен оператору.

Scoped fix: зафиксировать конкретный поддержанный native Admin projection/read mechanism и acceptance evidence; если он недоступен, пересмотреть требование или явно разрешить минимальное Admin extension.

Handoffs FT-007 → FT-008 → FT-009/FT-010 в целом согласованы: FT-007 владеет expiry/release, FT-009 — provider authenticity/webhook idempotency, FT-010 — email side effects. C4 ownership и запрет Medusa Core modification согласованы с Constitution: [Constitution](D:/projects/eshop/.memory-bank/constitution.md:III), [system architecture](D:/projects/eshop/.memory-bank/architecture/system-architecture.md:21-46).

VERDICT: REJECT