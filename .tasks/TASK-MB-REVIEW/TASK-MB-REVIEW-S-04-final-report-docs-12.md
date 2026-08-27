# TASK-MB-REVIEW S-04 Final Report

Task: TASK-MB-REVIEW  
Stage: S-04  
Reviewer: Security  
Artifact type: docs  
Review mode: read-only post-remediation review of FT-008

## Verdict scope

Security design/remediation gate for FT-008 is approved. This is not approval of runtime implementation or feature closure: FT-008 is still planned, TASK-054 is `ready`, TASK-055..057 are `planned`, and the corresponding runtime proof remains part of those tasks. No task status, source file, packet, or protocol state was changed during this review.

## Scope and evidence

Read and reconciled the governing Memory Bank, FT-008 linked feature/architecture/contract/data/state specs, system architecture, requirements, invariants, API boundary map, testing index, pending-order runtime/data docs, local-development runbook, tier policy, FT-008 plan and protocol, TASK-054..057 records and packets, current review request, and the existing implementation/configuration inventory.

Relevant evidence:

- `.memory-bank/contracts/order-lifecycle-admin-api.md`
- `.memory-bank/architecture/order-lifecycle-admin-runtime.md`
- `.memory-bank/domains/order-lifecycle-admin-data.md`
- `.memory-bank/states/order-lifecycle-admin.md`
- `.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md`
- `.memory-bank/tasks/plans/IMPL-FT-008.md`
- `.memory-bank/tasks/TASK-054.task.json` through `TASK-057.task.json` and their canonical packets
- `apps/backend/src/api/store/checkout/order/route.ts`, `apps/backend/src/api/middlewares.ts`, `apps/backend/medusa-config.ts`, `apps/backend/package.json`
- installed native Medusa 2.16 dependency sources under `node_modules/@medusajs/medusa`, `@medusajs/framework`, and `@medusajs/dashboard` (static compatibility evidence only; not modified)

The FT-008 implementation paths named by the plan are not present: `apps/backend/src/order-lifecycle`, the lifecycle transition workflow, lifecycle subscriber, and lifecycle smoke scripts all resolve to `False`. `apps/backend/package.json` has no FT-008 script. Therefore runtime claims below are explicitly separated from design guarantees.

## Security review

| Check | Result | Evidence and boundary |
|---|---|---|
| Server-side authorization and source/caller binding | PASS at design gate; runtime pending | The contract forbids public JSON and mutable caller/source; `caller: "native_admin_event"` is created only by private server-side entrypoints bound to a native Admin operation. The server re-reads the native order/payment under lock and fails closed for forged caller/source, missing Admin context, or event mismatch (`.memory-bank/contracts/order-lifecycle-admin-api.md:19-48`, `90-101`). This directly resolves the former declarative `source` gap. TASK-055 carries the T3 implementation and negative-test obligation (`.memory-bank/tasks/TASK-055.task.json`). |
| Native Admin session/RBAC | PASS at design/dependency boundary; runtime pending | FT-008 delegates mutation to native Admin and its authenticated actor context, not a custom Admin surface (`.memory-bank/architecture/order-lifecycle-admin-runtime.md:39-55`, `.memory-bank/contracts/order-lifecycle-admin-api.md:90-101`). Installed Medusa 2.16 native routes bind `mark-as-paid` and cancel operations to `req.auth_context.actor_id` and apply `payment_collection:update` / `order:update` policies (`node_modules/@medusajs/medusa/dist/api/admin/payment-collections/[id]/mark-as-paid/route.js:11-21`, `.../payment-collections/middlewares.js:75-90`, `node_modules/@medusajs/medusa/dist/api/admin/orders/[id]/cancel/route.js:11-23`, `.../orders/middlewares.js:140-152`). Framework auth rejects missing authentication and permission middleware rejects insufficient policy (`node_modules/@medusajs/framework/dist/http/middlewares/authenticate-middleware.js:11-56`, `node_modules/@medusajs/framework/dist/http/middlewares/check-permissions.js:35-56`). |
| Cross-order payment binding | PASS in normative design; runtime pending | The payment collection must belong to the same re-read order; cross-order identifiers, forged/mismatched event context, and unauthorized context are rejected with no mutation (`.memory-bank/contracts/order-lifecycle-admin-api.md:70-84`, `.memory-bank/states/order-lifecycle-admin.md:42-56`). TASK-055 explicitly requires this T3 negative path (`.memory-bank/tasks/TASK-055.task.json`). No current FT-008 runtime exists to claim execution evidence. |
| Store/browser mutation rejection | PASS for current boundary; runtime negative test pending | The contract exposes no Store lifecycle endpoint and no return-page authority (`.memory-bank/contracts/order-lifecycle-admin-api.md:13-17`, `.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md:93-101`). The current Store route is authenticated checkout creation only: it derives the customer actor and returns a pending order/payment selection, not a lifecycle mutation (`apps/backend/src/api/middlewares.ts:48-55`, `apps/backend/src/api/middlewares.ts:127-132`, `apps/backend/src/api/store/checkout/order/route.ts:28-56`). The route inventory has no custom lifecycle route. |
| Replay, contradictory event, and no-op safety | PASS in normative design; runtime pending | Repeated transition to the already-current target is an explicit no-op (`changed: false`); contradictory, forged, late, canceled/expired, and missing-Admin-context events fail closed without mutation (`.memory-bank/contracts/order-lifecycle-admin-api.md:50-84`, `.memory-bank/states/order-lifecycle-admin.md:42-56`). The manual profile has no provider replay surface; `native_event_id` is bounded audit context, not browser/provider authority. TASK-055 requires duplicate/no-op evidence. |
| Reservation, stock, refund, and privacy safety | PASS in normative design; runtime pending | Payment confirmation leaves the reservation hold intact; native fulfillment consumes it; FT-008 never deletes reservations or directly changes stock. Unpaid cancellation delegates release to FT-007, while refund does not auto-restock (`.memory-bank/architecture/order-lifecycle-admin-runtime.md:57-67`, `.memory-bank/domains/order-lifecycle-admin-data.md:40-56`). Audit metadata is bounded to actor/event/operation identifiers and excludes provider payloads, credentials, and unnecessary PII (`.memory-bank/contracts/order-lifecycle-admin-api.md:90-101`, `.memory-bank/domains/order-lifecycle-admin-data.md:54-56`). |
| Post-payment cancellation path | PASS | The remediated lifecycle explicitly permits cancellation only while unpaid; paid/processing/completed orders cannot transition to canceled and require native Admin refund instead (`.memory-bank/architecture/order-lifecycle-admin-runtime.md:39-55`, `.memory-bank/states/order-lifecycle-admin.md:24-42`, `.memory-bank/tech-specs/FT-008-order-lifecycle-admin-visibility.md:53-68`). This resolves the former ambiguous/unsafe paid-cancel finding. |
| Provider credentials and calls in current manual profile | PASS / no finding | The current backend config contains the native modules and manual fulfillment only; no payment provider or YooKassa module/call is configured (`apps/backend/medusa-config.ts:179-213`). Source inventory contains no FT-008 provider integration. `YOOKASSA_*` values occur only as local placeholder entries in `.env.example` and `apps/backend/.env.example` (for example `apps/backend/.env.example:26-29`); no actual credential was observed. Storefront E2E references to provider names are rejection/assertion guards, not provider calls (`apps/storefront/e2e/run-real-medusa-e2e.cjs:941`, `1116`, `1198`). |

## Threat-model conclusion

The untrusted browser/buyer boundary is now explicit: the browser can create its own authenticated pending checkout, but cannot assert payment, actor, lifecycle source, payment state, fulfillment, or order ownership. The trusted mutation boundary is the native Medusa Admin session/RBAC operation, with server-side re-read, same-order payment binding, fixed private event mapping, bounded audit metadata, and fail-closed mismatch handling.

The design also keeps the high-impact domains separated: FT-007 owns pending-order expiry and reservation release; FT-008 owns the post-Admin lifecycle projection and guards; native Medusa owns Admin payment/order authority; future provider/webhook work remains FT-009. No custom public route, custom Admin replacement, direct stock mutation, provider secret use, raw provider payload, or new PII log path was introduced by the current worktree.

## Residual execution condition

The approval is limited to the remediated security design and its task handoff. Before FT-008 can be considered implemented or production-ready, TASK-055..057 must provide the planned T3 runtime tests/evidence for Admin auth context, source/caller binding, cross-order rejection, Store/browser rejection, replay/no-op, reservation invariants, metadata/privacy, and manual-profile no-provider behavior. This is a verification condition already recorded in the task records and does not change their statuses here.

No P1/P2 security design blocker remains in the reviewed post-remediation FT-008 materials.

VERDICT: APPROVE
