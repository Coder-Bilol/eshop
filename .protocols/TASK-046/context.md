---
description: Execution context for TASK-046 Admin-managed checkout delivery options.
status: in_progress
---
# TASK-046 Context

## Task

- Tier: T2.
- Authoritative task: `.memory-bank/tasks/TASK-046.task.json`.
- Packet context: `.memory-bank/packets/TASK-046.packet.json` (scheduler-owned readiness; not validated here).
- Feature: FT-006 Checkout Delivery Methods.
- Dependency: TASK-015 is `done`.
- Approved bounded scope expansion: `apps/backend/medusa-config.ts` may register
  the installed built-in manual fulfillment provider solely for Admin/Shipping
  Options integration evidence.

## Goal Interpretation

- Purpose: project the configured Medusa Admin / Shipping Options into the FT-006 stable delivery-option shape.
- Success outcome: `pickup`, `city_courier`, and `transport_company` are returned in deterministic order with configured RUB amounts and explicit availability.
- Anti-goals: no checkout validation, storefront UI, order/inventory/payment behavior, external carrier, custom tariff registry, or Medusa Core change.

## Boundary Notes

- Source boundary: installed Medusa v2.16 `Modules.FULFILLMENT.listShippingOptionsForContext` for current configured/available options.
- Price boundary: Medusa Pricing linked through `LINKS.ShippingOptionPriceSet`, queried from `ContainerRegistrationKeys.REMOTE_QUERY`; prices are Admin-managed price-set records.
- Stable mapping boundary: Admin Shipping Option `type.code` or explicit metadata stable ID, never a hardcoded amount fallback.
- Money: Medusa amounts are integer minor units; RUB is projected as the configured amount with `currency_code: RUB`.
- Missing/invalid/unavailable configured option: remains unavailable or fails closed; it is never substituted.
- Provider boundary: `@medusajs/medusa/fulfillment` loads the installed
  `@medusajs/medusa/fulfillment-manual` provider with identifier `manual`.

## Allowed Writes

- `apps/backend/src/checkout/delivery-options.ts`
- `apps/backend/src/checkout/delivery-tariffs.ts`
- `apps/backend/src/scripts/smoke-checkout-delivery-options.ts`
- `apps/backend/test/run-integration.cjs`
- `apps/backend/package.json`
- `.memory-bank/changelog.md`
- `.protocols/TASK-046/*` and `.tasks/TASK-046/*` operational artifacts.

## Forbidden Writes

- Medusa Core or installed package files.
- Auth/session, order/inventory/payment, external delivery provider, production data, or credentials.
- TASK record, packet, scheduler state, verification/red-verification, or MB-SYNC outputs.

## Stop Conditions

- Installed v2.16 boundary cannot expose Admin / Shipping Options availability and values.
- Correct behavior requires a parallel hardcoded tariff source.
- Money/currency semantics cannot be represented without inventing a public contract.
