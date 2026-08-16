---
description: FT-006 logical API and downstream handoff contract for checkout delivery validation.
status: active
owner: prd-to-tasks
last_updated: 2026-08-13
source_of_truth:
  - .memory-bank/tech-specs/FT-006-checkout-delivery-methods.md
  - .memory-bank/domains/checkout-delivery-data.md
  - .memory-bank/contracts/api-guidelines.md
  - .memory-bank/contracts/auth-session-security.md
---
# Checkout Delivery API Contract

## Boundary

FT-006 exposes one authenticated Store-facing validation boundary using the
existing API -> Workflows -> Modules architecture. The exact route file and
Medusa v2 route registration follow installed backend conventions; this spec
owns logical request, response, errors, and handoff semantics rather than adding
a second HTTP style.

The request is a JSON object with these fields:

```json
{
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

- `name`, `email`, `phone`, and `city` are required strings.
- `address` is required for `city_courier` and `transport_company` and is not
  required for `pickup`.
- `comment` is optional.
- `delivery_method` accepts only `pickup`, `city_courier`, or
  `transport_company`.
- `payment_method` accepts only `card`, `sbp`, or `sberpay`.
- The backend normalizes string input before applying safe length limits and
  validation. Numeric limits are implementation-owned safe bounds, not client
  authority; they must be covered by tests and not bypassable by the UI.
- Customer identity is derived from the authenticated Medusa actor. No customer
  ID, order ID, provider payment ID, or tariff amount is accepted as authority
  from the client.

## Delivery Result

The successful logical result contains the selected stable delivery ID, the
tariff resolved from configured Medusa Shipping Options in RUB, the validated
contact/delivery fields required by the selected method, the optional comment,
the selected payment ID for FT-009, and a validated checkout snapshot for FT-007.

The snapshot is transient FT-006 output. It is not an order, payment attempt,
inventory reservation, or durable custom checkout record. FT-007 owns its exact
order-creation transport and persistence boundary; FT-009 owns its exact
payment-selection consumption boundary.

## Errors

Use the shared sanitized JSON error envelope from
[.memory-bank/contracts/api-guidelines.md](api-guidelines.md):

- `401` when no authenticated customer actor is present.
- `422` for field, method, payment-selection, or conditional-address validation
  failures, with structured field details when safe.
- `422` with code `delivery_method_unavailable` when the selected delivery
  option is not available from the current Medusa Shipping Options source.
  Recovery is retry or selecting another listed method.
- `400` for malformed request shape after the standard Medusa parser has accepted
  the body, and `500` for an unexpected sanitized backend failure, following the
  shared API guidelines. Malformed JSON syntax rejected by the standard Medusa
  parser remains framework-owned in the current TASK-047 scope; normalizing that
  parser response is deferred and must not be implemented as part of this task.

No error may expose raw Medusa errors, provider payloads, customer identifiers,
contact data, credentials, or payment secrets. A configured tariff read failure
must fail closed and must never fall back to a hardcoded tariff; its sanitized
unexpected-failure mapping follows the shared API guideline until a later
operator decision adds a feature-specific code.

## Security And Scope Invariants

- The backend actor guard is authoritative; the FT-004 UI gate is not an
  authorization substitute.
- The storefront sends no provider request and cannot create an order through
  FT-006.
- FT-006 returns validated data only; downstream features own order/payment
  mutations and their own authentication checks.
- Evidence uses synthetic customers and checkout values only. Real PII,
  credentials, tokens, provider payloads, and production data are forbidden.
