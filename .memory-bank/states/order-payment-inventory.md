---
description: Authoritative order, payment, inventory, and cart lifecycle guardrails.
status: active
owner: spec-design
last_updated: 2026-06-19
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
- Storefront pages can request and display state but cannot directly confirm payment, finalize inventory, or force order success.
- YooKassa webhook is the payment status source of truth.

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
| `pending_payment` | `paid` | Authenticated YooKassa webhook confirms payment success. | Webhook is authentic and idempotency check passes. |
| `pending_payment` | `canceled` | 72-hour timeout, explicit cancel, or unrecoverable payment path. | Reserved inventory is released exactly once. |
| `paid` | `processing` | Operator/backend fulfillment step. | Payment state remains successful. |
| `processing` | `completed` | Operator/backend completion step. | Required order data remains visible in Medusa Admin. |
| `paid` or `processing` or `completed` | `refunded` | Confirmed refund workflow. | Payment/refund state and inventory/accounting effects are explicitly handled. |

State mapping for expiry:

- `canceled` is the global product lifecycle state and the native Medusa terminal
  order status for an expired pending order.
- FT-007 may persist `checkout_state: expired` as a feature-local logical reason
  projection for a 72-hour timeout. `expired` is not a second peer native/global
  order status; it maps to global/native `canceled` and exists to distinguish
  timeout from explicit cancellation in audit and retry guards.

Forbidden transitions:

- Return page -> `paid`.
- Duplicate webhook -> duplicate transition side effects.
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

Rules:

- Payment attempts are linked to a `pending_payment` order.
- Payment retry is allowed while the pending order remains valid.
- Webhook processing is authoritative for `successful`, `failed`, and `refunded` outcomes.
- Return page polling can show waiting/result based on backend state only.
- Duplicate webhook events must be recognized and must not duplicate order transitions, reservation changes, or emails.

## Inventory Reservation Lifecycle

Global reservation states:

- `available`
- `reserved`
- `released`
- `finalized`

Rules:

- Creating a `pending_payment` order reserves inventory for the ordered variants/SKU.
- Reservation failure blocks order creation or returns a domain conflict.
- Successful payment finalizes or otherwise commits the reservation according to the selected Medusa extension model.
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

- Store durable processed-event or equivalent replay state for YooKassa webhook handling.
- Idempotency keys must include enough provider/payment/order identity to reject duplicate side effects.
- Email triggers linked to repeated payment/order events must suppress duplicates where customer-visible duplication is possible.
- Transition guards must be testable without live provider mutation.

## Verification Targets

- Unit tests for transition guards and 72-hour timeout calculation.
- Integration tests for pending order creation, reservation release/finalize, webhook idempotency, and duplicate-email suppression where applicable.
- E2E tests for return-page waiting/result behavior driven by backend/webhook state.
- T2/T3 closure must follow [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md).

## Open Design Questions

- FT-007 resolved reservation creation through native reservation items and
  timeout release through native order cancellation. FT-008/FT-009 must still
  choose the exact payment-success finalization path.
- FT-007 resolved `pending_payment` and expiry mapping; FT-008/FT-009 must still
  define final paid/processing/Admin projection details.
- Refund inventory behavior.

The remaining questions are feature-local blockers for FT-008 and FT-009, not
blockers for the global backbone or the verified FT-007 boundary.
