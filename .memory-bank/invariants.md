---
description: Глобальные инварианты и запреты проекта (MUST/NEVER).
status: active
owner: spec-init
last_updated: 2026-06-18
source_of_truth:
  - .memory-bank/prd.md
  - .memory-bank/constitution.md
---
# Invariants

## MUST
- Preserve KISS and medium-complexity scope for MVP.
- Use Medusa extension boundaries: API -> Workflows -> Modules.
- Isolate external integrations as modules.
- Treat ЮKassa webhook as the authoritative payment status source.
- Handle repeated payment webhook events idempotently.
- Preserve customer/cart/order/payment/inventory data; no data loss.
- Reserve inventory while an order is in `pending_payment`.
- Expire or cancel unpaid pending-payment orders after 72 hours.
- Route auth, payments, order lifecycle, stock reservation, production/deploy, destructive data operations, and compliance-sensitive tasks according to high-tier policy when decomposed.

## NEVER
- Never modify Medusa Core for MVP behavior.
- Never use return page as authoritative payment confirmation.
- Never introduce microservices or enterprise abstractions for MVP.
- Never include 1С, СДЭК/Boxberry, bonuses/loyalty, marketplace, B2B, mobile app, SMS confirmation, or custom admin replacement in MVP.
- Never implement fiscalization/receipts inside MVP without explicit post-PRD decision.

## Notes
- These invariants are decomposition-shaping. Detailed contracts and state machines belong to `/spec-design` or feature-level specs after `/prd`.
