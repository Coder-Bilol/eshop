---
description: Feature-level SDD hub for FT-003 guest cart persistence and authenticated merge.
status: active
owner: spec-improve
last_updated: 2026-07-02
source_of_truth:
  - .memory-bank/features/FT-003-guest-cart-persistence-merge.md
  - .memory-bank/requirements.md
  - .memory-bank/architecture/cart-runtime.md
  - .memory-bank/contracts/cart-api-data-contract.md
  - .memory-bank/contracts/cart-access-security.md
  - .memory-bank/domains/cart-merge-data.md
  - .memory-bank/states/cart-ownership-merge.md
---
# FT-003 Guest Cart Persistence And Merge

## Scope

FT-003 owns guest cart creation and mutation, browser-session recovery through
an opaque cart reference, authenticated merge into an existing compatible
customer cart, and same-variant quantity summing.

FT-003 does not own OAuth provider setup, checkout fields, order creation,
inventory reservation, payment, or email notifications.

## Normative Design Surface

- [.memory-bank/architecture/cart-runtime.md](../architecture/cart-runtime.md):
  feature architecture, component responsibilities, runtime/deployment, and
  synchronous event model.
- [.memory-bank/contracts/cart-api-data-contract.md](../contracts/cart-api-data-contract.md):
  reused Store REST routes, custom merge endpoint, payloads, errors, and
  idempotency behavior.
- [.memory-bank/contracts/cart-access-security.md](../contracts/cart-access-security.md):
  guest/authenticated access rules, ownership checks, credentials, and safety.
- [.memory-bank/domains/cart-merge-data.md](../domains/cart-merge-data.md):
  Medusa-owned cart persistence and the custom merge journal model/migration.
- [.memory-bank/states/cart-ownership-merge.md](../states/cart-ownership-merge.md):
  ownership and merge lifecycle, transitions, guards, and recovery.
- [.memory-bank/architecture/system-architecture.md](../architecture/system-architecture.md),
  [.memory-bank/contracts/api-guidelines.md](../contracts/api-guidelines.md), and
  [.memory-bank/states/order-payment-inventory.md](../states/order-payment-inventory.md):
  global architecture, HTTP, and lifecycle constraints.

## Design Area Matrix

| Area | Status | Authoritative source |
|---|---|---|
| Architecture Specification | complete | `architecture/cart-runtime.md` |
| Component Contract | complete | `architecture/cart-runtime.md` |
| API Contract | complete | `contracts/cart-api-data-contract.md` |
| Event Contract | complete, queue not applicable | `architecture/cart-runtime.md` |
| Data Contract | complete | `contracts/cart-api-data-contract.md` |
| Data Specification | complete | `domains/cart-merge-data.md` |
| State Specification | complete | `states/cart-ownership-merge.md` |
| Security/access contracts | complete | `contracts/cart-access-security.md` |

## Merge Semantics

- Line identity is the Medusa Product Variant ID, not SKU display text.
- Quantities from all source and target lines for the same variant are summed.
- The destination is the authenticated customer's most recently updated
  compatible active cart; compatibility requires the same region, currency, and
  sales channel as the source.
- If no compatible customer cart exists, the source cart is transferred to the
  authenticated customer and remains the active cart.
- More than one compatible customer cart is resolved deterministically by
  `updated_at DESC, id ASC`; non-selected carts are untouched.
- Stock or sellability conflict returns `409` and leaves both carts usable and
  unmerged. Quantities are never silently capped.
- After all target mutations succeed for `merge_into_existing`, the workflow
  soft-deletes the source cart through the Medusa Cart Module. It does not hard
  delete the cart or clear its lines.
- The source soft-delete is compensatable with `restoreCarts`; the journal is
  marked `completed` only after the source is no longer available through
  ordinary Store cart routes.
- A completed journal is looked up before source-cart retrieval. This lets a
  retry return the recorded target even though the consumed source cart is
  soft-deleted.
- Repeating a completed merge for the same source cart and customer returns the
  recorded target without changing quantities.

## UX Contract

- Add-to-cart creates a guest cart lazily when no usable reference exists.
- Cart view supports add, absolute quantity update, remove, empty, loading,
  stale-reference recovery, validation, conflict, and backend-failure states.
- On a stale/not-found reference, the storefront clears the local reference; it
  does not reconstruct a cart from cached line items.
- After authenticated merge success, the stored reference switches atomically
  to the returned target cart ID before the UI renders the merged result.
- A stale tab that still holds a consumed source ID receives not-found from
  ordinary cart retrieval/mutation, clears that reference, and may adopt the
  recorded target only through an authenticated merge replay.
- Merge conflict keeps the source reference and shows a recoverable message.
- The actual Google/VK login UI and callback are FT-004.

## Anti-goals

- No browser-authoritative cart contents or totals.
- No duplicate custom cart CRUD API.
- No Medusa Core modification.
- No direct storefront database access.
- No queue, broker, cache, distributed transaction system, or microservice.
- No live OAuth provider dependency for FT-003 verification.
- No checkout, order, inventory reservation, payment, or production mutation.

## Verification Targets

- PostgreSQL-backed integration proves create/read/update/delete and restart-safe
  cart recovery through Medusa.
- Unit tests prove local reference parsing/versioning and merge-plan aggregation.
- Integration tests prove ownership guards, deterministic target selection,
  transfer-without-target, same-variant summing, incompatible/stock conflicts,
  source soft-delete, Store-route rejection of the consumed source, restore
  compensation after partial failure, and repeated-request idempotency when the
  source no longer resolves.
- Browser E2E proves product-detail handoff to guest cart, reload/new browser
  context recovery, quantity update/remove, and storefront state switch after a
  simulated authenticated merge.
- Security evidence proves a customer cannot merge a cart owned by another
  customer or choose a foreign destination.

## Open Questions

None blocking feature design. FT-004 must integrate its completed authentication
callback with the merge handoff; live provider login remains outside FT-003.
The TASK-017..TASK-026 records and Execution Packets were refreshed from this
repair on 2026-07-03. Run strict `/mb-doctor` before execution.
