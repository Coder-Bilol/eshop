---
description: Feature FT-004 - OAuth login before payment.
status: draft
lifecycle: planned
---
# FT-004 OAuth Login Before Payment

## Use Cases

- Buyer logs in through Google OAuth.
- Buyer logs in through VK ID.
- Checkout blocks payment until buyer is authenticated.

## Acceptance Criteria

- Covers REQ-010, REQ-011, REQ-012.
- Google OAuth login is available.
- VK ID login is available.
- Guest buyer cannot proceed to payment until authenticated.

## Edge Cases & Failure Modes

- OAuth provider error or canceled login.
- Existing user returns during checkout.
- Login succeeds while guest cart exists and must be merged.

## Test Strategy Pointers

- Integration/e2e: OAuth login flows with provider mocks where possible.
- E2E: payment gate requires authenticated user.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/contracts/boundary-map.md](../contracts/boundary-map.md)

## Normative Inputs

- [.memory-bank/constitution.md](../constitution.md)
- [.memory-bank/invariants.md](../invariants.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md).
- Run `/prd-to-tasks FT-004`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: auth boundary, identity ownership, privacy/security, callback/config setup.
- Auth work is high-risk and likely T3 under tier policy.
- Use standalone `/spec-improve FT-004` only for repair/refresh without creating or updating task records.
