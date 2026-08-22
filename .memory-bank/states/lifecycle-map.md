---
description: Lifecycle hints for decomposition before full state design.
status: active
owner: spec-init
last_updated: 2026-08-21
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/domains/core-domain.md
---
# Lifecycle Map

## Order

- Lifecycle Summary: commercial order is created before payment and then progresses through payment and fulfillment states.
- States: `pending_payment`, `paid`, `processing`, `completed`, `canceled`, `refunded`.
- Transitions needing later detail:
  - `pending_payment -> paid` by authoritative ЮKassa webhook.
  - `pending_payment -> canceled` after 72-hour timeout or explicit cancel.
  - `paid -> processing -> completed` through operator workflow.
  - refund/cancel transitions and inventory effects.
- Questions:
  - FT-007 pending/expiry mapping is resolved; FT-008/FT-009 still own final
    paid/processing/Admin projection and event details.

## Payment

- Lifecycle Summary: ЮKassa payment status drives order payment state; return page is not authoritative.
- States: initiated, waiting, successful, failed, refunded.
- Transitions needing later detail:
  - payment initiation from pending order.
  - webhook idempotency and replay handling.
  - payment failure with retry while pending order is still valid.
- Questions:
  - Local/staging webhook URL and credentials setup.

## Inventory Reservation

- Lifecycle Summary: stock is reserved while order is in `pending_payment`.
- States: available, reserved, released, finalized.
- Transitions needing later detail:
  - reserve when pending order is created.
  - release on timeout/cancel/payment failure after retry window.
  - finalize on successful payment.
  - reverse or compensate on refund.
- Questions:
  - FT-007 native reservation creation and timeout release are resolved;
    payment-success finalization and refund effects remain FT-009/FT-008 work.

## Cart

- Lifecycle Summary: guest cart can become customer-owned through login.
- States: guest-owned, customer-owned, merged.
- Transitions needing later detail:
  - merge guest cart into existing user cart.
  - sum identical product variants/SKU.
  - preserve user-visible result after merge.
- Questions:
  - None blocking PRD decomposition.
