---
description: User scenarios and architecture implications.
status: active
---
# User Scenarios

## Primary Actors

- Buyer: browses home goods, manages cart, logs in before payment, completes checkout, and receives order emails.
- Authenticated customer: owns carts, orders, and wishlist/favorites after Google OAuth or VK ID login.
- Store operator: works in Medusa Admin with order, payment, delivery, and customer contact data.
- Payment provider: ЮKassa sends authoritative payment status webhooks.

## Core Scenarios

1. Browse to pending order:
   Buyer browses/filter home goods, selects a product variant/SKU, adds it to a guest cart, logs in before payment, fills checkout data, and creates a `pending_payment` order with inventory reserved for 72 hours.

2. Payment confirmation:
   Buyer completes or retries ЮKassa payment; the return page displays waiting/result state, while the ЮKassa webhook authoritatively updates payment/order status and triggers email notifications.

3. Operations:
   Store operator opens Medusa Admin and sees contacts, products, delivery data, payment status, order status, total amount, and payment method.

## Out Of Scope Scenarios

- Checkout without login before payment.
- External delivery-provider calculation/tracking.
- Fiscalization/receipt implementation in MVP.
- 1С, marketplace, B2B, mobile app, SMS confirmation, bonuses/loyalty.
- Custom admin panel replacing Medusa Admin.

## Architecture/Domain Implications

- Buyer-facing decomposition should preserve one end-to-end purchase journey instead of splitting cart, auth, checkout, payment, and order lifecycle without shared state ownership.
- Payment/webhook behavior and order lifecycle are decomposition-shaping because they affect inventory reservation, emails, admin visibility, retry, and expiration behavior.
- Auth and payment areas are high-risk and should later route to higher task tiers under [.memory-bank/workflows/tier-policy.md](workflows/tier-policy.md).
- Use [.memory-bank/prd.md](prd.md) as the authoritative PRD source for detailed requirements and acceptance criteria.

## Review Status

- Status: ready_for_prd
- Last reviewed: 2026-06-18
- Owner command: `/spec-init`
