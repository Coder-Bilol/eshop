---
description: FT-006 runtime architecture for authenticated checkout delivery validation.
status: active
owner: prd-to-tasks
last_updated: 2026-08-13
source_of_truth:
  - .memory-bank/tech-specs/FT-006-checkout-delivery-methods.md
  - .memory-bank/contracts/checkout-delivery-api.md
  - .memory-bank/domains/checkout-delivery-data.md
  - .memory-bank/architecture/system-architecture.md
---
# Checkout Delivery Runtime

## Ownership

- FT-004 owns authentication and checkout entry. Only `authenticated_ready` may
  render the FT-006 continuation, and the backend still validates the customer
  actor on every checkout mutation.
- The storefront owns form and display state only. It does not own tariff truth,
  customer authorization, order state, or payment state.
- The Medusa backend owns normalization, validation, delivery-option availability,
  tariff lookup, and the transient validated handoff.
- Medusa Admin / Shipping Options is the runtime source of configured delivery
  methods and tariff values. FT-006 does not create a second tariff registry.
- FT-007 owns order creation and consumes the validated checkout snapshot. FT-009
  owns payment-provider behavior and consumes the selected payment ID.

## Runtime Flow

1. FT-004 exposes the checkout continuation after `authenticated_ready`.
2. The storefront submits contact, delivery, and payment-selection input to the
   authenticated backend boundary.
3. The backend derives the actor from the Medusa session, normalizes strings, and
   applies server-side safe length limits before domain validation.
4. The backend resolves the selected stable delivery ID against active Medusa
   Shipping Options and its configured RUB tariff.
5. The backend returns a validated checkout snapshot for FT-007 and the selected
   payment ID for FT-009. The operation creates no order and starts no payment.
6. If the selected option is unavailable, the backend returns `422` with
   `delivery_method_unavailable`; the storefront can retry or select another
   option without claiming that checkout succeeded.

## Delivery Source

The semantic option set and order are fixed:

| Stable ID | Initial local tariff | Currency | Order |
|---|---:|---|---:|
| `pickup` | 0 | RUB | 1 |
| `city_courier` | 500 | RUB | 2 |
| `transport_company` | 700 | RUB | 3 |

These values are initial local Admin / Shipping Options configuration, not
runtime constants in storefront or validation code. The supported Medusa v2.16
extension/query point that exposes the options is an implementation assumption
to verify in the backend task. If the installed boundary cannot expose the
configured options without a parallel source, execution must stop.

## Not Applicable

- No external carrier, tracking, delivery calculation provider, queue, event bus,
  custom delivery module, or custom durable checkout snapshot table is introduced.
- FT-006 does not mutate order, inventory, payment, or notification state.
- The exact transport mechanism by which FT-007 and FT-009 consume the handoff is
  owned by those downstream features and is not redefined here.

## Verification Targets

- Backend tests prove Medusa Admin / Shipping Options is the tariff source and the
  three stable IDs are returned in deterministic order.
- Integration tests prove actor validation, normalization-before-limit behavior,
  conditional address validation, exact unavailable-method error, and handoff
  isolation from order/payment-provider calls.
- Browser tests prove only authenticated-ready customers see the form, tariff
  display follows backend data, and unavailable delivery recovers by retry or
  replacement selection.
