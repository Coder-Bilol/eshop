---
description: Feature FT-003 - guest cart persistence and merge.
status: draft
lifecycle: verified
spec_design_status: complete
spec_design_links:
  - .memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/architecture/cart-runtime.md
  - .memory-bank/contracts/cart-api-data-contract.md
  - .memory-bank/contracts/cart-access-security.md
  - .memory-bank/domains/cart-merge-data.md
  - .memory-bank/states/cart-ownership-merge.md
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
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md)
- [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md)
- [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md)
- [.memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md](../tech-specs/FT-003-guest-cart-persistence-merge.md)
- [.memory-bank/architecture/cart-runtime.md](../architecture/cart-runtime.md)
- [.memory-bank/contracts/cart-api-data-contract.md](../contracts/cart-api-data-contract.md)
- [.memory-bank/contracts/cart-access-security.md](../contracts/cart-access-security.md)
- [.memory-bank/domains/cart-merge-data.md](../domains/cart-merge-data.md)
- [.memory-bank/states/cart-ownership-merge.md](../states/cart-ownership-merge.md)

## SDD Design Gate

- Global `/spec-design` gate: complete.
- Feature-level SDD: complete; the linked specs define architecture, component,
  API, event, boundary payload, persistence, state, and access/security contracts.
- Repair decision: an existing-target merge soft-deletes the source through the
  Medusa Cart Module, restores it during compensation, and resolves completed
  replay from the journal before source retrieval.
- Implementation route: the repaired TASK-017..TASK-026 queue and packets are
  current; run strict `/mb-doctor` before the first `/execute`.

## Constraints

- Medusa Cart Module and PostgreSQL remain the durable cart source of truth.
- Browser persistence stores only the opaque cart reference and schema version,
  never authoritative line items, totals, ownership, or availability.
- Reuse Medusa Store cart and line-item routes; do not create duplicate CRUD APIs.
- FT-003 may consume authenticated customer context but does not implement Google
  OAuth or VK ID; provider login remains FT-004.
- Merge must be retry-safe, must sum by Medusa Product Variant ID, and must not
  silently truncate quantities when stock validation fails.
- After a merge into an existing customer cart succeeds, the source cart is
  soft-deleted through the Medusa Cart Module; a no-target ownership transfer
  keeps the source cart active as the target.
- Completed-merge replay is resolved from the durable journal before source-cart
  retrieval, so a soft-deleted source cannot cause duplicate quantities.
- No queue, broker, cache service, or separate deployable is introduced.

## Verification Targets

- Guest cart create/add/update/remove reads and writes through the Medusa Cart
  Module and PostgreSQL.
- A browser reload/new context restores the cart from the persisted opaque ID.
- Authenticated merge selects only a cart owned by the authenticated customer.
- Same-variant quantities are summed exactly once across repeated merge requests.
- After an existing-target merge, standard Store CRUD calls for the consumed
  source cart return not found, while authenticated merge replay returns the
  recorded target without mutation.
- No target cart, incompatible cart, insufficient stock, foreign-owned source,
  stale reference, source soft-delete, restore compensation, partial failure,
  and retry paths have executable evidence.
- FT-003 does not claim OAuth provider login, checkout, inventory reservation,
  order, or payment completion.

## Verification Status

- Historical feature-level `/red-verify --feature FT-003` returned
  `SEMANTIC_VERDICT: semantic-concern` on 2026-07-13 because source-runtime
  canonical fixture evidence was not reproducible.
- Remediation now passes seed -> product-detail smoke -> backend acceptance in
  order, and the feature red-verification retry returned
  `SEMANTIC_VERDICT: semantic-pass`. See
  [.tasks/FT-003/FT-003-S-RED-VERIFY-final-report-docs-02.md](../../.tasks/FT-003/FT-003-S-RED-VERIFY-final-report-docs-02.md).
- FT-003 lifecycle is `verified` after explicit manual closure by the user on
  2026-07-13; REQ-006 through REQ-008 have matching verified RTM evidence.
