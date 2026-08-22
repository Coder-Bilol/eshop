---
description: TASK-053 implementation handoff for expired pending-order replay conflict.
status: complete
---
# TASK-053 Implementation Handoff

## Outcome

The existing FT-007 idempotency key remains discoverable after expiry changes
the logical order metadata to `expired`. The pre-existing ownership,
fingerprint, native-status, and expiry guard now returns sanitized
`409 checkout_idempotency_conflict` instead of allowing a replacement order.

Backend and real-browser evidence prove normal `201 -> 200` replay, controlled
expiry/release, expired same-key `409`, unchanged post-expiry order/reservation
counts, sanitized error UI with no stale success panel, provider isolation,
privacy, and post-cleanup artifact publication.

## Changed runtime files

- `apps/backend/src/workflows/checkout/create-pending-order.ts`
- `apps/backend/src/scripts/smoke-pending-order.ts`
- `apps/storefront/e2e/run-real-medusa-e2e.cjs`

No new ledger, service, route, public contract, provider behavior, Admin
projection, Medusa Core change, or production operation was introduced.

## Gates

- Backend/storefront typechecks and pending-order source contract: PASS.
- Real Medusa/PostgreSQL pending-order acceptance: PASS.
- Real Edge/Next.js/compiled-Medusa/PostgreSQL e2e: PASS.
- Full workspace production build: PASS.
- Memory Bank lint and `git diff --check`: PASS; line-ending warnings only.
- Privacy, process, port, temp-ledger, and visual artifact audits: PASS.

## Evidence

- `.tasks/TASK-053/backend-acceptance-20260821.status.json`
- `.tasks/TASK-053/browser-pending-order-20260821.status.json`
- `.tasks/TASK-053/playwright/pending-order-browser-report.json`
- `.tasks/TASK-053/playwright/pending-order.png`
- `.tasks/TASK-053/workspace-build-20260821.status.json`

## Operational note

One browser attempt stopped in the shared checkout-fixture bootstrap after the
legacy 240-second child timeout on the slow filesystem. Failure-atomic cleanup
left no fixture ledger, process, or port. The pending-order suite now uses a
bounded 600-second budget for that same Medusa CLI phase; assertions and the
checkout-delivery suite default remain unchanged.

Blockers: none.
