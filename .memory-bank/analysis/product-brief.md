---
description: Product Brief input contract for PRD.
status: draft
type: product-brief
---
# Product Brief

## Metadata

- Status: draft
- Decision: proceed
- Source artifacts:
  - `idea.md`
  - `.memory-bank/analysis/brainstorming/BR-001.md`

## 1. One-liner

MVP интернет-магазина товаров для дома на Medusa v2 и Next.js, где пользователь собирает корзину, входит через Google/VK, оформляет доставку, оплачивает через ЮKassa, а заказ управляется в Medusa Admin.

## 2. Target Users

- Покупатели товаров для дома, включая карнизы и сопутствующие категории.
- Операторы магазина, которые обрабатывают заказы через Medusa Admin.
- Команда разработки, которой нужен простой локальный контур на Windows 10 без Docker containers.

## 3. Problem

Нужно быстро запустить рабочий e-commerce MVP без микросервисной и enterprise-сложности, но с критичным покупательским путем: каталог, корзина, авторизация, checkout, оплата, статус заказа и админский учет.

## 4. Current Alternatives

- Ручные продажи через мессенджеры, телефон или соцсети.
- Размещение товаров на маркетплейсах без собственного checkout и клиентской базы.
- Типовые CMS/e-commerce решения с ограниченным контролем над Medusa-style workflows/modules.

## 5. Value Proposition

Проект дает собственный storefront и управляемую архитектуру на Medusa v2: покупатель получает понятный путь покупки, а команда сохраняет расширяемость через Workflows и Modules без изменения Medusa Core.

## 6. Product Concept

Storefront показывает товары для дома с категориями, умеренными фильтрами и карточками товаров с вариантами/SKU. Пользователь может собрать гостевую корзину, но перед оплатой должен войти через Google OAuth или VK ID. Checkout собирает контакты, телефон, способ доставки и способ оплаты. Заказ создается до оплаты в состоянии `pending_payment`, резервирует остатки на 72 часа, затем обновляется по authoritative webhook от ЮKassa. Оператор видит заказ и ключевые статусы в Medusa Admin.

## 7. MVP Scope

- Каталог товаров для дома, включая разные виды карнизов.
- Категории, поиск и умеренные фильтры: категория, цена, цвет, материал, размер/длина, тип товара, способ крепления.
- Карточка товара с вариантами/SKU по цвету, размеру, длине и материалу.
- Гостевая корзина с сохранением между сессиями.
- Объединение гостевой и пользовательской корзины после входа; одинаковые позиции суммируются.
- Авторизация через Google OAuth и VK ID.
- Checkout: имя, email, обязательный телефон, город, адрес, комментарий, способ доставки, способ оплаты.
- Доставка без внешних интеграций: самовывоз, курьер по городу, транспортная компания; фиксированные тарифы по способу.
- Оплата через ЮKassa: карты, СБП, SberPay.
- Webhook ЮKassa как source of truth для статуса оплаты; повторные события обрабатываются идемпотентно.
- Жизненный цикл заказа: `pending_payment -> paid -> processing -> completed/canceled/refunded`.
- Pending-заказы: retry оплаты, резерв остатков и автоматическое истечение/отмена через 72 часа.
- Email-уведомления: pending-заказ, успешная оплата, ошибка оплаты, изменение статуса.
- Wishlist/избранное только для авторизованных пользователей.
- Отображение в Medusa Admin: контакты, товары, доставка, payment status, order status, сумма, способ оплаты.
- Windows 10 native local development using Node.js/npm and local PostgreSQL.

## 8. Non-goals

- Изменение Medusa Core.
- Микросервисы и enterprise-функции.
- 1С.
- Интеграции СДЭК/Boxberry.
- Бонусы/loyalty.
- Маркетплейс.
- B2B.
- Мобильное приложение.
- SMS-подтверждение.
- Отдельная кастомная админка вместо Medusa Admin.
- Полноценная фискализация/чеки в MVP.

## 9. Success Metrics

- Покупатель может найти товар, выбрать вариант, добавить его в корзину и пройти checkout.
- Гостевая корзина сохраняется между сессиями и корректно объединяется после входа.
- Оплата через ЮKassa обновляет заказ через webhook без дублей при повторных событиях.
- Pending-заказы резервируют остатки и истекают через 72 часа.
- Оператор видит заказ и ключевые статусы в Medusa Admin.
- Локальный dev-контур поднимается на Windows 10 без Docker containers.

## 10. Constraints

- Backend: Medusa v2, TypeScript, PostgreSQL.
- Frontend: Next.js, TypeScript.
- Auth: Google OAuth, VK ID.
- Payments: ЮKassa для карт, СБП, SberPay.
- Architecture: API -> Workflows -> Modules.
- External integrations must be isolated as modules.
- KISS: keep MVP narrow and operationally understandable.

## 11. Assumptions

- `idea.md` and `BR-001.md` are the current source of user intent.
- MVP targets a Russian-market checkout context.
- Delivery can be modeled with manual methods and fixed tariffs.
- Medusa Admin is sufficient for first-release order operations.
- Login before payment is acceptable even though cart can be built as guest.
- Fiscalization is not implemented in MVP, but must be reviewed before production launch.

## 12. Risks

- ЮKassa payment state handling requires strict idempotency and clear order/payment status transitions.
- Pending-order stock reservation for 72 hours can reduce available inventory if many payments are abandoned.
- Cart merge rules can create unexpected quantities if not clearly shown to the user.
- Fiscalization/receipts may become mandatory before production launch depending on legal/business setup.
- OAuth provider setup and webhook URLs can slow local/staging validation.

## 13. Open Questions

- Which environment credentials and webhook URLs are required for local and staging ЮKassa development?
- What exact fiscalization/receipt obligations apply before production launch?

## 14. PRD Input Summary

Proceed to PRD with one primary purchase journey: browse/filter home goods, choose product variant, use guest cart, log in before payment, checkout with delivery/contact data, create pending order, reserve stock for 72 hours, process ЮKassa payment via webhook, update order status, notify by email, and operate through Medusa Admin. Treat payment idempotency, cart merge, stock reservation, fiscalization risk, and local webhook setup as PRD/spec focus areas.

## Decision

proceed
