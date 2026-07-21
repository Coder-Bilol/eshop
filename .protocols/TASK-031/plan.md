# TASK-031 Plan

- Tier: T3
- Task record: `.memory-bank/tasks/TASK-031.task.json`
- Packet context: `.memory-bank/packets/TASK-031.packet.json` R10, status `ready`

## Goal Interpretation

- Purpose: expose equal Google/VK login choices and complete authenticated cart
  readiness through existing provider boundaries.
- Success outcome: session-established completion reports merged or no-source truth,
  consumes the safe return path only in `authenticated_ready`, and keeps recoverable
  merge failure blocked with retry.
- Anti-goals: no backend/provider changes, no merge-semantic changes, no checkout,
  and no rendering of provider callback data, tokens, raw errors, or customer PII.
- Allowed write scope: the seven paths listed in TASK-031 runtime context, plus
  required `.protocols/TASK-031/` and `.tasks/TASK-031/` evidence/report artifacts.
- Forbidden scope: backend auth/provider code, FT-003 semantics, checkout/order/
  inventory/payment, and raw provider data or tokens.
- Stop conditions: existing provider handoffs cannot represent required truth,
  callback data must be rendered, or merge retry cannot preserve auth/source state.

## Boundary Notes

- Linked contracts: auth/session security, customer auth/session state, FT-003 UX,
  and cart access/security.
- Responsibility boundary: UI orchestrates existing Auth/Cart provider methods;
  backend owns identity/session and FT-003 owns merge/reference mutation.
- Boundary drift risk: treating a current-customer object, query parameter, or local
  flag as identity/merge proof, or consuming return state before readiness.

## Steps

1. Add login and fixed completion routes backed by scoped client components.
2. Add bounded login pending/failure/retry and completion cancel/failure states.
3. Resolve merged/no-source/merge-blocked truth through existing providers.
4. Add focused auth UI contract/orchestration/privacy tests and register the suite.
5. Run packet R7 UI tests, typecheck, build, and Memory Bank lint.
6. Record full T3 protocol, evidence, markers, and code-01 implementation report.

## Local Gates

- `npm --workspace apps/storefront run test -- auth-ui`
- `npm --workspace apps/storefront run typecheck`
- `npm --workspace apps/storefront run build`
- `node scripts/mb-lint.mjs`

## Ownership

- Scheduler/Reviewer owns `/verify`, `/red-verify`, lifecycle, dependent promotion,
  and `/mb-sync` after this implementation handoff.

## Retry 1/2 Plan

1. Fail closed unless the complete CartProvider handoff proves either a genuine
   no-source state or a validated restored ready target.
2. Move merge attempt ownership into a small component controller whose generation
   invalidates stale fulfillment on auth loss, retry supersession, and unmount.
3. Guard login/session/merge actions against duplicate invocation.
4. Replace helper/source-only confidence with deterministic controller tests using
   the existing Node test stack; add no browser or Playwright dependency.
5. Run packet R9 gates plus all storefront tests and record code-02 evidence.

## Retry 2/2 Plan

1. Recognize the real root CartProvider no-reference `null + idle` handoff only when
   operation, cart, and error are all null; retain the coherent `empty` terminal form.
2. Require merged readiness to have terminal `ready` state, no operation/error,
   matching target cart IDs, complete metadata, and outcome/replay/source-target
   relationships consistent with the FT-003 contract.
3. Add real cart-state/cart-merge composition fixtures plus hostile pending,
   errored, incomplete, and contradictory handoffs.
4. Preserve the existing controller invalidation, one-flight, return-path, and
   privacy behavior unchanged.
5. Run all packet R10 gates plus full storefront regression and diff check; record
   code-03 evidence and implementation handoff only.
