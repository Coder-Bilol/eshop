# Eshop 🏡

Теплый интернет-магазин товаров для дома: карнизы, детали для оформления окон и все то, что помогает комнате выглядеть собранной, уютной и своей.

Здесь покупатель не пробирается через шумный catalog и случайные карточки. Он спокойно находит нужный товар, выбирает подходящий размер, цвет, длину и материал, кладет все в cart и доводит заказ до оплаты без лишних шагов.

## 🌿 Витрина для спокойного выбора

Eshop задуман как магазин, в котором легко покупать вещи для дома даже тогда, когда у товара много вариантов.

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

### 🧾 Payment status без догадок

Return page не делает вид, что оплата прошла. Источник правды — webhook ЮKassa. Это защищает order lifecycle от случайных refresh, duplicate events и спорных состояний.

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
- **Payments**: ЮKassa
- **Auth**: Google OAuth, VK ID
- **Operations**: Medusa Admin
- **Local runtime**: Docker Compose

Главный принцип backend: **API -> Workflows -> Modules**. Medusa Core остается чистым, а external integrations живут в своих boundaries.

## 🔒 Что делает магазин надежным

- Webhook ЮKassa — source of truth для payment status.
- Duplicate webhook events обрабатываются idempotently.
- Return page не подтверждает payment сама.
- Inventory резервируется для `pending_payment` order.
- Unpaid order отменяется или истекает через 72 часа.
- Customer data, cart, order, payment и inventory state защищены от потери.

## ❤️ Для кого это

Для покупателей, которые хотят спокойно выбрать товары для дома. Для операторов, которым нужна понятная order visibility. Для команды, которая хочет развивать магазин без лишней сложности.

---

Eshop — это не просто checkout и product cards. Это аккуратный путь от идеи "надо обновить дом" до оформленного заказа. 🌤️
