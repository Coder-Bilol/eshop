---
description: Core domain framing for MVP internet shop decomposition.
status: active
owner: spec-init
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/constitution.md
---
# Core Domain

## Main Entities

- Product: sellable home goods item shown in catalog.
- Category: catalog grouping used for browsing and filtering.
- Product Variant/SKU: concrete sellable variant by color, size, length, material, or related attributes.
- Cart: buyer-selected items before order creation; can be guest-owned or customer-owned.
- Wishlist/Favorite: saved product reference for authenticated customers.
- Customer/User: authenticated buyer account from Google OAuth or VK ID.
- Checkout: contact, delivery, and payment selection state before payment completion.
- Delivery Method: pickup, city courier, or transport-company delivery with fixed tariff.
- Order: commercial record created before payment in `pending_payment`.
- Inventory Reservation: stock hold linked to a pending-payment order.
- Payment: personal/offline payment request and native system collection associated with an order; a future FT-009 provider profile may add provider attempts.
- Payment Webhook Event: deferred provider event for payment status; not part of the current FT-008 authority.
- Email Notification: outbound message for order/payment/status events.

## User Roles

- Buyer
- Authenticated customer
- Store operator
- Payment provider
- Development team

## Business Rules

- Buyers can build carts as guests, but must log in before payment.
- Guest cart merges into an existing user cart on login; identical variants/SKU are summed.
- Wishlist/favorites are available only to authenticated users.
- Orders are created before payment with `pending_payment` status.
- Pending-payment orders reserve inventory for 72 hours.
- Pending-payment orders allow payment retry and then expire/cancel if unpaid.
- Native Medusa Admin is the source of truth for payment/status operations in the current manual profile.
- Repeated native Admin events must be idempotent; future provider webhook events remain FT-009 scope.
- Medusa Admin remains the MVP operations surface.

## Entity States

- Order: `pending_payment`, `paid`, `processing`, `completed`, `canceled`, `refunded`.
- Cart ownership: guest-owned, customer-owned, merged.
- Inventory reservation: reserved, released, finalized.
- Payment confirmation: unpaid, Admin-confirmed, refunded in the current profile; future provider statuses remain FT-009 scope.

## Lifecycles

- Purchase lifecycle: catalog discovery -> variant selection -> guest cart -> login -> checkout -> pending order -> personal payment request -> Admin operation.
- Order lifecycle: `pending_payment -> paid -> processing -> completed/canceled/refunded`.
- Inventory lifecycle: available -> reserved during pending payment -> finalized on native fulfillment or released on timeout/cancel/refund.
- Payment lifecycle: requested/unpaid -> Admin-confirmed -> refunded; future provider retry/webhook states belong to FT-009.

## Domain Constraints

- Do not modify Medusa Core.
- Keep API -> Workflows -> Modules.
- External integrations are isolated as modules.
- Keep MVP KISS and medium-complexity.
- No external delivery-provider integration or fiscalization implementation in MVP.

## Links To Contracts/States/Storage

- PRD: [.memory-bank/prd.md](../prd.md)
- Boundary hints: [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)
- Lifecycle hints: [.memory-bank/states/lifecycle-map.md](../states/lifecycle-map.md)
- Verification policy: [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md)
