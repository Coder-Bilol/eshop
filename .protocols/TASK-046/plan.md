---
description: Implementation plan for TASK-046 Admin-managed checkout delivery options.
status: in_progress
---
# TASK-046 Plan

## Inputs

- `.memory-bank/tasks/TASK-046.task.json`
- `.memory-bank/packets/TASK-046.packet.json`
- `.memory-bank/tech-specs/FT-006-checkout-delivery-methods.md`
- `.memory-bank/architecture/checkout-delivery-runtime.md`
- `.memory-bank/domains/checkout-delivery-data.md`
- `.memory-bank/contracts/checkout-delivery-api.md`
- `.memory-bank/contracts/api-guidelines.md`
- `.memory-bank/testing/index.md`
- `.memory-bank/tasks/plans/IMPL-FT-006.md`
- `.memory-bank/analysis/brainstorming/BR-002.md`

## Plan

1. Add a pure Admin Shipping Option / price-set projection adapter with explicit stable IDs, availability, and fail-closed validation.
2. Resolve current configured options through the installed Fulfillment Module and resolve Admin-managed prices through the installed link/query boundary.
3. Register the installed built-in manual fulfillment provider in the bounded backend configuration scope so synthetic Admin Shipping Options can be created locally.
4. Add a synthetic Medusa exec smoke that creates no durable fixtures and proves configured-source projection, order, 0/500/700 RUB amounts, unavailable behavior, and no fallback.
5. Register the required integration suite and package command.
6. Run integration, typecheck, and Memory Bank lint; record substantive sanitized evidence.

## Intended Gates

- `npm --workspace apps/backend run test:integration -- checkout-delivery-options`
- `npm --workspace apps/backend run typecheck`
- `node scripts/mb-lint.mjs`

## Handoff

- `/verify` remains scheduler-owned and is not run by this Implementer.
- TASK status, packet, closure, promotion, `/red-verify`, and `/mb-sync` remain scheduler-owned.
