---
description: Product Requirements Document.
status: draft
type: prd
clarification_status: complete
constitution_checked: true
---
# PRD

## Source Inputs

- [.memory-bank/analysis/product-brief.md](analysis/product-brief.md): Product Brief, decision `proceed`.
- [.memory-bank/analysis/brainstorming/BR-001.md](analysis/brainstorming/BR-001.md): brainstorming report and interview decisions.
- [.memory-bank/constitution.md](constitution.md): ratified project principles.
- [idea.md](../idea.md): initial user-provided concept.
- [.memory-bank/testing/index.md](testing/index.md): testing and verification baseline.
- [.memory-bank/workflows/tier-policy.md](workflows/tier-policy.md): task tier and verification policy.
- User decision on 2026-06-23: local development must run natively on Windows 10, not in Docker containers. This supersedes earlier Docker Compose local-development notes in the Product Brief and brainstorming artifacts.

## Product Summary

The product is an MVP internet shop for home goods, including curtain rods and related categories. The storefront is built with Next.js and TypeScript, the backend uses Medusa v2, TypeScript, and PostgreSQL, and local development is supported through a native Windows 10 setup using local Node.js/npm processes and a local PostgreSQL service.

The primary product path is: browse and filter products, choose a product variant/SKU, add it to a guest cart, log in through Google OAuth or VK ID before payment, enter checkout and delivery data, create a pending order, reserve inventory for 72 hours, process payment through ЮKassa, update order status from the ЮKassa webhook, send email notifications, and operate the order through Medusa Admin.

Constitution check: passed. The PRD preserves KISS, does not require changing Medusa Core, avoids microservices and enterprise scope, and treats auth, payments, order state, inventory reservation, privacy, and data safety as high-risk areas for tiered verification.

## Goals

- Launch a narrow but complete e-commerce MVP for home goods.
- Provide a usable storefront catalog with moderate categories, search, filters, and product variants.
- Support guest cart creation and persistence before login.
- Require Google OAuth or VK ID login before payment.
- Support checkout with contacts, required phone, delivery method, delivery address data, and payment method.
- Integrate ЮKassa for cards, СБП, and SberPay.
- Use ЮKassa webhook as the authoritative payment status source.
- Create and operate orders in Medusa Admin with clear payment and order status.
- Keep external integrations isolated as modules and use API -> Workflows -> Modules.
- Keep local development reproducible on Windows 10 without Docker containers.

## Non-goals

- Modifying Medusa Core.
- Microservices or enterprise architecture.
- 1С integration.
- СДЭК/Boxberry integration.
- Bonus/loyalty system.
- Marketplace features.
- B2B features.
- Mobile application.
- SMS confirmation.
- Custom admin panel replacing Medusa Admin.
- Fiscalization/receipt implementation inside MVP.
- External delivery-provider price calculation or shipment tracking inside MVP.

## Users / Actors

- Buyer: browses home goods, adds items to cart, logs in before payment, completes checkout, and receives email notifications.
- Authenticated customer: has a persisted account through Google OAuth or VK ID, can use wishlist/favorites, and owns carts/orders after login.
- Store operator: uses Medusa Admin to inspect orders, contacts, products, delivery data, payment status, order status, total amount, and payment method.
- Payment provider: ЮKassa sends payment status webhooks and handles cards, СБП, and SberPay.
- Development team: runs and validates the MVP locally on Windows 10 with Node.js/npm and a local PostgreSQL service.

## Functional Requirements

### Catalog and Product Discovery

- FR-001: The storefront must list home goods products, including curtain rods and related categories.
- FR-002: The storefront must support product categories.
- FR-003: The storefront must support search and moderate filters: category, price, color, material, size/length, product type, and mounting method.
- FR-004: Product cards must support product variants/SKU by color, size, length, and material.
- FR-005: Product detail pages must allow the buyer to choose a valid variant/SKU before adding to cart when variants exist.

### Cart and Wishlist

- FR-006: Buyers must be able to create and update a cart before registration/login.
- FR-007: Guest cart state must persist between browser sessions.
- FR-008: When a buyer logs in, the guest cart must merge with any existing user cart, and identical positions must be summed.
- FR-009: Wishlist/favorites must be available only to authenticated users.

### Authentication

- FR-010: The product must support Google OAuth login.
- FR-011: The product must support VK ID login.
- FR-012: Buyers may browse and build a cart as guests, but must be authenticated before payment.

### Checkout and Delivery

- FR-013: Checkout must collect name, email, and required phone.
- FR-014: Checkout must collect delivery city, address, comment, and selected delivery method.
- FR-015: Checkout must offer delivery methods without external provider integration: pickup, city courier, and transport-company delivery.
- FR-016: Delivery price must use fixed tariffs by selected delivery method.
- FR-017: Checkout must collect selected payment method.

### Orders, Inventory, and Payment

- FR-018: The system must create an order before payment with status `pending_payment`.
- FR-019: Pending-payment orders must reserve inventory.
- FR-020: Pending-payment orders must allow payment retry.
- FR-021: Pending-payment orders must expire or cancel automatically after 72 hours if payment is not completed.
- FR-022: The order lifecycle must support `pending_payment -> paid -> processing -> completed/canceled/refunded`.
- FR-023: ЮKassa payment must support cards, СБП, and SberPay.
- FR-024: ЮKassa webhook must be the source of truth for payment status.
- FR-025: Repeated webhook events must be handled idempotently without duplicate orders or invalid status transitions.
- FR-026: The return page after payment must show waiting/result state and must not be the authoritative payment confirmation source.

### Notifications and Admin Operations

- FR-027: The system must send email notifications for pending order, successful payment, payment error, and order status change.
- FR-028: Medusa Admin must show contacts, ordered products, delivery data, payment status, order status, total amount, and payment method.
- FR-029: Operators must be able to use Medusa Admin as the MVP order operations surface.

### Local Development

- FR-030: The project must provide a Windows 10 native local development path for the storefront/backend/database stack without requiring Docker containers.

## Non-functional Requirements

- NFR-001: Architecture must stay KISS and medium-complexity; do not introduce microservices or enterprise abstractions for MVP.
- NFR-002: Medusa Core must not be modified.
- NFR-003: Backend extensions must follow API -> Workflows -> Modules.
- NFR-004: External integrations must be isolated as modules.
- NFR-005: Payment, auth, order lifecycle, stock reservation, and compliance-sensitive work must follow high-tier verification policy when decomposed into tasks.
- NFR-006: Security/privacy must be treated as non-negotiable for customer identity, contact data, carts, orders, and payment-related identifiers.
- NFR-007: Payment state handling must prioritize correctness and idempotency over convenience.
- NFR-008: The solution must avoid data loss for carts, orders, inventory reservations, and payment status transitions.
- NFR-009: The first release must remain low-maintenance and operationally understandable.
- NFR-010: Critical purchase flows should have e2e verification; payment/webhook and cart/order state logic should have integration-level verification where possible.

## Data / Domain Model

- Product: sellable home goods item shown in catalog.
- Category: grouping for catalog browsing and filtering.
- Product Variant/SKU: concrete sellable variant of a product by color, size, length, material, or related attributes.
- Cart: buyer-selected items before order creation; can be guest-owned or user-owned.
- Wishlist/Favorite: saved product reference for authenticated users.
- Customer/User: authenticated buyer account from Google OAuth or VK ID.
- Checkout: contact, delivery, and payment selection state before order/payment completion.
- Delivery Method: pickup, city courier, or transport-company delivery with fixed tariff.
- Order: commercial record created before payment in `pending_payment`.
- Inventory Reservation: stock hold linked to a pending-payment order and released or finalized based on lifecycle.
- Payment: ЮKassa payment attempt/status associated with an order.
- Payment Webhook Event: provider event used as authoritative payment status input; must be idempotently processed.
- Email Notification: outbound message for order/payment/status events.

Key status model:

- Order status: `pending_payment`, `paid`, `processing`, `completed`, `canceled`, `refunded`.
- Pending-payment timeout: 72 hours.
- Payment source of truth: ЮKassa webhook, not return page.

## UX / Interaction Flow

1. Buyer opens storefront and browses home goods.
2. Buyer uses categories, search, and filters.
3. Buyer opens product detail page and chooses variant/SKU where applicable.
4. Buyer adds item to guest cart.
5. Cart persists across browser sessions.
6. Buyer proceeds to checkout and is required to log in through Google OAuth or VK ID before payment.
7. If a previous user cart exists, the guest cart merges into it and identical positions are summed.
8. Buyer enters name, email, required phone, delivery city, address, optional comment, delivery method, and payment method.
9. System creates `pending_payment` order, reserves stock for 72 hours, and starts payment.
10. Buyer completes or retries payment through ЮKassa.
11. Return page shows waiting/result state while payment status is confirmed through webhook.
12. ЮKassa webhook updates payment/order status idempotently.
13. System sends email notifications for pending order, successful payment, payment error, and order status changes.
14. Store operator handles the order in Medusa Admin.

## Integrations / Dependencies

- Medusa v2 backend.
- PostgreSQL.
- Next.js storefront.
- Google OAuth.
- VK ID.
- ЮKassa payment integration for cards, СБП, SberPay, return flow, and webhook processing.
- Email delivery provider or SMTP-style integration to be selected during design/tasking.
- Native Windows 10 local development using Node.js/npm and local PostgreSQL.
- Medusa Admin for operations.

Operational details still to resolve during design/tasking:

- Local and staging credentials for ЮKassa.
- Local and staging webhook URLs/tunneling approach.
- Email provider/configuration.
- Fiscalization/receipt obligations before production launch.

## Edge Cases / Failure Handling

- Guest cart and user cart both contain the same variant/SKU: merge and sum quantity.
- Buyer abandons payment: order remains `pending_payment`, supports retry, and expires/cancels after 72 hours.
- Pending-payment timeout elapses: release inventory reservation and transition order to canceled/expired behavior to be finalized in design.
- ЮKassa sends duplicate webhook: processing must be idempotent and must not create duplicate orders or invalid transitions.
- Return page loads before webhook arrives: show waiting state and do not mark payment successful from return page alone.
- Payment fails: keep order recoverable for retry while within pending window and send payment error email.
- Product variant goes out of stock before order creation: prevent checkout for unavailable quantity.
- Product variant inventory is reserved by pending order: reflect reduced availability according to inventory design.
- OAuth login occurs during checkout with existing account cart: merge carts before payment.
- Fiscalization is found mandatory before production: block production launch until compliance path is designed.

## Acceptance Criteria

- AC-001: A buyer can browse categories and filter/search home goods.
- AC-002: A buyer can select product variant/SKU and add it to a cart.
- AC-003: Guest cart survives a new browser session.
- AC-004: Login through Google OAuth and VK ID is available before payment.
- AC-005: Guest cart merges into user cart on login, summing identical variants/SKU.
- AC-006: Checkout collects required contact and delivery fields, including required phone.
- AC-007: Delivery methods and fixed tariffs are available without external provider integration.
- AC-008: Order is created as `pending_payment` before payment and reserves inventory.
- AC-009: Pending-payment order supports retry and expires/cancels after 72 hours.
- AC-010: ЮKassa card, СБП, and SberPay payment path exists.
- AC-011: Payment status changes are driven by webhook and handled idempotently.
- AC-012: Return page does not independently mark payment as successful.
- AC-013: Email notifications are emitted for pending order, successful payment, payment error, and order status change.
- AC-014: Medusa Admin displays order contacts, products, delivery data, payment status, order status, total amount, and payment method.
- AC-015: Windows 10 native local development path starts or verifies required storefront, backend, and local PostgreSQL services without Docker containers.
- AC-016: MVP scope excludes listed non-goals and does not modify Medusa Core.

## Verification Strategy

- Run Memory Bank lint after PRD/spec/task artifact changes.
- Use tier policy for all generated task verification.
- Treat auth, payments, webhooks, order lifecycle, stock reservation, destructive data operations, production/deploy, and compliance work as T3 or higher-risk task areas when decomposed.
- Use unit tests for local pure logic such as cart merge, status transition guards, timeout calculations, and fixed tariff calculation.
- Use integration tests for order creation, inventory reservation/release, ЮKassa webhook idempotency, and email trigger boundaries.
- Use e2e tests for critical buyer flow: browse/filter -> choose variant -> cart -> login -> checkout -> pending order -> simulated payment webhook -> order visible.
- Store substantive evidence under `.tasks/TASK-*` during execution; keep durable conclusions in Memory Bank.

## Clarifications

### Session 2026-06-18

- Product level is medium, with KISS and anti-overengineering as governing principles.
- Buyer may build a guest cart, but must log in before payment.
- Google OAuth and VK ID are both in MVP.
- Order is created before payment as `pending_payment`.
- Pending-payment timeout is 72 hours.
- Inventory is reserved during pending-payment period.
- ЮKassa webhook is authoritative for payment status.
- Webhook repeats must be handled idempotently.
- Fiscalization/receipts are not implemented in MVP, but remain a legal/payment launch risk.
- No new clarification questions were asked during `/write-prd`; prior `/brainstorm` and `/constitution` answers were sufficient for PRD decomposition.

### Session 2026-06-23

- Q: How should local development run? -> A: The local development path must run natively on Windows 10, not in Docker containers.
- Q: What is Docker's role? -> A: Docker may be used only for a future remote server deployment path, not for local development.
- Impact: FR-030, AC-015, local development dependencies, architecture, FT-011, and generated local-foundation tasks must be synchronized from Docker Compose to Windows-native Node.js/npm plus local PostgreSQL. Future remote-server Docker deployment remains out of the current local-foundation scope and must be designed separately as high-tier deployment work.

## Unresolved Blockers

None.
