---
feature: FT-007
stage: decomposition
status: complete
---
# FT-007 Decision Log

## D-001 — Native Medusa order status mapping

- Decision: use native order `status: "pending"` and durable metadata
  `checkout_state: "pending_payment"` plus `pending_payment_expires_at`.
- Reason: Medusa v2.16 `OrderStatus` does not include `pending_payment`; changing
  Medusa Core or inventing a parallel order record would violate project
  boundaries and KISS.
- Consequence: FT-008 must project the logical state for Admin/operator views;
  downstream transitions must update the logical metadata under the same guards.

## D-002 — Native reservation workflow

- Decision: compose `createOrderWorkflow`, `reserveInventoryStep`, and
  `cancelOrderWorkflow`; use native Inventory reservation items linked by
  `line_item_id`.
- Reason: the installed v2.16 package exposes these supported extension points,
  including compensation for `reserveInventoryStep`.
- Consequence: no custom inventory ledger or direct stock quantity mutation is
  created; ambiguous multi-location allocation fails closed for the MVP.

## D-003 — Idempotency without a second ledger

- Decision: lock customer/cart/idempotency-key, persist the normalized key in order
  metadata, and reconcile an existing order before creating another.
- Reason: the MVP needs retry safety without adding an unneeded custom table; the
  lock pattern already exists in the project and metadata is durable.
- Consequence: metadata scans are acceptable for the MVP. A future scale-driven
  unique ledger requires a separate design and migration.

## D-004 — Expiration execution

- Decision: hourly Medusa cron invokes an idempotent expiration workflow that
  rechecks state, cancels the native pending order, and releases reservations by
  order line ID.
- Reason: Medusa v2.16 has a supported job loader and reservation deletion APIs;
  an in-process cron is sufficient for the Windows-native MVP.
- Consequence: partial cleanup remains retryable; paid/non-pending orders are
  guarded from automatic cancellation.

## Open Questions

- None block decomposition. FT-009 still owns provider-specific payment retry and
  webhook transitions; FT-008 owns final Admin mapping and lifecycle projection.
