---
description: Requirements (REQ IDs) and traceability matrix for the MVP internet shop.
status: active
owner: prd
last_updated: 2026-07-13
source_of_truth:
  - .memory-bank/prd.md
---
# Requirements

## Status Model

- Document `status`: `draft|active|deprecated|archived`
- RTM `Lifecycle`: `planned|implemented|verified`

## REQ List

- REQ-001: The storefront must list home goods products, including curtain rods and related categories.
- REQ-002: The storefront must support product categories.
- REQ-003: The storefront must support search and moderate filters: category, price, color, material, size/length, product type, and mounting method.
- REQ-004: Product cards must support product variants/SKU by color, size, length, and material.
- REQ-005: Product detail pages must allow choosing a valid variant/SKU before add-to-cart when variants exist.
- REQ-006: Buyers must be able to create and update a cart before registration/login.
- REQ-007: Guest cart state must persist between browser sessions.
- REQ-008: On login, guest cart must merge with existing user cart and sum identical variants/SKU.
- REQ-009: Wishlist/favorites must be available only to authenticated users.
- REQ-010: The product must support Google OAuth login.
- REQ-011: The product must support VK ID login.
- REQ-012: Buyers may browse and build a cart as guests, but must be authenticated before payment.
- REQ-013: Checkout must collect name, email, and required phone.
- REQ-014: Checkout must collect delivery city, address, comment, and selected delivery method.
- REQ-015: Checkout must offer pickup, city courier, and transport-company delivery without external provider integration.
- REQ-016: Delivery price must use fixed tariffs by selected delivery method.
- REQ-017: Checkout must collect selected payment method.
- REQ-018: The system must create an order before payment with status `pending_payment`.
- REQ-019: Pending-payment orders must reserve inventory.
- REQ-020: Pending-payment orders must allow payment retry.
- REQ-021: Pending-payment orders must expire/cancel after 72 hours if payment is not completed.
- REQ-022: The order lifecycle must support `pending_payment -> paid -> processing -> completed/canceled/refunded`.
- REQ-023: ЮKassa payment must support cards, СБП, and SberPay.
- REQ-024: ЮKassa webhook must be the source of truth for payment status.
- REQ-025: Repeated webhook events must be handled idempotently without duplicate orders or invalid status transitions.
- REQ-026: Return page after payment must show waiting/result state and must not be authoritative payment confirmation.
- REQ-027: The system must send email notifications for pending order, successful payment, payment error, and order status change.
- REQ-028: Medusa Admin must show contacts, products, delivery data, payment status, order status, total amount, and payment method.
- REQ-029: Operators must be able to use Medusa Admin as the MVP order operations surface.
- REQ-030: The project must provide a Windows 10 native local development path for storefront/backend/database without requiring Docker containers.

## Out Of Scope

- Medusa Core modifications.
- Microservices and enterprise abstractions.
- 1С, СДЭК/Boxberry, bonuses/loyalty, marketplace, B2B, mobile app, SMS confirmation.
- External delivery-provider calculation/tracking.
- Fiscalization/receipt implementation in MVP.
- Custom admin panel replacing Medusa Admin.

## Traceability

| REQ | Epic | Feature | Test | Lifecycle |
|---|---|---|---|---|
| REQ-001 | EP-001 | FT-001 | e2e: catalog browse | verified |
| REQ-002 | EP-001 | FT-001 | e2e: category browse | verified |
| REQ-003 | EP-001 | FT-001 | integration/e2e: filters/search | verified |
| REQ-004 | EP-001 | FT-002 | unit/integration: variant model | verified |
| REQ-005 | EP-001 | FT-002 | e2e: variant add-to-cart | verified |
| REQ-006 | EP-002 | FT-003 | e2e: guest cart update | verified |
| REQ-007 | EP-002 | FT-003 | e2e: cart persistence | verified |
| REQ-008 | EP-002 | FT-003 | unit/integration: cart merge | verified |
| REQ-009 | EP-002 | FT-005 | e2e: authenticated wishlist | planned |
| REQ-010 | EP-002 | FT-004 | integration/e2e: Google OAuth | planned |
| REQ-011 | EP-002 | FT-004 | integration/e2e: VK ID | planned |
| REQ-012 | EP-002 | FT-004 | e2e: login before payment | planned |
| REQ-013 | EP-003 | FT-006 | e2e: checkout contact fields | planned |
| REQ-014 | EP-003 | FT-006 | e2e: delivery data fields | planned |
| REQ-015 | EP-003 | FT-006 | integration/e2e: delivery methods | planned |
| REQ-016 | EP-003 | FT-006 | unit: fixed tariff calculation | planned |
| REQ-017 | EP-003 | FT-006 | e2e: payment method selection | planned |
| REQ-018 | EP-003 | FT-007 | integration: pending order creation | planned |
| REQ-019 | EP-003 | FT-007 | integration: inventory reservation | planned |
| REQ-020 | EP-004 | FT-009 | e2e: payment retry | planned |
| REQ-021 | EP-003 | FT-007 | unit/integration: 72h timeout | planned |
| REQ-022 | EP-003 | FT-008 | unit/integration: order lifecycle | planned |
| REQ-023 | EP-004 | FT-009 | integration: ЮKassa methods | planned |
| REQ-024 | EP-004 | FT-009 | integration: webhook source of truth | planned |
| REQ-025 | EP-004 | FT-009 | integration: webhook idempotency | planned |
| REQ-026 | EP-004 | FT-009 | e2e: return waiting/result state | planned |
| REQ-027 | EP-004 | FT-010 | integration: email events | planned |
| REQ-028 | EP-003 | FT-008 | integration/e2e: admin order visibility | planned |
| REQ-029 | EP-003 | FT-008 | e2e: operator order surface | planned |
| REQ-030 | EP-005 | FT-011 | smoke: Windows native local path | planned |
