---
description: Product overview (C4 L1) for the MVP internet shop.
status: active
owner: prd
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/constitution.md
---
# Product

## What This Is

MVP интернет-магазина товаров для дома, включая разные виды карнизов и сопутствующие категории. Storefront строится на Next.js/TypeScript, backend на Medusa v2/TypeScript/PostgreSQL, локальная разработка поддерживается через Windows 10 native setup без Docker containers.

## Core Value

Покупатель получает полный путь от поиска товара до оплаченного заказа, а команда сохраняет расширяемую, но простую архитектуру Medusa v2 без изменения Medusa Core и без enterprise-overhead.

## Current Payment Profile

В текущем MVP storefront только формирует цену и записывает запрос на личную
оплату. Оплата подтверждается оператором через native Medusa Admin; storefront
не запускает платёжный redirect и не меняет статус заказа. ЮKassa и webhook
остаются отдельным deferred-профилем для будущего FT-009.

## Audience

- Покупатели товаров для дома.
- Авторизованные клиенты с корзиной, избранным и заказами.
- Операторы магазина в Medusa Admin.
- Команда разработки, поддерживающая MVP.

## Primary User Flow

1. Покупатель открывает storefront и просматривает товары для дома.
2. Использует категории, поиск и фильтры.
3. Открывает карточку товара и выбирает variant/SKU.
4. Добавляет товар в гостевую корзину.
5. Перед оплатой входит через Google OAuth или VK ID.
6. Гостевая корзина объединяется с пользовательской.
7. Покупатель заполняет checkout, выбирает доставку и способ оплаты.
8. Система создает `pending_payment` order, резервирует остатки на 72 часа и
   записывает запрос на личную оплату.
9. Оператор после личного подтверждения использует native Medusa Admin, чтобы
   отметить native payment collection как paid и выполнить дальнейшие status
   actions.
10. Покупатель получает email-уведомления, оператор видит заказ в Medusa Admin.

## Constraints

- KISS, medium-complexity MVP.
- Do not modify Medusa Core.
- Backend extensions follow API -> Workflows -> Modules.
- External integrations are isolated as modules.
- Auth, payments, order lifecycle, stock reservation, production/deploy, destructive data operations, and compliance-sensitive work follow high-tier verification when decomposed.

## Non-goals

- 1С, СДЭК/Boxberry, marketplace, B2B, mobile app, bonuses/loyalty, SMS confirmation.
- Fiscalization/receipt implementation in MVP.
- Custom admin panel replacing Medusa Admin.
- External delivery-provider calculation/tracking.
