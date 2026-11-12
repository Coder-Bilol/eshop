# TASK-055 lock boundary exploration — 2026-11-12

Role: Explorer, read-only source inspection. No services, DB, VPS or source edits.

## Recommendation

Do not repurpose the global tracing hook as an invisible correctness dependency.
The installed Medusa 2.16 middleware contract does not expose the downstream
handler promise. The existing finish-only lock is not full-handler serialization.
This is a small integration design conflict, not missing runtime evidence.

`ApiLoader.traceRoute` can technically supply `await handler(req, res)` plus
`finally`, including after socket disconnect. It is exported and typed, but its
explicit contract is instrumentation. Native `instrumentHttpLayer()` assigns the
same global static slot for OTEL, so registration order can silently remove a
business lock wrapper. There is no existing project instrumentation file. Using
this slot for payment correctness would require deliberate owner-approved spec
revision and hook-composition/entrypoint guarantees; it is not the promised
supported project middleware solution. No wrapper registry is warranted.

Native workflow hooks are not a simpler full-operation substitute: mark-as-paid
and refund workflows have no matching surrounding hook pair; cancel exposes
post-mutation `orderCanceled`, completion post-mutation `ordersCompleted`. They
cannot acquire before every mutation and release after handler settlement.

Smallest conventional alternative, if owner revises the current prohibition:
same-path project route files delegate to installed native handlers inside one
shared `try/finally` lock helper, retaining native auth/validators/workflows.
This changes the currently forbidden replacement-Admin-route boundary and must
not be silently implemented. Existing middleware must not acquire a second lock
around such delegation. Lease expiration must also not release a still-running
handler; finally alone does not solve the existing 120-second expiry.

Within the current unchanged scope, keep TASK-055 open and record this exact
decision rather than add tracing monkeypatches, response interception, timers,
or a custom queue. Offline server waiver does not authorize a new API boundary.

## Installed evidence

- `node_modules/@medusajs/framework/dist/http/router.d.ts`: traceRoute is a
  wrapper explicitly documented for instrumentation.
- `node_modules/@medusajs/framework/dist/http/router.js`: registration applies
  traceRoute to the actual route before the framework await/error wrapper.
- `node_modules/@medusajs/framework/dist/http/utils/wrap-handler.js`: awaits the
  handler; ordinary middleware `next()` is not that promise.
- `node_modules/@medusajs/medusa/dist/instrumentation/index.js`: instrumentHttpLayer
  overwrites ApiLoader.traceRoute for OTEL.
- `node_modules/@medusajs/medusa/dist/commands/start.js`: optional root
  instrumentation register() runs at startup, before loading routes.
- Native mark-as-paid handler awaits native workflow and refetch before sending
  response. Workflow source hooks above are post-mutation or absent.

Verdict: OWNER_DESIGN_DECISION_NEEDED; no supported full-handler middleware
solution found in the installed interfaces inspected.
