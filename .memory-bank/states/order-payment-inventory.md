---
description: Authoritative order, payment, inventory, and cart lifecycle guardrails.
status: active
owner: spec-design
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/domains/core-domain.md
  - .memory-bank/invariants.md
  - .memory-bank/architecture/system-architecture.md
---
# Order Payment Inventory State

## Scope

This file defines global lifecycle guardrails for order, payment, inventory reservation, and cart ownership. Exact Medusa v2 extension points, database fields, and endpoint schemas belong to feature-local SDD specs from `/prd-to-tasks`, standalone `/spec-improve` repair outputs, and implementation tasks.

## Ownership

- Backend workflows/modules own lifecycle transitions.
- PostgreSQL-backed Medusa/custom data owns durable state.
- Storefront pages can request and display state but cannot directly confirm
  payment, change order status, finalize inventory, or force order success.
- In the current MVP, authenticated Medusa Admin is the payment and order-status
  authority. YooKassa is a deferred optional provider profile.

## Order Lifecycle

Allowed MVP states:

- `pending_payment`
- `paid`
- `processing`
- `completed`
- `canceled`
- `refunded`

Allowed global transitions:

| From | To | Trigger | Required guard |
|---|---|---|---|
| none | `pending_payment` | Authenticated checkout creates order before payment. | Inventory reservation succeeds or the order is not created. |
| `pending_payment` | `paid` | Native Medusa Admin marks the unpaid payment collection as paid. | Admin authorization is present, collection belongs to the order, and the order is still pending. |
| `pending_payment` | `canceled` | Native Medusa Admin cancels the unpaid order; the existing FT-007 expiry path remains a compatibility cleanup path. | Reserved inventory is released exactly once and the order remains auditable. |
| `paid` | `processing` | Native Medusa Admin fulfillment step. | Payment state remains successful. |
| `processing` | `completed` | Native Medusa Admin completion step. | Required order data remains visible in Medusa Admin. |
| `paid` or `processing` or `completed` | `refunded` | Native Medusa Admin refund step, when needed. | Payment/refund state and inventory/accounting effects are explicitly handled. |

State mapping for expiry:

- `canceled` is the global product lifecycle state and the native Medusa terminal
  order status for an expired pending order.
- FT-007 may persist `checkout_state: expired` as a feature-local logical reason
  projection for a 72-hour timeout. `expired` is not a second peer native/global
  order status; it maps to global/native `canceled` and exists to distinguish
  timeout from explicit cancellation in audit and retry guards.

Forbidden transitions:

- Storefront request or return page -> `paid`.
- Forged internal source/actor or cross-order payment reference -> any lifecycle transition.
- Duplicate Admin/native event -> duplicate transition side effects.
- `pending_payment` timeout -> `canceled` after the order is already `paid`.
- Any transition that bypasses inventory release/finalize rules.
- Any status mutation that hides required order/payment/delivery fields from Medusa Admin.

## Payment Lifecycle

Global payment states:

- `initiated`
- `waiting`
- `successful`
- `failed`
- `refunded`

Current MVP payment profile:

- The customer-facing payment choice is a personal/offline request; the
  storefront does not create a provider payment or redirect the customer.
- A native system payment collection (`pp_system_default`) is used only so the
  built-in Admin Order Detail can mark the amount as paid.
- The native Admin `paymentCollection.markAsPaid` operation is the authoritative
  successful-payment event. No external webhook is required.

Future provider profile rules:

- Any future payment attempts remain linked to a `pending_payment` order.
- Provider retry, webhook authenticity, and provider idempotency are deferred to
  FT-009 and cannot change the current Admin-only authority without a new
  approved contract.
- Duplicate Admin/native events must not duplicate order transitions,
  reservation changes, or emails.

## Inventory Reservation Lifecycle

Global reservation states:

- `available`
- `reserved`
- `released`
- `finalized`

Rules:

- Creating a `pending_payment` order reserves inventory for the ordered variants/SKU.
- Reservation failure blocks order creation or returns a domain conflict.
- Admin-confirmed payment keeps the native reservation while the order is paid
  or processing; the supported Medusa fulfillment workflow consumes the hold
  and adjusts inventory. Payment confirmation alone never deletes a reservation or
  directly mutates stock quantities.
- Timeout, cancel, or unrecoverable failed payment releases the reservation exactly once.
- Refund inventory effects are not assumed globally; feature-local design must decide whether refund returns stock, requires operator action, or uses another Medusa-supported flow.

## Cart Ownership Lifecycle

Global cart ownership states:

- `guest-owned`
- `customer-owned`
- `merged`

Rules:

- Guest cart may persist between browser sessions through a non-authoritative cart reference.
- Login before payment merges the guest cart into the authenticated customer's cart when both exist.
- Identical variants/SKU are summed during merge.
- Stock constraints are revalidated before order creation, not trusted from stale browser state.
- Wishlist/favorites require authenticated customer ownership.

## Idempotency Requirements

- Store durable processed-event state only if a future provider profile is
  activated.
- Current Admin/native event handling must reject duplicate side effects and
  cross-order identifiers.
- Email triggers linked to repeated payment/order events must suppress duplicates
  where customer-visible duplication is possible.
- Transition guards must be testable without live provider mutation.

## Verification Targets

- Unit tests for transition guards and 72-hour timeout calculation.
- Integration tests for pending order creation, reservation release/finalize, webhook idempotency, and duplicate-email suppression where applicable.
- E2E tests for return-page waiting/result behavior driven by backend/webhook state.
- T2/T3 closure must follow [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md).

## Resolved Feature Handoffs

- FT-007 owns native reservation creation, pending expiry, and release for
  unpaid orders.
- FT-008 resolves the logical `paid`/`processing`/`completed`/`canceled`/
  `refunded` projection for the Admin-only payment profile and keeps holds until
  native fulfillment consumes them; native Admin remains the operator surface.
- FT-009 remains a deferred optional provider profile and has no call into the
  current FT-008 payment transition boundary.
- Refund projection does not automatically restock inventory; stock return is an
  explicit native operator return/fulfillment path.
