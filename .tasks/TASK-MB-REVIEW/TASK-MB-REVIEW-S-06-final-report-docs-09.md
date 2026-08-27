# TASK-MB-REVIEW S-06 Code Quality Review: FT-006

Scope: scoped code review of FT-006 checkout delivery methods code quality, not red-verify. Reviewed backend checkout delivery option/tariff/validation/workflow/route code, storefront checkout page/form/client/state code, relevant tests/acceptance harness, FT-006 specs, and task reports.

## Reviewed Inputs

- Constitution: `.memory-bank/constitution.md`
- FT-006 specs: `.memory-bank/tech-specs/FT-006-checkout-delivery-methods.md`, `.memory-bank/architecture/checkout-delivery-runtime.md`, `.memory-bank/contracts/checkout-delivery-api.md`, `.memory-bank/domains/checkout-delivery-data.md`, `.memory-bank/states/checkout-delivery-validation.md`
- Plan/reports: `.memory-bank/tasks/plans/IMPL-FT-006.md`, `.tasks/TASK-046/*`, `.tasks/TASK-047/*`, `.tasks/TASK-048/*`, `.tasks/TASK-049/*`, `.tasks/FT-006/FT-006-S-RED-VERIFY-final-report-docs-01.md`
- Backend code: `apps/backend/src/checkout/*`, `apps/backend/src/workflows/checkout/validate-checkout.ts`, `apps/backend/src/api/store/checkout/*`, `apps/backend/src/api/middlewares.ts`
- Storefront code: `apps/storefront/app/checkout/page.tsx`, `apps/storefront/components/checkout-form.tsx`, `apps/storefront/lib/checkout.ts`, `apps/storefront/lib/checkout-state.ts`
- Tests/harness: `apps/backend/src/scripts/smoke-checkout-delivery*.ts`, `apps/storefront/src/checkout-*.test.cjs`, `apps/storefront/e2e/run-real-medusa-e2e.cjs`

## Findings

No blocking findings.

## Evidence

- KISS and API -> Workflows -> Modules are preserved. The route parses/authenticates and delegates to one workflow at `apps/backend/src/api/store/checkout/route.ts:43-53`; the workflow only resolves options and returns a transient snapshot at `apps/backend/src/workflows/checkout/validate-checkout.ts:58-82`. Tariff projection remains in small checkout modules, not a parallel service or Medusa Core fork, at `apps/backend/src/checkout/delivery-options.ts:42-52` and `apps/backend/src/checkout/delivery-tariffs.ts:32-53`.
- Tariff authority is Shipping Options / linked price-set data, with fail-closed behavior. Runtime options are loaded through `Modules.FULFILLMENT.listShippingOptionsForContext` at `apps/backend/src/checkout/delivery-options.ts:55-76`; price links are read through `LINKS.ShippingOptionPriceSet` remote query at `apps/backend/src/checkout/delivery-tariffs.ts:38-51`; tariff projection accepts exactly one unrestricted RUB price and returns `null` for missing/ambiguous/invalid data at `apps/backend/src/checkout/delivery-tariffs.ts:56-77`. The public projection marks an option available only when source option, flat price type, enabled provider, and tariff are all present at `apps/backend/src/checkout/delivery-options.ts:100-123`.
- Stable delivery IDs/order and stable payment IDs match the FT-006 contract. Backend delivery IDs are `pickup`, `city_courier`, `transport_company` at `apps/backend/src/checkout/delivery-options.ts:11-17`; payment IDs are `card`, `sbp`, `sberpay` at `apps/backend/src/checkout/validation.ts:6-8`. Storefront mirrors the same IDs at `apps/storefront/lib/checkout.ts:1-11`.
- Backend actor guard is authoritative and client identity is not accepted. The route derives `customer_id` from `req.auth_context` and rejects non-customer/missing actors with `401 checkout_auth_required` at `apps/backend/src/api/store/checkout/route.ts:67-84`; middleware applies checkout authentication on `/store/checkout` at `apps/backend/src/api/middlewares.ts:125-127`; public response strips `customer_id` at `apps/backend/src/api/store/checkout/route.ts:59-64`. Client-supplied unknown fields are rejected by request shape validation at `apps/backend/src/checkout/validation.ts:66-78`.
- Validation and error state are consistent. Backend normalizes before length checks at `apps/backend/src/checkout/validation.ts:121-169`, enforces required name/email/phone/city, conditional address, email syntax, delivery selection, and payment selection at `apps/backend/src/checkout/validation.ts:79-117`. Unavailable delivery uses exact `422 delivery_method_unavailable` at `apps/backend/src/workflows/checkout/validate-checkout.ts:40-49` and `apps/backend/src/workflows/checkout/validate-checkout.ts:63-67`; route error mapping sanitizes known validation/unavailable failures and otherwise returns `checkout_failed` at `apps/backend/src/api/store/checkout/route.ts:87-130`.
- Storefront state does not claim local success without backend validation. The checkout controller transitions to `checkout_validated` only after `options.client.validate` resolves at `apps/storefront/lib/checkout-state.ts:147-182`; unavailable delivery maps to `delivery_method_unavailable`, validation failures map to `checkout_invalid`, and unexpected failures map to `checkout_failed` at `apps/storefront/lib/checkout-state.ts:183-198`. Tariff display is populated from the successful backend result for the selected method at `apps/storefront/lib/checkout-state.ts:172-180`, and the form labels that tariff source as backend at `apps/storefront/components/checkout-form.tsx:209-228`.
- Checkout page/form gate is consistent with FT-004/FT-006 boundary. The page renders the auth gate plus continuation at `apps/storefront/app/checkout/page.tsx:4-10`; the continuation waits for the existing `authenticated_ready` DOM marker before rendering the form at `apps/storefront/components/checkout-form.tsx:29-52`. This is a UI gate only; backend auth remains enforced as noted above.
- Hidden mutation/provider calls were not found in the FT-006 validation path. The FT-006 route calls only `validateCheckoutWorkflow` at `apps/backend/src/api/store/checkout/route.ts:43-53`; the workflow creates no order, reservation, payment collection, or provider request at `apps/backend/src/workflows/checkout/validate-checkout.ts:52-92`. The current storefront component also contains a downstream FT-007 pending-order action via `checkoutClient.createPendingOrder` at `apps/storefront/components/checkout-form.tsx:88-125`, but that call is explicit, guarded by a validated handoff, and targets separate `/store/checkout/order` client code at `apps/storefront/lib/checkout.ts:224-231`, not the FT-006 validation endpoint.
- Tests and acceptance harness cover the review concerns. TASK-046 verification reports Admin Shipping Options source, linked price-set source, deterministic order/tariffs, fail-closed projection, and no runtime constants/provider calls at `.tasks/TASK-046/TASK-046-S-verify-final-report-docs-01.md:20-24`. TASK-047 verification reports auth, validation, stable IDs, unavailable `422`, no mutation counts, and sanitized errors at `.tasks/TASK-047/TASK-047-S-VERIFY-final-report-docs-03.md:27-60`. TASK-048 verification reports storefront gate, fields, backend tariff display, recovery states, and no browser-authoritative checkout success at `.tasks/TASK-048/TASK-048-S-VERIFY-final-report-docs-01.md:44-58`. TASK-049 verification reports real backend/browser acceptance, unchanged order/payment/reservation counts, `forbiddenRequestCount: 0`, and sanitized artifacts at `.tasks/TASK-049/TASK-049-S-VERIFY-final-report-docs-04.md:17-33`.

## Risk Notes

- The current checkout form has FT-007 pending-order UI in the same component as FT-006 form state. This is acceptable for current integrated checkout code, but future reviews should keep evidence scoped: FT-006 validation remains `/store/checkout`; order creation belongs to `/store/checkout/order`.
- The E2E harness is large and multi-feature. It is operationally heavier than ideal KISS unit coverage, but the FT-006 slice is explicitly selectable and publishes checkout-specific artifacts, so this is not a Constitution violation.

## Constitution Check

- No Medusa Core modification found.
- No enterprise abstraction, custom delivery provider, custom tariff registry, durable checkout snapshot table, or external carrier/payment integration found in FT-006 validation code.
- Security/privacy and payment correctness boundaries are respected by backend actor validation, sanitized public errors, transient handoff, and no order/payment/provider mutation inside FT-006.
- Evidence-before-done is satisfied by the referenced PASS reports and feature semantic report; this review did not rerun gates because the request was scoped code review.

VERDICT: APPROVE
