---
task_id: TASK-052
stage: implementation
tier: T3
status: complete
---
# TASK-052 Context

## Authoritative inputs

- Task: `.memory-bank/tasks/TASK-052.task.json`
- Packet: `.memory-bank/packets/TASK-052.packet.json` (`status: ready`)
- Tier policy: `.memory-bank/workflows/tier-policy.md`
- FT-007 specs: `.memory-bank/tech-specs/FT-007-pending-order-inventory-reservation.md`, `.memory-bank/architecture/pending-order-runtime.md`, `.memory-bank/contracts/pending-order-api.md`, `.memory-bank/domains/pending-order-inventory-data.md`, `.memory-bank/states/pending-order-inventory-lifecycle.md`
- Cross-feature inputs: `.memory-bank/contracts/checkout-delivery-api.md`, `.memory-bank/architecture/checkout-delivery-runtime.md`, `.memory-bank/states/customer-auth-session.md`, `.memory-bank/testing/index.md#ft-007-pending-order-and-inventory`
- Global guardrails: `.memory-bank/constitution.md`, `.memory-bank/spec-backbone.md`, `.memory-bank/spec-index.md`, `.memory-bank/invariants.md`, `.memory-bank/contracts/boundary-map.md`

## Goal interpretation

- Purpose: expose the pending-order handoff in the authenticated browser checkout and prove the complete Store API -> workflow -> native order/reservation -> expiry boundary.
- Success outcome: a fresh browser idempotency key creates one pending order; replay returns the same order; backend acceptance proves stock-conflict no mutation and controlled expiry releases reservations.
- Anti-goals: no payment/provider integration, Admin scope, FT-006 validation rewrite, Medusa Core edits, production data, secrets, or direct browser database access.
- Allowed write scope and forbidden scope are the exact lists in the task record.

## Preflight

- Dependencies TASK-050 and TASK-051 are `done`.
- Required T3 packet is ready and was checked at scheduler promotion.
- Two fresh `codex exec` attempts made no tool calls or artifacts and hung; execution continues in ROLE GENERAL fallback under the same task protocol.
- Concurrent user changes in `.memory-bank/index.md`, `.memory-bank/guides/`, `apps/storefront/app/globals.css`, `apps/storefront/app/page.tsx`, and `apps/storefront/components/product-universe.tsx` are unrelated and must remain untouched.
