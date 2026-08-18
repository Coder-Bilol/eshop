---
description: FT-007 API contract for authenticated pending-order creation.
status: active
owner: prd-to-tasks
last_updated: 2026-08-16
source_of_truth:
  - .memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md
  - .memory-bank/architecture/pending-order-runtime.md
  - .memory-bank/contracts/api-guidelines.md
---
# Pending Order API Contract

## Boundary

The logical Store-facing creation boundary is `POST /store/checkout/order`.
It is authenticated with the Medusa customer actor and follows the shared
sanitized error envelope.

## Request

```json
{
  "cart_id": "cart_opaque_reference",
  "name": "...",
  "email": "...",
  "phone": "...",
  "city": "...",
  "address": "...",
  "comment": "...",
  "delivery_method": "pickup",
  "payment_method": "card"
}
```

- `cart_id` is an opaque lookup reference. The backend validates active ownership
  against the authenticated customer and never trusts it as identity.
- Checkout fields reuse FT-006 validation. The backend re-normalizes and
  re-resolves current delivery availability/tariff; a client snapshot or tariff
  is not accepted as authority.
- The request must carry an `Idempotency-Key` header. It is opaque, bounded, and
  scoped to the authenticated customer/cart; secrets and PII are forbidden.

## Success

HTTP `201`:

```json
{
  "order_id": "order_opaque_id",
  "status": "pending_payment",
  "expires_at": "2026-08-19T12:00:00.000Z",
  "payment_id": "card"
}
```

`status` is the logical product state. The native Medusa order status remains
`pending` and is not exposed as a substitute for the product state.

## Errors

- `401 checkout_auth_required`: no authenticated customer actor.
- `400 checkout_invalid_request`: malformed shape or missing idempotency key.
- `403 checkout_cart_forbidden`: cart is not owned by the actor.
- `404 checkout_cart_not_found`: cart is absent or no longer active.
- `409 checkout_idempotency_conflict`: key was reused with another actor/cart or
  a different normalized request; also used for a non-retryable expired order.
- `409 checkout_stock_conflict`: current inventory cannot satisfy the cart.
- `422 checkout_validation_failed`: FT-006 field, delivery, or payment-selection
  validation failed.
- `500 checkout_order_failed`: sanitized unexpected failure; no raw Medusa,
  customer, or inventory details are returned.

## Idempotency And Retry

- The same key, actor, cart, and normalized request returns the original order
  response after a successful first attempt.
- A failed attempt must either compensate to no pending order/reservation or
  return a recoverable sanitized failure; it must not silently create a second
  order on retry.
- Payment retry after order creation is owned by FT-009. FT-007 only exposes the
  pending state and expiry guard that FT-009 must check.

## Security Invariants

- Customer identity comes only from `req.auth_context.actor_id`.
- Items, variant prices, inventory locations, tariff amount, order status, and
  expiration are backend-owned.
- No provider request, payment secret, production data, or raw internal error
  appears in response or evidence.
