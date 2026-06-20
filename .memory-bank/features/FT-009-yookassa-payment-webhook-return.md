---
description: Feature FT-009 - ЮKassa payment, webhook, and return flow.
status: draft
lifecycle: planned
---
# FT-009 ЮKassa Payment Webhook Return

## Use Cases

- Buyer starts payment by card, СБП, or SberPay.
- Buyer returns to storefront after payment attempt.
- ЮKassa webhook updates payment/order status.
- Buyer retries payment while pending order is valid.

## Acceptance Criteria

- Covers REQ-020 and REQ-023 through REQ-026.
- ЮKassa supports cards, СБП, and SberPay.
- Webhook is the source of truth for payment status.
- Duplicate webhook events are idempotent.
- Return page shows waiting/result state but does not confirm payment authoritatively.

## Edge Cases & Failure Modes

- Webhook arrives before return page.
- Return page loads before webhook.
- Webhook is repeated.
- Payment fails and buyer retries.
- ЮKassa credentials/webhook URL are missing in local/staging.

## Test Strategy Pointers

- Integration: webhook status mapping and idempotency.
- E2E: payment return waiting/result behavior with simulated webhook.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/states/lifecycle-map.md](../states/lifecycle-map.md)
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)

## Normative Inputs

- [.memory-bank/invariants.md](../invariants.md)
- [.memory-bank/constitution.md](../constitution.md)
- [.memory-bank/workflows/tier-policy.md](../workflows/tier-policy.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md).
- Run `/prd-to-tasks FT-009`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: payment source of truth, idempotency, status mapping, local/staging webhook setup, compliance risk.
- Payment work is high-risk and likely T3 under tier policy.
- Use standalone `/spec-improve FT-009` only for repair/refresh without creating or updating task records.
