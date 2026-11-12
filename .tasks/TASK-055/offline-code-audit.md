# TASK-055 — offline code audit

- Role: Explorer; read-only source audit, report exception authorized.
- Date: 2026-11-11.
- Scope: current dirty working implementation; no server, database, VPS, or provider was started or contacted. Existing changes preserved.
- Basis: AGENTS priming, TASK-055, FT-008 runtime/contract/state specs, project source and installed Medusa package source.
- Outcome: actionable correctness gaps; no runtime PASS claimed. User's offline override defers service-dependent evidence, not behavior requirements.

## Prioritized findings

1. **HIGH — stale logical metadata defeats native terminal guards.** `apps/backend/src/api/middlewares.ts`, `assertNativeLifecyclePrecondition`, selects `metadata.checkout_state` before native `order.status`, does not check the payment deadline, and does not reliably load capture evidence. Thus a canceled/completed native order retaining stale `pending_payment` can pass the pre-native payment guard; elapsed pending orders also pass before the expiry job runs. Minimal fix: native canceled/completed, FT-007 expiry origin/deadline, and authoritative captures/refunds take precedence; test stale projections and both race orderings offline.

2. **HIGH — paid orders can expire while projection is delayed.** `apps/backend/src/workflows/checkout/expire-pending-order.ts` loads only items and `isExpiredPendingOrder` (`apps/backend/src/checkout/pending-order.ts:419`) checks status/metadata only. After native capture, the order can still be native `pending` with stale `pending_payment`, so expiry cancels a paid order despite sharing a lock. Minimal fix: load linked native payment evidence under the same lock and exclude captured/paid orders independently of projection timing.

3. **BLOCKER — cross-module relations queried through Order module.** Middleware and `apps/backend/src/workflows/order-lifecycle/apply-order-lifecycle-transition.ts` call `orderModule.retrieveOrder` with `payment_collections`, nested payments, and `fulfillments`. Installed `node_modules/@medusajs/order/dist/models/order.js` has no such local relations, and `services/order-module-service.js:211` delegates retrieval to the module repository. Minimal fix: use registered Query graph for linked evidence, retain Order module for updates; service-free doubles should verify exact fields and relations rather than accepting an unrealistic DTO.

4. **BLOCKER — paid projection relies on nonexistent PaymentDTO.status.** Transition loader maps `payment.status`, and `apps/backend/src/order-lifecycle/projection.ts::isPaidPayment` recognizes only status strings. Installed `node_modules/@medusajs/types/dist/payment/common.d.ts:251..277` exposes `captured_at`, capture totals and capture records, no payment status. A real captured payment therefore cannot advance the logical state with the current loader. Minimal fix: derive paid from persisted capture evidence and/or authoritative collection status; test an installed-shaped payment with no status and nonzero captures.

5. **HIGH — lock may release before native async mutation finishes.** Middleware releases on `res.close`; client disconnection can occur while the native handler/workflow continues. `void release()` also leaves release failures unhandled. Minimal fix must preserve one lock family for the actual handler lifetime, including error/disconnect paths, with isolated lifecycle tests. Do not replace this with `locking.execute` without replacing every participating acquisition: installed PostgreSQL provider `execute` uses advisory transaction locks whereas `acquire`/`release` use the locking table, so identical keys across these APIs do not serialize each other. Existing `withOrderLifecycleLock` is currently unused but uses the incompatible `execute` family.

6. **MEDIUM/HIGH — subscriber completion/errors and out-of-order reconciliation.** `apps/backend/src/subscribers/order-lifecycle.ts` returns before `setImmediate` projection and logs failures outside subscriber ownership. Its comment claims awaiting projection deadlocks the local bus; installed `node_modules/@medusajs/event-bus-local/dist/services/event-bus-local.js` uses `EventEmitter.emit`, does not await listener promises, and already wraps async subscriber errors. Await projection inside the subscriber and test delayed/out-of-order paid/fulfillment/completion notifications. The pure projector currently requires each preceding metadata state, so delivery order can drop valid later transitions even when native records prove them.

## Additional observations

- Native admin auth is installed before custom middlewares in `node_modules/@medusajs/framework/dist/http/router.js`; absence of a second authenticate call in project Admin middleware is not by itself an auth bypass.
- Native captured event payload is `{ id: payment.id }`; fulfillment-created payload is `{ order_id, fulfillment_id, no_notification }`; current subscriber mapping matches those shapes.
- Subscriber currently picks the first order payment collection after matching any contained payment. Prefer selecting the collection actually containing the event payment, to maintain exact event binding for multiple collections.
- The integration alias and expiry smoke now include a compiled real-server launch (`runNativeAdminLifecycleSmoke`); these commands must be skipped under the current offline instruction, not run as pure tests.
- Full native authorization, DB/HTTP serialization, UI visibility, and deployment acceptance remain deferred. Pure tests cannot establish those properties.

## Handoff

Preliminary findings delivered to parent and `fix_lifecycle`; implementation owner is that agent. Suggested offline verification matrix: installed-shaped query/payments, stale terminal metadata, payment-deadline boundary, capture-before-expiry with delayed projector, terminal-before-payment, payment binding, duplicate/out-of-order projection, metadata-key preservation, disconnect/error/release rejection behavior. Re-review resulting source and service-free test results before any offline closure decision.
