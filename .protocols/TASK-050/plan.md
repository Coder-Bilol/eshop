---
task_id: TASK-050
stage: implementation
tier: T3
status: in_progress
---
# TASK-050 Implementation Plan

1. Add the authenticated `POST /store/checkout/order` boundary and bounded request/header validation.
2. Add pending-order pure helpers for 72-hour expiry, idempotency normalization/fingerprinting, cart/inventory mapping, and public result/error contracts.
3. Add a custom workflow using the existing lock pattern, server-side cart/variant revalidation, `validateCheckoutWorkflow`, `createOrderWorkflow`, and `reserveInventoryStep` with compensation-safe reservation annotation.
4. Add a real Medusa/PostgreSQL integration smoke suite covering create, reservation linkage, duplicate retry, stock conflict/compensation, and provider isolation.
5. Run assigned typecheck, pending-order integration, workspace build, and Memory Bank lint gates when feasible.

## Intended local gates

- `npm --workspace apps/backend run typecheck`
- `npm --workspace apps/backend run test:integration -- pending-order`
- `npm run build`
- `node scripts/mb-lint.mjs`

## Handoff

- `/verify`, `/red-verify`, `/mb-sync`, status changes, and scheduler decisions belong to the scheduler/closure owner.

