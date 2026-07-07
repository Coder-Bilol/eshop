---
description: FT-003 internal cart and merge-journal data specification, persistence, and migration rules.
status: active
owner: spec-improve
last_updated: 2026-07-02
source_of_truth:
  - .memory-bank/domains/core-domain.md
  - .memory-bank/architecture/cart-runtime.md
  - .memory-bank/contracts/cart-api-data-contract.md
---
# Cart Merge Data Specification

## Persistence Ownership

Existing Medusa 2.16 models remain authoritative:

- `Cart`: region, currency, sales channel, optional customer, completion state,
  metadata, and line-item relation.
- `LineItem`: concrete Product Variant ID, quantity, display snapshot, price/tax
  data managed by Medusa.

FT-003 must use Medusa Cart Module/query/workflows. It must not create parallel
cart or line-item tables.

## Cart Merge Module

One custom Medusa module stores retry and recovery state. It has one model:
`CartMerge`.

| Field | Type | Constraint |
|---|---|---|
| `id` | Medusa ID | Primary key, prefix such as `cmerge`. |
| `source_cart_id` | text | Required, unique. |
| `target_cart_id` | text | Required after target resolution. |
| `customer_id` | text | Required authenticated actor ID. |
| `mode` | enum/text | `ownership_transfer` or `merge_into_existing`. |
| `status` | enum/text | `pending`, `completed`, or `failed`. |
| `plan` | JSON | Immutable normalized merge plan; empty for ownership transfer. |
| `failure_code` | nullable text | Stable internal failure category, no secret/PII. |
| `attempt_count` | integer | Starts at 1; incremented on controlled retry. |
| `completed_at` | nullable datetime | Set only with `completed`. |
| timestamps | framework-managed | `created_at`, `updated_at`, `deleted_at` as supported. |

Indexes:

- unique `source_cart_id`;
- `(customer_id, status)` for actor/recovery lookup;
- `target_cart_id` for diagnostics/recovery.

Cart/customer IDs are cross-module references stored as scalar IDs; do not add
direct database foreign keys into Medusa core module tables.

## Merge Plan Rules

- Aggregate source and target lines by `variant_id`.
- Sort plan items by `variant_id`.
- Store source quantity, target quantity before, absolute target quantity after,
  and optional existing target line-item ID.
- Plan becomes immutable once status is `pending`.
- Retrying applies absolute `target_quantity_after`; it never increments from
  the current value blindly.
- Variant display text/SKU is not an identity key.

## Transaction And Compensation

- Create/read the journal under the same source/target lock scope as merge plan
  execution.
- Each core cart mutation must have workflow compensation restoring the recorded
  `target_quantity_before` or deleting a newly added target line.
- Failure records `failed` only after compensation outcome is known.
- A failed record may be retried only when source/target/customer identity still
  matches and the immutable plan remains safe; otherwise return a conflict and
  require a new cart/user action.
- A completed record is immutable and serves replay responses.

## Source Cart Disposition

- `ownership_transfer`: source and target are the same cart; the supported
  customer-transfer workflow keeps it active.
- `merge_into_existing`: after all target line mutations succeed, call the
  Medusa Cart Module `softDeleteCarts` operation for the source cart.
- Do not hard-delete the source or clear its line items. Soft deletion preserves
  the source data for compensation and diagnostics while removing it from
  ordinary Store cart access.
- If a step fails after source soft-delete but before journal completion,
  compensation calls `restoreCarts` for the source before reversing target
  mutations.
- The journal may transition to `completed` only after the source soft-delete
  succeeds. A completed replay queries the journal first and does not require
  the source cart to resolve.
- If the recorded target is missing, replay fails explicitly; it never restores
  the source or recalculates the immutable plan automatically.

## Migration

- Add only the Cart Merge Module model/table and documented indexes.
- Generate/apply migration through supported Medusa module tooling.
- Repeated migration must be safe through normal migration tracking.
- Rollback removes only the custom merge-journal persistence.
- No migration may alter Medusa core cart/line-item tables.

## Data Retention

- No credentials or customer contact fields are stored.
- Journal retention policy is not a blocking FT-003 runtime requirement; records
  must remain at least as long as source-cart retry can occur.
- Destructive cleanup/production retention jobs are outside FT-003 and require a
  separate operational/security design.

## Persistence Verification

- Migration applies against local PostgreSQL and the module resolves at runtime.
- Integration creates a journal through the module service, restarts/re-resolves
  the runtime boundary, and reads the same record.
- Unique source constraint rejects a second independent plan.
- Cart CRUD/merge tests query persisted Medusa carts rather than browser mocks.
- Existing-target merge verification proves the source no longer resolves
  through ordinary Store CRUD, the target contains the exact summed quantities,
  replay still returns that target, and injected post-soft-delete failure
  restores the source and target pre-merge state.
