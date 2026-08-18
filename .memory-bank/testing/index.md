---
description: Testing and verification strategy for MVP internet shop.
status: active
---
# Testing & Verification

## Quality Gates

- Memory Bank lint after PRD/spec/task artifact changes.
- Typecheck/build/lint for code changes when implementation exists.
- Unit tests for local pure logic.
- Integration tests for domain flows and integration boundaries.
- E2E tests for critical buyer and operator flows.
- Tier policy applies to execution and closure evidence.

## Unit Tests

- Cart merge and ownership rules.
- Variant/SKU selection validation.
- Fixed delivery tariff calculation.
- Order status transition guards.
- Pending-payment timeout calculation.
- Webhook idempotency helper logic when isolated.

## Integration Tests

- Cart persistence and merge boundary.
- OAuth login/callback boundary with mocks where possible.
- Pending order creation and inventory reservation/release.
- ЮKassa webhook status mapping and idempotency.
- Email trigger boundaries for order/payment/status events.
- Medusa Admin visibility of required order fields where testable.

## E2E Tests

- Browse/filter -> product detail -> variant selection -> add to cart.
- Guest cart persistence across browser session.
- Login before payment and cart merge.
- Checkout with delivery/contact/payment data.
- Pending order -> simulated ЮKassa webhook -> order/payment status visible.
- Return page waiting/result behavior without authoritative confirmation.

## FT-006 Checkout Delivery

- Unit/integration: Medusa Admin / Shipping Options resolution, stable delivery
  order, initial `0/500/700 RUB` tariffs, normalization-before-limit behavior,
  conditional address validation, stable payment IDs, and
  `422 delivery_method_unavailable` recovery.
- Backend acceptance: authenticated actor validation and validated snapshot/payment
  handoff with no order creation or payment-provider call.
- Browser acceptance: authenticated-ready gate, contact/delivery/payment fields,
  tariff display from backend, unavailable retry/alternative selection, and safe
  synthetic evidence without real PII.

## FT-007 Pending Order And Inventory

- Unit: UTC 72-hour expiry calculation, logical/native status guards,
  idempotency-key normalization, and reservation-to-order-line mapping.
- Integration: authenticated cart-to-order creation through real Medusa/PostgreSQL,
  native reservation creation, stock-conflict compensation, duplicate request
  reconciliation, cancellation, and reservation release.
- Runtime/E2E: one pending order from the real checkout boundary, same-order retry,
  no payment-provider traffic, controlled expiry/cancel, and released reservations.
- Anti-cheat: do not trust client items/tariffs, do not mark payment successful,
  do not cancel paid/non-pending orders, and do not claim expiry without observing
  reservation cleanup.

## Anti-cheat Rules

- Do not mark payment success from return page alone.
- Do not accept duplicate webhook handling without duplicate-event evidence.
- Do not mark order/inventory work done without state transition evidence.
- Do not mark cart merge done without same-SKU summing evidence.
- Do not mark T2/T3 work done without tier-required `/verify` and `/red-verify` evidence.
- Do not use production secrets, prod writes, or live payment mutation as local proof.

## Artifacts

- Store screenshots/logs/videos/traces in `.tasks/TASK-XXX/`.
- Memory Bank stores only links and short conclusions.
