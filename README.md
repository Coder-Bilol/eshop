# Eshop 🏡

Интернет-магазин на стеке NextJS + TS + Medusa с админкой и онлайн оплатой.

## 🌿 Функции магазина

- 🔎 Удобный search по товарам и категориям.
- 🧭 Фильтры по цене, цвету, материалу, длине, типу товара и способу крепления.
- 🎨 Понятный выбор variant/SKU прямо на product detail page.
- 🛒 Guest cart, который можно собрать до регистрации.
- 🔐 Вход через Google OAuth или VK ID только тогда, когда он действительно нужен: перед оплатой.
- 🚚 Простые delivery methods с фиксированными тарифами.
- 💳 Оплата через ЮKassa: cards, СБП и SberPay.
- 📩 Email-уведомления о важных изменениях заказа.

## ✨ Killer Features

### 🧵 Variant-first shopping

Карниз, крепление или другой товар для дома редко бывает "одним вариантом". Eshop делает выбор аккуратным: покупатель видит доступные параметры и выбирает именно тот variant/SKU, который можно добавить в cart.

### 🛒 Cart без давления

Можно спокойно собрать guest cart без регистрации. Login появляется не в начале пути, а перед payment, когда покупатель уже готов оформить заказ.

### 🔁 Умное объединение cart

Если покупатель вошел в аккаунт, guest cart объединяется с customer cart. Одинаковые variant/SKU суммируются, а не превращаются в дубли и путаницу.

### ⏳ Честный `pending_payment`

Order создается до оплаты в статусе `pending_payment`, а inventory резервируется на 72 часа. Покупатель получает время завершить payment или повторить попытку.

### 👀 Medusa Admin для оператора

Оператор видит contacts, products, delivery data, payment status, order status, total amount и payment method в Medusa Admin. Без отдельной самодельной admin panel.

## 🧭 Как выглядит покупка

1. Покупатель открывает storefront и смотрит товары для дома.
2. Использует категории, search и filters.
3. Открывает product detail page.
4. Выбирает цвет, размер, длину, материал или другой важный параметр.
5. Добавляет товар в cart.
6. Перед payment входит через Google OAuth или VK ID.
7. Заполняет checkout: имя, email, телефон, город, адрес, comment и delivery method.
8. Получает `pending_payment` order с резервом inventory.
9. Оплачивает через ЮKassa.
10. Получает email-уведомления, а магазин видит заказ в Medusa Admin.

## 🏗️ Технологический характер

Под капотом Eshop держится на понятной modular monolith architecture:

- **Storefront**: Next.js + TypeScript
- **Backend**: Medusa v2 + TypeScript
- **Database**: PostgreSQL
- **Payments**: ЮKassa, QR СБП
- **Auth**: Google OAuth, VK ID
- **Operations**: Medusa Admin
- **Local runtime**: Windows 10 native Node.js/npm + local PostgreSQL

Главный принцип backend: **API -> Workflows -> Modules**. Medusa Core остается чистым, а external integrations живут в своих boundaries.

## 🖥️ Local development on Windows 10

Локальная разработка запускается нативно на Windows 10: Node.js/npm processes
для backend и storefront, плюс локальный PostgreSQL service. Docker containers
не используются для local development; Docker зарезервирован только для будущего
remote server deployment.

```bash
npm run check:local-env
npm run dev:local
npm run smoke:local
```

Для интерактивного запуска сервисов можно использовать:

```bash
npm run dev:local:watch
```

Шаблоны конфигурации лежат в `.env.example`, `apps/backend/.env.example` и
`apps/storefront/.env.example`. Реальные `.env` файлы игнорируются git и должны
содержать только local/non-production значения.

Полный локальный runbook: `.memory-bank/runbooks/local-development.md`.

Для проверки backend-owned catalog seed:

```bash
npm --workspace apps/backend run db:seed
npm --workspace apps/backend run smoke:catalog
```

## 🔒 Что делает магазин надежным

- Webhooks — source of truth для payment status.
- Duplicate webhook events обрабатываются idempotently.
- Return page не подтверждает payment сама.
- Inventory резервируется для `pending_payment` order.
- Unpaid order отменяется или истекает через 72 часа.
- Customer data, cart, order, payment и inventory state защищены от потери.
