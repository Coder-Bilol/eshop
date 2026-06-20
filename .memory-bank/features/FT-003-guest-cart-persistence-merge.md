---
description: Feature FT-003 - guest cart persistence and merge.
status: draft
lifecycle: planned
---
# FT-003 Guest Cart Persistence Merge

## Use Cases

- Buyer creates and updates a cart before login.
- Guest cart persists between browser sessions.
- Guest cart merges into existing user cart after login.

## Acceptance Criteria

- Covers REQ-006, REQ-007, REQ-008.
- Guest cart can be created and updated.
- Guest cart survives a new browser session.
- On login, guest and user carts merge, and identical variants/SKU are summed.

## Edge Cases & Failure Modes

- Guest and user cart contain the same SKU.
- User has no existing cart.
- Merge creates quantity above available stock.

## Test Strategy Pointers

- Unit/integration: cart merge logic.
- E2E: guest cart persistence and merge after login.

## Source Artifacts

- [.memory-bank/prd.md](../prd.md)
- [.memory-bank/states/lifecycle-map.md](../states/lifecycle-map.md)

## Normative Inputs

- [.memory-bank/invariants.md](../invariants.md)

## SDD Design Gate

- Global `/spec-design` gate is complete; verify it before task decomposition.
- Global backbone links: [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md), [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md).
- Run `/prd-to-tasks FT-003`; it owns feature-level SDD design before task slicing and will set `spec_design_status: complete|not_required|blocked`.
- Design focus: cart ownership, merge semantics, stock validation after merge.
- Use standalone `/spec-improve FT-003` only for repair/refresh without creating or updating task records.
