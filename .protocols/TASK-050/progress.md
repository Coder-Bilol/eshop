---
task_id: TASK-050
stage: implementation
tier: T3
status: in_progress
---
# TASK-050 Progress

## Preflight complete

- Read the worker contract, execute command, task record, packet, tier policy, FT-007 linked specs, and normative cross-feature specs.
- Confirmed TASK-049 is `done` and the task remains `in_progress` under scheduler ownership.
- Confirmed the requested write scope and forbidden scope.

## Changes

- Added the authenticated `/store/checkout/order` middleware boundary and
  sanitized route/request error handling.
- Added server-owned pending-order helpers for 72-hour expiry, normalized
  idempotency fingerprints/locks, cart-line mapping, location-safe reservation
  blueprints, metadata, and public result contracts.
- Added the custom FT-007 workflow using `validateCheckoutWorkflow`, native
  `createOrderWorkflow`, `reserveInventoryStep`, native workflow compensation,
  reservation annotation, and durable order metadata.
- Added the real Medusa/PostgreSQL `pending-order` integration smoke and wired it
  into `run-integration.cjs`.
- Fixed the Medusa Query graph shape for `stock_locations[]` and preserved
  nested workflow domain errors as stable public conflict/validation responses.
- Remediation confirmed: the workflow lock is scoped to authenticated
  `customer_id + cart_id`, and preparation reuses the existing valid pending
  order for that customer/cart before creating anything for a new key. A
  changed-key real integration assertion verifies same order and unchanged
  order/reservation counts.

## Final bounded remediation — retry 2/2

- Added only a local integration-harness seam in the TASK-050 workflow. When
  `inject_reservation_failure_after_order_creation` is true, the seam requires
  a real created native order and changes the first reservation input to a
  deterministic nonexistent inventory item before native `reserveInventoryStep`.
- The Store API route never passes this optional flag; the normal workflow,
  customer/cart guard, native Medusa boundaries, and provider isolation are
  unchanged.
- Added a second synthetic cart to the real pending-order smoke. The scenario
  reaches native order creation, native reservation fails with sanitized
  `checkout_order_failed`, and post-failure PostgreSQL counts plus the failure
  idempotency-key order lookup prove no partial order/reservation remains.

## Evidence

- Preflight evidence: `.protocols/TASK-050/context.md`.
- Integration evidence: `.tasks/TASK-050/pending-order-integration.log`.
- Gate summary and implementation handoff: `.protocols/TASK-050/verification.md`
  and `.protocols/TASK-050/handoff.md`.
- Remediation report: `.tasks/TASK-050/TASK-050-S-IMPL-final-report-code-03.md`.
- Final remediation evidence: `.tasks/TASK-050/TASK-050-S-IMPL-final-report-code-04.md`.
- Updated integration evidence: `.tasks/TASK-050/pending-order-integration.log`.
