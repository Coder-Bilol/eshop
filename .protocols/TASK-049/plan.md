---
description: Execution plan for TASK-049 final FT-006 runtime acceptance harness.
status: in_progress
---
# TASK-049 Plan

## Scope

- Tier: `T3`.
- Packet: `.memory-bank/packets/TASK-049.packet.json`.
- Runtime allowed paths: `apps/backend/src/scripts/smoke-checkout-delivery-acceptance.ts`,
  `apps/backend/test/run-integration.cjs`,
  `apps/storefront/e2e/run-real-medusa-e2e.cjs`, both listed package files, and
  `.memory-bank/changelog.md`.

## Implementation plan

1. Add a backend acceptance script with synthetic customer/Admin Shipping
   Options fixtures, real compiled Medusa HTTP bearer/session requests, field and
   tariff/payment assertions, unavailable fail-closed proof, mutation counts,
   source boundary scan, and unconditional cleanup.
2. Register the backend acceptance suite and package entry without disturbing
   TASK-047 suites.
3. Extend the existing real Medusa Playwright runner with a checkout suite using
   the local Google provider double, real session cookie, real storefront form,
   live Admin-option disable/recovery phase, sanitized report, and cleanup.
4. Run packet gates sequentially, then syntax/privacy/diff checks, and record
   evidence for the later owner of `/verify` and `/red-verify`.

## Required assertions

- Authenticated-ready checkout entry and backend actor authorization.
- Stable delivery IDs/order, Admin-backed `0/500/700 RUB`, all contact fields,
  conditional address, optional comment, and `card/sbp/sberpay` payment IDs.
- Normalization before safe limit, field/unavailable sanitized errors, and no
  silent unavailable-method substitution.
- Validated snapshot/payment-ID handoff only; orders, reservations,
  payment-collections, and provider requests remain unchanged/absent.
- Synthetic-only evidence and unconditional fixture/session/server/port cleanup.

## Handoff ownership

- This worker does not run `/verify`, `/red-verify`, or `/mb-sync`.
- Task lifecycle, semantic T3 closure, human checkpoint, rollback marker, and
  dependent/feature decisions remain scheduler/owner responsibilities.
