---
description: Epic EP-004 - payments and notifications.
status: draft
lifecycle: planned
---
# EP-004 Payments And Notifications

## Value

Support ЮKassa payment methods, authoritative webhook-driven payment status, safe retry/return behavior, and customer emails.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/states/lifecycle-map.md](../states/lifecycle-map.md)
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)
- [.memory-bank/invariants.md](../invariants.md)

## Features

- [FT-009 ЮKassa Payment Webhook Return](../features/FT-009-yookassa-payment-webhook-return.md)
- [FT-010 Order Email Notifications](../features/FT-010-order-email-notifications.md)

## Success Metrics

- ЮKassa card, СБП, and SberPay payment paths exist.
- Payment status is updated from webhook, not return page.
- Duplicate webhook events do not create duplicate orders or invalid transitions.
- Email notifications fire for required order/payment events.

## Acceptance Criteria

- Covers REQ-020 and REQ-023 through REQ-027.
- Payment correctness and idempotency are verified.

## Constraints / Invariants

- Webhook is authoritative.
- Return page is not authoritative.
- Payment tasks are high-risk and likely T3.
