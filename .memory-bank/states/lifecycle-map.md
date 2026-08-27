---
description: Lifecycle hints for decomposition before full state design.
status: active
owner: spec-init
last_updated: 2026-08-27
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/domains/core-domain.md
---
# Lifecycle Map

## Order

- Lifecycle Summary: commercial order is created before payment and then progresses through payment and fulfillment states.
- States: `pending_payment`, `paid`, `processing`, `completed`, `canceled`, `refunded`.
- Transitions needing later detail:
  - `pending_payment -> paid` by native Medusa Admin marking the unpaid system
    payment collection as paid in the current manual-payment profile.
  - `pending_payment -> canceled` by native Admin explicit cancel; the existing
    FT-007 timeout/release path remains a compatibility boundary and is not a
    provider or Store status mutation.
  - `paid -> processing -> completed` through operator workflow.
  - refund/cancel transitions and inventory effects are governed by the FT-008
    state spec; refund does not automatically restock.
- Questions:
  - FT-007 pending/expiry mapping is resolved; FT-008 owns the current
    Admin-only paid/processing/status projection. FT-009 is a deferred optional
    provider profile and must not be assumed by current FT-008 tasks.

## Payment

- Lifecycle Summary: the current personal/offline payment request is represented
  by an unpaid native system collection; native Admin confirmation drives order
  payment state. A future FT-009 provider profile may add a webhook; return page
  is never authoritative.
- States: initiated, waiting, successful, failed, refunded.
- Transitions needing later detail:
  - creation of the unpaid native system collection on a pending order.
  - native Admin mark-as-paid and refund/cancel guards.
  - future provider webhook idempotency and replay handling.
- Questions:
  - Local/staging webhook URL and credentials setup for the deferred provider
    profile; it does not block the current manual-payment flow.

## Inventory Reservation

- Lifecycle Summary: stock is reserved while order is in `pending_payment`.
- States: available, reserved, released, finalized.
- Transitions needing later detail:
  - reserve when pending order is created.
  - release on timeout/cancel/payment failure after retry window.
  - finalize on native fulfillment after Admin payment confirmation.
  - reverse or compensate on refund.
- Questions:
  - FT-007 native reservation creation and timeout release are resolved. FT-008
    keeps the hold through payment and lets native fulfillment consume it; refund
    projection does not automatically restock.

## Cart

- Lifecycle Summary: guest cart can become customer-owned through login.
- States: guest-owned, customer-owned, merged.
- Transitions needing later detail:
  - merge guest cart into existing user cart.
  - sum identical product variants/SKU.
  - preserve user-visible result after merge.
- Questions:
  - None blocking PRD decomposition.
