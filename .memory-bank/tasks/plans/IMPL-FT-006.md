---
description: Implementation plan for FT-006 authenticated checkout delivery methods.
status: active
owner: prd-to-tasks
last_updated: 2026-08-25
source_of_truth:
  - .memory-bank/features/FT-006-checkout-delivery-methods.md
  - .memory-bank/tech-specs/FT-006-checkout-delivery-methods.md
  - .memory-bank/requirements.md
---
# IMPL-FT-006 Checkout Delivery Methods

## Goal

Implement the authenticated FT-006 checkout continuation that collects and
validates contact/delivery/payment selection, resolves the three Admin-managed
delivery options and initial local tariffs, and hands validated data to FT-007
and FT-009 without creating an order or invoking a payment provider.

## Decomposition Closure

- Closure date: `2026-08-25`.
- The FT-006 implementation plan and task queue are closed for the current
  approved scope. TASK-046 through TASK-049 are authoritative `done`.
- The scoped Memory Bank review returned `APPROVE` for architecture, scope/RTM,
  plan/tasks, security, MBB compliance, and code quality.
- Quality gates passed: `node scripts/mb-lint.mjs` (144 files) and
  `node scripts/mb-doctor.mjs --strict` (0 errors, 0 warnings).
- Do not regenerate or extend this decomposition through `/prd-to-tasks FT-006`
  unless a product, normative-spec, or task-queue change reopens the scope.
- Review evidence: [FT-006 decomposition review](../../../.tasks/TASK-MB-REVIEW/TASK-MB-REVIEW-S-FINAL-FT006-final-report-docs-01.md).

## Source Artifacts

- [.memory-bank/features/FT-006-checkout-delivery-methods.md](../../features/FT-006-checkout-delivery-methods.md)
- [.memory-bank/tech-specs/FT-006-checkout-delivery-methods.md](../../tech-specs/FT-006-checkout-delivery-methods.md)
- [.memory-bank/architecture/checkout-delivery-runtime.md](../../architecture/checkout-delivery-runtime.md)
- [.memory-bank/contracts/checkout-delivery-api.md](../../contracts/checkout-delivery-api.md)
- [.memory-bank/domains/checkout-delivery-data.md](../../domains/checkout-delivery-data.md)
- [.memory-bank/states/checkout-delivery-validation.md](../../states/checkout-delivery-validation.md)
- [.memory-bank/architecture/system-architecture.md](../../architecture/system-architecture.md)
- [.memory-bank/contracts/api-guidelines.md](../../contracts/api-guidelines.md)
- [.memory-bank/contracts/boundary-map.md](../../contracts/boundary-map.md)
- [.memory-bank/states/customer-auth-session.md](../../states/customer-auth-session.md)
- [.memory-bank/states/order-payment-inventory.md](../../states/order-payment-inventory.md)
- [.memory-bank/testing/index.md](../../testing/index.md)
- [.memory-bank/workflows/tier-policy.md](../../workflows/tier-policy.md)
- [.memory-bank/analysis/brainstorming/BR-002.md](../../analysis/brainstorming/BR-002.md)
- [.memory-bank/epics/EP-003-checkout-order-inventory.md](../../epics/EP-003-checkout-order-inventory.md)

## Normative Inputs

- FT-006 linked SDD specs above are authoritative for implementation slicing.
- BR-002 is the accepted product decision source for tariff values, stable IDs,
  field rules, unavailable-method behavior, payment IDs, and feature boundaries.
- Constitution requires KISS, no Medusa Core changes, API -> Workflows -> Modules,
  privacy, and evidence before done.
- FT-004 `authenticated_ready` is the only buyer-facing checkout entry state;
  backend actor validation remains mandatory.
- FT-007 owns pending-order creation and persistence after snapshot handoff.
- FT-009 owns payment-provider integration after payment-ID handoff.

## Constraints

- Medusa Admin / Shipping Options is the only tariff/availability source.
- Initial local values are `pickup: 0 RUB`, `city_courier: 500 RUB`, and
  `transport_company: 700 RUB`, with stable order `pickup`, `city_courier`,
  `transport_company`.
- Required fields are `name`, `email`, `phone`, and `city`; `address` is
  conditional on courier/transport-company; `comment` is optional.
- Backend normalizes strings before applying safe length limits. Numeric limits are
  bounded implementation assumptions and must stay server-side.
- Unavailable delivery returns `422 delivery_method_unavailable`; recovery is
  retry or selecting another method.
- Payment IDs are only `card`, `sbp`, and `sberpay`.
- FT-006 creates no order, inventory reservation, payment attempt, or provider
  request. No external delivery integration is added.
- Do not add a custom durable checkout snapshot table or a second tariff registry.
- Evidence uses synthetic data and must not contain real PII, credentials, tokens,
  provider payloads, or production data.

## Invariants

- Storefront state never becomes authoritative for customer, tariff, order, or
  payment truth.
- The backend derives customer identity from the authenticated Medusa actor.
- Pickup does not require address; courier and transport-company do.
- A missing/unavailable option is never silently substituted or hardcoded.
- Successful FT-006 validation is a transient handoff, not order/payment success.
- FT-007 receives the validated checkout snapshot; FT-009 receives the selected
  payment ID, without FT-006 implementing their downstream behavior.

## Constitution Check

- KISS: one adapter for Admin/Shipping Options, one backend validation workflow,
  one storefront state/form boundary, and one acceptance slice; no new service,
  registry, queue, or provider integration.
- No Medusa Core modification: use supported extension/query, workflow, route,
  and storefront boundaries.
- Security/privacy: authenticated backend validation and runtime acceptance are
  `T3`; source/domain and storefront slices are `T2`.
- Evidence before done: T2/T3 tasks require full protocol, linked SDD specs,
  canonical packets, and `/verify`; T3 additionally requires semantic, human,
  and recovery evidence at execution/closure time.
- Conflicts/blockers: none for decomposition. Execution must stop if the installed
  Shipping Options boundary cannot provide configured values or if a truthful
  bounded length policy cannot be selected without changing product scope.

## Waves

| Wave | Task | Tier | Purpose |
|---|---|---|---|
| W1 | TASK-046 | T2 | Resolve and expose Admin/Shipping Options delivery options, stable IDs/order, and initial local tariffs. |
| W2 | TASK-047 | T3 | Implement authenticated backend normalization, validation, unavailable error, and downstream handoff. |
| W2 | TASK-048 | T2 | Implement storefront checkout fields, option/payment selection, tariff display, and recovery states. |
| W3 | TASK-049 | T3 | Verify the real authenticated backend/browser flow and prove no order/payment-provider mutation. |

## Expected Touched Files

- `apps/backend/src/checkout/**`
- `apps/backend/src/workflows/checkout/**`
- `apps/backend/src/api/store/checkout/**`
- `apps/backend/src/scripts/smoke-checkout-delivery-*.ts`
- `apps/backend/test/run-integration.cjs`
- `apps/backend/package.json`
- `apps/storefront/app/checkout/page.tsx`
- `apps/storefront/components/checkout-form.tsx`
- `apps/storefront/lib/checkout.ts`
- `apps/storefront/lib/checkout-state.ts`
- `apps/storefront/src/checkout-*.test.cjs`
- `apps/storefront/e2e/run-real-medusa-e2e.cjs`
- `apps/storefront/package.json`
- `.memory-bank/changelog.md`

## Implementation Steps

1. Confirm the installed Medusa v2.16 Shipping Options/Admin boundary and expose
   the three stable options in deterministic order with initial local values.
2. Add one authenticated backend validation boundary that normalizes input,
   applies bounded limits, validates required/conditional fields and stable
   payment IDs, resolves current option availability/tariff, and returns the
   transient FT-007 snapshot plus FT-009 payment ID.
3. Add storefront checkout form/state after the existing FT-004 gate. Render
   backend-provided options/tariffs, conditional address, field errors, payment
   IDs, unavailable recovery, and validated handoff state.
4. Prove backend and browser behavior through the real Windows-native Medusa,
   PostgreSQL, and storefront runtime with synthetic authenticated actors. Assert
   no order is created and no payment-provider request occurs.

## Tests And Quality Gates

- `npm --workspace apps/backend run test:integration -- checkout-delivery-options`
- `npm --workspace apps/backend run test:integration -- checkout-delivery`
- `npm --workspace apps/backend run test:integration -- checkout-delivery-acceptance`
- `npm --workspace apps/storefront run test -- checkout-form`
- `npm --workspace apps/storefront run test -- checkout-state`
- `npm --workspace apps/storefront run test:e2e -- checkout-delivery`
- `npm run typecheck`
- `npm run build`
- `node scripts/mb-lint.mjs`
- `node scripts/mb-doctor.mjs --strict`

## UAT Steps

1. Start the Windows-native local PostgreSQL, Medusa backend, and Next.js
   storefront using synthetic/local configuration.
2. Enter checkout as a synthetic `authenticated_ready` customer and confirm the
   three delivery options appear in the order pickup, city courier, transport
   company with tariffs `0`, `500`, and `700 RUB` from backend configuration.
3. Confirm missing name/email/phone/city is rejected; confirm address is required
   for courier and transport company but not pickup; confirm comment is optional.
4. Submit normalized whitespace and over-limit synthetic values and confirm the
   backend applies normalization then safe server-side limits without exposing
   raw input in logs/errors.
5. Make one delivery option unavailable in the local Admin/Shipping Options test
   setup; confirm `422 delivery_method_unavailable`, retry, and alternative
   selection behavior.
6. Select each of `card`, `sbp`, and `sberpay`; confirm the validated handoff
   exposes only the selected payment ID and no provider call is made.
7. Confirm the FT-007 snapshot contains validated contact/delivery data and tariff
   but no order is created, no inventory reservation is made, and no payment
   provider is invoked.

## Acceptance Coverage

| Requirement | Coverage |
|---|---|
| REQ-013 | TASK-047, TASK-048, TASK-049 |
| REQ-014 | TASK-047, TASK-048, TASK-049 |
| REQ-015 | TASK-046, TASK-047, TASK-048, TASK-049 |
| REQ-016 | TASK-046, TASK-047, TASK-049 |
| REQ-017 | TASK-047, TASK-048, TASK-049 |

## Handoff

- Decomposition closure is complete; no task execution or task-status decision
  is performed by this plan.
- Keep EP-003 planned: FT-007 and FT-008 remain downstream boundaries, and FT-009
  still owns provider integration after the FT-006 payment-ID handoff.
- TASK-046 has an authoritative scheduler `done` decision after the recorded
  provider/configuration blocker was resolved through the owner-approved bounded
  `apps/backend/medusa-config.ts` scope expansion and the required gates passed.
- TASK-047, TASK-048, and TASK-049 are scheduler-closed with their required
  functional and semantic evidence. This durable-plan reconciliation records the
  already-authoritative closure and does not change implementation scope.
- After all FT-006 tasks were implemented, the owner ran feature-level
  `/red-verify --feature FT-006`; its final report records
  `SEMANTIC_VERDICT: semantic-pass`.

## Scheduler Reconciliation

- The authoritative scheduler decisions are `TASK-046: done`, `TASK-047: done`,
  `TASK-048: done`, and `TASK-049: done`; their required protocols, packet/spec
  gates, execute gates, and independent verification all passed.
- The historical provider/configuration blocker and owner approval remain recorded in
  the TASK-046 verify history and protocol trail. The approved configuration expansion
  is limited to exposing the installed built-in manual provider for local
  Admin/Shipping Options evidence; the Admin-managed source and no-fallback boundary
  are unchanged.
- Direct dependents `TASK-047`, `TASK-048`, and `TASK-049` are `done`; their
  functional and semantic evidence is linked below.
- REQ-013 through REQ-017 and FT-006 are `verified` after the feature-level
  semantic gate. EP-003 remains `planned` because FT-007 and FT-008 are still
  downstream work.

### Evidence Navigation

- [TASK-046 authoritative record](../TASK-046.task.json)
- [TASK-047 authoritative record](../TASK-047.task.json)
- [TASK-048 authoritative record](../TASK-048.task.json)
- [TASK-049 authoritative record](../TASK-049.task.json)
- [TASK-046 canonical packet](../../packets/TASK-046.packet.json)
- [TASK-047 canonical packet](../../packets/TASK-047.packet.json)
- [TASK-048 canonical packet](../../packets/TASK-048.packet.json)
- [TASK-049 canonical packet](../../packets/TASK-049.packet.json)
- [TASK-046 execute STOP_REPORT](../../../.tasks/TASK-046/TASK-046-S-execute-stop-report-code-01.md)
- [TASK-046 execute evidence](../../../.tasks/TASK-046/TASK-046-S-execute-final-report-code-02.md)
- [TASK-046 functional verification](../../../.tasks/TASK-046/TASK-046-S-verify-final-report-docs-01.md)
- [TASK-046 sync report](../../../.tasks/TASK-046/TASK-046-S-MB-SYNC-final-report-docs-02.md)
- [TASK-046 protocol handoff](../../../.protocols/TASK-046/handoff.md)
- [TASK-046 protocol progress](../../../.protocols/TASK-046/progress.md)
- [TASK-046 protocol verification](../../../.protocols/TASK-046/verification.md)
- [TASK-049 final verification](../../../.tasks/TASK-049/TASK-049-S-VERIFY-final-report-docs-04.md)
- [TASK-049 semantic verification](../../../.tasks/TASK-049/TASK-049-S-RED-VERIFY-final-report-docs-02.md)
- [FT-006 feature semantic verification](../../../.tasks/FT-006/FT-006-S-RED-VERIFY-final-report-docs-01.md)
