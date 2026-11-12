# Offline continuation plan

- Role: Explorer
- Date: 2026-11-11
- User basis: continue delegated development without VPS access or any local server; real-server requirements may be ignored for continued development.
- Scope: read-only exploration; only this report was written. No services or databases were started and no verification result was fabricated.

## Immediate actionable defect: fail-open suite selection

`apps/storefront/e2e/run-real-medusa-e2e.cjs:2886` recognizes only catalog, product-detail, cart, auth, wishlist, checkout-delivery, and pending-order. The required TASK-057 argument `order-lifecycle-admin` is unknown. `selectSuites()` silently replaces an all-unknown request with catalog/product-detail. Mixed known/unknown arguments silently drop unknown suites. This can produce unrelated successful evidence for an unimplemented acceptance gate, while starting local services unexpectedly.

`apps/backend/test/run-integration.cjs:49` also filters unknown suite names and silently drops them from mixed known/unknown requests. An all-unknown request already throws. Planned `order-admin-visibility` and `order-lifecycle-acceptance` suites do not exist yet.

### Minimal implementation scope

- `apps/storefront/e2e/run-real-medusa-e2e.cjs`: reject every supplied unknown name before building, seeding, artifact invalidation, or starting processes. Preserve no-argument default and stable deduplication.
- `apps/backend/test/run-integration.cjs`: reject every supplied unknown name before any suite executes. Preserve no-argument behavior.
- A small regression script under an owner-approved test path; avoid generic new test infrastructure. It may run runner processes with invalid arguments only, or expose the selectors under a main guard to test valid/default selection without running suites.
- If changed, storefront unit runner is also affected by silent filtering (`apps/storefront/src/test-runner.cjs`); fixing it is useful but outside TASK-057's current write scope and should receive explicit owner scope inclusion.

### Regression cases

1. Browser `order-lifecycle-admin` fails with a precise unsupported-suite error until implemented; never starts catalog/product-detail instead.
2. Browser `catalog typographical-error` fails before any work.
3. Backend `order-lifecycle-state typographical-error` fails before the pure suite runs.
4. Backend all-unknown suite fails.
5. Empty arguments retain documented defaults (test selector directly, do not run real suites).
6. Repeated known names preserve order and run once (test selector directly).
7. Failures create no new success artifacts, processes, ports, fixture ledger, or database accesses. Error wording contains requested suite names and supported list without secrets.

## TASK-056: useful installed Admin contract preparation

This task primarily verifies existing native Medusa features, so a custom Admin component or parallel read model is unnecessary. Its planned `apps/backend/src/scripts/smoke-order-admin-visibility.ts` is absent. Build a separate explicitly offline contract check that reads the installed package source (no database, HTTP listener, auth session, or browser):

- Read `node_modules/@medusajs/dashboard/src/routes/orders/order-detail/constants.ts`; verify DEFAULT_PROPERTIES includes email/status/total/metadata and DEFAULT_RELATIONS requests customer, items/variant/product, shipping address/methods, payment collections/payments/refunds, and fulfillments.
- Read `.../order-detail/order-detail.tsx`; verify DEFAULT_FIELDS usage, `showMetadata`, and `showJSON`.
- Read `node_modules/@medusajs/dashboard/src/hooks/api/payment-collections.tsx`; verify native `sdk.admin.paymentCollection.markAsPaid(paymentCollectionId, payload)`.
- Read `node_modules/@medusajs/dashboard/src/hooks/api/orders.tsx`; verify native `sdk.admin.order.cancel(orderId)`.
- Locate the installed metadata-editor route declaration using `rg` and assert its registration, rather than inventing a custom screen.
- Assert installed package version 2.16.0 to fail clearly on an unsupported package layout. Record source filenames/version in sanitized output.

Preferred exact source scope: `apps/backend/src/scripts/smoke-order-admin-visibility.ts`, backend runner and backend package scripts, plus TASK-056 protocol. Use an explicit distinct suite such as `order-admin-visibility-contract`, truthfully marked `sourceBoundary: installed-medusa-admin-source-contract`, `runtimeVerified: false`. Keep `order-admin-visibility` reserved for eventual real runtime checks; never alias it to source inspection. Parent must approve this narrow scope/spec adjustment and packet refresh before implementation.

Source assertions prove the installed UI/API wiring and request field availability only. They do not prove a real order payload, rendered field presence, native authorization, inventory mutation, or protected metadata requests.

## Checks available without services

- `npm --workspace apps/backend run smoke:order-lifecycle-state`: pure TS lifecycle smoke through `runPureNodeScript`, no Medusa boot.
- `npm run typecheck`: workspace compilation checks, no listener/database.
- `npm --workspace apps/storefront run test`: existing in-process fixture/request-double tests; inspect any future new suite before adding it.
- `npm run build`: compile-only workflow; no explicit database server launch, but parent should confirm Next.js build fetch behavior if its network isolation is important.
- `node scripts/mb-lint.mjs`, `node scripts/mb-doctor.mjs --strict`, `git diff --check`: documentation/queue/diff checks.
- New fail-closed runner regression check and installed-source contract check as described above.

Do NOT invoke `npm --workspace apps/backend run test:integration -- order-lifecycle`: current dirty runner chains pure smoke with `smoke-pending-order-expiry.ts`, and that script starts compiled Medusa (`startCompiledMedusa`, around line 454), opens a local listener to select a port, and accesses PostgreSQL. Do NOT invoke any real E2E runner or default integration command.

## Dependencies and closure

Implement TASK-055 correctness fixes and offline harness coverage first. TASK-056 installed-contract preparation can then be implemented without services. TASK-057 can fix CLI selection and prepare acceptance source, but complete operator/browser proof remains intentionally unexecuted. The source/contract checks should be PASS only for their explicit offline scope. Parent should durably record waived runtime execution separately from unchanged security/state semantics. Existing task/feature statuses must not imply real-runtime verification that did not occur.

No source code or task state was changed by this exploration.
