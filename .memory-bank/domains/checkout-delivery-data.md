---
description: FT-006 checkout contact, delivery option, tariff, and transient handoff data specification.
status: active
owner: prd-to-tasks
last_updated: 2026-08-13
source_of_truth:
  - .memory-bank/tech-specs/FT-006-checkout-delivery-methods.md
  - .memory-bank/architecture/checkout-delivery-runtime.md
  - .memory-bank/contracts/checkout-delivery-api.md
  - .memory-bank/architecture/system-architecture.md
---
# Checkout Delivery Data

## Input Data

FT-006 accepts the following checkout input for an authenticated buyer:

| Field | Rule |
|---|---|
| `name` | Required; backend-normalized and safe-length-bounded. |
| `email` | Required; backend-normalized and safe-length-bounded. |
| `phone` | Required; backend-normalized and safe-length-bounded. |
| `city` | Required for every delivery method; backend-normalized and safe-length-bounded. |
| `address` | Required for `city_courier` and `transport_company`; not required for `pickup`. |
| `comment` | Optional; backend-normalized and safe-length-bounded when supplied. |
| `delivery_method` | Stable ID: `pickup`, `city_courier`, or `transport_company`. |
| `payment_method` | Stable ID: `card`, `sbp`, or `sberpay`. |

Normalization occurs before length checks. Exact numeric safe limits are an
implementation-level assumption because BR-002 intentionally did not select
field-by-field numbers; execution must choose bounded values, cover boundaries in
tests, and keep them server-side.

## Delivery Option Data

Medusa Admin / Shipping Options owns configured delivery-option availability and
tariff truth. The initial local configuration is:

| ID | Amount | Currency | Position |
|---|---:|---|---:|
| `pickup` | 0 | RUB | 1 |
| `city_courier` | 500 | RUB | 2 |
| `transport_company` | 700 | RUB | 3 |

The backend may adapt the installed Medusa Shipping Options representation into
the feature contract, but it must not introduce hardcoded runtime fallback
values or an external carrier calculator. The amount representation and
rounding follow the installed Medusa money model; initial values are whole RUB
amounts and have no fractional tariff requirement.

## Validated Handoff

The successful validation result is a transient snapshot containing normalized
contact fields, applicable city/address/comment, selected stable delivery ID,
resolved RUB tariff, and selected payment ID.

- FT-007 consumes the checkout snapshot for its pending-order boundary.
- FT-009 consumes only the selected payment ID for its payment boundary.
- FT-006 does not persist the snapshot as an order or custom durable record.
- FT-006 does not include provider payment identifiers or payment credentials.

Exact downstream transport and persistence remain owned by FT-007 and FT-009;
this feature defines the data semantics they receive without duplicating their
contracts.

## Data Invariants

- Only the three stable delivery IDs are accepted.
- Delivery order is always pickup, city courier, transport company.
- A method unavailable in Medusa Shipping Options cannot be silently replaced
  by a hardcoded tariff.
- Pickup does not require an address; courier and transport company do.
- No order, inventory reservation, payment attempt, or provider state is created
  by FT-006.
