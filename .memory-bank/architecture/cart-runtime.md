---
description: FT-003 cart architecture, component contracts, source of truth, runtime, deployment, and event model.
status: active
owner: spec-improve
last_updated: 2026-07-02
source_of_truth:
  - .memory-bank/architecture/system-architecture.md
  - .memory-bank/tech-specs/FT-003-guest-cart-persistence-merge.md
---
# Cart Runtime Architecture

## Architecture Specification

FT-003 stays inside the existing modular monolith:

```text
Next.js cart UI
  -> storefront cart client + reference adapter
  -> Medusa Store REST API
  -> core cart workflows / custom merge workflow
  -> Medusa Cart Module + Cart Merge Module
  -> PostgreSQL
```

There is no direct storefront-to-database access and no additional service,
container, queue, cache, or runtime process.

## Source Of Truth

- Medusa Cart Module/PostgreSQL owns carts, line items, customer association,
  price-derived fields, completion state, and the source cart's soft-deleted
  state after an existing-target merge.
- Cart Merge Module/PostgreSQL owns merge attempt identity, immutable merge plan,
  outcome, and retry result.
- Authenticated Medusa request context owns the current customer ID.
- Browser local storage owns only the non-authoritative reference envelope
  `{ version, cart_id }`.
- UI state and product-detail handoff are transient and never override backend
  cart or inventory decisions.

## Module Boundaries

| Module | Owns | Must not own |
|---|---|---|
| Storefront cart reference adapter | Versioned local reference read/write/clear. | Items, totals, ownership, auth tokens. |
| Storefront cart client | Store REST requests and response/error normalization. | DB access or customer identity decisions. |
| Cart UI/provider | Loading, optimistic-disabled mutation states, recovery, visible merged result. | Durable truth or silent conflict resolution. |
| Medusa Store Cart routes | Core create/retrieve/add/update/remove operations. | Cross-cart merge semantics. |
| Cart merge route | HTTP auth/input/output boundary for one source cart. | Quantity computation or persistence. |
| Cart merge workflow | Locking, validation, target selection, merge plan execution, compensation. | Provider login or checkout/order behavior. |
| Medusa Cart Module | Cart and line-item persistence and core validation. | Custom merge idempotency journal. |
| Cart Merge Module | Merge journal and deterministic retry lookup. | Duplicate cart/line-item copies. |

## Component Contract

### Storefront reference adapter

- Returns `null` for missing, malformed, unsupported-version, or empty IDs.
- Writes only after backend cart creation or successful merge response.
- Clears stale references on backend `404`.
- Never stores cart payload snapshots.

### Storefront cart client

- Always sends `x-publishable-api-key`.
- Sends `credentials: include` for the authenticated merge call.
- Uses absolute quantities for line updates.
- Converts transport errors to the stable application error codes documented in
  the cart API contract.

### Cart merge route

- Requires authenticated `customer` actor context.
- Takes source cart ID only from the path.
- Does not accept destination cart/customer IDs from the client.
- Resolves a completed journal replay before requiring the source cart to be
  readable, then verifies that the journal customer matches the actor.
- Returns only after workflow completion or an explicit error.

### Cart merge workflow

- Acquires source and target locks in lexicographic cart-ID order.
- Validates source ownership and target compatibility before mutation.
- Reuses a completed journal result before calculating or applying quantities.
- Applies the immutable plan with Medusa core cart workflows.
- Compensates already-applied line mutations if a later mutation fails.
- For `merge_into_existing`, soft-deletes the source through the Medusa Cart
  Module after target mutations succeed; it never hard-deletes or clears the
  source.
- Restores a soft-deleted source before reversing target mutations when a later
  step fails.
- Marks the journal `completed` only after target mutations are durable and the
  source is soft-deleted.

### Cart Merge Module

- Enforces unique `source_cart_id`.
- Does not use cross-module database foreign keys to core Medusa tables.
- Stores no contact data, auth token, cookie, OAuth credential, or provider data.

## Consumed Source Boundary

- The completed merge journal is the durable source-to-target redirect record.
- Medusa's supported `softDeleteCarts` operation makes the consumed source
  unavailable to ordinary Store retrieve/add/update/remove routes.
- Medusa's supported `restoreCarts` operation is used only by workflow
  compensation before a merge is committed.
- The no-compatible-target path is different: the source is transferred to the
  authenticated customer and remains the active, non-deleted target.
- No middleware wrapper is added around all built-in cart CRUD routes; the
  Cart Module's soft-delete behavior provides the KISS terminal boundary.

## Runtime And Deployment

- Local runtime remains Windows-native Next.js on port 3000, Medusa on port
  9000, and local PostgreSQL.
- Production/deployment topology is unchanged by FT-003.
- One Medusa module migration is required for the merge journal.
- Migration rollback drops only the FT-003 merge-journal table/indexes and must
  never modify Medusa core cart tables.
- No new environment secret is introduced. Existing backend/store CORS,
  publishable key, JWT, and cookie configuration remains authoritative.

## Event Contract

FT-003 has no custom asynchronous event contract:

- no queue, topic, consumer, ordering partition, retry worker, or DLQ;
- merge is a synchronous command workflow;
- ordering is enforced by deterministic source/target locks;
- HTTP retries are resolved by the unique durable merge journal;
- API success is returned only after journal and cart mutations are committed.

Medusa framework-owned cart events may still be emitted by reused core workflows,
but FT-003 does not add consumers or use those events as proof of merge success.
Future consumers require a new explicit contract; they must not infer semantics
from internal event names.
